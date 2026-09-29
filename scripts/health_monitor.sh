#!/bin/bash
# Periodic health monitor. Runs health_check.py and, on WARN/CRIT, appends to an
# alerts file you can read via a session ("what's the health of the pipeline?").
# Keeps a rolling heartbeat so silence itself is diagnosable.
set -u
REPO=/Users/drewp/Developer/meme-explorer
PY=/usr/bin/python3
STATE_DIR="$HOME/Library/Application Support/MemeExplorer/self-improve"
mkdir -p "$STATE_DIR"
ALERTS="$STATE_DIR/ALERTS.txt"
HEARTBEAT="$STATE_DIR/health-heartbeat.txt"

OUT=$("$PY" "$REPO/scripts/health_check.py" 2>&1); RC=$?
TS=$(date -u +%FT%TZ)
echo "[$TS] rc=$RC" > "$HEARTBEAT"
echo "$OUT" >> "$HEARTBEAT"
if [ "$RC" -ge 1 ]; then
  { echo "[$TS] health rc=$RC"; echo "$OUT" | grep -E '\[(WARN|CRIT)\]'; echo "---"; } >> "$ALERTS"
  # keep alerts file bounded
  tail -n 500 "$ALERTS" > "$ALERTS.tmp" 2>/dev/null && mv "$ALERTS.tmp" "$ALERTS"
fi
exit 0
