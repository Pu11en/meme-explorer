#!/usr/bin/env python3
"""
Phase 2 — Early-entry backtest with real prices from parquet archive.

For each coin in the 40-batch parquet dataset, this script:
  1. Computes entry price at 15s and 20s (market cap proxy from nearest trade).
  2. Computes Tier 1 features at 15s/20s: buyer cadence, dead gaps, unique buyers.
  3. Simulates Tier 0 (watchlist dev at t=0), Tier 1 threshold sweep, Tier 2 (60 Burst at 60s).
  4. For each position: exit at migration, 2x take-profit, -50% stop, or 5min timeout.
  5. Deducts 1% pump.fun fee each side + 0.002 SOL priority fee + bonding-curve slippage.
  6. Reports EV per fire, win rate, and fires/day for each rule variant.

Output: analysis/backtest-phase2.json + summary printed to stdout.

Usage:
  python3 scripts/backtest_phase2.py
  (Takes ~2-3 min for 40 batches.)
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

REPO         = Path(__file__).parent.parent.resolve()
PARQUET_DIR  = Path("/Users/drewp/Library/Application Support/MemeExplorer/parquet")
WATCHLIST_F  = REPO / "analysis" / "dev-watchlist.json"
DUNE_F       = REPO / "analysis" / "dune-backfill-sep10-14.json"
OUT_FILE     = REPO / "analysis" / "backtest-phase2.json"
INSIGHTS_F   = REPO / "docs" / "analysis" / "data-insights.md"

# Simulation constants
PUMPFUN_FEE_RATE  = 0.01    # 1% each side
PRIORITY_FEE_SOL  = 0.002   # SOL per trade
BUY_SIZE_SOL      = 0.1     # virtual position size in SOL
SLIPPAGE_PCT      = 0.007   # bonding-curve price impact at 0.1 SOL buy
TAKE_PROFIT_X     = 2.0     # exit if mcap doubles
STOP_LOSS_X       = 0.5     # exit if mcap halves
TIMEOUT_SEC       = 300     # 5-minute timeout exit
BATCH_HOURS       = 9       # hours recorded per day


def load_parquet(path, columns=None):
    import pyarrow.parquet as pq
    t = pq.read_table(path, columns=columns)
    return t.to_pydict()


def epoch(ts_str):
    from datetime import datetime, timezone
    if ts_str is None:
        return None
    ts_str = ts_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(ts_str).timestamp()
    except Exception:
        return None


def load_watchlist():
    if not WATCHLIST_F.exists():
        return set()
    with open(WATCHLIST_F) as f:
        data = json.load(f)
    return {w["wallet"] for w in data.get("wallets", [])}


# ── Price timeline helpers ─────────────────────────────────────────────────

def compute_price_at(coin_t0, trades_for_mint, target_sec):
    """Return (mcap_at_target, found) — mcap of the last trade at/before t0+target_sec.
    Falls back to nearest trade after if none before."""
    target_t = coin_t0 + target_sec
    best_before = None
    best_after = None
    for t, mcap in trades_for_mint:
        if t <= target_t:
            best_before = mcap
        elif best_after is None:
            best_after = (t, mcap)
    if best_before is not None:
        return best_before
    if best_after is not None:
        return best_after[1]
    return None


def compute_tier1_features(coin_t0, trades_for_mint, window_end_sec):
    """Compute Tier 1 signals at window_end_sec after launch.
    Returns dict of features."""
    cutoff = coin_t0 + window_end_sec
    window_trades = [(t, w) for t, w, _ in trades_for_mint if t <= cutoff]
    if not window_trades:
        return {}

    unique_buyers = len(set(w for _, w in window_trades))
    buy_times = sorted(t for t, _ in window_trades)
    active_secs = len(set(int(t - coin_t0) for t in buy_times if 0 <= t - coin_t0 < window_end_sec))

    # Dead gap: max consecutive seconds with no buys
    last_buy_t = coin_t0
    max_gap = 0
    for t in buy_times:
        gap = t - last_buy_t
        if gap > max_gap:
            max_gap = gap
        last_buy_t = t

    # New-buyer arrival in last 5s of window
    five_sec_ago = cutoff - 5
    buyers_in_last5 = {w for t, w in window_trades if t > five_sec_ago}
    new_in_last5 = len(buyers_in_last5)

    return {
        "total_buys":    len(window_trades),
        "unique_buyers": unique_buyers,
        "active_secs":   active_secs,
        "max_gap_sec":   round(max_gap, 1),
        "new_in_last5":  new_in_last5,
        "buy_rate":      round(len(window_trades) / window_end_sec, 2),
    }


# ── Simulation ─────────────────────────────────────────────────────────────

def simulate_trade(entry_mcap, all_trades_for_mint, coin_t0, migration_mcap, migration_t,
                   entry_t, size_sol=BUY_SIZE_SOL):
    """Simulate entering at entry_mcap, exiting at first of: migration, 2x, -50%, 5min.
    TP/SL exits are CAPPED at the trigger level (conservative, no gap-slip windfall).
    Returns (PnL in SOL after fees, exit_reason). Returns (None, None) if no exit data."""
    if entry_mcap is None or entry_mcap <= 0:
        return None, None

    entry_with_slip = entry_mcap * (1 + SLIPPAGE_PCT)
    fee_in = size_sol * PUMPFUN_FEE_RATE + PRIORITY_FEE_SOL
    tp_mcap = entry_with_slip * TAKE_PROFIT_X
    sl_mcap = entry_with_slip * STOP_LOSS_X

    exit_mcap = None
    exit_reason = "timeout"

    # Walk trades chronologically after entry
    for t, mcap in all_trades_for_mint:
        if t <= entry_t:
            continue
        rel_t = t - coin_t0

        # Migration exit (use migration price if available, else this trade)
        if migration_t and t >= migration_t:
            exit_mcap = migration_mcap if migration_mcap else mcap
            exit_reason = "migration"
            break

        # Take-profit (cap at exactly 2× entry to avoid gap windfalls)
        if mcap >= tp_mcap:
            exit_mcap = tp_mcap
            exit_reason = "take_profit"
            break

        # Stop-loss (cap at exactly 0.5× entry)
        if mcap <= sl_mcap:
            exit_mcap = sl_mcap
            exit_reason = "stop_loss"
            break

        # Timeout
        if rel_t >= TIMEOUT_SEC:
            exit_mcap = mcap
            exit_reason = "timeout"
            break

    if exit_mcap is None:
        # No trade reached after entry — use last available price
        post = [(t, mc) for t, mc in all_trades_for_mint if t > entry_t]
        if not post:
            return None, None
        exit_mcap = post[-1][1]
        exit_reason = "timeout"

    # Clamp exit to TP/SL bounds in case last-price overshoot
    exit_mcap = max(sl_mcap, min(exit_mcap, tp_mcap)) if exit_reason == "timeout" else exit_mcap

    gross_ratio = exit_mcap / entry_with_slip - 1
    exit_fee    = size_sol * max(0, gross_ratio) * PUMPFUN_FEE_RATE + PRIORITY_FEE_SOL
    pnl_sol     = size_sol * gross_ratio - fee_in - exit_fee
    return round(pnl_sol, 6), exit_reason


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    import pyarrow.parquet as pq

    print("Loading watchlist…")
    watchlist = load_watchlist()
    print(f"  Watchlist: {len(watchlist)} wallets")

    # Load Dune backfill for creator and pre-computed signal features (Sep 10-14)
    dune_by_mint = {}
    if DUNE_F.exists():
        with open(DUNE_F) as f:
            dune_data = json.load(f)
        for row in dune_data:
            m = row.get("mint")
            if m:
                dune_by_mint[m] = row
        print(f"  Dune backfill: {len(dune_by_mint)} coins with signal features")

    batches = sorted(PARQUET_DIR.glob("batch-*"))
    print(f"Loading {len(batches)} batches from parquet…")

    all_coins = {}     # mint → {t0, creator, migrated, migration_t, migration_mcap}
    all_trades = defaultdict(list)   # mint → [(t, mcap, wallet)]
    creator_map = {}  # mint → creator (from tokens)

    for i, batch_dir in enumerate(batches):
        if i % 10 == 0:
            print(f"  batch {i+1}/{len(batches)}…")

        # Load events for t0
        ev_path = batch_dir / "events.parquet"
        if ev_path.exists():
            ev = load_parquet(ev_path, columns=["action", "mint", "source_at"])
            for j, action in enumerate(ev["action"]):
                if action == "create":
                    mint = ev["mint"][j]
                    t0 = epoch(ev["source_at"][j])
                    if mint and t0:
                        all_coins.setdefault(mint, {})["t0"] = t0

        # Load tokens for creator
        tk_path = batch_dir / "tokens.parquet"
        if tk_path.exists():
            tk = load_parquet(tk_path, columns=["mint", "creator"])
            for j, mint in enumerate(tk["mint"]):
                cw = tk["creator"][j]
                if mint and cw:
                    creator_map[mint] = cw

        # Load migrations (no mcap in this parquet — will interpolate from trades later)
        mg_path = batch_dir / "migrations.parquet"
        if mg_path.exists():
            mg = load_parquet(mg_path, columns=["mint", "stage", "source_at"])
            for j, mint in enumerate(mg["mint"]):
                if mg["stage"][j] == "migrate":
                    t = epoch(mg["source_at"][j])
                    if mint and t:
                        existing = all_coins.get(mint, {})
                        if not existing.get("migration_t") or t < existing["migration_t"]:
                            all_coins.setdefault(mint, {})["migration_t"] = t
                            all_coins[mint]["migrated"] = True

        # Load trades
        tr_path = batch_dir / "trades.parquet"
        if tr_path.exists():
            tr = load_parquet(tr_path, columns=["mint", "side", "source_at",
                                                  "market_cap_quote", "signing_wallet"])
            for j, mint in enumerate(tr["mint"]):
                if tr["side"][j] != "buy":
                    continue
                t = epoch(tr["source_at"][j])
                mcap_str = tr["market_cap_quote"][j]
                wallet = tr["signing_wallet"][j]
                if mint and t and mcap_str:
                    try:
                        mcap = float(mcap_str)
                        all_trades[mint].append((t, mcap, wallet or ""))
                    except (ValueError, TypeError):
                        pass

    # Sort trades per mint by time
    for mint in all_trades:
        all_trades[mint].sort(key=lambda x: x[0])

    # Assign creator, compute migration mcap from nearest trade before migration
    for mint, coin in all_coins.items():
        coin["creator"] = creator_map.get(mint)
        coin.setdefault("migrated", False)
        mg_t = coin.get("migration_t")
        if mg_t and mint in all_trades:
            # Use price of last trade at or before migration
            mcap_at_mig = None
            for t, mc, _ in all_trades[mint]:
                if t <= mg_t:
                    mcap_at_mig = mc
            coin["migration_mcap"] = mcap_at_mig

    print(f"  Total coins: {len(all_coins)}, with trades: {len(all_trades)}")

    # ── Build coin feature records ──────────────────────────────────────────
    print("Computing features and price series…")

    records = []
    for mint, coin in all_coins.items():
        t0 = coin.get("t0")
        if t0 is None:
            continue
        trades = [(t, mc) for t, mc, _ in all_trades.get(mint, [])]
        trades_with_wallet = all_trades.get(mint, [])

        entry_mcap_15 = compute_price_at(t0, trades, 15)
        entry_mcap_20 = compute_price_at(t0, trades, 20)
        entry_mcap_60 = compute_price_at(t0, trades, 60)
        entry_mcap_0  = trades[0][1] if trades else None  # first trade ≈ launch price

        features_15 = compute_tier1_features(t0, trades_with_wallet, 15)
        features_20 = compute_tier1_features(t0, trades_with_wallet, 20)
        features_60 = compute_tier1_features(t0, trades_with_wallet, 60)

        # Pull creator and Dune signal features by mint join
        dune = dune_by_mint.get(mint, {})
        creator = dune.get("creator") or coin.get("creator")
        on_watchlist = creator in watchlist if creator else False
        migration_t = coin.get("migration_t")
        migration_mcap = coin.get("migration_mcap")
        migrated = coin.get("migrated", False)

        # 60 Burst signal from Dune (most reliable — computed over full 60s window)
        dune_signal_60burst = dune.get("signal_60burst", False)
        dune_uniq_60 = dune.get("uniq_60", 0)
        dune_same_slot = dune.get("same_slot_buys", 0)

        records.append({
            "mint": mint,
            "t0": t0,
            "creator": creator,
            "on_watchlist": on_watchlist,
            "migrated": migrated,
            "migration_t": migration_t,
            "migration_mcap": migration_mcap,
            "entry_mcap_0":  entry_mcap_0,
            "entry_mcap_15": entry_mcap_15,
            "entry_mcap_20": entry_mcap_20,
            "entry_mcap_60": entry_mcap_60,
            "f15": features_15,
            "f20": features_20,
            "f60": features_60,
            "dune_signal_60burst": dune_signal_60burst,
            "dune_uniq_60": dune_uniq_60,
            "dune_same_slot": dune_same_slot,
        })

    print(f"  Records with features: {len(records)}")

    # ── Threshold sweep ────────────────────────────────────────────────────
    print("Running threshold sweep…")

    def run_simulation(entries, label):
        pnls, reasons = [], []
        for rec, entry_t_offset in entries:
            mint = rec["mint"]
            t0 = rec["t0"]
            entry_t = t0 + entry_t_offset
            all_mc = [(t, mc) for t, mc, _ in all_trades.get(mint, [])]
            entry_mcap = rec.get(f"entry_mcap_{entry_t_offset}")
            pnl, reason = simulate_trade(
                entry_mcap, all_mc, t0,
                rec.get("migration_mcap"), rec.get("migration_t"),
                entry_t,
            )
            if pnl is not None:
                pnls.append(pnl)
                reasons.append(reason)

        if not pnls:
            return {"label": label, "fires": 0}

        wins = sum(1 for p in pnls if p > 0)
        return {
            "label": label,
            "fires": len(pnls),
            "ev_per_fire_sol": round(sum(pnls) / len(pnls), 6),
            "win_rate_pct": round(wins / len(pnls) * 100, 1),
            "total_pnl_sol": round(sum(pnls), 4),
            "median_pnl_sol": round(sorted(pnls)[len(pnls)//2], 6),
            "exits": {r: reasons.count(r) for r in set(reasons)},
        }

    results = []

    # Tier 0: watchlist dev at launch price (t=0)
    tier0_entries = [(r, 0) for r in records if r["on_watchlist"] and r["entry_mcap_0"]]
    results.append(run_simulation(tier0_entries, "Tier0: watchlist@launch"))

    # Tier 1 candidates at 15s — sweep unique_buyers threshold
    for min_uniq in [3, 5, 8, 10, 15]:
        for max_gap in [5, 10, 20]:
            label = f"Tier1@15s: uniq≥{min_uniq}, gap≤{max_gap}s"
            entries = [
                (r, 15) for r in records
                if r["f15"].get("unique_buyers", 0) >= min_uniq
                and r["f15"].get("max_gap_sec", 999) <= max_gap
                and r["entry_mcap_15"] is not None
            ]
            results.append(run_simulation(entries, label))

    # Tier 1 candidates at 20s
    for min_uniq in [5, 8, 10, 15]:
        for max_gap in [5, 10, 20]:
            label = f"Tier1@20s: uniq≥{min_uniq}, gap≤{max_gap}s"
            entries = [
                (r, 20) for r in records
                if r["f20"].get("unique_buyers", 0) >= min_uniq
                and r["f20"].get("max_gap_sec", 999) <= max_gap
                and r["entry_mcap_20"] is not None
            ]
            results.append(run_simulation(entries, label))

    # Tier 2 (comparison): 60 Burst from Dune signal flag (gold standard)
    tier2_entries = [
        (r, 60) for r in records
        if r.get("dune_signal_60burst")
        and r["entry_mcap_60"] is not None
    ]
    results.append(run_simulation(tier2_entries, "Tier2@60s: 60Burst signal (comparison)"))

    # Print report
    print("\n" + "="*70)
    print("PHASE 2 BACKTEST RESULTS")
    print(f"Dataset: {len(records)} coins, {BATCH_HOURS}h/day × {len(batches)//BATCH_HOURS:.0f} days")
    print("Fees: 1% each side + 0.002 SOL priority; slippage: 0.7%; size: 0.1 SOL")
    print("Exits: migration / 2× TP / 0.5× SL / 5min timeout")
    print("="*70)
    print(f"{'Label':<45} {'Fires':>6} {'WinRate':>8} {'EV/fire':>10} {'TotalPnL':>10}")
    print("-"*80)

    best_positive = []
    for r in results:
        if r["fires"] == 0:
            continue
        ev = r.get("ev_per_fire_sol", 0)
        wr = r.get("win_rate_pct", 0)
        fires = r["fires"]
        total = r.get("total_pnl_sol", 0)
        label = r["label"]
        print(f"{label:<45} {fires:>6} {wr:>7.1f}% {ev:>+10.5f} {total:>+10.4f}")
        if ev > 0:
            best_positive.append(r)

    print()
    migrated_count = sum(1 for r in records if r["migrated"])
    watchlist_fires_total = sum(1 for r in records if r["on_watchlist"])
    print(f"Background: {len(records)} coins, {migrated_count} migrated ({migrated_count/len(records)*100:.1f}%)")
    print(f"Watchlist launches seen: {watchlist_fires_total} ({watchlist_fires_total/len(records)*100:.2f}% of flow)")

    if best_positive:
        print(f"\n✓ {len(best_positive)} rules with positive EV after fees")
    else:
        print("\n✗ No rules with positive EV — revisit features or entry timing")

    # Save
    summary = {
        "dataset": {"batches": len(batches), "total_coins": len(records), "migrated": migrated_count},
        "sim_params": {
            "pumpfun_fee_rate": PUMPFUN_FEE_RATE,
            "priority_fee_sol": PRIORITY_FEE_SOL,
            "buy_size_sol": BUY_SIZE_SOL,
            "slippage_pct": SLIPPAGE_PCT,
            "take_profit_x": TAKE_PROFIT_X,
            "stop_loss_x": STOP_LOSS_X,
            "timeout_sec": TIMEOUT_SEC,
        },
        "results": results,
    }
    with open(OUT_FILE, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nSaved: {OUT_FILE}")


if __name__ == "__main__":
    main()
