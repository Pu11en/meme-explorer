#!/bin/bash
# Weekly self-improving analyst — the autonomous brain, on a leash.
#
# Runs unattended (launchd, weekly). It:
#   1. Refuses to run unless the pipeline is provably idle and the tree is clean.
#   2. Snapshots the deterministic baseline score (weekly_eval).
#   3. Works in an ISOLATED git worktree (never touches main / the live tree).
#   4. Runs a bounded, cheap `claude -p` (Sonnet, timeout, Read+Edit only) that
#      may edit ONLY scripts/dev_ledger.py, at most one small change, and is told
#      "no change" is a good outcome.
#   5. Runs the safety gate. If it passes, the candidate stays on a branch for
#      HUMAN review (never auto-merged to the live main). Otherwise it's dropped.
# All actions and any auth failures are logged to STATE_DIR for you to read via a
# session later. Self-cleaning: removes its worktree and prunes old branches.
set -u

REPO=/Users/drewp/Developer/meme-explorer
PY=/usr/bin/python3
CLAUDE=/Users/drewp/.local/bin/claude
STATE_DIR="$HOME/Library/Application Support/MemeExplorer/self-improve"
PIPELINE_LOCK="$HOME/Library/Application Support/MemeExplorer/pipeline/.pipeline.lock"
mkdir -p "$STATE_DIR"
LOG="$STATE_DIR/analyst.log"
DATE=$(date +%Y%m%d-%H%M)
WT="$STATE_DIR/wt-$DATE"
BRANCH="self-improve/$DATE"
KEEP_BRANCH=0

log(){ echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }
cleanup(){
  cd "$REPO" 2>/dev/null || return
  git worktree remove --force "$WT" 2>/dev/null
  git worktree prune 2>/dev/null
  if [ "$KEEP_BRANCH" -eq 0 ]; then
    git branch -D "$BRANCH" 2>/dev/null
  fi
}
trap cleanup EXIT

log "=== weekly analyst start ($DATE) ==="
cd "$REPO" || { log "FATAL: cannot cd $REPO"; exit 1; }

# 1. Only run when the pipeline is provably idle. We work in an isolated worktree
#    (a clean checkout of main), so the primary tree's many permanently-untracked
#    batch files don't matter — we only guard against a commit being mid-flight
#    (staged-but-uncommitted) plus the lock and a recent-commit cooldown.
if [ -f "$PIPELINE_LOCK" ]; then log "ABORT: pipeline lock present (recording active)"; exit 0; fi
if ! git diff --cached --quiet; then log "ABORT: staged changes present (a commit may be mid-flight)"; exit 0; fi
LASTCOMMIT=$(git log -1 --format=%ct 2>/dev/null || echo 0)
NOW=$(date +%s)
if [ $((NOW - LASTCOMMIT)) -lt 1800 ]; then log "ABORT: a commit landed <30min ago (pipeline may be finishing)"; exit 0; fi
CUR_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CUR_BRANCH" != "main" ]; then log "ABORT: repo not on main (on $CUR_BRANCH)"; exit 0; fi

# 2. Frozen baseline score (deterministic, read-only).
$PY scripts/weekly_eval.py --quiet >>"$LOG" 2>&1
cp analysis/weekly-scorecard.json "$STATE_DIR/baseline-scorecard-$DATE.json" 2>/dev/null

# 3. Isolated worktree off main — main's HEAD/tree are never touched.
git worktree prune
if ! git worktree add -b "$BRANCH" "$WT" main >>"$LOG" 2>&1; then
  log "FATAL: worktree add failed"; exit 1
fi

# 4. Bounded, cheap, tightly-scoped model run.
PROMPT='You are improving ONLY the wallet-ranking logic in scripts/dev_ledger.py of this repo.

Read analysis/weekly-scorecard.json (the current performance) and scripts/dev_ledger.py.
Consider ONE small, safe improvement to how devs are scored/ranked so the watchlist better
surfaces wallets whose coins are actually profitable (realistic return, not best-case).

STRICT RULES:
- Edit ONLY scripts/dev_ledger.py. Touching any other file (tests, eval, gate, pipeline,
  plists, scorecard) fails the safety gate and wastes the run.
- At MOST one small change. Prefer NO change: if not confident it is a real improvement,
  edit nothing and explain why. "NO CHANGE" is a good, expected outcome most weeks.
- Do not loosen filters just to increase counts. Do not remove safety code (locks, atomic
  writes, pruning, corruption handling, Wilson bound). Keep it minimal and readable.

End your reply with either a one-paragraph summary of the single change and WHY, or "NO CHANGE" and why.'

CLAUDE_OUT="$STATE_DIR/claude-out-$DATE.txt"
( cd "$WT" && timeout 900 "$CLAUDE" -p "$PROMPT" \
    --model sonnet \
    --permission-mode acceptEdits \
    --allowedTools "Read" "Edit" ) > "$CLAUDE_OUT" 2>&1
CL=$?
[ $CL -eq 124 ] && log "WARN: claude timed out (900s)"
if grep -qiE 'invalid api key|unauthorized|authentication|please run .?login|expired|not logged in' "$CLAUDE_OUT"; then
  log "ALERT: possible claude auth failure — inspect $CLAUDE_OUT and re-authenticate"
fi

# 5. Safety gate (canonical gate script from main; enforces scope + tests + health).
bash "$REPO/scripts/self_improve_gate.sh" "$WT" main >>"$LOG" 2>&1
G=$?
if [ $G -eq 0 ]; then
  ( cd "$WT" && git add scripts/dev_ledger.py \
      && git commit -m "self-improve $DATE: candidate finder change (gated; needs human review)

Passed the safety gate (scope+tests+health). NOT auto-merged — review the diff
and merge into main only if you agree it is a real improvement.

Co-Authored-By: Claude (weekly analyst) <noreply@anthropic.com>" ) >>"$LOG" 2>&1
  KEEP_BRANCH=1
  log "KEPT branch $BRANCH — passed gate; review & merge when you return"
  log "  summary: $(tail -n 3 "$CLAUDE_OUT" | tr '\n' ' ' | cut -c1-300)"
elif [ $G -eq 3 ]; then
  log "NO CHANGE this week (analyst made no edit) — this is fine"
else
  log "REVERTED: candidate failed the safety gate (exit $G) — dropped"
fi

# 6. Hygiene: drop unmerged self-improve branches older than 60 days.
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/self-improve 2>/dev/null); do
  [ "$b" = "$BRANCH" ] && [ "$KEEP_BRANCH" -eq 1 ] && continue
  ct=$(git log -1 --format=%ct "$b" 2>/dev/null || echo "$NOW")
  if [ $((NOW - ct)) -gt 5184000 ]; then git branch -D "$b" 2>/dev/null && log "pruned old branch $b"; fi
done

log "=== weekly analyst done (gate=$G, kept=$KEEP_BRANCH) ==="
exit 0
