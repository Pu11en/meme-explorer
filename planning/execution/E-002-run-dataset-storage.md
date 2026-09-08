# E-002 — Durable run-dataset storage

- Status: complete
- Outcome: The plugin can create, append, finalize, reopen and validate versioned run datasets without any live provider.
- Depends on: P-004, P-007, P-009, E-001

## Context

- [Versioned run-dataset contract](../evidence/P-008-run-dataset-contract.md)
- [Complete machine-readable run dataset](../decisions/P-009-variable-review.md)

## In scope

- Materialize `contract.json` schemas/enums/invariants and the run/catalog/sequence directory layout.
- Implement durable run IDs, atomic manifest/sequence writes, append-only NDJSON writers, bounded batch sync, durable sequence tracking and content-addressed blobs.
- Implement raw envelopes, normalized-family writers, referential checks and reliability/gap records.
- Implement orderly finalization and restart recovery that marks nonterminal runs interrupted without altering retained bytes.
- Keep DSH `storageDomain` limited to compact settings/current pointer/summaries.

## Out of scope

- PumpAPI, metadata/DEX HTTP calls, replay, formulas beyond deterministic storage fixtures, session pagination and live profile installation.

## Constraints

- Exact numeric strings; no float coercion.
- No false zero, hidden gap or rewritten raw line.
- One serialized writer per stream; maximum batch window is 128 records or 250 ms and is declared in each manifest.
- Replay-after-stop is represented by the contract but not implemented in this ticket.

## Proof

- Schema validation, byte-fidelity/hash/blob, monotonic ordering, dedup identity, no-false-zero and referential-integrity fixtures pass.
- Kill/reopen fixture preserves every durable sequence and marks the run interrupted.
- Orderly Stop drains/syncs before an atomic terminal manifest.
- Run sequence never repeats across restart.
- A fixture consumer resolves two run IDs through only catalog, manifest, contract and normalized/derived files.

## Completion evidence

- Versioned contract, atomic JSON writers, append-only NDJSON, content-addressed blobs, manifests, catalog and durable sequence allocation are implemented.
- Serialized ingestion and bounded run-level durability enforce the declared 128-record/250-ms maximum policy.
- Restart recovery marks nonterminal runs interrupted without rewriting raw bytes.
- Byte-fidelity, exact-number, no-false-zero, referential, dedup, corruption-detection and two-run consumer fixtures pass.

## If blocked or disproven

- Return to P-008 if the configured Harness storage root cannot safely host plugin-owned append-only files or the durability bound cannot be objectively tested.

## Human review

- None.

## Next eligible ticket

- E-003 — PumpAPI live recorder.
