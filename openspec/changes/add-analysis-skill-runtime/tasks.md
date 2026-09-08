## 1. Contracts and catalog

- [x] 1.1 Define collection-batch, metric-row, result-manifest, receipt, and skill-catalog types.
- [x] 1.2 Add the ten-second buy activity catalog entry and Luna-facing project skill.

## 2. Deterministic analyzer

- [x] 2.1 Stream Pump.fun raw envelopes, reliability facts, and manifests locally without loading records into model context.
- [x] 2.2 Calculate `[0s, 10s)` buys, one-second bars, unique buyers, exact SOL volume, repeat ratio, block concentration, observability, and deterministic rank.
- [x] 2.3 Save complete versioned results and emit a bounded compact receipt.

## 3. Verification and first result

- [x] 3.1 Test time boundaries, incomplete observation, gap handling, exact totals, ranking, and preview limits.
- [x] 3.2 Run the skill on the four-run Batch 001 and verify known RIZO counts.
- [x] 3.3 Run project checks, validate the skill and OpenSpec change, and record the next recommended analysis step.
