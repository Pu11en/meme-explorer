#!/usr/bin/env python3
"""
Phase 3 — Exit signal design for Tier 0 (watchlist dev at launch).

Using the same 40-batch parquet dataset, this script:
  1. Loads all Tier 0 entries (watchlist dev coins) with their post-entry trade sequence.
  2. Sweeps dead-streak thresholds (N seconds with no buys → exit).
  3. Sweeps buyer-stall thresholds (arrival rate drops below X new buyers per 10s).
  4. Measures concentration-climb (top-wallet share rising post-entry).
  5. Re-runs Phase 2 simulation with calibrated exit signals vs naive 0.5× SL / 5min.
  6. Keeps whichever exit rule improves EV and reports the optimal combination.

Output: analysis/exit-signals-phase3.json + summary printed to stdout.

Usage:
  python3 scripts/exit_signal_phase3.py
"""
import json
from collections import defaultdict
from pathlib import Path

REPO         = Path(__file__).parent.parent.resolve()
PARQUET_DIR  = Path("/Users/drewp/Library/Application Support/MemeExplorer/parquet")
WATCHLIST_F  = REPO / "analysis" / "dev-watchlist.json"
DUNE_F       = REPO / "analysis" / "dune-backfill-sep10-14.json"
OUT_FILE     = REPO / "analysis" / "exit-signals-phase3.json"

PUMPFUN_FEE_RATE = 0.01
PRIORITY_FEE_SOL = 0.002
BUY_SIZE_SOL     = 0.1
SLIPPAGE_PCT     = 0.007
TAKE_PROFIT_X    = 2.0
STOP_LOSS_X      = 0.5
TIMEOUT_SEC      = 300


def load_parquet(path, columns=None):
    import pyarrow.parquet as pq
    t = pq.read_table(path, columns=columns)
    return t.to_pydict()


def epoch(ts_str):
    from datetime import datetime, timezone
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def main():
    import pyarrow.parquet as pq

    # Load watchlist
    with open(WATCHLIST_F) as f:
        wl = json.load(f)
    watchlist = {w["wallet"] for w in wl["wallets"]}
    print(f"Watchlist: {len(watchlist)} wallets")

    # Load Dune for creator mapping
    dune_by_mint = {}
    if DUNE_F.exists():
        with open(DUNE_F) as f:
            for row in json.load(f):
                m = row.get("mint")
                if m:
                    dune_by_mint[m] = row
    print(f"Dune backfill: {len(dune_by_mint)} coins")

    batches = sorted(PARQUET_DIR.glob("batch-*"))
    print(f"Loading {len(batches)} batches…")

    coin_t0 = {}         # mint → t0
    coin_mig = {}        # mint → {migration_t, migration_mcap}
    all_trades = defaultdict(list)   # mint → [(t, mcap, wallet)]

    for i, batch_dir in enumerate(batches):
        if i % 10 == 0:
            print(f"  batch {i+1}/{len(batches)}…")

        ev_path = batch_dir / "events.parquet"
        if ev_path.exists():
            ev = load_parquet(ev_path, columns=["action", "mint", "source_at"])
            for j, action in enumerate(ev["action"]):
                if action == "create":
                    m = ev["mint"][j]
                    t = epoch(ev["source_at"][j])
                    if m and t:
                        coin_t0[m] = t

        mg_path = batch_dir / "migrations.parquet"
        if mg_path.exists():
            mg = load_parquet(mg_path, columns=["mint", "stage", "source_at"])
            for j, m in enumerate(mg["mint"]):
                if mg["stage"][j] == "migrate":
                    t = epoch(mg["source_at"][j])
                    if m and t:
                        if m not in coin_mig or t < coin_mig[m]["migration_t"]:
                            coin_mig[m] = {"migration_t": t}

        tr_path = batch_dir / "trades.parquet"
        if tr_path.exists():
            tr = load_parquet(tr_path, columns=["mint", "side", "source_at",
                                                  "market_cap_quote", "signing_wallet"])
            for j, m in enumerate(tr["mint"]):
                if tr["side"][j] != "buy":
                    continue
                t = epoch(tr["source_at"][j])
                mcap_str = tr["market_cap_quote"][j]
                w = tr["signing_wallet"][j] or ""
                if m and t and mcap_str:
                    try:
                        all_trades[m].append((t, float(mcap_str), w))
                    except (ValueError, TypeError):
                        pass

    for m in all_trades:
        all_trades[m].sort(key=lambda x: x[0])

    # Fill migration mcap from trades
    for m, info in coin_mig.items():
        mg_t = info["migration_t"]
        best_mcap = None
        for t, mc, _ in all_trades.get(m, []):
            if t <= mg_t:
                best_mcap = mc
        info["migration_mcap"] = best_mcap

    # Build Tier 0 records: watchlist dev coins seen in parquet
    print("Building Tier 0 records…")
    tier0 = []
    for mint, t0 in coin_t0.items():
        dune = dune_by_mint.get(mint, {})
        creator = dune.get("creator")
        if not creator or creator not in watchlist:
            continue
        trades = all_trades.get(mint, [])
        if not trades:
            continue
        entry_mcap = trades[0][1]  # first trade ≈ launch price
        if not entry_mcap or entry_mcap <= 0:
            continue
        mig = coin_mig.get(mint, {})
        tier0.append({
            "mint": mint,
            "t0": t0,
            "creator": creator,
            "entry_mcap": entry_mcap,
            "entry_t": trades[0][0],
            "migration_t": mig.get("migration_t"),
            "migration_mcap": mig.get("migration_mcap"),
            "migrated": mint in coin_mig,
            "trades": trades,  # (t, mcap, wallet)
        })

    print(f"  Tier 0 coins: {len(tier0)} (watchlist devs in parquet)")

    # ── Exit signal sweep ──────────────────────────────────────────────────

    def simulate_with_exits(coins, dead_streak_s=None, stall_buyers_per10s=None):
        """Simulate Tier 0 with optional early-exit signals replacing the naive SL."""
        results = []
        for coin in coins:
            entry_mcap = coin["entry_mcap"]
            entry_t = coin["entry_t"]
            t0 = coin["t0"]
            trades = coin["trades"]
            migration_t = coin["migration_t"]
            migration_mcap = coin["migration_mcap"]

            entry_slip = entry_mcap * (1 + SLIPPAGE_PCT)
            fee_in = BUY_SIZE_SOL * PUMPFUN_FEE_RATE + PRIORITY_FEE_SOL
            tp_mcap = entry_slip * TAKE_PROFIT_X
            sl_mcap = entry_slip * STOP_LOSS_X

            exit_mcap = None
            exit_reason = "timeout"
            last_buy_t = entry_t

            post_trades = [(t, mc, w) for t, mc, w in trades if t > entry_t]
            buyers_seen = set()

            # Track rolling new buyers per 10s window for stall detection
            window_buyers = []  # (t, wallet) for recent buyers

            for t, mcap, wallet in post_trades:
                rel = t - t0
                elapsed = t - entry_t

                # Migration
                if migration_t and t >= migration_t:
                    exit_mcap = migration_mcap if migration_mcap else mcap
                    exit_reason = "migration"
                    break

                # TP
                if mcap >= tp_mcap:
                    exit_mcap = tp_mcap
                    exit_reason = "take_profit"
                    break

                # Naive SL (always active as backstop)
                if mcap <= sl_mcap:
                    exit_mcap = sl_mcap
                    exit_reason = "stop_loss"
                    break

                # Timeout
                if elapsed >= TIMEOUT_SEC:
                    exit_mcap = mcap
                    exit_reason = "timeout"
                    break

                # Dead streak signal: no buys for N consecutive seconds
                if dead_streak_s and (t - last_buy_t) >= dead_streak_s:
                    exit_mcap = mcap
                    exit_reason = "dead_streak"
                    break

                # Buyer stall: count new unique buyers in last 10s
                if stall_buyers_per10s is not None:
                    window_buyers = [(bt, bw) for bt, bw in window_buyers if t - bt <= 10]
                    if wallet and wallet not in buyers_seen:
                        window_buyers.append((t, wallet))
                    new_in_window = len(set(bw for _, bw in window_buyers if bw not in buyers_seen))
                    if elapsed > 20 and new_in_window < stall_buyers_per10s:
                        exit_mcap = mcap
                        exit_reason = "buyer_stall"
                        break

                last_buy_t = t
                if wallet:
                    buyers_seen.add(wallet)

            if exit_mcap is None:
                # No trades after entry → skip
                if not post_trades:
                    continue
                exit_mcap = post_trades[-1][1]
                exit_reason = "timeout"

            # Cap exits
            if exit_reason in ("timeout", "dead_streak", "buyer_stall"):
                exit_mcap = max(sl_mcap, min(exit_mcap, tp_mcap))

            gross = exit_mcap / entry_slip - 1
            exit_fee = BUY_SIZE_SOL * max(0, gross) * PUMPFUN_FEE_RATE + PRIORITY_FEE_SOL
            pnl = BUY_SIZE_SOL * gross - fee_in - exit_fee
            results.append((pnl, exit_reason))

        if not results:
            return {}
        pnls = [p for p, _ in results]
        reasons = [r for _, r in results]
        wins = sum(1 for p in pnls if p > 0)
        return {
            "fires": len(pnls),
            "ev": round(sum(pnls) / len(pnls), 6),
            "win_rate": round(wins / len(pnls) * 100, 1),
            "total_pnl": round(sum(pnls), 4),
            "exits": {r: reasons.count(r) for r in set(reasons)},
        }

    # Baseline (no early exits)
    print("\nRunning sweeps…")
    baseline = simulate_with_exits(tier0)
    print(f"Baseline (naive SL/TP/timeout only): EV={baseline['ev']:+.4f}, win={baseline['win_rate']:.1f}%")
    print(f"  exits: {baseline['exits']}")

    # Dead streak sweep
    sweep_results = {"baseline": baseline, "dead_streak": {}, "buyer_stall": {}}
    print("\nDead streak sweep (N seconds with no buys → exit):")
    for n in [5, 10, 15, 20, 30, 45, 60, 90, 120]:
        r = simulate_with_exits(tier0, dead_streak_s=n)
        sweep_results["dead_streak"][str(n)] = r
        print(f"  N={n:3}s: EV={r['ev']:+.5f}, win={r['win_rate']:.1f}%, exits={r['exits']}")

    print("\nBuyer stall sweep (< X new buyers per 10s window → exit, after 20s):")
    for x in [0.5, 1, 2, 3, 5]:
        r = simulate_with_exits(tier0, stall_buyers_per10s=x)
        sweep_results["buyer_stall"][str(x)] = r
        print(f"  X={x:4}: EV={r['ev']:+.5f}, win={r['win_rate']:.1f}%, exits={r['exits']}")

    # Find best single exit signal
    best_ds = max(sweep_results["dead_streak"].items(), key=lambda x: x[1]["ev"])
    best_stall = max(sweep_results["buyer_stall"].items(), key=lambda x: x[1]["ev"])
    print(f"\nBest dead streak: N={best_ds[0]}s → EV={best_ds[1]['ev']:+.5f} (baseline {baseline['ev']:+.5f})")
    print(f"Best buyer stall: X={best_stall[0]} → EV={best_stall[1]['ev']:+.5f}")

    # Try best combination
    best_ds_n = int(best_ds[0])
    best_stall_x = float(best_stall[0])
    combo = simulate_with_exits(tier0, dead_streak_s=best_ds_n, stall_buyers_per10s=best_stall_x)
    sweep_results["best_combo"] = {"dead_streak_s": best_ds_n, "stall_x": best_stall_x, "result": combo}
    print(f"\nCombined (DS={best_ds_n}s + stall<{best_stall_x}): EV={combo['ev']:+.5f}, win={combo['win_rate']:.1f}%")
    print(f"  exits: {combo['exits']}")

    with open(OUT_FILE, "w") as f:
        json.dump(sweep_results, f, indent=2)
    print(f"\nSaved: {OUT_FILE}")


if __name__ == "__main__":
    main()
