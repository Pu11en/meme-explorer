# P-008 — Versioned run-dataset contract

**Status:** planned contract for the collector vertical slice  
**Dataset version:** `1.0.0`

## Purpose

The collector's primary output is a durable machine-readable dataset keyed by run ID. It preserves every enabled-source payload whose event time falls inside one overall five- or ten-minute run, plus provider-independent normalized records and explicit failures/gaps. Session messages only inspect this dataset; future analysis skills are separate consumers.

## Version-1 source boundary

Merged sources are limited to the verified strict-free stack:

1. PumpAPI live stream — core create/buy/sell/transfer/migrate/pool/liquidity/claim events through exactly one shared socket.
2. PumpAPI hourly replay — delayed best-effort repair only for missing events whose source event time falls inside the original run window.
3. Hardened local IPFS/HTTPS metadata retrieval — attempted while the run is active, with bytes/hashes and explicit failures.
4. Deterministic local signer indexes, candles and summaries derived from retained events.
5. Optional DEX Screener exact-pair and pinned WSOL/USDC snapshots only when requested before the overall timer expires; these remain labeled delayed provider references.

PumpPortal, RugCheck, Jupiter, GeckoTerminal, continuous public RPC, paid/metered/funded sources and sampled-only verification do not enter the merged version-1 dataset.

## Storage layout

The plugin resolves one configurable local data root and owns this layout:

```text
<data-root>/
  contract.json
  catalog.ndjson
  sequence.json
  indexes/
    signers.ndjson
    mints.ndjson
  runs/<run-id>/
    manifest.json
    raw/
      pumpapi-live.ndjson
      pumpapi-replay.ndjson
      metadata.ndjson
      dexscreener-pairs.ndjson
      dexscreener-solusd.ndjson
    normalized/
      tokens.ndjson
      events.ndjson
      trades.ndjson
      wallets.ndjson
      curves.ndjson
      migrations.ndjson
      metadata.ndjson
      reliability.ndjson
    derived/
      candles.ndjson
      trade-summaries.ndjson
    blobs/<sha256>
```

- NDJSON is the append-only stream format; no new database dependency is required.
- `manifest.json`, `sequence.json` and `contract.json` use temp-write, file sync and atomic rename.
- Large or binary response bodies use immutable content-addressed blobs; the record stores hash, byte length, media type and relative path.
- DSH `storageDomain` stores only compact settings, current-run pointer and small summaries; it never stores raw event streams.

## Run identity and lifecycle

- ID: `run-<zero-padded-sequence>-<UTC>`, for example `run-0001-20260826T123456Z`.
- Human label: `Run 001 — 2026-08-26 12:34:56 UTC — 10 min`.
- Duration is exactly `300000` or `600000` milliseconds.
- At most one run is active per Host process.
- Status: `starting | running | stopping | stopped | interrupted | error`.
- Stop reason: `timer_expired | manual_early | interrupted | error`.
- Restart never resurrects a socket/timer. A nonterminal manifest becomes `interrupted`; retained files remain readable.

`manifest.json` contains dataset/schema version, run sequence, start/stop timestamps, selected duration, terminal status/reason, enabled adapters and versions, first/last durable raw sequence, counts by source/action/mint, failure/gap summary, flush policy and file inventory/hashes when finalized.

## Shared record rules

Every record carries:

- `schema`, such as `pump.raw/1`, `pump.token/1` or `pump.trade/1`;
- `dataset_version`;
- `run_id`;
- source/provider and transport (`live | replay | fetch | poll | derived`);
- source event ID when available;
- source event time/slot/sequence when available;
- local receipt time and monotonic receipt offset when available;
- commitment/finality (`processed | confirmed | finalized | provider | unknown`);
- adapter/parser/formula version as applicable;
- explicit success/missing/not-indexed/rate-limited/blocked/timeout/decode-error/failed/gap state.

Provider numeric quantities remain exact strings with mint/decimals context; they are never float-coerced. Unknown provider fields remain in the untouched raw payload. Absence is `null` plus a reliability state, never a false zero.

## Raw envelope — `pump.raw/1`

The sole raw-file record type contains:

- monotonic run-wide `seq`;
- source, transport and channel;
- event ID/time/slot/sequence when supplied;
- `received_at` and optional monotonic offset;
- commitment and parser version;
- SHA-256 and byte length of the original bytes;
- exactly one of inline UTF-8 payload or a blob reference;
- `in_window` and, for replay repair, `ingested_after_stop`.

Raw records are immutable. Replay may append after run completion only when the repaired event's source time is inside `[started_at, stops_at)`. It never extends the observation window and is provenance-marked.

## Normalized record families

### `pump.token/1`

Canonical mint key; token program/decimals/quote mint; immutable launch identifiers; name/symbol/URI; launch signature/slot/time; creator, creation user and launch signer kept as distinct addresses; initial buy; initial curve/reserves; mode/program flags; authority facts when available; first/last seen; reconciliation and raw-sequence links.

### `pump.event/1`

Chronological provider-independent backbone for create, buy, sell, transfer, migrate, create-pool, add/remove-liquidity, creator-fee claim, completion and unknown actions. Preserve `action_raw`, signature, breakdown index, mint, clock/provenance and links to specialized records.

### `pump.trade/1`

Buy/sell, signature/slot, signing wallet, exact quote/token amounts, observed price/market-cap value, fee fields when present, post-trade balances/reserves, event/raw links and provenance.

### `pump.wallet/1`

Address-level observed roles/actions, first/last seen, launch signatures and mints involved. It never claims a person, owner, insider or bot identity.

### `pump.curve/1`

Pool/curve identity, exact virtual/real token and quote reserves, supply fields, completion state, locally derived curve progress with formula version, event/raw links and provenance.

### `pump.migration/1`

Observed completion/migration stages, signatures/slots/times, amounts, pool identity supplied by the source, lags and reconciliation state. A token that has not migrated before the timer ends is `incomplete` and right-censored, never `failed`.

### `pump.metadata/1`

Mint/URI; attempted time; success/failure/latency/retry state; final host/gateway, media type, content hash/size; creator-supplied description/image/site/social claims; unknown fields; raw/blob links and provenance. Creator-supplied claims are never treated as verified identity or quality.

### `pump.reliability/1`

Stream gaps/disconnects, adapter errors, metadata failures, rate limits, replay reconciliation/dedup and optional enrichment failures. Contains source/scope/mint, opened/closed times, retry/error/detail and raw/provenance links.

## Derived records

- `pump.candle/1`: deterministic local OHLC and quote volume, interval/boundaries, trade count, gap state, input raw sequence range and formula version. Partial boundary bars remain labeled partial.
- `pump.trade-summary/1`: buy/sell counts and exact quote totals, net flow, observed wallet count, first/last trade, price path, inactivity age, gap state and formula version.
- Global signer/mint indexes are append-only factual indexes across runs and contain signatures/run IDs rather than identity or quality labels.

Derived records must be reproducible from retained normalized/raw records. A new formula creates a new formula version; it never silently rewrites historical meaning.

## Ordering, deduplication and references

1. Raw `seq` is strictly increasing across the run.
2. Signature plus provider breakdown position is the normalized event identity when available; repeated frames collapse to one normalized event and create a dedup reliability fact.
3. Distinct positions inside one transaction remain distinct events.
4. Every specialized/derived record references an existing run/mint and its source raw/event sequences.
5. Missing sequence coverage or reconnect uncertainty creates an explicit gap record.
6. No event whose source time is at or after `stops_at` enters the run, including delayed replay.

## Durability boundary

- One serialized append writer owns each NDJSON file.
- Writes flush in bounded batches (maximum 128 records or 250 ms, whichever comes first); the manifest records this policy and the latest durable sequence.
- Orderly timer/manual Stop closes the socket, stops accepting events, drains accepted writes, syncs all files, atomically finalizes the manifest, then settles the run.
- A completed tool/job result is not emitted until this final durability boundary passes.
- Abrupt Host death may lose only records beyond the last recorded durable sequence; restart marks the run interrupted and exposes that boundary rather than claiming completeness.

## Future-skill consumption

A later skill receives one or more run IDs, resolves them through `catalog.ndjson`, checks `manifest.json` status/version/gaps, reads provider-independent records from `normalized/` and `derived/`, and consults `contract.json` for schemas/enums. It does not need to parse provider raw payloads except for forensic or new-normalizer work.

## Objective proof

1. Exact-byte fixture preserves unknown fields, large integers, SHA-256 and byte length.
2. Fake-clock tests prove only five/ten-minute durations; a coin launched at minute eight of a ten-minute run has two minutes of eligible live data.
3. Replay accepts a repaired event inside the original window after Stop, rejects an event outside the window and records both outcomes with provenance.
4. Duplicate frames collapse while separate transaction breakdown positions remain distinct.
5. Adapter failure writes a reliability record and `null`, never false zero; true zero remains zero with provenance.
6. Crash/reopen converts nonterminal status to interrupted without altering durable raw bytes.
7. Orderly Stop proves socket close, writer drain/sync and atomic terminal manifest before job completion.
8. Schema validation covers every emitted record and rejects missing run/source/receipt/version fields.
9. Recomputing candles/summaries with the same formula version produces identical records.
10. Metadata/DEX failure cannot block or corrupt PumpAPI live capture.
11. Run sequence never repeats across restart.
12. A fixture future consumer can load two run IDs using only catalog, manifest, contract and normalized/derived files.
