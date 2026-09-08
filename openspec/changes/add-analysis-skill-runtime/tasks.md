## 1. Contracts and catalog

- [ ] 1.1 Define collection-batch, metric-row, result-manifest, receipt, and skill-catalog types.
- [ ] 1.2 Add the ten-second buy activity catalog entry and Luna-facing project skill.

## 2. Deterministic analyzer

- [ ] 2.1 Stream token, trade, reliability, and manifest inputs without loading raw envelopes into model context.
- [ ] 2.2 Calculate `[0s, 10s)` buys, one-second bars, unique buyers, exact SOL volume, repeat ratio, block concentration, observability, and deterministic rank.
- [ ] 2.3 Save complete versioned results and emit a bounded compact receipt.

## 3. Verification and first result

- [ ] 3.1 Test time boundaries, incomplete observation, gap handling, exact totals, ranking, and preview limits.
- [ ] 3.2 Run the skill on the four-run Batch 001 and verify known RIZO counts.
- [ ] 3.3 Run project checks, validate the skill and OpenSpec change, and record the next recommended analysis step.
