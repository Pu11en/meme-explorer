#!/usr/bin/env python3
"""
Phase 1 — Build repeat-dev watchlist from Dune Analytics.

Usage:
  DUNE_API_KEY=<key> python3 scripts/build_dev_watchlist.py

Reads dev_watchlist_query.sql, creates a new Dune query, executes it
on the large tier, paginates results, and writes analysis/dev-watchlist.json.

Validates that known repeat devs appear in the output.
Do NOT commit the API key. Pass it via env only.
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import urllib.request
import urllib.error

# ── Config ─────────────────────────────────────────────────────────────────
REPO       = Path(__file__).parent.parent.resolve()
SQL_FILE   = REPO / "scripts" / "dev_watchlist_query.sql"
OUT_FILE   = REPO / "analysis" / "dev-watchlist.json"
DUNE_BASE  = "https://api.dune.com/api/v1"

KNOWN_WALLETS = [
    "Fzz2amRoCCpEvxtwdurs8qLVLSdrd3dcraJVpNjE4rp4",
    "AV7PjXHL5JXZ1YoYRoN9Dsstg1x2UciBupMCXcJP8gUz",
]

# Tier A: high-confidence — any hit rate if still active
# Tier B: volume boost — prolific launchers (≥8 migrations) at ≥5% hit rate beat background ~3.5%
MIN_HIT_RATE_A  = 30.0  # % — standard threshold
MIN_HIT_RATE_B  = 5.0   # % — applies only when migrations >= VOLUME_THRESHOLD_B
VOLUME_THRESHOLD_B = 8  # minimum migrations to qualify at lower hit rate
MAX_INACTIVE_D  = 30    # exclude devs last seen >30 days ago


def api_key():
    k = os.environ.get("DUNE_API_KEY", "").strip()
    if not k:
        sys.exit("ERROR: set DUNE_API_KEY env var")
    return k


def dune_request(method, path, body=None):
    url = f"{DUNE_BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "X-Dune-Api-Key": api_key(),
        "Content-Type":   "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        sys.exit(f"Dune API {method} {path} → {e.code}: {body_text}")


def create_query(sql):
    print("Creating Dune query…")
    r = dune_request("POST", "/query", {
        "name": "meme-explorer-dev-watchlist",
        "query_sql": sql,
        "is_private": True,
    })
    qid = r.get("query_id") or r.get("id")
    if not qid:
        sys.exit(f"Unexpected create response: {r}")
    print(f"  query_id={qid}")
    return qid


def execute_query(query_id):
    print("Executing query (large tier)…")
    r = dune_request("POST", f"/query/{query_id}/execute", {
        "performance": "large",
    })
    eid = r.get("execution_id")
    if not eid:
        sys.exit(f"Unexpected execute response: {r}")
    print(f"  execution_id={eid}")
    return eid


def poll_until_done(execution_id, poll_interval=10):
    print("Polling…", end="", flush=True)
    while True:
        r = dune_request("GET", f"/execution/{execution_id}/status")
        state = r.get("state", "")
        print(f" {state}", end="", flush=True)
        if state == "QUERY_STATE_COMPLETED":
            print()
            return r
        if state in ("QUERY_STATE_FAILED", "QUERY_STATE_CANCELLED", "QUERY_STATE_EXPIRED"):
            print()
            sys.exit(f"Query {state}: {r.get('error', '')}")
        time.sleep(poll_interval)


def fetch_all_rows(execution_id):
    rows, offset, page_size = [], 0, 32000
    while True:
        r = dune_request("GET", f"/execution/{execution_id}/results?offset={offset}&limit={page_size}")
        page = r.get("result", {}).get("rows", [])
        rows.extend(page)
        print(f"  fetched {len(rows)} rows…")
        if len(page) < page_size:
            break
        offset += page_size
    return rows


def process_rows(rows):
    now = datetime.now(timezone.utc)
    watchlist = []
    for row in rows:
        last_seen_str = row.get("last_seen") or ""
        try:
            last_seen_dt = datetime.fromisoformat(last_seen_str.replace(" UTC", "+00:00").replace("Z", "+00:00"))
            days_inactive = (now - last_seen_dt).days
        except Exception:
            days_inactive = 9999

        hit_rate = float(row.get("hit_rate") or 0)
        migrations = int(row.get("migrations") or 0)

        if days_inactive > MAX_INACTIVE_D:
            continue

        tier_a = hit_rate >= MIN_HIT_RATE_A
        tier_b = migrations >= VOLUME_THRESHOLD_B and hit_rate >= MIN_HIT_RATE_B
        if not (tier_a or tier_b):
            continue

        watchlist.append({
            "wallet":            row["wallet"],
            "launches":          int(row.get("launches") or 0),
            "migrations":        migrations,
            "hit_rate":          hit_rate,
            "avg_migration_sec": int(row.get("avg_migration_sec") or 0) if row.get("avg_migration_sec") else None,
            "last_seen":         last_seen_str,
            "days_inactive":     days_inactive,
            "tier":              "A" if tier_a else "B",
        })

    watchlist.sort(key=lambda w: (-w["hit_rate"], -w["migrations"]))
    return watchlist


def validate(watchlist, raw_rows):
    raw_by_wallet = {r["wallet"]: r for r in raw_rows}
    wallet_set = {w["wallet"] for w in watchlist}
    query_missing = [k for k in KNOWN_WALLETS if k not in raw_by_wallet]
    filter_removed = [k for k in KNOWN_WALLETS if k in raw_by_wallet and k not in wallet_set]

    if query_missing:
        print(f"ERROR: {len(query_missing)} known wallet(s) not returned by Dune query — check SQL!")
        for m in query_missing:
            print(f"  {m}")
    else:
        print(f"  Query OK — all {len(KNOWN_WALLETS)} known wallets found in raw Dune results.")

    if filter_removed:
        print(f"  {len(filter_removed)} known wallet(s) excluded by hit-rate filter (not query error):")
        for k in filter_removed:
            r = raw_by_wallet[k]
            print(f"    {k[:8]}... launches={r['launches']}, migrations={r['migrations']}, "
                  f"hit_rate={float(r['hit_rate']):.1f}%, last_seen={r['last_seen'][:10]}")


def main():
    # Allow re-processing an existing execution to avoid re-running the expensive query.
    # Usage: DUNE_API_KEY=... python3 build_dev_watchlist.py --exec 01M2HKG8VDY89VZ3FJTFS7J9K2
    reuse_exec = None
    for i, arg in enumerate(sys.argv[1:]):
        if arg == "--exec" and i + 1 < len(sys.argv) - 1:
            reuse_exec = sys.argv[i + 2]

    if reuse_exec:
        print(f"Re-fetching from existing execution {reuse_exec}…")
        exec_id = reuse_exec
    else:
        sql        = SQL_FILE.read_text()
        query_id   = create_query(sql)
        exec_id    = execute_query(query_id)
        poll_until_done(exec_id)

    rows       = fetch_all_rows(exec_id)
    print(f"Total raw rows with ≥2 migrations: {len(rows)}")

    watchlist  = process_rows(rows)
    print(f"Watchlist after filters (TierA≥{MIN_HIT_RATE_A}% / TierB≥{MIN_HIT_RATE_B}%+{VOLUME_THRESHOLD_B}mig, inactive≤{MAX_INACTIVE_D}d): {len(watchlist)}")

    validate(watchlist, rows)

    meta = {
        "generated_at":   datetime.now(timezone.utc).isoformat(),
        "raw_rows":       len(rows),
        "watchlist_count": len(watchlist),
        "filters": {
            "tier_a_min_hit_rate_pct":  MIN_HIT_RATE_A,
            "tier_b_min_hit_rate_pct":  MIN_HIT_RATE_B,
            "tier_b_min_migrations":    VOLUME_THRESHOLD_B,
            "max_inactive_days":        MAX_INACTIVE_D,
            "min_migrations":           2,
        },
        "wallets": watchlist,
    }
    OUT_FILE.write_text(json.dumps(meta, indent=2))
    print(f"Wrote {OUT_FILE}")

    # success gate from roadmap
    high_quality = [w for w in watchlist if w["hit_rate"] >= 50]
    recent = [w for w in high_quality if w["days_inactive"] <= MAX_INACTIVE_D]
    gate_pass = len(recent) >= 20
    print(f"\nSuccess gate: ≥20 wallets with ≥50% hit-rate and recent activity → {len(recent)} wallets → {'PASS' if gate_pass else 'FAIL'}")
    if not gate_pass:
        print("  Lower MIN_HIT_RATE or extend look-back window if needed.")


if __name__ == "__main__":
    main()
