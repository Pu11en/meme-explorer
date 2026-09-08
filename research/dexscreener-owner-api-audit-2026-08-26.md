# DEX Screener owner API — post-listing market-capability audit

**Audited:** 2026-08-26 UTC  
**Evidence boundary:** DEX Screener owner documentation and terms, PumpAPI owner pages already audited in this repository, current repository evidence, and bounded anonymous probes. A successful no-key request proves observed access only—not an SLA, future entitlement, completeness, or accuracy.

## Verdict

DEX Screener is a useful **post-listing indexed snapshot** enrichment for PumpAPI, not a discovery, canonical-chain, historical-trade, or executable-liquidity replacement. The seven requested fields are exposed by the Pair schema, but their meanings and distinctness differ:

| Capability | Owner schema / meaning | Distinct value beyond PumpAPI | Decision |
|---|---|---|---|
| Price | `priceNative` string; nullable `priceUsd` string | PumpAPI emits event-time `price` and quote context. DEX Screener adds a pullable current cross-DEX indexed snapshot and USD value after indexing. | **Distinct snapshot/access pattern; not canonical or executable.** |
| Liquidity | nullable `liquidity.{usd,base,quote}` numbers | PumpAPI emits pool reserves and liquidity-action events that must be maintained/valued by the client. DEX Screener adds indexed USD/base/quote liquidity. | **Distinct convenience/valuation; not executable depth.** |
| Transactions | `txns.{window}.{buys,sells}`, where window keys are open-ended additional properties | PumpAPI emits raw buy/sell events; DEX Screener supplies ready-made rolling counts. | **Distinct aggregate, but window definition/freshness are provider-defined.** |
| Volume | `volume.{window}` numbers with open-ended window keys | PumpAPI raw events/replay can be aggregated locally. DEX Screener supplies rolling indexed volume. | **Distinct aggregate, not distinct underlying trade truth.** |
| Pair age | nullable integer `pairCreatedAt`; compute age only as `request_receipt_time - pairCreatedAt` | PumpAPI emits `createPool`/migration event timestamps and `poolId`. DEX Screener adds provider-reported pair creation time. | **Convenience field; do not call it token age, migration time, or first-index time.** |
| FDV | nullable number; owner formula: `(total supply - burned supply) * price` | PumpAPI exposes `price`, supply, and `marketCapQuote`, so a comparable fully diluted value can be derived only after quote-currency alignment. | **Provider-computed valuation, useful for cross-checking.** |
| Market cap | separate nullable number; owner says it can differ from FDV when DEX Screener uses self-reported circulating supply from Enhanced Token Info or CoinGecko | PumpAPI does not expose an equivalent documented circulating-supply market-cap field. | **Most clearly distinct valuation, but nullable and partly dependent on external/self-reported supply.** |

Owner schema source: [API reference](https://docs.dexscreener.com/api/reference). Formula/listing source: [Token Listing](https://docs.dexscreener.com/token-listing). PumpAPI comparison sources: [stream](https://pumpapi.io/stream), [historical replay](https://pumpapi.io/historical-replay), and repository audit [`pumpapi-live-historical-audit.md`](pumpapi-live-historical-audit.md).

## Access and rate limits

- The owner [FAQ](https://docs.dexscreener.com/faq) calls this its “free API.” The reference publishes no authentication scheme for the pair/search/token endpoints, and anonymous requests succeeded on 2026-08-26.
- Owner-published limits are **300 requests/minute** for `/latest/dex/pairs/{chainId}/{pairId}`, `/latest/dex/search`, `/token-pairs/v1/{chainId}/{tokenAddress}`, and `/tokens/v1/{chainId}/{tokenAddresses}`. Profile/boost/order and metas endpoints shown in the reference are **60 requests/minute**.
- The owner page does not promise a free tier SLA, burst semantics, per-IP versus per-client accounting, `Retry-After`, or 429 body schema. Do not convert 300/minute into a guaranteed 5 RPS burst allowance.
- Current no-key observations: known Solana token-pairs `200` with an array, known token lookup `200`, unknown token `200 []`, unknown pair `200` with null pair collections. These establish current anonymous reachability only.

Source: [API reference](https://docs.dexscreener.com/api/reference).

## First-index behavior

Owner listing rule: “All tokens are listed … as soon as they are added to a liquidity pool and have at least one transaction.” This creates a categorical blind spot before both conditions. It does **not** define a numerical indexing-lag maximum, percentile, supported-chain completeness guarantee, or SLA.

Repository evidence on a fresh Pump creation queried immediately, near 5 seconds, and near 15 seconds returned `200 []` from the token-pairs endpoint at every sample. A corrected same-date migration probe then joined PumpAPI `poolId` to the exact DEX pair: exact-pair and token lookups were empty at about 0.2, 5, and 15 seconds; at about 35.2 seconds the exact pair first appeared with price, liquidity, transactions, volume, FDV, market cap, and `pairCreatedAt`. The token lookup then returned three pairs. This single observation brackets first observed indexing to **after 15 seconds and by 35 seconds** for that event/request/cache path; it is not a latency promise or population estimate. Therefore DEX Screener metrics cannot be assumed during the earliest alert window.

Sources: [Token Listing](https://docs.dexscreener.com/token-listing), repository [`planning/evidence/P-004-evidence.md`](../planning/evidence/P-004-evidence.md), and bounded 2026-08-26 no-key probe.

## Update cadence evidence

No owner page reviewed states the market-pair update cadence or freshness SLA, and Pair objects have no provider snapshot timestamp or source slot. In a bounded 2026-08-26 hot-pair probe:

- every response was HTTP 200 with `Cache-Control: public, max-age=30`;
- repeated one-second reads returned the identical ETag/body while `Age` advanced from 26 through 29;
- at the next cache refresh the ETag/body changed, including price, 5-minute transactions, and 5-minute volume; the next reads again reused that payload while `Age` advanced.

This proves observed CDN cache behavior of up to roughly 30 seconds for that route at that time. It does **not** prove upstream calculation cadence, maximum data staleness, or a 30-second SLA. Capture local request/receipt time, `Age`, `Cache-Control`, ETag/body hash, and raw response; do not invent provider event time.

## Schema and absence/error semantics

### Documented shapes

- Pair lookup: object containing optional `schemaVersion` and nullable `pairs: Pair[]`.
- Token-pairs and token-address lookup: `Pair[]`; token-address lookup accepts up to 30 comma-separated addresses.
- Pair fields: identity and pair address; base/quote tokens; string `priceNative`; nullable string `priceUsd`; open-ended rolling `txns`, `volume`, and `priceChange`; nullable liquidity; nullable FDV, market cap, and pair-created time; optional info and boosts.
- Open-ended window keys mean parsers must not hard-code only currently observed `m5`, `h1`, `h6`, and `h24`. Preserve unknown keys and raw payloads.

### Evidence-backed meanings

| Response state | Meaning safe to encode | Meaning **not** established |
|---|---|---|
| `200 []` from token endpoints | No matching indexed Pair object was returned for that request/cache snapshot. | Token/pool does not exist on-chain; token never traded; permanent absence. |
| `200` with `pairs:null` (and observed undocumented `pair:null`) from pair lookup | No indexed pair match was returned for that request/cache snapshot. | 404; permanent nonexistence; invalid chain proof. |
| Nullable field missing or `null` | Provider did not supply that value in this Pair snapshot. Keep `unavailable` distinct from numeric zero. | Zero liquidity/FDV/market cap, no trades, or no pair age. |
| HTTP 404 | Bounded probes produced 404 HTML `Cannot GET ...` for an unknown route and a documented route missing its path parameter. | “Valid token/pair is not indexed.” Valid unknown pair/token probes instead returned HTTP 200 absence shapes. |
| HTTP 429 | Treat only as rate throttling and back off. Published endpoint ceilings make it an expected contract-test state. | The owner reference does not document its body, duration, `Retry-After`, or reset semantics; this audit did not intentionally exceed the limit. |

## Legal boundary

DEX Screener’s owner API Terms (last-updated text: 2023-08-18) grant a limited, non-exclusive, non-transferable, non-assignable, revocable license. They:

- prohibit using the API Services to construct, enhance, or market a product whose primary purpose directly competes with DEX Screener or its API;
- prohibit unauthorized assignment, sale, marketing, licensing, or making the API Services or any portion available to third parties;
- say DEX Screener retains rights to the API Services and users gain no ownership in the data obtained;
- allow commercial and non-commercial use subject to the restrictions;
- allow suspension/termination at sole discretion, with or without notice/liability;
- reserve modification/discontinuance and provide breaking-change/discontinuation notice commitments only to paying customers;
- provide support on an as-is basis and allow immediate posted amendments.

This is not an unrestricted data license or clear resale/redistribution grant. Before shipping stored DEX-derived data to third parties, obtain counsel/provider confirmation. Keep DEX Screener optional and replaceable.

Source: [DEX Screener API Terms & Conditions](https://docs.dexscreener.com/api/api-terms-and-conditions).

## PumpAPI comparison strategy

1. **Join identity correctly:** map PumpAPI `poolId` to DEX Screener `pairAddress`; retain `mint`, `quoteMint`, venue (`pool`/DEX), and signature. Do not mistake PumpAPI’s `pool` venue label for the pair address.
2. **Separate clocks:** store PumpAPI event `timestamp`, local PumpAPI receipt, DEX request/receipt, HTTP cache `Age`/ETag, DEX `pairCreatedAt`, and first non-empty DEX observation. `pairCreatedAt` is not first-index time.
3. **Measure first index:** after finalized `createPool` or migration, query the exact pair and token at a sparse fixed schedule within 300/minute; record every 200-empty/null, first non-empty response, and misses. Report distributions over many pairs, not one anecdote.
4. **Normalize currency:** compare the same pool and quote mint. DEX `priceNative`/`priceUsd` and liquidity USD are not directly comparable with PumpAPI quote-denominated `price`/`marketCapQuote` until quote decimals and time-aligned quote/USD conversion are fixed.
5. **Recompute raw-event aggregates:** aggregate PumpAPI buys/sells and quote volume into explicit event-time windows, with signature dedupe and gap flags. Compare only against matching DEX windows at aligned observation times. Expect differences from indexing coverage, classification, cache, failed/gapped PumpAPI delivery, and rolling-window boundaries.
6. **Compare valuations separately:** calculate `supply × aligned price` as an FDV-like check; never silently compare it with DEX `marketCap` when circulating supply differs. Preserve DEX nulls.
7. **Liquidity is not execution:** compare DEX reported base/quote/USD liquidity with PumpAPI pool reserves at a declared slot/time, but validate executable output separately with an amount-specific router/AMM simulation and finalized settlement.
8. **Ground truth:** reconcile pair creation, reserves, trades, and migration against finalized Solana/Pump/PumpSwap state/events. Neither third-party source is canonical or SLA-backed.
9. **Contract tests:** cover 200 populated/empty/null, missing/null fields, 404, 429, 5xx, timeouts, schema additions, dynamic window keys, cache staleness, and multiple pairs per token.

## Acceptance decision

Use DEX Screener as a failure-tolerant post-listing enrichment for current indexed USD price, reported liquidity, rolling activity, provider pair age, FDV, and especially nullable circulating-supply market cap. Do not use it as the Pump launch feed, completion/migration authority, gap-free trade archive, historical OHLCV source, or proof of routeable liquidity. Recheck terms and safe anonymous access before deployment.
