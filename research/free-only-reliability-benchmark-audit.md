# Free-only Solana meme-source reliability benchmark — corrected audit

**Audited:** 2026-08-26 UTC  
**Rule:** Exclude any lane requiring a funded wallet, metered balance/credits/CUs, paid package, card, or temporary trial. Owner documentation and documented low-volume no-key requests only. A successful probe establishes observed availability, never an SLA, completeness, or future entitlement.

## Corrected source eligibility

- **PumpAPI:** Owner pages label the single-connection WebSocket and hourly replay FREE. A fresh no-key socket opened and produced a frame; the replay day listing returned HTTP 200. This is a best-effort candidate, not a production guarantee: terms say as-is/as-available, replay has no retention/completeness SLA, current files are hundreds of MB/hour, and the repository audit found one missing historical hour. Replay objects appear only after an hour closes, so they cannot always recover a current-hour gap within 15 minutes.
- **PumpPortal:** Creation and migration subscriptions are documented as free. Token/account trade subscriptions are ineligible: they require an API key, a wallet funded with at least 0.02 SOL, and metered fees. A fresh anonymous creation subscription worked, but the documented URL includes a key; anonymous access is observed rather than contractual. The feed is processed-commitment, live-only, and has no replay/completeness/SLA contract.
- **Solana public RPC:** The documented mainnet HTTP/WSS service is no-key; a fresh `getVersion` returned HTTP 200. Solana expressly says public endpoints are not intended for production, limits may change, and traffic can be blocked. RPC history methods enable bounded backfill but do not promise archive completeness or retention.
- **DEX Screener:** The reference documents 300 requests/minute for pair/token endpoints and 60 requests/minute for profiles/boosts; a documented no-key Solana token-pairs request returned HTTP 200. It offers indexed snapshots, not a chain ground truth, indexing-delay guarantee, or SLA.
- **Jupiter:** Current owner pages distinguish keyless access at 0.5 RPS for tests/prototyping from a $0 API-key Free plan at 1 RPS with unlimited credits. A keyless quote returned HTTP 200. Treat each as a separate lane; verify signup has no card/deposit before admitting the keyed lane. No free-tier SLA is documented.
- **RugCheck:** Owner Swagger is public. Swagger leaves report/summary GETs without a security requirement; a fresh no-key summary returned HTTP 200 and rate headers showing 15 remaining-unit semantics without a documented window. This establishes an anonymous observed lane, not a documented free production commitment or stable full-report schema.
- **GeckoTerminal:** The legacy FAQ says 30 calls/minute, but current owner CoinGecko keyless guidance says approximately 10 calls/minute and directs production-grade/high-frequency needs to paid service. The API is beta and no-key; a fresh pool request returned HTTP 200. Do not preregister 30/minute as a current production entitlement.
- **Helius and Birdeye:** Exclude. Their $0 plans consume metered credits/compute units, which fails the supplied definition regardless of whether signup requires a card.

## Benchmark corrections

1. Compare **endpoint × event class × field × commitment × latency window × access lane**, not a single source-wide score. Unsupported classes are not misses.
2. Do not build truth from the union of compared sources alone. That has incorporation bias and cannot detect events missed by every source. Enumerate independently captured slot windows/program activity, decode pinned owner IDLs, reconcile at finalized commitment, and publish reference coverage/uncertainty. If independent enumeration is incomplete, call the result bounded agreement/ascertainment—not recall against ground truth.
3. Sample mints deterministically from the independent finalized cohort, not whichever feed arrived first. Define scheduled age from one declared anchor and retain actual request time.
4. Cross-source monotonic arrival deltas measure relative lead/lag only. They are not absolute chain latency. WebSocket high-level APIs timestamp complete application-visible messages, not first network byte; claim first-byte timing only with a lower-level instrumented transport.
5. Prefer signature + exact decoded instruction/log/event position. If a provider omits position, preserve every occurrence and attach a non-unique fallback confidence; sorting by type/mint/pool/amount can collapse repeated identical events.
6. Exact-signature matching is strongest. Unsigned time-window matching is exploratory and should not contribute to high-confidence recall unless independently adjudicated. Compare exact integer raw amounts with mint/decimals/direction; relative error alone is undefined around zero and unsafe across units.
7. Separate live delivery, reconnect recovery, provider-native replay, and eventual archive recovery. Start PumpAPI archive-recovery timing when the required hourly object becomes available; separately report object publication lag and missing hours.
8. Separate provider outages from collector-injected faults. Include injected faults in an end-to-end resilience metric, but not in provider-only availability. Planned faults also make “14 uninterrupted days” inaccurate; use “14 continuously scheduled scored days.”
9. Treat thresholds such as 99.5% recall, 3-second p95, and 15-minute recovery as preregistered use-case gates, not verified industry standards. Report denominators and insufficient-evidence strata. Because observations are temporally clustered, complement Wilson intervals with hour/day block bootstrap or per-day bounds.
10. Define HTTP success semantically: transport success, valid schema, entity identity, data present, freshness, and quote/no-route are separate outcomes. A 200-empty, 404-not-indexed, 429, parse failure, and valid no-route must remain distinct.
11. Use conservative endpoint-specific rate controls. Where the owner does not document a ceiling (notably anonymous RugCheck), discover behavior only with low-volume probes and adaptive backoff; do not run intentional 110% over-limit tests.
12. Raw evidence should retain payloads and evidence hashes while redacting API keys/cookies from published headers. Preserve secret-redaction manifests, terms/access snapshots, parser/dependency pins, clocks, retries, reconnects, schema inventories, disagreement tables, and rerun proofs.

## Primary sources and repository evidence

- PumpAPI: https://pumpapi.io/stream · https://pumpapi.io/historical-replay · https://pumpapi.io/fees · https://pumpapi.io/FAQ · https://pumpapi.io/legal
- PumpPortal: https://pumpportal.fun/data-api/real-time/ · https://pumpportal.fun/fees/ · https://pumpportal.fun/FAQ/ · https://pumpportal.fun/legal/
- Solana: https://solana.com/docs/references/clusters · https://solana.com/docs/rpc/http/gettransaction · https://solana.com/docs/rpc/http/getsignaturesforaddress · https://solana.com/docs/rpc/websocket/logssubscribe
- DEX Screener: https://docs.dexscreener.com/api/reference · https://docs.dexscreener.com/api/api-terms-and-conditions
- Jupiter: https://developers.jup.ag/docs/portal/setup · https://developers.jup.ag/docs/portal/plans · https://developers.jup.ag/pricing
- RugCheck: https://api.rugcheck.xyz/swagger/doc.json
- GeckoTerminal/CoinGecko: https://apiguide.geckoterminal.com/authentication · https://apiguide.geckoterminal.com/faq · https://docs.coingecko.com/docs/keyless-public-api
- Exclusions: https://www.helius.dev/docs/billing/credits · https://www.helius.dev/pricing · https://docs.birdeye.so/docs/pricing · https://docs.birdeye.so/docs/compute-unit-cost
- Repository cross-checks: `research/pumpapi-live-historical-audit.md`, `research/pumpportal-live-historical-streams-audit.md`, `research/solana-free-rpc-audit.md`, `research/free-price-liquidity-routing-migration-audit.md`, `research/free-holders-creator-risk-enrichment-audit-2026-08-26.md`, `planning/evidence/P-004-evidence.md`, and `planning/evidence/P-010-reuse-candidates.md`.
