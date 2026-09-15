-- Phase 1: Repeat-dev watchlist query for pump.fun creator wallets
-- Returns one row per creator with 2+ migrations in the last 6 months.
-- Sorted by migration count desc so high-volume devs appear first.
-- Run via Dune API (large tier) — takes ~3 min.

WITH creates AS (
  SELECT
    COALESCE(creator, account_user) AS creator,
    account_mint AS mint,
    call_block_time AS created_at
  FROM pumpdotfun_solana.pump_call_create_v2
  WHERE call_block_date >= DATE '2026-03-14'
    AND NOT call_is_inner
),
migrations AS (
  SELECT
    account_base_mint AS mint,
    MIN(call_block_time) AS migrated_at
  FROM pumpdotfun_solana.pump_call_migrate_v2
  WHERE call_block_date >= DATE '2026-03-13'
    AND NOT call_is_inner
  GROUP BY account_base_mint
),
joined AS (
  SELECT
    c.creator,
    c.mint,
    c.created_at,
    m.migrated_at,
    (m.mint IS NOT NULL) AS did_migrate,
    CASE WHEN m.mint IS NOT NULL THEN date_diff('second', c.created_at, m.migrated_at) END AS secs_to_migrate
  FROM creates c
  LEFT JOIN migrations m ON c.mint = m.mint
  WHERE c.creator IS NOT NULL
)
SELECT
  creator                                                                    AS wallet,
  COUNT(*)                                                                   AS launches,
  SUM(CAST(did_migrate AS INTEGER))                                          AS migrations,
  ROUND(100.0 * SUM(CAST(did_migrate AS INTEGER)) / COUNT(*), 1)            AS hit_rate,
  ROUND(AVG(CASE WHEN did_migrate THEN CAST(secs_to_migrate AS DOUBLE) END), 0) AS avg_migration_sec,
  MAX(created_at)                                                            AS last_seen
FROM joined
GROUP BY creator
HAVING SUM(CAST(did_migrate AS INTEGER)) >= 2
ORDER BY migrations DESC, hit_rate DESC
