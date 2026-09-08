# E-004 — In-window metadata and market enrichment

- Status: complete
- Outcome: Enabled strict-free enrichment attempts made before timer expiry are isolated, persisted raw and normalized, and never interfere with PumpAPI capture.
- Depends on: P-004, P-007, P-012, E-003

## Context

- [Distinct-tool dossier](../evidence/P-012-distinct-tool-dossier.md)
- [Capability gap ledger](../evidence/P-012-capability-gap-ledger.md)
- [Versioned run-dataset contract](../evidence/P-008-run-dataset-contract.md)

## In scope

- Implement hardened IPFS/HTTPS metadata retrieval with DNS, redirect, size, media, timeout, hashing/blob and explicit failure controls.
- Implement optional DEX Screener exact-pair and pinned WSOL/USDC snapshots only when scheduled and completed before overall timer expiry.
- Persist source payloads, cache/receipt timing and normalized metadata/market reference records.
- Record every missing, blocked, rate-limited, not-indexed, timeout, decode and provider failure separately.

## Out of scope

- Any request first started after timer expiry, post-run outcome snapshots, continuous public RPC, RugCheck, Jupiter, GeckoTerminal, PumpPortal, paid/metered data or legitimacy/quality judgments.

## Constraints

- Enrichment isolation: failures and latency cannot block or backpressure the core PumpAPI writer.
- Creator metadata and social links are untrusted claims.
- DEX values are delayed provider references, never migration truth, executable quotes or silently merged canonical prices.

## Proof

- Safe-fetch tests cover IPFS JSON, arbitrary HTTPS JSON, direct image, blocked private DNS/address, redirect, oversized body, timeout, bad media and hash/blob fidelity.
- DEX tests cover not-indexed, stale/cache age, success and rate/failure states.
- Fake-clock tests reject late completion outside the run boundary without extending the dataset window.
- Stress test proves enrichment failures do not alter core raw ordering or Stop latency.

## Completion evidence

- DNS-pinned HTTPS fetcher blocks private/reserved IPs, credentials and unsafe redirects; it enforces timeout, redirect, media and byte limits with SHA-256 byte fidelity.
- IPFS routing, JSON/direct-image metadata capture and untrusted creator-claim normalization are implemented.
- Recorded DEX Screener pair-contract fixtures prove exact-pair and pinned SOL-reference raw/normalized snapshots, cache age, exact numeric strings and not-indexed states.
- Late completion is rejected at the overall run boundary; abortable enrichment cannot block core PumpAPI appends or orderly Stop.
- Full project check passes 24 tests.

## If blocked or disproven

- Disable the affected optional adapter and record the evidence; return to planning only if removing it breaks the promised complete selected-source contract.

## Human review

- None.

## Next eligible ticket

- E-005 — Replay repair and deterministic derived data.
