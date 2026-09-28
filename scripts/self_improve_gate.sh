#!/bin/bash
# Safety gate for the autonomous self-improve loop. Exit 0 ONLY if a candidate
# change is safe to keep. Run by weekly_analyst.sh inside the isolated worktree
# AFTER the analyst has made its edit.
#
# Enforces (from the design review):
#   1. Reward-hacking block: the diff vs main may ONLY touch an allow-list of
#      finder-logic files. If it touches the eval, gate, tests, scorecard,
#      plists, .gitignore, or pipeline's commit code, HARD FAIL. This is what
#      stops the LLM from editing its own scorer/tests to fake success.
#   2. Correctness: python syntax + import check for changed scripts.
#   3. Unit tests must pass.
#   4. Health check must pass.
#
# Usage: self_improve_gate.sh <worktree_dir> <main_ref>
set -u

WORKTREE="${1:?usage: self_improve_gate.sh <worktree_dir> <main_ref>}"
MAIN_REF="${2:-main}"
PY=/usr/bin/python3
cd "$WORKTREE" || { echo "GATE FAIL: cannot cd $WORKTREE"; exit 1; }

# Files the analyst is ALLOWED to modify. Everything scoring/gating/testing/
# scheduling is off-limits by construction — edits there fail the gate.
ALLOW_REGEX='^scripts/dev_ledger\.py$'

echo "== Gate: reward-hacking / scope check =="
CHANGED=$(git diff --name-only "$MAIN_REF"...HEAD)
if [ -z "$CHANGED" ]; then
  echo "GATE: no changes vs $MAIN_REF (do-nothing) — nothing to accept"
  exit 3   # distinct code: clean, but no change to keep
fi
echo "changed files:"; echo "$CHANGED" | sed 's/^/  /'
BAD=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if ! echo "$f" | grep -qE "$ALLOW_REGEX"; then
    echo "GATE FAIL: change touches off-limits file: $f"
    BAD=1
  fi
done <<< "$CHANGED"
[ "$BAD" -eq 1 ] && { echo "GATE FAIL: out-of-scope edits (possible reward-hacking)"; exit 1; }

echo "== Gate: python syntax/import =="
$PY -c "import ast; ast.parse(open('scripts/dev_ledger.py').read())" || { echo "GATE FAIL: syntax"; exit 1; }
( cd scripts && $PY -c "import dev_ledger" ) || { echo "GATE FAIL: import"; exit 1; }

echo "== Gate: unit tests =="
$PY test/test_dev_ledger.py || { echo "GATE FAIL: unit tests"; exit 1; }

echo "== Gate: health check =="
# health_check may return 1 (warn) which is acceptable; 2 (crit) is not.
$PY scripts/health_check.py; hc=$?
if [ "$hc" -ge 2 ]; then echo "GATE FAIL: health critical"; exit 1; fi

echo "GATE PASS"
exit 0
