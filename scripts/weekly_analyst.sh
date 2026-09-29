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
G=na

LOCKDIR="$STATE_DIR/.analyst.lock"
ALERTS="$STATE_DIR/ALERTS.txt"
log(){ echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }
alert(){ echo "[$(date -u +%FT%TZ)] $*" >> "$ALERTS"; log "ALERT: $*"; }
# Portable wall-clock bound. macOS has no GNU `timeout`. Prefer it if present,
# else run the command in its OWN process group and kill the whole group on
# timeout (so claude's node/tool child processes can't be orphaned and keep
# burning tokens). `set -m` puts the backgrounded job in its own pgroup.
bounded(){
  local secs=$1; shift
  if command -v timeout >/dev/null 2>&1; then timeout -k 30 "$secs" "$@"; return $?; fi
  if command -v gtimeout >/dev/null 2>&1; then gtimeout -k 30 "$secs" "$@"; return $?; fi
  set -m
  "$@" &
  local pid=$!
  ( sleep "$secs"; kill -TERM -"$pid" 2>/dev/null; sleep 10; kill -KILL -"$pid" 2>/dev/null ) 2>/dev/null &
  local killer=$!
  local rc=0
  wait "$pid" 2>/dev/null || rc=$?
  kill "$killer" 2>/dev/null; wait "$killer" 2>/dev/null
  set +m
  return $rc
}
cleanup(){
  cd "$REPO" 2>/dev/null || return
  git worktree remove --force "$WT" 2>/dev/null
  git worktree prune 2>/dev/null
  if [ "$KEEP_BRANCH" -eq 0 ]; then
    git branch -D "$BRANCH" 2>/dev/null
  fi
  rmdir "$LOCKDIR" 2>/dev/null
}
trap cleanup EXIT INT TERM

log "=== weekly analyst start ($DATE) ==="
cd "$REPO" || { log "FATAL: cannot cd $REPO"; exit 1; }

# Self-mutex: refuse to run if another analyst is active. Steal a stale lock
# (>2h old) left by a SIGKILLed run so the loop can't wedge permanently.
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  if [ -n "$(find "$LOCKDIR" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
    log "stale lock (>2h) — reclaiming"; rmdir "$LOCKDIR" 2>/dev/null; mkdir "$LOCKDIR" 2>/dev/null
  else
    log "ABORT: another analyst run is active"; exit 0
  fi
fi

# Sweep orphaned worktree dirs from prior SIGKILLed runs (trap can't run on -9).
git worktree prune 2>/dev/null
find "$STATE_DIR" -maxdepth 1 -type d -name 'wt-*' -mmin +1440 2>/dev/null | while read -r old; do
  git worktree remove --force "$old" 2>/dev/null; rm -rf "$old" 2>/dev/null
done

# 1. Only run when the pipeline is provably idle. We work in an isolated worktree
#    (a clean checkout of main), so the primary tree's many permanently-untracked
#    batch files don't matter — we only guard against a commit being mid-flight
#    (staged-but-uncommitted) plus the lock and a recent-commit cooldown.
if [ -f "$PIPELINE_LOCK" ]; then log "ABORT: pipeline lock present (recording active)"; exit 0; fi
if ! git diff --cached --quiet; then log "ABORT: staged changes present (a commit may be mid-flight)"; exit 0; fi
LASTCOMMIT=$(git log -1 --format=%ct 2>/dev/null || echo 0)
NOW=$(date +%s)
COOLDOWN=${ANALYST_COMMIT_COOLDOWN:-1800}   # overridable for testing
if [ $((NOW - LASTCOMMIT)) -lt "$COOLDOWN" ]; then log "ABORT: a commit landed <${COOLDOWN}s ago (pipeline may be finishing)"; exit 0; fi
CUR_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CUR_BRANCH" != "main" ]; then log "ABORT: repo not on main (on $CUR_BRANCH)"; exit 0; fi

# 2. Frozen baseline score (deterministic, read-only).
$PY scripts/weekly_eval.py --quiet >>"$LOG" 2>&1
cp analysis/weekly-scorecard.json "$STATE_DIR/baseline-scorecard-$DATE.json" 2>/dev/null

# 2b. Mechanical "licence to do nothing": if we don't have enough data to MEASURE
# whether a change helps, don't spend money guessing. Skip the LLM entirely and
# just report. This is the expected path for the first weeks (organic winners are
# rare) and is the primary guard against noise-chasing / reward-hacking.
VERDICT=$($PY -c "import json;print(json.load(open('analysis/weekly-scorecard.json')).get('verdict','insufficient_data'))" 2>/dev/null || echo insufficient_data)
log "eval verdict: $VERDICT"
if [ "$VERDICT" = "insufficient_data" ]; then
  log "SKIP: insufficient data to evaluate a change — no LLM run this week (by design)"
  exit 0
fi

# 3. Isolated worktree off main — main's HEAD/tree are never touched.
git worktree prune
if ! git worktree add -b "$BRANCH" "$WT" main >>"$LOG" 2>&1; then
  log "FATAL: worktree add failed"; exit 1
fi
# The freshly-computed scorecard lives in the main tree (and is gitignored, so the
# worktree checkout won't have it). Copy it in so the analyst reads CURRENT data.
mkdir -p "$WT/analysis"
cp analysis/weekly-scorecard.json "$WT/analysis/weekly-scorecard.json" 2>/dev/null

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
( cd "$WT" && bounded 900 "$CLAUDE" -p "$PROMPT" \
    --model sonnet \
    --permission-mode acceptEdits \
    --allowedTools "Read" "Edit" ) > "$CLAUDE_OUT" 2>&1
CL=$?
{ [ $CL -eq 124 ] || [ $CL -eq 142 ] || [ $CL -eq 143 ]; } && log "WARN: claude timed out"
# A nonzero exit is a hard signal (don't let auth expiry masquerade as healthy
# "no change" for months). Alert and stop rather than silently doing nothing.
if [ $CL -ne 0 ] && [ $CL -ne 124 ] && [ $CL -ne 142 ] && [ $CL -ne 143 ]; then
  alert "claude exited nonzero ($CL) — possible auth/API failure. See $CLAUDE_OUT"
  exit 0
fi
if grep -qiE 'invalid api key|unauthorized|authentication|please run .?login|expired|not logged in|session token' "$CLAUDE_OUT"; then
  alert "possible claude auth failure — inspect $CLAUDE_OUT and re-authenticate"
  exit 0
fi

# 5. Commit whatever the analyst changed (so the gate can see it), THEN gate.
#    Committing first means an off-limits edit gets staged and the gate's scope
#    check catches it — the branch is dropped if the gate fails.
if [ -z "$(cd "$WT" && git status --porcelain)" ]; then
  log "NO CHANGE this week (analyst made no edit) — this is fine"
else
  ( cd "$WT" && git add -A && git commit -m "self-improve $DATE: candidate finder change (gated; needs human review)

Passed the safety gate (scope+tests+health). NOT auto-merged — review the diff
and merge into main only if you agree it is a real improvement.

Co-Authored-By: Claude (weekly analyst) <noreply@anthropic.com>" ) >>"$LOG" 2>&1
  bash "$REPO/scripts/self_improve_gate.sh" "$WT" main >>"$LOG" 2>&1
  G=$?
  if [ $G -eq 0 ]; then
    KEEP_BRANCH=1
    log "KEPT branch $BRANCH — passed gate; review & merge when you return"
    log "  summary: $(tail -n 3 "$CLAUDE_OUT" | tr '\n' ' ' | cut -c1-300)"
  elif [ $G -eq 3 ]; then
    log "no effective change vs main — dropped (fine)"
  else
    log "REVERTED: candidate failed the safety gate (exit $G) — dropped"
  fi
fi

# 6. Hygiene: drop unmerged self-improve branches older than 60 days.
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/self-improve 2>/dev/null); do
  [ "$b" = "$BRANCH" ] && [ "$KEEP_BRANCH" -eq 1 ] && continue
  ct=$(git log -1 --format=%ct "$b" 2>/dev/null || echo "$NOW")
  if [ $((NOW - ct)) -gt 5184000 ]; then git branch -D "$b" 2>/dev/null && log "pruned old branch $b"; fi
done

log "=== weekly analyst done (gate=$G, kept=$KEEP_BRANCH) ==="
exit 0
