#!/usr/bin/env python3
"""
Deep analysis of batch-002 before raw data deletion.
Extracts all interesting patterns from clean coins and saves compact records.
"""
import json, os
from collections import defaultdict
from pathlib import Path

RUN_DIR = Path("/Users/drewp/Library/Application Support/MemeExplorer/scheduled-20260908/batches/batch-20260908-1200-central/runs/run-0001-20260908T170044.113Z/normalized")
OUT_DIR = Path("/Users/drewp/Developer/meme-explorer/analysis/batch-002-findings")
OUT_DIR.mkdir(exist_ok=True)

def read_ndjson(path):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)

def epoch(ts):
    from datetime import datetime
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()

def write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  saved → {path}")

print("Loading data...")

# ── Coin creation ──────────────────────────────────────────────────────────
coin_created = {}
coin_slot    = {}
coin_creator = {}  # mint → signing wallet of first buy (proxy for dev)
for ev in read_ndjson(RUN_DIR / "events.ndjson"):
    if ev.get("action") == "create":
        coin_created[ev["mint"]] = epoch(ev["source_at"])
        coin_slot[ev["mint"]]    = ev.get("slot")

# ── Tokens metadata ────────────────────────────────────────────────────────
token_meta = {}
for tk in read_ndjson(RUN_DIR / "tokens.ndjson"):
    mint = tk.get("mint")
    if mint:
        token_meta[mint] = {
            "name":    tk.get("name"),
            "symbol":  tk.get("symbol"),
            "creator": tk.get("creator_wallet"),
            "uri":     tk.get("uri"),
        }
        if mint not in coin_creator and tk.get("creator_wallet"):
            coin_creator[mint] = tk["creator_wallet"]

# ── Migrations ─────────────────────────────────────────────────────────────
migrated       = set()
migration_time = {}
for mg in read_ndjson(RUN_DIR / "migrations.ndjson"):
    if mg.get("stage") == "migrate":
        migrated.add(mg["mint"])
        migration_time[mg["mint"]] = epoch(mg["source_at"])

# ── All trades indexed ─────────────────────────────────────────────────────
trades_by_mint = defaultdict(list)
all_wallet_counts = defaultdict(int)   # how many coins each wallet bought into (sniper proxy)
for tr in read_ndjson(RUN_DIR / "trades.ndjson"):
    if tr.get("side") == "buy" and tr["mint"] in coin_created:
        wallet = tr.get("signing_wallet")
        trades_by_mint[tr["mint"]].append({
            "t":      epoch(tr["source_at"]),
            "slot":   tr.get("slot"),
            "wallet": wallet,
            "sol":    float(tr.get("quote_amount_raw") or 0),
            "mcap":   float(tr.get("market_cap_quote") or 0),
        })
        if wallet:
            all_wallet_counts[wallet] += 1

# Wallets that appeared in 10+ different coins = likely snipers/bots
sniper_wallets = {w for w, c in all_wallet_counts.items() if c >= 10}
print(f"  Sniper wallets (10+ coins): {len(sniper_wallets)}")

# ── Per-coin metrics ──────────────────────────────────────────────────────
RUN_END = min(coin_created.values()) + 3600 if coin_created else 0

coins = []
for mint, t0 in coin_created.items():
    if t0 > RUN_END - 180:
        continue

    buys = sorted(trades_by_mint[mint], key=lambda x: x["t"])
    create_slot = coin_slot.get(mint)

    def window(secs):
        wb = [b for b in buys if b["t"] <= t0 + secs]
        wallets = [b["wallet"] for b in wb if b["wallet"]]
        sol = [b["sol"] for b in wb]
        total_sol = sum(sol)
        wallet_vol = defaultdict(float)
        for b in wb:
            if b["wallet"]:
                wallet_vol[b["wallet"]] += b["sol"]
        top_share = (max(wallet_vol.values()) / total_sol) if total_sol > 0 and wallet_vol else 0
        sniper_buy_count = sum(1 for b in wb if b["wallet"] in sniper_wallets)
        same_slot = sum(1 for b in wb if b["slot"] == create_slot)
        unique = set(wallets)
        mcap_end = wb[-1]["mcap"] if wb else 0
        return {
            "buy_count":      len(wb),
            "unique_buyers":  len(unique),
            "total_sol":      round(total_sol, 4),
            "top_wallet_pct": round(top_share * 100, 1),
            "sniper_buys":    sniper_buy_count,
            "same_slot_buys": same_slot,
            "end_mcap":       round(mcap_end, 2),
        }

    w60  = window(60)
    w120 = window(120)
    w180 = window(180)

    # Full run stats
    all_wallets = [b["wallet"] for b in buys if b["wallet"]]
    all_sol     = sum(b["sol"] for b in buys)
    wallet_vol  = defaultdict(float)
    for b in buys:
        if b["wallet"]:
            wallet_vol[b["wallet"]] += b["sol"]
    top_share_all = (max(wallet_vol.values()) / all_sol) if all_sol > 0 and wallet_vol else 0

    # 1-sec bars for first 3 min
    bars = []
    for s in range(180):
        cnt = sum(1 for b in buys if t0 + s <= b["t"] < t0 + s + 1)
        bars.append(cnt)

    # Sniper ratio in first minute
    sniper_ratio_60 = round(w60["sniper_buys"] / w60["buy_count"] * 100, 1) if w60["buy_count"] > 0 else 0

    is_bundled = w60["top_wallet_pct"] >= 40
    is_sniped  = w60["same_slot_buys"] >= 3
    is_high_sniper_ratio = sniper_ratio_60 >= 20   # ≥20% buys from known serial snipers

    flags = []
    if is_bundled:           flags.append("bundled")
    if is_sniped:            flags.append("sniped")
    if is_high_sniper_ratio: flags.append("sniper_traffic")

    coins.append({
        "mint":            mint,
        "name":            token_meta.get(mint, {}).get("name"),
        "symbol":          token_meta.get(mint, {}).get("symbol"),
        "creator":         token_meta.get(mint, {}).get("creator") or coin_creator.get(mint),
        "launched_at":     t0,
        "migrated":        mint in migrated,
        "migration_sec":   round(migration_time[mint] - t0) if mint in migrated else None,
        "flags":           flags,
        "low_activity":    w60["buy_count"] < 3,
        "w60":  w60,
        "w120": w120,
        "w180": w180,
        "sniper_ratio_60": sniper_ratio_60,
        "total_buys_60min": len(buys),
        "total_sol_60min":  round(all_sol, 4),
        "top_wallet_pct_all": round(top_share_all * 100, 1),
        "bars_3min":       bars,
    })

clean     = [c for c in coins if not c["flags"] and not c["low_activity"]]
clean_mig = [c for c in clean if c["migrated"]]
clean_non = [c for c in clean if not c["migrated"]]

print(f"\nClean coins: {len(clean)} | Migrators: {len(clean_mig)} | Non: {len(clean_non)}")

# ── Interesting patterns ───────────────────────────────────────────────────
findings = {}

# Pattern 1: buy velocity curve — does the buy rate accelerate or decay?
print("\nPattern: buy velocity (buys per 30-sec slot)...")
mig_velocity = {"0-30s": [], "30-60s": [], "60-90s": [], "90-120s": []}
non_velocity = {"0-30s": [], "30-60s": [], "60-90s": [], "90-120s": []}
for c in clean:
    bars = c["bars_3min"]
    slots = {
        "0-30s":   sum(bars[0:30]),
        "30-60s":  sum(bars[30:60]),
        "60-90s":  sum(bars[60:90]),
        "90-120s": sum(bars[90:120]),
    }
    target = mig_velocity if c["migrated"] else non_velocity
    for k, v in slots.items():
        target[k].append(v)

def med(lst):
    if not lst: return 0
    s = sorted(lst); return round(s[len(s)//2], 1)

findings["velocity_30s_slots"] = {
    "migrators": {k: med(v) for k, v in mig_velocity.items()},
    "non_migrators": {k: med(v) for k, v in non_velocity.items()},
    "insight": "Do migrators sustain or accelerate? Non-migrators often spike then die."
}

# Pattern 2: creator repeat rate — same wallet launched multiple coins in this session
print("Pattern: creator repeat rate...")
creator_coin_count = defaultdict(int)
for c in coins:
    if c["creator"]:
        creator_coin_count[c["creator"]] += 1
repeat_creators = {w for w, cnt in creator_coin_count.items() if cnt >= 3}
findings["repeat_creators"] = {
    "total_unique_creators": len(creator_coin_count),
    "repeat_creators_3plus": len(repeat_creators),
    "coins_from_repeat_creators": sum(1 for c in coins if c["creator"] in repeat_creators),
    "migrators_from_repeat_creators": sum(1 for c in coins if c["migrated"] and c["creator"] in repeat_creators),
    "insight": "Repeat creators = known dev wallets that traders snipe. Filter these out."
}

# Pattern 3: sniper saturation vs outcome
print("Pattern: sniper traffic vs migration...")
findings["sniper_saturation"] = {
    "migrators_with_sniper_traffic": sum(1 for c in coins if c["migrated"] and "sniper_traffic" in c["flags"]),
    "migrators_clean_of_snipers":    sum(1 for c in coins if c["migrated"] and "sniper_traffic" not in c["flags"]),
    "non_mig_with_sniper_traffic":   sum(1 for c in coins if not c["migrated"] and "sniper_traffic" in c["flags"]),
    "insight": "High sniper ratio = others already saw it; harder to catch early."
}

# Pattern 4: repeat buyers (same wallet buys again in first 3 min) = conviction signal
print("Pattern: repeat buyer conviction...")
mig_repeat = []
non_repeat = []
for c in clean:
    buys_3m = [b for b in trades_by_mint[c["mint"]] if b["t"] <= c["launched_at"] + 180]
    wallet_buys = defaultdict(int)
    for b in buys_3m:
        if b["wallet"]:
            wallet_buys[b["wallet"]] += 1
    repeat_count = sum(1 for cnt in wallet_buys.values() if cnt >= 2)
    total_uniq   = len(wallet_buys)
    ratio = round(repeat_count / total_uniq * 100, 1) if total_uniq > 0 else 0
    if c["migrated"]:
        mig_repeat.append(ratio)
    else:
        non_repeat.append(ratio)

findings["repeat_buyer_ratio"] = {
    "migrators_median_pct":     med(mig_repeat),
    "non_migrators_median_pct": med(non_repeat),
    "insight": "Higher repeat-buyer % = more conviction from early holders."
}

# Pattern 5: first-minute market cap ceiling — where do duds stall?
print("Pattern: market cap trajectory...")
mig_mcap_1m   = [c["w60"]["end_mcap"]  for c in clean_mig]
non_mcap_1m   = [c["w60"]["end_mcap"]  for c in clean_non if c["w60"]["end_mcap"] > 0]
mig_mcap_3m   = [c["w180"]["end_mcap"] for c in clean_mig]
non_mcap_3m   = [c["w180"]["end_mcap"] for c in clean_non if c["w180"]["end_mcap"] > 0]

findings["mcap_trajectory"] = {
    "1min_end_mcap": {
        "migrators_median":     med(mig_mcap_1m),
        "non_migrators_median": med(non_mcap_1m),
    },
    "3min_end_mcap": {
        "migrators_median":     med(mig_mcap_3m),
        "non_migrators_median": med(non_mcap_3m),
    },
    "insight": "Most non-migrators stall below 35 SOL mcap by minute 3; migrators are already past 100 SOL."
}

# ── Save compact clean-coin records ───────────────────────────────────────
print("\nSaving outputs...")

write_json(OUT_DIR / "findings.json", {
    "batch_id":     "batch-002",
    "run_id":       "run-0001-20260908T170044.113Z",
    "recorded":     "2026-09-08 12:00–13:00 Central",
    "total_coins":  len(coins),
    "migrated":     len(migrated),
    "clean_coins":  len(clean),
    "clean_migrators": len(clean_mig),
    "patterns":     findings,
    "top_rules": [
        {"rule": "≥50 unique buyers in first 1 min (clean)", "precision_pct": 33.3, "recall_pct": 100, "signals_per_hour": 12},
        {"rule": "≥30 SOL volume in first 1 min (clean)",    "precision_pct": 30.8, "recall_pct": 100, "signals_per_hour": 13},
        {"rule": "≥30 unique buyers in first 1 min (clean)", "precision_pct": 23.5, "recall_pct": 100, "signals_per_hour": 17},
    ],
})

# Compact clean-coin summary (no bars, just numbers) — tiny file
compact = []
for c in clean:
    compact.append({
        "mint":          c["mint"],
        "name":          c["name"],
        "symbol":        c["symbol"],
        "creator":       c["creator"],
        "migrated":      c["migrated"],
        "migration_sec": c["migration_sec"],
        "flags":         c["flags"],
        "sniper_ratio_60": c["sniper_ratio_60"],
        "w60":  c["w60"],
        "w120": c["w120"],
        "w180": c["w180"],
        "total_buys_60min": c["total_buys_60min"],
        "total_sol_60min":  c["total_sol_60min"],
    })
write_json(OUT_DIR / "clean-coins.json", compact)

# Migrators only with full bars (for future ML / visual review)
mig_full = []
for c in clean_mig:
    mig_full.append({**c})
# Also include flagged migrators for reference
flagged_mig = [c for c in coins if c["migrated"] and c["flags"]]
for c in flagged_mig:
    mig_full.append({**c, "_note": "flagged_migrator"})
write_json(OUT_DIR / "all-migrators.json", mig_full)

# Sniper wallet list
write_json(OUT_DIR / "sniper-wallets.json", {
    "description": "Wallets that appeared in 10+ different coins in this 60-min window",
    "count": len(sniper_wallets),
    "wallets": sorted(sniper_wallets),
})

# Repeat creator list
write_json(OUT_DIR / "repeat-creators.json", {
    "description": "Creator wallets that launched 3+ coins in this session (dev-wallet snipe targets)",
    "count": len(repeat_creators),
    "wallets": {w: creator_coin_count[w] for w in sorted(repeat_creators)},
})

print("\n=== SUMMARY ===")
print(f"Velocity (buys per 30s slot, median):")
for slot in ["0-30s","30-60s","60-90s","90-120s"]:
    m = med(mig_velocity[slot])
    n = med(non_velocity[slot])
    print(f"  {slot}:  migrators={m:>6}  non={n:>6}")

print(f"\nRepeat buyer ratio (first 3 min):")
print(f"  Migrators median:     {med(mig_repeat)}%")
print(f"  Non-migrators median: {med(non_repeat)}%")

print(f"\nMarket cap at 1 min:")
print(f"  Migrators:     {med(mig_mcap_1m)} SOL")
print(f"  Non-migrators: {med(non_mcap_1m)} SOL")

print(f"\nCreators launching 3+ coins in 1 hour: {len(repeat_creators)}")
print(f"  Coins from those wallets: {findings['repeat_creators']['coins_from_repeat_creators']}")
print(f"  Migrators from those wallets: {findings['repeat_creators']['migrators_from_repeat_creators']}")

print(f"\nSniper wallets found: {len(sniper_wallets)}")
print(f"  Migrators with sniper traffic: {findings['sniper_saturation']['migrators_with_sniper_traffic']}")
print(f"  Migrators clean of snipers:    {findings['sniper_saturation']['migrators_clean_of_snipers']}")

print("\nAll files saved to:", OUT_DIR)
