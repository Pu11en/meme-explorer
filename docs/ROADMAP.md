# Roadmap — From Signals to a Paper-Trading Alerter

**End goal:** a live system that detects high-EV pump.fun entries early, paper-trades them
with realistic prices, and builds a track record good enough to decide whether to go live.

**Core reframe (decided Sep 14 2026):** stop optimizing signal precision alone.
Optimize **EV per fire = P(migrate | signal) × payoff(at entry price) − losses on duds**.
Earlier entry → cheaper price → lower precision needed to profit. The burst signals are
NOT deleted — they move to confirmation/exit roles (see tiers below).

## Target signal stack

| Tier | Time | Signal | Role |
|------|------|--------|------|
| 0 | 0s | Creator wallet on repeat-dev watchlist | Buy at launch price (best EV in our data) |
| 1 | 15–20s | Early shape: new-buyer cadence + no dead gap + steady CV + same-slot<threshold | Buy-small trigger, low precision OK |
| 2 | 60s | 60 Burst (≥60 uniq + slot<5) | Confirmation: hold/add if fires, exit if not |
| exit | any | Dead streak after entry, buyer arrival stalling, top-wallet share climbing | Sell triggers |

---

## Phase 1 — Repeat-dev watchlist from Dune history  ← START HERE

**Why first:** cheapest to build, fires at second 0 (floor price), nobody else has it
without months of data. Directly tradeable output.

Tasks:
1. Dune query: all migrations for the last 6 months (`pump_call_migrate_v2`, group by month
   ranges to stay under row limits) joined to `pump_call_create_v2` for creator wallet.
2. Group by creator: wallets with 2+ migrations. For each: total launches (from creates),
   migration hit-rate, avg time-to-migration, last-seen date.
3. Filter: hit-rate matters more than raw count (a dev with 3/4 migrations >> 5/50).
   Exclude wallets inactive > 30 days.
4. Output `analysis/dev-watchlist.json`: `{wallet, launches, migrations, hit_rate, avg_migration_sec, last_seen}`.
5. Validate against our pipeline's 6 known repeat devs (AV7PjXHL…, Fzz2amRo…, etc.) —
   they must appear, else the query is wrong.
6. Wire into pipeline: recorder checks each new launch's creator against the watchlist,
   logs `watchlist_hit: true` in findings. (Alerting comes in Phase 4.)

Success gate: watchlist has ≥20 wallets with ≥50% hit-rate and recent activity.

## Phase 2 — Early-entry backtest with real prices

**Why:** decides whether Tier 1 (15–20s entry) makes money, and picks its thresholds.
This kills or confirms the whole strategy — do NOT build the paper trader before this.

Tasks:
1. Extend `scripts/dune_backfill.sql`: add per-coin price series — SOL-per-token at
   15s, 20s, 30s, 60s after launch, at migration, and at +5min (from `pumpdotfun_solana.trades`,
   `token_sold_amount / token_bought_amount` on buys).
2. Compute Tier 1 features at the 15s and 20s marks from our per-second bars (58k coins)
   AND from Dune buys (137k coins): buys so far, uniq so far, active_secs, max_gap,
   same_slot count, new-buyer arrival in last 5s.
3. Threshold sweep on Tier 1 features. For each candidate rule, simulate:
   entry at 15s/20s price, exits = migration price / 2x take-profit / −50% stop / 5min timeout.
   Include 1% pump.fun fee both sides + priority fee estimate + slippage model
   (assume our buy is 0.5–1% of curve, apply bonding-curve price impact).
4. Same simulation for Tier 0 (entry at launch price for watchlist devs) and, for
   comparison, 60 Burst entry at 60s (expected to lose — verify).
5. Report: EV per fire, win rate, distribution, fires/day for each rule. Wide error
   bars expected (~125 organics) — treat positive result as "worth paper trading", not "go live".

Success gate: at least one rule with positive EV after fees/slippage across BOTH
datasets (bars + Dune). If nothing is positive → revisit features, try 10s entry,
or conclude the edge isn't there before bot-speed competition.

## Phase 3 — Exit-signal design

Using the same data, define sell triggers measured AFTER a simulated entry:
- Dead streak: N consecutive seconds with no buys post-entry (calibrate N)
- Buyer stall: new-buyer arrival rate drops below X/10s
- Concentration climb: top-wallet share rising post-entry (dev distributing)
Re-run Phase 2 simulation with these exits vs the naive ones; keep what improves EV.

## Phase 4 — Live paper trader

Only after Phase 2 gates pass. A daemon alongside the recorder:
1. Reads the live trade stream per coin.
2. Second 0: watchlist check → virtual buy (Tier 0).
3. 15–20s: Tier 1 rule → virtual buy at current curve price.
4. 60s: Tier 2 confirmation → hold/add or virtual exit.
5. Exit signals from Phase 3 → virtual sell; log everything to
   `analysis/paper-trades.json` (entry/exit price, signal, P&L, fees).
6. Discord: post each virtual trade + daily P&L summary.
Run 2–3 weeks. Success gate: live paper P&L consistent with backtest.

## Phase 5 — Real execution layer (only if Phase 4 validates)

- Survey open-source pump.fun bots for the Solana tx layer (bonding-curve buy/sell
  encoding, priority fees, RPC submission). AUDIT EVERYTHING — bot repos are
  notorious for wallet-drainers. Never paste a private key into unaudited code.
- Keep our signal layer; swap their entry triggers for ours.
- Start with tiny positions (0.05–0.1 SOL), compare live fills vs paper assumptions.

---

## Standing infrastructure notes

- Pipeline: launchd, 8AM–5PM Central daily. Batches land in `analysis/batch-NNN-findings/`.
- Dune: query 8719904 is our scratch query; key is Drew's (do NOT commit it, do NOT log it).
  Use `pump_call_create_v2` / `pumpdotfun_solana.trades` / `pump_call_migrate_v2`.
  Dune results paginate at 32k rows. Large tier: ~1 min per 5-day window.
- Local dataset: `analysis/dune-backfill-sep10-14.json` (137,904 rows, gitignored).
- Insights log: `docs/analysis/data-insights.md` — keep appending findings.
- Backlog (not on the critical path): sniper expiry (30-day rolling window) for
  cumulative-snipers.json; push commits to origin (was failing with HTTP 400); Bitquery
  integration when key obtained.
