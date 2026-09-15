#!/usr/bin/env python3
"""
Phase 4 — Live paper trader for Tier 0 (watchlist dev at launch).

Works in two modes:
  - Historical: python3 scripts/paper_trader.py --historical
    Processes all parquet batches and populates analysis/paper-trades.json.
  - Batch: python3 scripts/paper_trader.py --batch <batch_id>
    Processes a single new batch and appends to the ledger.
    Called by pipeline.py after each batch completes.

Entry logic (Tier 0): when a new coin's creator is on the watchlist,
enter a virtual 0.1 SOL position at the first-trade mcap (≈ launch price).

Exit logic: 2× TP / 0.5× SL / 5min timeout (Phase 2 validated).

Discord: posts each closed trade to the Discord thread via CCDB API.
"""
import json
import os
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO         = Path(__file__).parent.parent.resolve()
PARQUET_DIR  = Path("/Users/drewp/Library/Application Support/MemeExplorer/parquet")
WATCHLIST_F  = REPO / "analysis" / "dev-watchlist.json"
DUNE_F       = REPO / "analysis" / "dune-backfill-sep10-14.json"
LEDGER_F     = REPO / "analysis" / "paper-trades.json"

CCDB_API     = os.environ.get("CCDB_API_URL", "http://127.0.0.1:9876")
THREAD_ID    = os.environ.get("DISCORD_THREAD_ID", "")

BUY_SIZE_SOL      = 0.1
PUMPFUN_FEE_RATE  = 0.01
PRIORITY_FEE_SOL  = 0.002
SLIPPAGE_PCT      = 0.007
TAKE_PROFIT_X     = 2.0
STOP_LOSS_X       = 0.5
TIMEOUT_SEC       = 300


def epoch(ts_str):
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def iso(ts):
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, timezone.utc).isoformat()


def load_parquet(path, columns=None):
    import pyarrow.parquet as pq
    t = pq.read_table(path, columns=columns)
    return t.to_pydict()


def load_watchlist():
    if not WATCHLIST_F.exists():
        return {}, {}
    with open(WATCHLIST_F) as f:
        data = json.load(f)
    by_wallet = {w["wallet"]: w for w in data.get("wallets", [])}
    return by_wallet, set(by_wallet.keys())


def load_dune_creators():
    if not DUNE_F.exists():
        return {}
    with open(DUNE_F) as f:
        data = json.load(f)
    return {r["mint"]: r.get("creator") for r in data if r.get("creator")}


def load_ledger():
    if LEDGER_F.exists():
        with open(LEDGER_F) as f:
            return json.load(f)
    return {"trades": [], "processed_batches": []}


def save_ledger(ledger):
    trades = ledger["trades"]
    wins = sum(1 for t in trades if t["pnl_sol"] > 0)
    total_pnl = sum(t["pnl_sol"] for t in trades)
    ledger["generated_at"] = datetime.now(timezone.utc).isoformat()
    ledger["total_trades"] = len(trades)
    ledger["total_pnl_sol"] = round(total_pnl, 4)
    ledger["win_rate_pct"] = round(wins / len(trades) * 100, 1) if trades else 0
    with open(LEDGER_F, "w") as f:
        json.dump(ledger, f, indent=2)


def post_discord(msg):
    if not THREAD_ID or not CCDB_API:
        return
    try:
        body = json.dumps({"text": msg, "mode": "queue", "hop": 0}).encode()
        req = urllib.request.Request(
            f"{CCDB_API}/api/threads/{THREAD_ID}/message",
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass  # don't let Discord failures break the pipeline


def process_batch(batch_id, batch_dir, watchlist_by_wallet, watchlist_set, dune_creators):
    """Returns list of closed trade records for this batch."""
    batch_dir = Path(batch_dir)
    trades_path = batch_dir / "trades.parquet"
    events_path = batch_dir / "events.parquet"
    migrations_path = batch_dir / "migrations.parquet"
    tokens_path = batch_dir / "tokens.parquet"

    if not trades_path.exists() or not events_path.exists():
        return []

    # Load coin creation times
    coin_t0 = {}
    ev = load_parquet(events_path, columns=["action", "mint", "source_at"])
    for j, action in enumerate(ev["action"]):
        if action == "create":
            m = ev["mint"][j]
            t = epoch(ev["source_at"][j])
            if m and t:
                coin_t0[m] = t

    # Load token names/symbols
    coin_meta = {}
    if tokens_path.exists():
        tk = load_parquet(tokens_path, columns=["mint", "name", "symbol"])
        for j, m in enumerate(tk["mint"]):
            if m:
                coin_meta[m] = {"name": tk["name"][j], "symbol": tk["symbol"][j]}

    # Load migrations
    coin_mig = {}
    if migrations_path.exists():
        mg = load_parquet(migrations_path, columns=["mint", "stage", "source_at"])
        for j, m in enumerate(mg["mint"]):
            if mg["stage"][j] == "migrate":
                t = epoch(mg["source_at"][j])
                if m and t:
                    if m not in coin_mig or t < coin_mig[m]:
                        coin_mig[m] = t

    # Load all buy trades
    all_trades = defaultdict(list)
    tr = load_parquet(trades_path, columns=["mint", "side", "source_at",
                                              "market_cap_quote", "signing_wallet"])
    for j, m in enumerate(tr["mint"]):
        if tr["side"][j] != "buy":
            continue
        t = epoch(tr["source_at"][j])
        mcap_str = tr["market_cap_quote"][j]
        if m and t and mcap_str:
            try:
                all_trades[m].append((t, float(mcap_str)))
            except (ValueError, TypeError):
                pass
    for m in all_trades:
        all_trades[m].sort()

    # Fill migration mcap from nearest trade before migration
    coin_mig_mcap = {}
    for m, mg_t in coin_mig.items():
        best = None
        for t, mc in all_trades.get(m, []):
            if t <= mg_t:
                best = mc
        coin_mig_mcap[m] = best

    # Find watchlist entries
    closed_trades = []
    for mint, t0 in coin_t0.items():
        # Get creator from dune backfill (parquet lacks it)
        creator = dune_creators.get(mint)
        if not creator or creator not in watchlist_set:
            continue
        trades = all_trades.get(mint, [])
        if not trades:
            continue
        entry_mcap = trades[0][1]
        entry_t = trades[0][0]
        if entry_mcap <= 0:
            continue

        wl_info = watchlist_by_wallet.get(creator, {})
        entry_slip = entry_mcap * (1 + SLIPPAGE_PCT)
        fee_in = BUY_SIZE_SOL * PUMPFUN_FEE_RATE + PRIORITY_FEE_SOL
        tp_mcap = entry_slip * TAKE_PROFIT_X
        sl_mcap = entry_slip * STOP_LOSS_X
        mig_t = coin_mig.get(mint)
        mig_mcap = coin_mig_mcap.get(mint)

        exit_mcap = None
        exit_reason = "timeout"
        exit_t = entry_t + TIMEOUT_SEC

        for t, mcap in trades:
            if t <= entry_t:
                continue
            if mig_t and t >= mig_t:
                exit_mcap = mig_mcap if mig_mcap else mcap
                exit_reason = "migration"
                exit_t = t
                break
            if mcap >= tp_mcap:
                exit_mcap = tp_mcap
                exit_reason = "take_profit"
                exit_t = t
                break
            if mcap <= sl_mcap:
                exit_mcap = sl_mcap
                exit_reason = "stop_loss"
                exit_t = t
                break
            if t - entry_t >= TIMEOUT_SEC:
                exit_mcap = mcap
                exit_reason = "timeout"
                exit_t = t
                break

        if exit_mcap is None:
            post = [(t, mc) for t, mc in trades if t > entry_t]
            if not post:
                continue
            exit_mcap = post[-1][1]
            exit_t = post[-1][0]
            exit_reason = "timeout"

        # Cap non-migration exits
        if exit_reason not in ("migration",):
            exit_mcap = max(sl_mcap, min(exit_mcap, tp_mcap))

        gross = exit_mcap / entry_slip - 1
        exit_fee = BUY_SIZE_SOL * max(0, gross) * PUMPFUN_FEE_RATE + PRIORITY_FEE_SOL
        pnl = round(BUY_SIZE_SOL * gross - fee_in - exit_fee, 6)

        meta = coin_meta.get(mint, {})
        closed_trades.append({
            "batch_id":       batch_id,
            "mint":           mint,
            "name":           meta.get("name"),
            "symbol":         meta.get("symbol"),
            "creator":        creator,
            "watchlist_tier": wl_info.get("tier"),
            "watchlist_hit_rate": wl_info.get("hit_rate"),
            "entry_time":     iso(entry_t),
            "entry_mcap_sol": round(entry_mcap, 2),
            "exit_time":      iso(exit_t),
            "exit_mcap_sol":  round(exit_mcap, 2),
            "exit_reason":    exit_reason,
            "pnl_sol":        pnl,
            "result":         "win" if pnl > 0 else "loss",
        })

    return closed_trades


def format_trade_message(trade, ledger_total_pnl, ledger_total_trades, ledger_win_rate):
    pnl = trade["pnl_sol"]
    emoji = "🟢" if pnl > 0 else "🔴"
    name = trade.get("name") or trade["mint"][:8]
    symbol = f"${trade['symbol']}" if trade.get("symbol") else ""
    reason_map = {"take_profit": "2× TP", "stop_loss": "0.5× SL",
                  "migration": "migrated", "timeout": "timeout"}
    return (
        f"{emoji} Paper trade closed: **{name} {symbol}**\n"
        f"Creator: {trade['creator'][:8]}… (Tier {trade['watchlist_tier']}, "
        f"{trade['watchlist_hit_rate']:.0f}% hist)\n"
        f"Entry: {trade['entry_mcap_sol']:.1f} SOL mcap → "
        f"Exit: {trade['exit_mcap_sol']:.1f} SOL ({reason_map.get(trade['exit_reason'], trade['exit_reason'])})\n"
        f"PnL: **{pnl:+.4f} SOL** | "
        f"Running: {ledger_total_pnl:+.3f} SOL, {ledger_total_trades} trades, {ledger_win_rate:.0f}% win"
    )


def post_daily_summary(ledger):
    """Post today's paper trading P&L to Discord."""
    trades = ledger.get("trades", [])
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today = [t for t in trades if (t.get("entry_time") or "").startswith(today_str)]
    if not today:
        return
    wins = sum(1 for t in today if t["pnl_sol"] > 0)
    total_pnl = sum(t["pnl_sol"] for t in today)
    win_rate = wins / len(today) * 100
    emoji = "🟢" if total_pnl > 0 else "🔴"
    msg = (
        f"{emoji} **Daily paper trading summary** ({today_str})\n"
        f"Trades: {len(today)} | Wins: {wins} ({win_rate:.0f}%)\n"
        f"Today PnL: **{total_pnl:+.4f} SOL**\n"
        f"All-time: {ledger['total_pnl_sol']:+.3f} SOL, {ledger['total_trades']} trades, "
        f"{ledger['win_rate_pct']:.0f}% win"
    )
    post_discord(msg)
    print(msg)


def main():
    args = sys.argv[1:]
    historical_mode = "--historical" in args
    daily_summary = "--daily-summary" in args
    batch_arg = None
    if "--batch" in args:
        idx = args.index("--batch")
        if idx + 1 < len(args):
            batch_arg = args[idx + 1]

    watchlist_by_wallet, watchlist_set = load_watchlist()
    dune_creators = load_dune_creators()
    print(f"Watchlist: {len(watchlist_set)} wallets")
    print(f"Dune creator map: {len(dune_creators)} coins")

    ledger = load_ledger()
    processed = set(ledger.get("processed_batches", []))

    if historical_mode:
        batches = sorted(PARQUET_DIR.glob("batch-*"))
        print(f"Historical mode: {len(batches)} batches")
        for batch_dir in batches:
            bid = batch_dir.name
            if bid in processed:
                print(f"  {bid}: already processed, skipping")
                continue
            trades = process_batch(bid, batch_dir, watchlist_by_wallet, watchlist_set, dune_creators)
            ledger["trades"].extend(trades)
            ledger.setdefault("processed_batches", []).append(bid)
            save_ledger(ledger)
            print(f"  {bid}: {len(trades)} virtual trades")

    elif batch_arg:
        bid = batch_arg
        batch_dir = PARQUET_DIR / bid
        if not batch_dir.exists():
            print(f"Batch dir not found: {batch_dir}")
            sys.exit(1)
        if bid in processed:
            print(f"{bid}: already processed")
            sys.exit(0)
        trades = process_batch(bid, batch_dir, watchlist_by_wallet, watchlist_set, dune_creators)
        ledger["trades"].extend(trades)
        ledger.setdefault("processed_batches", []).append(bid)
        save_ledger(ledger)
        print(f"{bid}: {len(trades)} virtual trades")
        for trade in trades:
            msg = format_trade_message(
                trade,
                ledger["total_pnl_sol"],
                ledger["total_trades"],
                ledger["win_rate_pct"],
            )
            print(msg)
            post_discord(msg)

    elif daily_summary:
        ledger = load_ledger()
        save_ledger(ledger)  # refresh totals
        post_daily_summary(ledger)
        return

    else:
        print("Usage: paper_trader.py --historical | --batch <batch_id> | --daily-summary")
        sys.exit(1)

    print(f"\nLedger: {ledger['total_trades']} trades, {ledger['total_pnl_sol']:+.4f} SOL, {ledger['win_rate_pct']:.1f}% win")


if __name__ == "__main__":
    main()
