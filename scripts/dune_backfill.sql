-- Dune Analytics backfill query for pump.fun organic migration data.
-- Uses v2 tables (pump_call_create_v2, pump_call_migrate_v2, pumpdotfun_solana.trades).
-- Produces one row per token launched with signal features pre-computed.
--
-- Key tables discovered:
--   pump_call_create_v2  — most creates (~30k/day), v1 is <200/day
--   pump_call_migrate_v2 — all migrations from bonding curve to pump AMM
--   pumpdotfun_solana.trades — unified buy/sell table (token_bought_mint_address = mint for buys)
--
-- Replace date ranges as needed. 1-week date ranges are manageable on large tier.

WITH 
launches AS (
  SELECT account_mint AS mint, COALESCE(creator, account_user) AS creator, name, symbol, call_block_time AS created_at
  FROM pumpdotfun_solana.pump_call_create_v2
  WHERE call_block_date BETWEEN DATE '2026-09-10' AND DATE '2026-09-14'
    AND NOT call_is_inner
  UNION ALL
  SELECT account_mint, account_user, name, symbol, call_block_time
  FROM pumpdotfun_solana.pump_call_create
  WHERE call_block_date BETWEEN DATE '2026-09-10' AND DATE '2026-09-14'
    AND NOT call_is_inner
),
migrations AS (
  SELECT account_base_mint AS mint, MIN(call_block_time) AS migrated_at
  FROM pumpdotfun_solana.pump_call_migrate_v2
  WHERE call_block_date BETWEEN DATE '2026-09-10' AND DATE '2026-09-17'
    AND NOT call_is_inner
  GROUP BY account_base_mint
),
buys AS (
  SELECT 
    t.token_bought_mint_address AS mint,
    t.trader_id AS buyer,
    t.block_slot AS slot,
    t.tx_id,
    GREATEST(0, CAST(date_diff('second', l.created_at, t.block_time) AS INTEGER)) AS sec
  FROM pumpdotfun_solana.trades t
  INNER JOIN launches l ON t.token_bought_mint_address = l.mint
  WHERE t.block_date BETWEEN DATE '2026-09-10' AND DATE '2026-09-17'
    AND t.block_time >= l.created_at
    AND t.block_time < l.created_at + INTERVAL '180' SECOND
),
slot_analysis_60 AS (
  SELECT mint, slot, COUNT(*) AS buys_in_slot, COUNT(DISTINCT tx_id) AS txs_in_slot
  FROM buys WHERE sec < 60
  GROUP BY mint, slot
),
bundle_proxy_60 AS (
  -- same_slot_buys: buys in slots where >1 tx happened (bundle signal)
  SELECT mint,
    SUM(CASE WHEN buys_in_slot > txs_in_slot THEN buys_in_slot - txs_in_slot ELSE 0 END) AS same_slot_buys
  FROM slot_analysis_60 GROUP BY mint
),
u60 AS (SELECT mint, COUNT(DISTINCT buyer) AS uniq_60s FROM buys WHERE sec < 60 GROUP BY mint),
u120 AS (SELECT mint, COUNT(DISTINCT buyer) AS uniq_120s FROM buys WHERE sec < 120 GROUP BY mint),
active AS (SELECT mint, COUNT(DISTINCT sec) AS active_60s FROM buys WHERE sec < 60 GROUP BY mint),
w AS (
  SELECT mint, COUNT(*) AS total_buys,
    SUM(CASE WHEN sec < 5  THEN 1 ELSE 0 END) AS b_0_5,
    SUM(CASE WHEN sec BETWEEN 5 AND 9  THEN 1 ELSE 0 END) AS b_5_10,
    SUM(CASE WHEN sec < 10 THEN 1 ELSE 0 END) AS b_0_10,
    SUM(CASE WHEN sec < 15 THEN 1 ELSE 0 END) AS b_0_15,
    SUM(CASE WHEN sec BETWEEN 15 AND 29 THEN 1 ELSE 0 END) AS b_15_30,
    SUM(CASE WHEN sec < 30 THEN 1 ELSE 0 END) AS b_0_30,
    SUM(CASE WHEN sec < 60 THEN 1 ELSE 0 END) AS b_0_60,
    SUM(CASE WHEN sec < 120 THEN 1 ELSE 0 END) AS b_0_120
  FROM buys GROUP BY mint
)
SELECT 
  l.mint, l.creator, l.name, l.symbol, l.created_at,
  CASE WHEN m.mint IS NOT NULL THEN TRUE ELSE FALSE END AS migrated,
  m.migrated_at,
  COALESCE(w.total_buys,0) AS total_buys,
  COALESCE(u60.uniq_60s,0) AS uniq_60,
  COALESCE(u120.uniq_120s,0) AS uniq_120,
  COALESCE(w.b_0_10,0) AS buys_0_10,
  COALESCE(w.b_0_30,0) AS buys_0_30,
  COALESCE(w.b_0_60,0) AS buys_0_60,
  COALESCE(a.active_60s,0) AS active_60s,
  COALESCE(bp.same_slot_buys,0) AS same_slot_buys,
  -- Sustain ratios (burst fade detection)
  CASE WHEN w.b_0_5>0 THEN ROUND(CAST(w.b_5_10 AS DOUBLE)/w.b_0_5,3) ELSE 0 END AS sustain10,
  CASE WHEN w.b_0_15>0 THEN ROUND(CAST(w.b_15_30 AS DOUBLE)/w.b_0_15,3) ELSE 0 END AS sustain30,
  -- Signal flags (calibrated against pipeline data)
  CASE WHEN COALESCE(w.b_0_10,0)>=100 
    AND CASE WHEN w.b_0_5>0 THEN CAST(w.b_5_10 AS DOUBLE)/w.b_0_5 ELSE 0 END>=0.3 
    THEN TRUE ELSE FALSE END AS signal_10burst,
  CASE WHEN COALESCE(w.b_0_30,0)>=200 
    AND CASE WHEN w.b_0_15>0 THEN CAST(w.b_15_30 AS DOUBLE)/w.b_0_15 ELSE 0 END>=0.4 
    THEN TRUE ELSE FALSE END AS signal_30burst,
  -- 60 Burst: >=60 unique buyers in 60s, same-slot proxy < 5 (no bundle pattern)
  CASE WHEN COALESCE(u60.uniq_60s,0)>=60 
    AND COALESCE(bp.same_slot_buys,0)<5 
    THEN TRUE ELSE FALSE END AS signal_60burst
FROM launches l
LEFT JOIN migrations m ON l.mint = m.mint
LEFT JOIN w ON l.mint = w.mint
LEFT JOIN u60 ON l.mint = u60.mint
LEFT JOIN u120 ON l.mint = u120.mint
LEFT JOIN active a ON l.mint = a.mint
LEFT JOIN bundle_proxy_60 bp ON l.mint = bp.mint
ORDER BY l.created_at
LIMIT 200000
