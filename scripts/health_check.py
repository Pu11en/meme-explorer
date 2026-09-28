#!/usr/bin/env python3
"""
Pipeline health check — catch silent failures before they cost months of data.

A long-running data pipeline fails quietly: the disk fills, a batch errors and
the watchlist goes stale, or the ledger corrupts and every future update is a
no-op — and nobody notices for weeks. This surfaces those conditions.

Exit code 0 = healthy, 1 = warnings, 2 = critical. Prints one line per check.
Run it from cron/launchd (e.g. hourly) and alert on nonzero, or by hand:

  /usr/bin/python3 scripts/health_check.py
"""
import json
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO         = Path(__file__).parent.parent.resolve()
ANALYSIS     = REPO / "analysis"
DATA_ROOT    = Path("/Users/drewp/Library/Application Support/MemeExplorer/pipeline")
LOG_FILE     = DATA_ROOT / "pipeline.log"
LEDGER       = ANALYSIS / "dev-ledger.json"
LIVE_WL      = ANALYSIS / "dev-watchlist-live.json"
MIN_FREE_GB  = 15          # pipeline needs 15 GiB free to record
STALE_BATCH_HOURS = 26     # findings should refresh at least daily (8AM window)

OK, WARN, CRIT = 0, 1, 2
results = []

def check(name, level, msg):
    results.append((level, name, msg))

def age_hours(path):
    if not path.exists():
        return None
    return (time.time() - path.stat().st_mtime) / 3600.0

# 1. Disk — the failure this box has hit before.
free_gb = shutil.disk_usage(str(DATA_ROOT if DATA_ROOT.exists() else REPO)).free / 1e9
if free_gb < MIN_FREE_GB:
    check("disk", CRIT, f"only {free_gb:.1f} GB free (<{MIN_FREE_GB}); pipeline will refuse to record")
elif free_gb < MIN_FREE_GB + 5:
    check("disk", WARN, f"{free_gb:.1f} GB free — approaching the {MIN_FREE_GB} GB floor")
else:
    check("disk", OK, f"{free_gb:.1f} GB free")

# 2. Latest findings freshness — did the pipeline actually produce a batch recently?
summaries = sorted(ANALYSIS.glob("batch-*-findings/summary.json"),
                   key=lambda p: p.stat().st_mtime)
if not summaries:
    check("findings", CRIT, "no batch findings found at all")
else:
    h = age_hours(summaries[-1])
    if h > STALE_BATCH_HOURS:
        check("findings", CRIT, f"latest findings are {h:.0f}h old (>{STALE_BATCH_HOURS}h) — pipeline may be stuck")
    else:
        check("findings", OK, f"latest findings {h:.1f}h old ({summaries[-1].parent.name})")

# 3. Dev ledger integrity + freshness.
if not LEDGER.exists():
    check("ledger", WARN, "dev-ledger.json missing (will build on next batch)")
else:
    try:
        d = json.load(open(LEDGER))
        ndevs = len(d.get("devs", {}))
        nbatch = len(d.get("processed_batches", []))
        h = age_hours(LEDGER)
        if not isinstance(d.get("devs"), dict):
            check("ledger", CRIT, "ledger has wrong shape")
        elif h > STALE_BATCH_HOURS:
            check("ledger", WARN, f"ledger {h:.0f}h stale ({ndevs} devs, {nbatch} batches)")
        else:
            check("ledger", OK, f"{ndevs} devs, {nbatch} batches, {h:.1f}h old")
    except Exception as e:
        check("ledger", CRIT, f"ledger unreadable: {e}")

# 4. Corruption quarantine files piling up = repeated crashes mid-write.
corrupt = list(ANALYSIS.glob("dev-ledger.corrupt-*"))
if corrupt:
    check("ledger-corrupt", WARN, f"{len(corrupt)} quarantined corrupt ledger(s) — investigate crash-during-write")

# 5. Live watchlist present and parseable.
if LIVE_WL.exists():
    try:
        wl = json.load(open(LIVE_WL))
        check("watchlist", OK, f"{wl.get('watchlist_count',0)} devs (A={wl.get('tier_a',0)}, B={wl.get('tier_b',0)})")
    except Exception as e:
        check("watchlist", CRIT, f"dev-watchlist-live.json unreadable: {e}")
else:
    check("watchlist", WARN, "dev-watchlist-live.json missing")

# 6. Recent ERROR lines in the pipeline log.
if LOG_FILE.exists():
    try:
        tail = LOG_FILE.read_text(errors="ignore").splitlines()[-400:]
        errs = [l for l in tail if "ERROR" in l or "Traceback" in l]
        if errs:
            check("log", WARN, f"{len(errs)} error line(s) in last 400 log lines; latest: {errs[-1][:120]}")
        else:
            check("log", OK, "no recent errors in pipeline.log")
    except Exception as e:
        check("log", WARN, f"could not read pipeline.log: {e}")

# ── Report ──
worst = max((lvl for lvl, _, _ in results), default=OK)
label = {OK: "OK", WARN: "WARN", CRIT: "CRIT"}
print(f"[health {datetime.now(timezone.utc).isoformat(timespec='seconds')}] overall={label[worst]}")
for lvl, name, msg in results:
    print(f"  [{label[lvl]:4}] {name}: {msg}")
sys.exit(worst)
