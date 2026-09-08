# P-009 — Complete machine-readable run dataset

- Status: complete
- Depends on: P-004, P-010, P-012

## Decision

Preserve every available payload emitted by the selected strict-free source adapters during an overall five- or ten-minute run, then normalize those facts into a stable, versioned dataset keyed by run ID. Do not prune fields for readability or attempt analysis in the collector.

## Viable options

- A. Raw plus normalized — preserve untouched source payloads and produce stable machine-readable indexes for future skills.
- B. Raw only — maximally faithful but forces every future skill to repeat provider-specific parsing.
- C. Summaries only — easier to display but destroys evidence and prevents new analyses.

## Recommendation

A — raw plus normalized. Raw records preserve evidence; normalized records let later, separately planned skills compare coins and runs without depending on one provider's payload shape.

## Confirmed decision

- Each on-demand run is exactly five or ten minutes.
- The timer applies to the complete run, not separately to each pair. A pair launched at minute eight of a ten-minute run receives two minutes of data.
- Every pair launched during the run is tracked immediately, and all capture and tracking stop together when the overall timer ends.
- The version-1 enabled-source set is: PumpAPI live capture; hardened launch-metadata IPFS/HTTPS retrieval while the run is active; deterministic local signer indexes and candles; optional DEX Screener exact-pair and pinned WSOL/USDC snapshots only when attempted before timer expiry; and delayed PumpAPI replay solely for repairing in-window gaps. Rejected, paid, metered, legally segregated and sampled-only sources do not enter the merged dataset.
- Preserve every payload emitted by the enabled source adapters, including source name, source event identifier, source timestamp, local receipt timestamp, ordering information, retrieval status and the untouched payload.
- Normalize all available facts into versioned run, token, event, trade, signer/wallet, curve/reserve/liquidity, migration, metadata and reliability/gap records. A provider's absence or failure is recorded explicitly rather than represented as a false zero.
- Preserve complete launch identity and raw launch payloads. Distinguish immutable identifiers from editable or untrusted names, images, links and metadata.
- Preserve complete buy and sell events rather than only totals. General transfers are not required unless an enabled adapter emits them; if emitted, keep the raw payload even when no normalized transfer view exists yet.
- Derived measurements must identify their formula/schema version and remain reproducible from preserved raw or normalized events.
- `Seconds since meaningful activity` is a derived neutral fact. It never ends a run or labels a token.
- No automatic post-run outcome snapshots are collected. Delayed PumpAPI replay may repair missing events only when their source event time falls inside the original run window; the repair is provenance-marked and never extends the observation window.
- No analysis, scoring, trend detection or predictive claim belongs in this collector.
- The primary output is the machine-readable run dataset. Paginated session messages are only a convenient way to inspect and retrieve it.
- Future skills may consume one or more run IDs to analyze trends, but those skills are separate projects and are not planned here.

## Delegation

2026-08-26, in-session: the user clarified that the goal is to establish the collection skill first, save all run data, and later create separate skills that analyze different runs. This supersedes field-by-field pruning and display optimization.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: consumed

## Evidence

- [Primary-source data catalog](../evidence/P-005-signal-candidates.md)
- [Observed launch payload](../evidence/P-004-evidence.md)
- [Free-only reliability dossier](../evidence/P-011-free-data-reliability-dossier.md)
- [Ten-minute collection cadence](../evidence/P-009-ten-minute-collection-cadence.md)
- [Metric speed and proof matrix](../evidence/P-009-metric-proof-matrix.md)
- [Completed distinct-tool dossier](../evidence/P-012-distinct-tool-dossier.md)

## Effects

- The build route needs one shared PumpAPI connection, one overall timer, durable raw append storage and versioned normalized indexes.
- Session viewing may summarize and paginate, but it must never be the only copy of any collected fact.
- Future analysis skills can depend on the versioned dataset contract without changing this recorder's runtime behavior.

## Complete when

The plan states that all selected-source data available during the run is preserved raw, normalized into a versioned machine-readable contract, and separated from all future analysis skills.
