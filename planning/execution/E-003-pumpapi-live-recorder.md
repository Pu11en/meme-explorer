# E-003 — PumpAPI live recorder

- Status: complete
- Outcome: A five- or ten-minute run captures the PumpAPI live stream through exactly one socket and persists byte-faithful raw plus core normalized records until the one overall timer ends.
- Depends on: P-002, P-003, P-010, P-011, P-012, E-002

## Context

- [PumpAPI capability checklist](../evidence/P-012-pumpapi-capability-checklist.md)
- [Free-source reliability dossier](../evidence/P-011-free-data-reliability-dossier.md)
- [Versioned run-dataset contract](../evidence/P-008-run-dataset-contract.md)

## In scope

- Implement the replaceable PumpAPI live adapter and one-socket ownership.
- Preserve exact source bytes/envelopes for every emitted action during the overall run.
- Normalize token, generic event, complete trade, wallet/signer, curve/reserve and migration records; preserve unknown actions raw.
- Enforce source-time run boundaries, one-active-run, five/ten durations, manual early Stop and timer Stop through one orderly path.
- Record disconnect, decode, ordering, duplicate and uncertainty states explicitly.

## Out of scope

- Historical replay repair, metadata fetches, DEX Screener, derived candles/summaries, analysis and live GUI profile installation.

## Constraints

- Free/no-key data stream only; no trading or paid PumpAPI operations.
- Provider facts remain provider facts; no canonical/finality or identity claim without evidence.
- Adapter failure never corrupts already durable data.

## Proof

- Deterministic fixture stream covers create, buy, sell, transfer, migrate, create-pool, add/remove-liquidity, creator-fee claim and unknown action.
- Duplicate-frame and multi-breakdown-transaction tests pass.
- Fake-clock test proves a pair launched at minute eight of a ten-minute run receives exactly two minutes of eligible live data and no event at/after `stops_at` enters the run.
- Concurrency test proves a second Start never opens another socket.
- Stop tests prove socket close, writer drain/sync and terminal manifest order.

## Completion evidence

- Native Node WebSocket adapter enforces one owned socket, drains accepted frames, records disconnect/error/reconnect states and uses bounded exponential reconnect.
- Lossless JSON parser preserves provider numeric tokens as exact strings while untouched source bytes remain in raw storage.
- Tolerant normalizer covers create, buy, sell, transfer, migrate, create-pool, add/remove-liquidity, creator-fee claims and unknown actions.
- Deterministic fixtures prove duplicate collapse, distinct transaction breakdown positions, raw duplicate preservation, decode-error preservation and socket-close-before-manifest-finalize ordering.
- Fake-clock proof accepts a minute-eight launch and its final eligible trade, rejects source time exactly at the ten-minute boundary and finalizes the whole run once.
- Full project check passes 20 tests.

## If blocked or disproven

- Return to P-010/P-011 only if owner access, terms or the observed stream contract materially changed; otherwise record provider failure and keep the adapter boundary.

## Human review

- None; no live use until the final integration ticket.

## Next eligible ticket

- E-004 — In-window metadata and market enrichment.
