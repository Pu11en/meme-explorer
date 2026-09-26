#!/usr/bin/env python3
"""
Meme Explorer — Hourly Recording Pipeline

Runs indefinitely. Each cycle:
  1. Creates a new batch config for the current hour
  2. Records Pump.fun for 60 minutes
  3. Runs analysis + fraud detection
  4. Saves compact findings to repo
  5. Deletes raw data (saves ~1.4 GB per batch)
  6. Updates cumulative HTML report
  7. Commits everything to git
  8. Sleeps until next hour boundary

Run once: python3 scripts/pipeline.py
Stop anytime with Ctrl+C — safe at any stage.
"""
import json
import os
import shutil
import subprocess
import sys
import time
import threading
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pyarrow as pa
import pyarrow.parquet as pq

# ── Paths ──────────────────────────────────────────────────────────────────
REPO          = Path(__file__).parent.parent.resolve()
BATCHES_DIR   = REPO / "analysis" / "batches"
FINDINGS_DIR  = REPO / "analysis"
SCRIPTS_DIR   = REPO / "scripts"
DATA_ROOT_BASE = Path("/Users/drewp/Library/Application Support/MemeExplorer/pipeline")
LIB_DIR       = REPO / "lib"
NODE          = Path("/Users/drewp/.hermes/node/bin/node")
LOCK_FILE     = DATA_ROOT_BASE / ".pipeline.lock"
LOG_FILE      = DATA_ROOT_BASE / "pipeline.log"

MINIMUM_FREE_BYTES  = 16_106_127_360   # 15 GiB
MAXIMUM_BATCH_BYTES = 12_884_901_888   # 12 GiB
PARQUET_ARCHIVE     = Path("/Users/drewp/Library/Application Support/MemeExplorer/parquet")

# ── Helpers ────────────────────────────────────────────────────────────────
def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass

def run(cmd, **kw):
    return subprocess.run(cmd, **kw)

def next_batch_number():
    existing = sorted(BATCHES_DIR.glob("batch-*.json"))
    nums = []
    for p in existing:
        try:
            n = int(p.stem.split("-")[1])
            nums.append(n)
        except Exception:
            pass
    return max(nums, default=0) + 1

def epoch(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()

# ── Fraud detection v3 ────────────────────────────────────────────────────
def classify(c):
    w60          = c.get("w60", {})
    same_slot    = w60.get("same_slot_buys", 0)
    uniq         = w60.get("unique_buyers", 0)
    sniper_ratio = c.get("sniper_ratio_60", 0)
    top_wallet   = w60.get("top_wallet_pct", 0)
    if same_slot >= 4:       return "bundle"   # lowered from 5 — 4 same-slot buys is coordinated
    if top_wallet >= 40:     return "bundle"
    if uniq <= 6 and sniper_ratio >= 80: return "controlled"
    return "organic"

# ── Parquet archiver ──────────────────────────────────────────────────────
def archive_to_parquet(batch_id, norm_dir):
    """Convert all 4 raw ndjson files to parquet before deletion. ~50MB vs 1.4GB."""
    PARQUET_ARCHIVE.mkdir(parents=True, exist_ok=True)
    out_dir = PARQUET_ARCHIVE / batch_id
    out_dir.mkdir(exist_ok=True)

    files = {
        "trades":     norm_dir / "trades.ndjson",
        "events":     norm_dir / "events.ndjson",
        "migrations": norm_dir / "migrations.ndjson",
        "tokens":     norm_dir / "tokens.ndjson",
    }

    sizes = {}
    for name, path in files.items():
        if not path.exists():
            continue
        rows = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
        if not rows:
            continue
        # Flatten — all values to strings to avoid schema conflicts across batches
        flat = [{k: str(v) if v is not None else None for k, v in r.items()} for r in rows]
        keys = list(flat[0].keys())
        arrays = {k: pa.array([r.get(k) for r in flat], type=pa.string()) for k in keys}
        table = pa.table(arrays)
        out_path = out_dir / f"{name}.parquet"
        pq.write_table(table, out_path, compression="zstd")
        sizes[name] = round(out_path.stat().st_size / 1024 / 1024, 1)

    total_mb = sum(sizes.values())
    return total_mb, sizes

# ── Cross-batch sniper persistence ────────────────────────────────────────
CUMULATIVE_SNIPERS_PATH = FINDINGS_DIR / "cumulative-snipers.json"
WATCHLIST_PATH          = FINDINGS_DIR / "dev-watchlist.json"

# Ensure required dirs exist
BATCHES_DIR.mkdir(parents=True, exist_ok=True)
PARQUET_ARCHIVE.mkdir(parents=True, exist_ok=True)

def load_dev_watchlist():
    if not WATCHLIST_PATH.exists():
        return {}
    with open(WATCHLIST_PATH) as f:
        data = json.load(f)
    return {w["wallet"]: w for w in data.get("wallets", [])}

def load_cumulative_snipers():
    if CUMULATIVE_SNIPERS_PATH.exists():
        with open(CUMULATIVE_SNIPERS_PATH) as f:
            return set(json.load(f))
    return set()

def save_cumulative_snipers(wallets):
    with open(CUMULATIVE_SNIPERS_PATH, "w") as f:
        json.dump(sorted(wallets), f)

# ── Analysis ──────────────────────────────────────────────────────────────
def read_ndjson(path):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)

def analyze_batch(batch_id, data_root, run_id, dev_watchlist=None):
    log(f"  Analyzing {batch_id}...")
    norm_dir = data_root / "runs" / run_id / "normalized"

    coin_created = {}
    coin_slot    = {}
    for ev in read_ndjson(norm_dir / "events.ndjson"):
        if ev.get("action") == "create":
            coin_created[ev["mint"]] = epoch(ev["source_at"])
            coin_slot[ev["mint"]]    = ev.get("slot")

    token_meta = {}
    for tk in read_ndjson(norm_dir / "tokens.ndjson"):
        mint = tk.get("mint")
        if mint:
            token_meta[mint] = {"name": tk.get("name"), "symbol": tk.get("symbol"), "creator": tk.get("creator_wallet")}

    migrated       = set()
    migration_time = {}
    for mg in read_ndjson(norm_dir / "migrations.ndjson"):
        if mg.get("stage") == "migrate":
            migrated.add(mg["mint"])
            migration_time[mg["mint"]] = epoch(mg["source_at"])

    trades_by_mint   = defaultdict(list)
    all_wallet_counts = defaultdict(int)
    for tr in read_ndjson(norm_dir / "trades.ndjson"):
        if tr.get("side") == "buy" and tr["mint"] in coin_created:
            w = tr.get("signing_wallet")
            trades_by_mint[tr["mint"]].append({
                "t": epoch(tr["source_at"]), "slot": tr.get("slot"),
                "wallet": w, "sol": float(tr.get("quote_amount_raw") or 0),
                "mcap": float(tr.get("market_cap_quote") or 0),
            })
            if w: all_wallet_counts[w] += 1

    # Fix 2: merge this batch's snipers with cumulative cross-batch snipers
    batch_snipers      = {w for w, c in all_wallet_counts.items() if c >= 10}
    cumulative_snipers = load_cumulative_snipers()
    sniper_wallets     = batch_snipers | cumulative_snipers
    save_cumulative_snipers(sniper_wallets)

    RUN_END = min(coin_created.values()) + 3600 if coin_created else 0

    coins = []
    for mint, t0 in coin_created.items():
        # Fix 1: don't skip tail coins — compute however many seconds are available
        coverage_sec = min(180, int(RUN_END - t0))
        if coverage_sec < 10: continue  # need at least 10s for any signal

        buys = sorted(trades_by_mint[mint], key=lambda x: x["t"])
        create_slot = coin_slot.get(mint)

        def window(secs):
            wb = [b for b in buys if b["t"] <= t0 + secs]
            wallets = [b["wallet"] for b in wb if b["wallet"]]
            total_sol = sum(b["sol"] for b in wb)
            wallet_vol = defaultdict(float)
            for b in wb:
                if b["wallet"]: wallet_vol[b["wallet"]] += b["sol"]
            top_share = (max(wallet_vol.values()) / total_sol) if total_sol > 0 and wallet_vol else 0
            sniper_ct = sum(1 for b in wb if b["wallet"] in sniper_wallets)
            same_slot = sum(1 for b in wb if b["slot"] == create_slot)
            # Fix 4: SOL-weighted unique buyers — wallets with ≥ 0.5 SOL (not dust)
            whale_buyers = len({b["wallet"] for b in wb if b["wallet"] and b["sol"] >= 0.5})
            return {
                "buy_count": len(wb), "unique_buyers": len(set(wallets)),
                "whale_buyers": whale_buyers,
                "total_sol": round(total_sol, 4), "top_wallet_pct": round(top_share * 100, 1),
                "sniper_buys": sniper_ct, "same_slot_buys": same_slot,
                "end_mcap": round(wb[-1]["mcap"] if wb else 0, 2),
            }

        w60 = window(60); w120 = window(120); w180 = window(180)
        all_sol = sum(b["sol"] for b in buys)
        sniper_ratio_60 = round(w60["sniper_buys"] / w60["buy_count"] * 100, 1) if w60["buy_count"] > 0 else 0
        # Fix 1: bars padded to 180 with zeros beyond coverage window
        bars = [sum(1 for b in buys if t0 + s <= b["t"] < t0 + s + 1) for s in range(180)]

        meta = token_meta.get(mint, {})
        creator = meta.get("creator")
        wl_entry = (dev_watchlist or {}).get(creator) if creator else None
        coins.append({
            "mint": mint, "name": meta.get("name"), "symbol": meta.get("symbol"),
            "creator": creator, "launched_at": t0,
            "watchlist_hit": wl_entry is not None,
            "watchlist_info": {"hit_rate": wl_entry["hit_rate"], "migrations": wl_entry["migrations"], "tier": wl_entry.get("tier")} if wl_entry else None,
            "migrated": mint in migrated,
            "migration_sec": round(migration_time[mint] - t0) if mint in migrated else None,
            "coverage_sec": coverage_sec,   # Fix 1: how many seconds of data we have
            "flags": [], "low_activity": w60["buy_count"] < 3,
            "w60": w60, "w120": w120, "w180": w180,
            "sniper_ratio_60": sniper_ratio_60,
            "total_buys_60min": len(buys), "total_sol_60min": round(all_sol, 4),
            "bars_3min": bars,
        })

    migrators = [c for c in coins if c["migrated"]]
    watchlist_hits = [c for c in coins if c.get("watchlist_hit")]
    return {
        "batch_id":         batch_id,
        "run_id":           run_id,
        "total_coins":      len(coins),
        "migrated":         len(migrators),
        "sniper_wallets":   len(sniper_wallets),
        "watchlist_hits":   len(watchlist_hits),
        "all_coins":        coins,
        "all_migrators":    migrators,
        "organic_migrators": [c for c in migrators if classify(c) == "organic"],
        "watchlist_migrators": [c for c in migrators if c.get("watchlist_hit")],
    }

# ── Report builder ────────────────────────────────────────────────────────
def build_report(all_batch_results):
    def badge(cls):
        colors = {"organic": "#22c55e", "bundle": "#ef4444", "controlled": "#f97316"}
        labels = {"organic": "ORGANIC", "bundle": "BUNDLE", "controlled": "CONTROLLED"}
        return f'<span style="background:{colors.get(cls,"#6b7280")};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">{labels.get(cls,cls.upper())}</span>'

    def fmt(sec):
        if sec is None: return "n/a"
        return f"{sec//60}m {sec%60}s"

    def coin_row(c, batch_label):
        w60  = c.get("w60", {})
        mint = c["mint"]
        cls  = classify(c)
        return f"""<tr>
          <td><a href="https://pump.fun/coin/{mint}" target="_blank" style="color:#60a5fa;text-decoration:none">{c.get('name','?')} <span style="opacity:.5">({c.get('symbol','?')})</span></a></td>
          <td style="text-align:center">{fmt(c.get('migration_sec'))}</td>
          <td style="text-align:right">{w60.get('buy_count',0)}</td>
          <td style="text-align:right">{w60.get('unique_buyers',0)}</td>
          <td style="text-align:right">{w60.get('total_sol',0):.1f}</td>
          <td style="text-align:center">{w60.get('same_slot_buys',0)}</td>
          <td style="text-align:center">{c.get('sniper_ratio_60',0)}%</td>
          <td style="text-align:center">{badge(cls)}</td>
          <td style="text-align:center;opacity:.5;font-size:12px">{batch_label}</td>
        </tr>"""

    all_mig = []
    for r in all_batch_results:
        for c in r["all_migrators"]:
            c["_batch"] = r["batch_id"]
            all_mig.append(c)
    all_mig.sort(key=lambda c: (c.get("migration_sec") or 9999))
    organic = [c for c in all_mig if classify(c) == "organic"]
    filtered = [c for c in all_mig if classify(c) != "organic"]

    total_coins = sum(r["total_coins"] for r in all_batch_results)
    total_mig   = len(all_mig)
    n_batches   = len(all_batch_results)

    rows_organic  = "".join(coin_row(c, c["_batch"]) for c in organic)
    rows_filtered = "".join(coin_row(c, c["_batch"]) for c in filtered)

    batch_rows = "".join(f"""<tr>
      <td style="font-weight:600">{r['batch_id']}</td>
      <td style="color:#94a3b8">{r.get('window','—')}</td>
      <td style="text-align:center">{r['total_coins']:,}</td>
      <td style="text-align:center">{r['migrated']}</td>
      <td style="text-align:center">{r['migrated']/r['total_coins']*100:.1f}%</td>
      <td style="text-align:center">{len(r['organic_migrators'])}</td>
      <td style="text-align:center">{r['sniper_wallets']:,}</td>
    </tr>""" for r in all_batch_results)

    th = """<tr style="background:#1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase">
      <th style="text-align:left;padding:8px 12px">Coin</th><th>Migrated In</th>
      <th>1m Buys</th><th>1m Unique</th><th>1m SOL</th>
      <th>Same-Slot</th><th>Sniper%</th><th>Verdict</th><th>Batch</th>
    </tr>"""

    updated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meme Explorer Report</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px 24px;max-width:1200px;margin:0 auto}}
h1{{font-size:24px;font-weight:700;color:#f1f5f9;margin-bottom:4px}}
h2{{font-size:18px;font-weight:600;color:#f1f5f9;margin:32px 0 12px}}
p{{color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:10px}}
table{{width:100%;border-collapse:collapse;font-size:13px}}
td,th{{padding:8px 12px;border-bottom:1px solid #1e293b}}
tr:hover td{{background:#1e293b44}}
.cards{{display:flex;gap:16px;flex-wrap:wrap;margin:20px 0}}
.card{{background:#1e293b;border-radius:8px;padding:20px 24px;min-width:140px}}
.card .val{{font-size:28px;font-weight:700}}
.card .lbl{{font-size:13px;color:#94a3b8;margin-top:4px}}
.sec{{border:1px solid #1e293b;border-radius:12px;padding:24px;margin-bottom:24px}}
.rule{{background:#1e293b;border-left:3px solid #60a5fa;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:10px;font-size:13px}}
.insight{{background:#1e293b;border-radius:8px;padding:14px 18px;margin-bottom:10px;font-size:13px;line-height:1.6}}
code{{background:#0f172a;padding:2px 6px;border-radius:4px;color:#60a5fa;font-family:monospace}}
</style></head><body>
<h1>Meme Explorer — Live Trend Report</h1>
<p style="color:#475569">Updated {updated} · {n_batches} batch{'es' if n_batches!=1 else ''} · auto-generated each hour</p>

<div class="cards">
  <div class="card"><div class="val" style="color:#60a5fa">{total_coins:,}</div><div class="lbl">Total Coins Recorded</div></div>
  <div class="card"><div class="val" style="color:#a78bfa">{total_mig}</div><div class="lbl">Total Migrated</div></div>
  <div class="card"><div class="val" style="color:#22c55e">{len(organic)}</div><div class="lbl">Organic Migrators</div></div>
  <div class="card"><div class="val" style="color:#ef4444">{len(filtered)}</div><div class="lbl">Bundles Filtered</div></div>
  <div class="card"><div class="val" style="color:#f59e0b">{total_mig/total_coins*100:.1f}%</div><div class="lbl">Migration Rate</div></div>
</div>

<div class="sec">
  <h2>Per-Batch Summary</h2>
  <table>
    <tr style="background:#1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase">
      <th style="text-align:left;padding:8px 12px">Batch</th><th>Window</th>
      <th>Launches</th><th>Migrated</th><th>Rate</th><th>Organic</th><th>Sniper Wallets</th>
    </tr>
    {batch_rows}
  </table>
</div>

<div class="sec">
  <h2>✅ Organic Migrators ({len(organic)} total)</h2>
  <p>Passed all fraud filters. Every coin name is a clickable pump.fun link.</p>
  <table>{th}{rows_organic}</table>
</div>

<div class="sec">
  <h2>🚫 Filtered — Bundles & Controlled ({len(filtered)} total)</h2>
  <table>{th}{rows_filtered}</table>
</div>

<div class="sec">
  <h2>Fraud Detection Rules (v2)</h2>
  <div class="rule"><strong>DISTRIBUTED BUNDLE</strong> — <code>same_slot_buys ≥ 5</code><br>Multiple wallets coordinated to buy in the same block as coin creation. Inflates unique buyer count artificially.</div>
  <div class="rule"><strong>SINGLE-WALLET BUNDLE</strong> — <code>top_wallet_pct ≥ 40%</code><br>One wallet holds 40%+ of first-minute volume.</div>
  <div class="rule"><strong>CONTROLLED</strong> — <code>unique_buyers ≤ 6 AND sniper_ratio ≥ 80%</code><br>A small bot cabal controls the majority of buys. No real organic activity.</div>
</div>

<div class="sec">
  <h2>Key Patterns</h2>
  <div class="insight"><strong>Migration rate is ~2.4% every hour</strong> — about 34 coins per 1,400 launches, completely consistent across batches.</div>
  <div class="insight"><strong>The real-time trigger:</strong> <code>≥50 unique buyers in first 60s + same_slot_buys &lt; 5</code> → 33% chance of migration. Fires ~12 times per hour.</div>
  <div class="insight"><strong>Snipers chase winners.</strong> 33/34 migrators each hour had known sniper bots pile in. High sniper presence is a signal, not a red flag.</div>
  <div class="insight"><strong>Repeat devs relaunch every session.</strong> Track dev wallets — when a known dev gets organic traction, they relaunch immediately after. "Luke" did it twice in one hour, both migrated under 2 min.</div>
  <div class="insight"><strong>Sub-2-minute migrations are unmistakable</strong> — 400–900 buys, 200–600 unique buyers in the first minute. You see it in the feed before any algorithm would catch it.</div>
</div>

</body></html>"""

# ── Main pipeline loop ────────────────────────────────────────────────────
def run_one_batch():
    batch_num    = next_batch_number()
    batch_id     = f"batch-{batch_num:03d}"
    now_utc      = datetime.now(timezone.utc)
    start_dt     = now_utc.replace(microsecond=0)
    starts_at    = start_dt.isoformat().replace("+00:00", "Z")
    ends_at      = (start_dt + timedelta(hours=1)).isoformat().replace("+00:00", "Z")
    window_label = now_utc.strftime("%Y-%m-%d %H:%M UTC")

    data_root = DATA_ROOT_BASE / "batches" / batch_id
    data_root.mkdir(parents=True, exist_ok=True)

    job = {
        "schema": "pump.scheduled-recording/1",
        "batch_id": batch_id,
        "label": f"Pump.fun pipeline {window_label}",
        "starts_at": starts_at,
        "ends_at":   ends_at,
        "data_root": str(data_root),
        "minimum_free_bytes":  MINIMUM_FREE_BYTES,
        "maximum_batch_bytes": MAXIMUM_BATCH_BYTES,
    }

    job_path = DATA_ROOT_BASE / f"{batch_id}.json"
    with open(job_path, "w") as f:
        json.dump(job, f, indent=2)

    # Register batch in repo
    batch_file = BATCHES_DIR / f"{batch_id}.json"
    with open(batch_file, "w") as f:
        json.dump({
            "schema":   "pump.collection-batch/1",
            "batch_id": batch_id,
            "label":    f"Collection {batch_id} — pipeline — {window_label}",
            "run_ids":  [],
        }, f, indent=2)

    log(f"Starting {batch_id} ({starts_at} → {ends_at})")

    # ── Record ────────────────────────────────────────────────────────────
    stdout_log = DATA_ROOT_BASE / f"{batch_id}.stdout.log"
    stderr_log = DATA_ROOT_BASE / f"{batch_id}.stderr.log"
    cli = LIB_DIR / "scheduled-recording-cli.js" if (LIB_DIR / "scheduled-recording-cli.js").exists() else \
          Path("/Users/drewp/Library/Application Support/MemeExplorer/scheduled-20260908/lib/scheduled-recording-cli.js")

    with open(stdout_log, "w") as out, open(stderr_log, "w") as err:
        result = subprocess.run(
            ["/usr/bin/caffeinate", "-i", str(NODE), str(cli), str(job_path)],
            stdout=out, stderr=err
        )

    status_path = data_root / "job-status.json"
    if not status_path.exists():
        log(f"  ERROR: no job-status.json produced. Check {stderr_log}")
        return None

    with open(status_path) as f:
        status = json.load(f)

    state = status.get("state")
    log(f"  Recording finished: {state}")

    if state not in ("completed", "stopped"):
        log(f"  Skipping analysis — state={state}")
        run_id = status.get("run_id")
        if run_id:
            run_dir = data_root / "runs" / run_id
            for subdir in ["raw", "normalized"]:
                p = run_dir / subdir
                if p.exists():
                    shutil.rmtree(p)
            log(f"  Cleaned up orphaned raw data for {run_id}")
        return None

    run_id = status.get("run_id")
    manifest = status.get("manifest", {})
    raw_count = manifest.get("counts", {}).get("raw_records", 0)
    log(f"  run_id={run_id} raw_records={raw_count:,}")

    # Update batch file with run_id
    with open(batch_file) as f:
        bf = json.load(f)
    bf["run_ids"] = [run_id]
    with open(batch_file, "w") as f:
        json.dump(bf, f, indent=2)

    # Fix 5: kick off analysis in background — next recording starts immediately
    t = threading.Thread(
        target=post_process_batch,
        args=(batch_id, batch_file, data_root, run_id, window_label),
        daemon=True,
        name=f"analyze-{batch_id}",
    )
    t.start()
    log(f"  Analysis running in background ({t.name}) — next recording starting now.")
    return {"batch_id": batch_id, "analysis_thread": t}


def post_process_batch(batch_id, batch_file, data_root, run_id, window_label):
    """Analyze, save findings, delete raw data, commit. Runs in a background thread."""
    try:
        dev_watchlist = load_dev_watchlist()
        result_data = analyze_batch(batch_id, data_root, run_id, dev_watchlist=dev_watchlist)
        result_data["window"] = window_label

        findings_out = FINDINGS_DIR / f"{batch_id}-findings"
        findings_out.mkdir(exist_ok=True)

        def write_json(path, data):
            with open(path, "w") as f:
                json.dump(data, f, indent=2)

        compact_mig = []
        for c in result_data["all_migrators"]:
            cc = {k: v for k, v in c.items() if k != "bars_3min"}
            cc["verdict"] = classify(c)
            compact_mig.append(cc)
        write_json(findings_out / "migrators.json", compact_mig)

        all_bars = [
            {"mint": c["mint"], "migrated": c["migrated"], "verdict": classify(c),
             "coverage_sec": c.get("coverage_sec", 180), "bars_3min": c["bars_3min"]}
            for c in result_data["all_coins"]
        ]
        write_json(findings_out / "all-coins-bars.json", all_bars)
        write_json(findings_out / "summary.json", {
            "batch_id":             batch_id,
            "window":               window_label,
            "total_coins":          result_data["total_coins"],
            "migrated":             result_data["migrated"],
            "organic":              len(result_data["organic_migrators"]),
            "sniper_wallets":       result_data["sniper_wallets"],
            "watchlist_hits":       result_data["watchlist_hits"],
            "watchlist_migrators":  len(result_data["watchlist_migrators"]),
            "migration_rate_pct":   round(result_data["migrated"] / result_data["total_coins"] * 100, 2) if result_data["total_coins"] else 0,
        })

        wl_note = f", {result_data['watchlist_hits']} watchlist hits ({len(result_data['watchlist_migrators'])} migrated)" if result_data["watchlist_hits"] else ""
        log(f"  [{batch_id}] Analysis done — {result_data['migrated']} migrated, {len(result_data['organic_migrators'])} organic{wl_note}")

        all_results = []
        for bf_path in sorted(FINDINGS_DIR.glob("batch-*-findings/summary.json")):
            with open(bf_path) as f:
                s = json.load(f)
            mig_path = bf_path.parent / "migrators.json"
            if mig_path.exists():
                with open(mig_path) as f:
                    s["all_migrators"] = json.load(f)
                s["organic_migrators"] = [c for c in s["all_migrators"] if c.get("verdict") == "organic"]
            all_results.append(s)

        report_html = build_report(all_results)
        (FINDINGS_DIR / "report.html").write_text(report_html)
        log(f"  [{batch_id}] Report updated")

        # Archive raw ndjson → parquet before deleting (~50MB vs 1.4GB)
        norm_dir = data_root / "runs" / run_id / "normalized"
        if norm_dir.exists():
            total_mb, sizes = archive_to_parquet(batch_id, norm_dir)
            log(f"  [{batch_id}] Archived to parquet: {total_mb:.1f} MB total {sizes}")

        run_dir = data_root / "runs" / run_id
        for subdir in ["raw", "normalized"]:
            p = run_dir / subdir
            if p.exists():
                shutil.rmtree(p)
        log(f"  [{batch_id}] Raw data deleted — parquet copy kept")

        # Phase 4: run paper trader on this batch's parquet before git add
        paper_trader_py = SCRIPTS_DIR / "paper_trader.py"
        pt_parquet = PARQUET_ARCHIVE / batch_id
        if paper_trader_py.exists() and pt_parquet.exists():
            try:
                pt_result = subprocess.run(
                    ["python3", str(paper_trader_py), "--batch", batch_id],
                    capture_output=True, text=True, timeout=60,
                )
                if pt_result.returncode == 0:
                    log(f"  [{batch_id}] Paper trader: {pt_result.stdout.strip().splitlines()[-1] if pt_result.stdout.strip() else 'ok'}")
                else:
                    log(f"  [{batch_id}] Paper trader error: {pt_result.stderr[:200]}")
            except Exception as pt_err:
                log(f"  [{batch_id}] Paper trader exception: {pt_err}")

        paper_trades_path = FINDINGS_DIR / "paper-trades.json"
        git_add = [str(batch_file), str(findings_out),
                   str(FINDINGS_DIR / "report.html"),
                   str(CUMULATIVE_SNIPERS_PATH)]
        if WATCHLIST_PATH.exists():
            git_add.append(str(WATCHLIST_PATH))
        if paper_trades_path.exists():
            git_add.append(str(paper_trades_path))
        subprocess.run(["git", "-C", str(REPO), "add"] + git_add, capture_output=True)
        subprocess.run(["git", "-C", str(REPO), "commit", "-m",
                        f"pipeline: {batch_id} — {result_data['total_coins']} coins, {result_data['migrated']} migrated, {len(result_data['organic_migrators'])} organic\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"],
                       capture_output=True)
        log(f"  [{batch_id}] Committed")

    except Exception as e:
        log(f"  [{batch_id}] ERROR in post_process_batch: {e}")

WINDOW_START_HOUR = 8   # 8 AM Central
WINDOW_END_HOUR   = 17  # 5 PM Central

def in_window():
    """True if current Central time is within 8 AM – 5 PM."""
    from datetime import timezone as tz
    import zoneinfo
    central = datetime.now(zoneinfo.ZoneInfo("America/Chicago"))
    return WINDOW_START_HOUR <= central.hour < WINDOW_END_HOUR

def seconds_until_window():
    """Seconds until 8 AM Central tomorrow."""
    import zoneinfo
    now_ct = datetime.now(zoneinfo.ZoneInfo("America/Chicago"))
    tomorrow_8am = now_ct.replace(hour=WINDOW_START_HOUR, minute=0, second=0, microsecond=0)
    if tomorrow_8am <= now_ct:
        tomorrow_8am = tomorrow_8am + timedelta(days=1)
    return (tomorrow_8am - now_ct).total_seconds()

def main():
    DATA_ROOT_BASE.mkdir(parents=True, exist_ok=True)

    if LOCK_FILE.exists():
        log("Lock file exists — another pipeline may be running. Remove .pipeline.lock to force start.")
        sys.exit(1)

    LOCK_FILE.write_text(str(os.getpid()))
    log(f"Pipeline started. Active window: {WINDOW_START_HOUR}:00–{WINDOW_END_HOUR}:00 Central.")

    try:
        while True:
            if not in_window():
                wait_sec = seconds_until_window()
                wake = datetime.now(timezone.utc) + timedelta(seconds=wait_sec)
                log(f"Outside window. Sleeping until 8 AM Central (~{wake.strftime('%Y-%m-%d %H:%M UTC')}).")
                time.sleep(wait_sec)
                continue

            result = run_one_batch()
            if result:
                log("Batch complete.")
                # Post daily summary at end of trading day (last batch before 5 PM CDT)
                from datetime import timezone as tz
                import zoneinfo
                central = datetime.now(zoneinfo.ZoneInfo("America/Chicago"))
                if central.hour >= WINDOW_END_HOUR - 1:  # last hour
                    paper_trader_py = SCRIPTS_DIR / "paper_trader.py"
                    if paper_trader_py.exists():
                        subprocess.run(["python3", str(paper_trader_py), "--daily-summary"],
                                       capture_output=True, timeout=10)
            else:
                log("Batch skipped/errored. Waiting 60s before retry.")
                time.sleep(60)

    except KeyboardInterrupt:
        log("Pipeline stopped by user.")
    finally:
        LOCK_FILE.unlink(missing_ok=True)

if __name__ == "__main__":
    main()
