# P-011 — Free-source reliability audit

- Status: complete
- Depends on: P-010

## Decision

Deeply verify the free-only source stack before continuing field review or implementation.

## Viable options

- Not applicable — primary-source research, adversarial verification, repository audits, and live comparison were required.

## Recommendation

Use PumpAPI as a best-effort local prototype stream, immediately retain raw frames, reconcile completed replay hours, compare launches against PumpPortal, and visibly preserve every gap. Do not call any free source complete or production reliable.

## Confirmed decision

The audited strict-free stack is PumpAPI live/replay + local raw storage + PumpPortal creation comparison + sampled public-Solana verification. RugCheck, DEX Screener, Jupiter, GeckoTerminal, and metadata fetching are optional failure-tolerant enrichments. Helius/Birdeye and funded/metered PumpPortal streams are excluded.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- [Free-only reliability dossier](../evidence/P-011-free-data-reliability-dossier.md)
- [Raw live-stream comparison](../evidence/P-011-live-stream-comparison.json)
- [Open-source license/build audit](../evidence/P-011-open-source-audit.md)
- [Reliability benchmark audit](../../research/free-only-reliability-benchmark-audit.md)
- [Live/historical source audit](../../research/live-historical-pump-streams-audit.md)
- [Free Solana RPC audit](../../research/free-solana-rpc-audit-2026-08-26.md)
- [Free holder/risk audit](../../research/free-holders-creator-risk-enrichment-audit-2026-08-26.md)
- [Free market-data audit](../../research/free-price-liquidity-routing-migration-audit.md)

## Effects

- Rejects `pump.fun.meter` as a drop-in package because it is not currently installable.
- Rejects unlicensed/all-rights-reserved Pump data repositories as reusable code.
- Requires raw logging, schema-tolerant parsing, deduplication, gap states, and live/replay comparison in the MVP.
- Requires legal/access recheck before redistribution or broader deployment.

## Complete when

The free stack, exclusions, direct observations, reliability limits, and pre-build benchmark are saved and reflected in the plan.