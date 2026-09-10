#!/usr/bin/env python3
"""
Batch-002 early signal analysis.

For each coin launched during the recording:
- Computes first 0-3 min buy metrics
- Flags bundlers/snipers (wallet concentration, same-slot buys)
- Labels success = migrated within the 60-min window
- Reports patterns that separate migrators from duds
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

RUN_DIR = Path("/Users/drewp/Library/Application Support/MemeExplorer/scheduled-20260908/batches/batch-20260908-1200-central/runs/run-0001-20260908T170044.113Z/normalized")

WINDOWS_SEC = [60, 120, 180]  # 1, 2, 3 minutes

def read_ndjson(path):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)

def epoch(ts):
    from datetime import datetime, timezone
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()

# ── 1. Load coin creation times ──────────────────────────────────────────────
coin_created = {}   # mint → epoch
coin_slot = {}      # mint → create slot (for sniper detection)
for ev in read_ndjson(RUN_DIR / "events.ndjson"):
    if ev.get("action") == "create":
        coin_created[ev["mint"]] = epoch(ev["source_at"])
        coin_slot[ev["mint"]] = ev.get("slot")

# ── 2. Load migrations ────────────────────────────────────────────────────────
migrated = set()
migration_time = {}  # mint → epoch
for mg in read_ndjson(RUN_DIR / "migrations.ndjson"):
    if mg.get("stage") == "migrate":
        migrated.add(mg["mint"])
        migration_time[mg["mint"]] = epoch(mg["source_at"])

# ── 3. Load trades, index by mint ────────────────────────────────────────────
trades_by_mint = defaultdict(list)
for tr in read_ndjson(RUN_DIR / "trades.ndjson"):
    if tr.get("side") == "buy" and tr["mint"] in coin_created:
        trades_by_mint[tr["mint"]].append({
            "t":      epoch(tr["source_at"]),
            "slot":   tr.get("slot"),
            "wallet": tr.get("signing_wallet"),
            "sol":    float(tr.get("quote_amount_raw") or 0),
            "mcap":   float(tr.get("market_cap_quote") or 0),
        })

# ── 4. Analyse each coin ──────────────────────────────────────────────────────
RUN_START = min(coin_created.values()) if coin_created else 0
RUN_END   = RUN_START + 3600

coins = []
for mint, t0 in coin_created.items():
    # Skip coins that launched with < 3 min left in session (can't observe them)
    if t0 > RUN_END - 180:
        continue

    buys = sorted(trades_by_mint[mint], key=lambda x: x["t"])
    create_slot = coin_slot.get(mint)

    windows = {}
    for w in WINDOWS_SEC:
        wbuys = [b for b in buys if b["t"] <= t0 + w]
        wallets = [b["wallet"] for b in wbuys if b["wallet"]]
        sol_amounts = [b["sol"] for b in wbuys]
        total_sol = sum(sol_amounts)
        unique_wallets = set(wallets)

        # Wallet concentration: fraction of volume from top wallet
        wallet_vol = defaultdict(float)
        for b in wbuys:
            if b["wallet"]:
                wallet_vol[b["wallet"]] += b["sol"]
        top_wallet_share = (max(wallet_vol.values()) / total_sol) if total_sol > 0 and wallet_vol else 0

        # Same-slot buys at creation (sniper / bundler signal)
        same_slot_buys = sum(1 for b in wbuys if b["slot"] == create_slot)

        # Market cap at end of window
        end_mcap = wbuys[-1]["mcap"] if wbuys else 0

        windows[w] = {
            "buy_count":       len(wbuys),
            "unique_buyers":   len(unique_wallets),
            "total_sol":       round(total_sol, 4),
            "top_wallet_pct":  round(top_wallet_share * 100, 1),
            "same_slot_buys":  same_slot_buys,
            "end_mcap":        round(end_mcap, 2),
        }

    # ── Bundler / sniper flags ─────────────────────────────────────────────
    w60 = windows[60]
    is_bundled   = w60["top_wallet_pct"] >= 40           # ≥40% vol from one wallet in first min
    is_sniped    = w60["same_slot_buys"] >= 3            # ≥3 buys in create slot
    is_low_activity = w60["buy_count"] < 3               # fewer than 3 buys in first minute

    flag = []
    if is_bundled:  flag.append("bundled")
    if is_sniped:   flag.append("sniped")

    coins.append({
        "mint":       mint,
        "launched_at": t0,
        "migrated":   mint in migrated,
        "migration_sec": round(migration_time[mint] - t0) if mint in migrated else None,
        "flags":      flag,
        "low_activity": is_low_activity,
        "w60":        windows[60],
        "w120":       windows[120],
        "w180":       windows[180],
    })

total = len(coins)
migrators    = [c for c in coins if c["migrated"]]
non_migrators = [c for c in coins if not c["migrated"]]

# ── 5. Filter to clean coins (no bundler/sniper flags, not low-activity) ──
clean     = [c for c in coins if not c["flags"] and not c["low_activity"]]
clean_mig = [c for c in clean if c["migrated"]]
clean_non = [c for c in clean if not c["migrated"]]

def avg(vals):
    return round(sum(vals) / len(vals), 2) if vals else 0

def median(vals):
    if not vals: return 0
    s = sorted(vals)
    n = len(s)
    return round(s[n // 2], 2)

def pct_above(vals, threshold):
    if not vals: return 0
    return round(100 * sum(1 for v in vals if v >= threshold) / len(vals), 1)

print("=" * 60)
print("BATCH-002 EARLY SIGNAL ANALYSIS")
print("=" * 60)
print(f"\nTotal coins w/ ≥3 min observation: {total}")
print(f"  → Migrated:     {len(migrators)} ({100*len(migrators)//total}%)")
print(f"  → Did not:      {len(non_migrators)}")
print(f"\nFlagged (bundled/sniped): {sum(1 for c in coins if c['flags'])}")
print(f"Low activity (<3 buys/min): {sum(1 for c in coins if c['low_activity'])}")
print(f"\nCLEAN coins (no flags, ≥3 buys): {len(clean)}")
print(f"  → Migrated:  {len(clean_mig)} ({100*len(clean_mig)//len(clean) if clean else 0}%)")
print(f"  → Did not:   {len(clean_non)}")

for w in WINDOWS_SEC:
    label = f"{w//60}m" if w >= 60 else f"{w}s"
    mig_vals_buys   = [c[f"w{w}"]["buy_count"]     for c in clean_mig]
    non_vals_buys   = [c[f"w{w}"]["buy_count"]     for c in clean_non]
    mig_vals_sol    = [c[f"w{w}"]["total_sol"]     for c in clean_mig]
    non_vals_sol    = [c[f"w{w}"]["total_sol"]     for c in clean_non]
    mig_vals_uniq   = [c[f"w{w}"]["unique_buyers"] for c in clean_mig]
    non_vals_uniq   = [c[f"w{w}"]["unique_buyers"] for c in clean_non]
    mig_vals_mcap   = [c[f"w{w}"]["end_mcap"]      for c in clean_mig]
    non_vals_mcap   = [c[f"w{w}"]["end_mcap"]      for c in clean_non]

    print(f"\n── First {label} ({'MIGRATED' if w else ''} vs non-migrated, clean coins) ──")
    print(f"  Buys:         migrators median={median(mig_vals_buys):>6}   non median={median(non_vals_buys):>6}")
    print(f"  Unique buyers:migrators median={median(mig_vals_uniq):>6}   non median={median(non_vals_uniq):>6}")
    print(f"  SOL volume:   migrators median={median(mig_vals_sol):>6}   non median={median(non_vals_sol):>6}")
    print(f"  Market cap:   migrators median={median(mig_vals_mcap):>6}   non median={median(non_vals_mcap):>6}")
    # What % of migrators had ≥N buys?
    for threshold in [5, 10, 20, 50]:
        m_pct = pct_above(mig_vals_buys, threshold)
        n_pct = pct_above(non_vals_buys, threshold)
        print(f"  ≥{threshold:>2} buys in {label}: migrators={m_pct:>5}%  non={n_pct:>5}%")

# ── 6. Best simple threshold rules ───────────────────────────────────────────
print("\n── THRESHOLD SCAN: which 1-min rules best separate migrators ──")
print(f"{'Rule':<35} {'Precision':>9} {'Recall':>7} {'Signals':>7}")
print("-" * 62)

def threshold_stats(coins_list, mig_list, field, w, op, val):
    key = f"w{w}"
    if op == ">=":
        flagged     = [c for c in coins_list if c[key][field] >= val]
        flagged_mig = [c for c in mig_list   if c[key][field] >= val]
    else:
        flagged     = [c for c in coins_list if c[key][field] <= val]
        flagged_mig = [c for c in mig_list   if c[key][field] <= val]
    if not flagged: return
    precision = 100 * len(flagged_mig) / len(flagged)
    recall    = 100 * len(flagged_mig) / len(mig_list) if mig_list else 0
    print(f"  {field} {op} {val} (first {w//60 if w>=60 else str(w)+'s'}m):{' ':>{max(0,20-len(field)-len(str(val)))}} {precision:>8.1f}%  {recall:>6.1f}%  {len(flagged):>6}")

for w in [60, 120, 180]:
    for field in ["buy_count", "unique_buyers", "total_sol"]:
        for val in [5, 10, 20, 30, 50]:
            threshold_stats(clean, clean_mig, field, w, ">=", val)

# ── 7. Top migrators in the clean set ────────────────────────────────────────
print(f"\n── TOP {min(15, len(clean_mig))} MIGRATORS (clean, by 1-min buys) ──")
top = sorted(clean_mig, key=lambda c: c["w60"]["buy_count"], reverse=True)[:15]
print(f"{'mint[:8]':<10} {'1m buys':>7} {'1m uniq':>7} {'1m SOL':>8} {'migration_min':>13}")
for c in top:
    mmin = f"{c['migration_sec']//60}m{c['migration_sec']%60}s" if c["migration_sec"] else "n/a"
    print(f"  {c['mint'][:8]}  {c['w60']['buy_count']:>7}  {c['w60']['unique_buyers']:>7}  {c['w60']['total_sol']:>8.3f}  {mmin:>13}")

print("\nDone.")
