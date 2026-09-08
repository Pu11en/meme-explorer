# E-005 — Replay repair and deterministic derived data

- Status: complete
- Outcome: Completed/interrupted runs can provenance-mark replay repairs for missing in-window events and expose reproducible local indexes, candles and summaries.
- Depends on: P-009, P-010, P-011, P-012, E-004

## Context

- [Versioned run-dataset contract](../evidence/P-008-run-dataset-contract.md)
- [PumpAPI capability checklist](../evidence/P-012-pumpapi-capability-checklist.md)
- [Ten-minute collection cadence](../evidence/P-009-ten-minute-collection-cadence.md)

## In scope

- Implement delayed PumpAPI hourly replay discovery/import as best-effort gap repair.
- Accept replay events only when source time falls inside the original run window; mark late ingestion, source/replay schema and reconciliation/dedup.
- Preserve live order separately from replay append order and never claim repaired completeness when archive hours are missing/late.
- Implement deterministic signer/mint indexes, one-minute candles and trade summaries with formula versions, partial-bar and gap states.

## Out of scope

- Extending the observation window, collecting later outcomes, mutating raw live files, provider scoring or trend analysis.

## Constraints

- Replay is not guaranteed and may arrive hours later; run manifest/catalog expose repair status and last update.
- Every derived row is reproducible from retained normalized/raw inputs and formula version.
- Address indexes never assert human identity, bot, insider or quality labels.

## Proof

- Replay fixture accepts an in-window event after Stop, rejects an out-of-window event and records both decisions.
- Missing archive, schema-era change, duplicate and signature-breakdown cases remain explicit.
- Same input + formula version produces identical candle/summary records.
- Gap/partial-bar and no-false-zero tests pass.
- Cross-run signer fixture records factual signatures/run IDs without identity claims.

## Completion evidence

- Hourly PumpAPI archive discovery and Node-stdlib streaming Zstandard import preserve replay raw bytes separately from live order.
- Replay accepts only source events in `[started_at, stops_at)`, records out-of-window, missing-archive, decode and dedup decisions, and preserves schema-era and multi-breakdown distinctions.
- Exact-decimal one-minute candles and trade summaries expose formula version, partial bars, retained-input gaps and missing amounts without floating-point coercion or false zero.
- Global signer/mint indexes remain factual across run IDs and contain no identity labels.
- Replay/derived contract suite passes with the full project checks.

## If blocked or disproven

- Keep live data authoritative and leave repair status unresolved; return to planning only if replay owner access/terms make even best-effort repair impermissible.

## Human review

- None.

## Next eligible ticket

- E-006 — Session inspection and live proof.
