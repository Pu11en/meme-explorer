# P-012 — Verify distinct free tools

- Status: complete
- Depends on: P-011

## Decision

Continue capability-by-capability research beyond PumpAPI. A tool counts only when it supplies an important missing capability, survives repeated live checks, has acceptable free access and legal terms, and exposes precise failure states.

## Viable options

- Not applicable — the user directed continuing research and verification until every important gap is either filled or shown not reliably solvable for free.

## Recommendation

Maintain a live capability ledger. Promote tools only after owner-source audit plus repeated probes. Reject duplicate launch feeds, unstable provider opinions, metered “free” plans, unclear data rights, and sources with no useful capability beyond PumpAPI.

## Confirmed decision

PumpAPI live capture is checked. Secondary launch feeds do not count. Research now targets risk/holders/creator history, migration truth, market snapshots, OHLCV, metadata integrity, finality/history, USD conversion, and wallet graphs.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- [Distinct free-tool dossier](../evidence/P-012-distinct-tool-dossier.md)
- [Capability gap ledger](../evidence/P-012-capability-gap-ledger.md)
- [PumpAPI complete free/paid capability checklist](../evidence/P-012-pumpapi-capability-checklist.md)
- [RugCheck fresh-token benchmark](../evidence/P-012-rugcheck-fresh-token-benchmark.json)
- [DEX Screener expanded migration-index benchmark](../evidence/P-012-dexscreener-expanded-migration-index-benchmark.json)
- [DEX Screener initial migration-index benchmark](../evidence/P-012-dexscreener-migration-index-benchmark.json)
- [Metadata gateway benchmark](../evidence/P-012-metadata-gateway-benchmark.json)
- [Arbitrary-HTTPS metadata benchmark](../evidence/P-012-metadata-arbitrary-https-benchmark.json)
- [DEX Screener SOL/USD cadence](../evidence/P-012-dexscreener-sol-usd-cadence.json)
- [GeckoTerminal candle probe](../evidence/P-012-geckoterminal-candle-probe.json)
- [Local candle/GeckoTerminal comparison](../evidence/P-012-local-candle-geckoterminal-comparison.json)
- [Jupiter Tokens v2 audit](../../research/jupiter-tokens-v2-strict-free-audit-2026-08-26.md)
- [Jupiter token stability benchmark](../evidence/P-012-jupiter-token-stability-benchmark.json)
- [Jupiter fresh-token indexing benchmark](../evidence/P-012-jupiter-fresh-token-index-benchmark.json)
- [Launch-signer/Jupiter attribution benchmark](../evidence/P-012-launch-signer-jupiter-attribution-benchmark.json)
- [Deep free-only reliability dossier](../evidence/P-011-free-data-reliability-dossier.md)
- [RugCheck adversarial audit](../../research/rugcheck-owner-swagger-anonymous-capabilities-audit-2026-08-26.md)
- [DEX Screener audit](../../research/dexscreener-owner-api-audit-current.md)
- [Migration verification audit](../../research/pump-recorder-candidate-adversarial-verification-2026-08-26.md)
- [GeckoTerminal audit](../../research/geckoterminal-coingecko-keyless-history-audit-2026-08-26.md)

## Effects

- Pauses one-by-one field review while reliable distinct sources are investigated.
- PumpAPI remains the only checked core stream.
- DEX Screener is checked only as optional post-listing enrichment.
- RugCheck is rejected as reliable early-token facts after live instability.
- Many high-value gaps may ultimately be documented as not reliably solvable under strict-free constraints.

## Completion

Complete. Every high-importance ledger row is checked, rejected/excluded, explicitly classified as not reliably solvable for free, or marked not objectively knowable. The dossier contains the final accepted stack and benchmark evidence.