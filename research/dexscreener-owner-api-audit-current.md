# DEX Screener strict-free Pump.fun recorder audit — current

**Cutoff:** 2026-08-26 11:54:21 UTC. **Evidence boundary:** DEX Screener owner docs/terms, PumpAPI owner material already audited in this repository, repository probe evidence, and bounded anonymous HTTP GETs. No secondary source, account, API key, checkout, wallet, or deliberate rate-limit exhaustion was used.

## Decision

**Accept only as optional post-listing enrichment.** DEX Screener adds a pullable, cross-DEX indexed snapshot: USD/native price, reported base/quote/USD liquidity, provider-window buy/sell counts and volume, price change, `pairCreatedAt`, FDV, and nullable market cap. The most distinct values beyond PumpAPI are indexed USD valuation, ready-made rolling aggregates, and market cap based in some cases on circulating supply. PumpAPI already supplies Pump-family creation/trade/pool/migration events, reserves, price, and replay, so DEX Screener is not a distinct launch feed, raw-trade archive, migration authority, or canonical liquidity source. [DEX API reference](https://docs.dexscreener.com/api/reference) · [DEX listing/formulas](https://docs.dexscreener.com/token-listing) · [PumpAPI stream](https://pumpapi.io/stream) · repository [`pumpapi-live-historical-audit.md`](pumpapi-live-historical-audit.md)

Do not promote owner phrases such as “automatically in realtime” into a latency, completeness, accuracy, or uptime claim. DEX Screener publishes no numerical first-index bound, pair-update cadence, completeness guarantee, replay, or free-tier SLA. Its listing rule requires both a liquidity pool and at least one transaction. Its documented WebSockets cover profiles, boosts, community takeovers, and ads—not raw trades or a universal new-pair stream—so they are promotional/context feeds, not lossless discovery. [Owner FAQ](https://docs.dexscreener.com/faq) · [Token listing](https://docs.dexscreener.com/token-listing) · [WebSockets](https://docs.dexscreener.com/api/websockets)

## Capability and duplication boundary

| Data | Owner schema | Value beyond PumpAPI | Audit disposition |
|---|---|---|---|
| Price | `priceNative` string; nullable `priceUsd` string | Pullable indexed cross-DEX/USD snapshot | **Keep**, non-canonical and not executable |
| Liquidity | nullable numeric `liquidity.{usd,base,quote}` | Convenient indexed valuation of reserves | **Keep**, but not depth, route output, or settlement proof |
| Activity | open-ended `txns.{window}.{buys,sells}`, `volume`, `priceChange` maps | Provider-computed rolling windows | **Keep as cross-check**; underlying trades duplicate PumpAPI and window/freshness definitions are not documented |
| Pair age | nullable integer `pairCreatedAt` | Provider pair timestamp | **Keep with label**; not token birth, migration time, or first-index time |
| FDV / market cap | nullable numbers; FDV uses `(total supply - burned supply) × price`; market cap may use self-reported circulating supply from paid Enhanced Token Info or CoinGecko | Market cap is the clearest distinct valuation | **Keep nullable**; paid/self-reported metadata is not independent truth |
| Profiles, ads, boosts, paid orders | separate 60-RPM endpoints | Promotion/attention context only | **Reject from core recorder**; payment changes visibility, not organic demand, and adds no missing chain capability |

The documented Pair schema also includes chain/DEX/pair identity, base/quote token objects, optional `info`, and optional active boosts. Token lookup accepts up to 30 comma-separated addresses. Window maps permit additional keys, so retain raw JSON and unknown windows rather than hard-coding only `m5/h1/h6/h24`. [API reference](https://docs.dexscreener.com/api/reference)

## Anonymous access, cost, and limits

- The owner FAQ calls it a **free API**; the published OpenAPI fragments declare no authentication/security scheme. All bounded probes below succeeded without credentials. This proves current anonymous access only—not perpetual entitlement.
- Owner-published ceilings are **300 requests/minute** for pair, search, token-pairs, and token-address market endpoints; profile/boost/order and meta endpoints are **60 requests/minute**. The docs do not specify burst behavior, IP/client accounting, reset windows, `Retry-After`, or a 429 body contract.
- API Terms say both free and paid versions may exist, with rate/request specifications presented at checkout. No owner page reviewed supplied a public credit schedule for these anonymous market GETs. Do not infer that an undocumented paid tier or “credits” are required for the probed route.
- No funded wallet, SOL, card, or payment was required to read market data. Paid Marketplace promotion/Enhanced Token Info is a separate purchase path; buying it is outside strict-free scope. Merely observing the public ads/boost/order endpoints does not fund a wallet, but those launch-promotion signals are not core recorder data.

Sources: [FAQ](https://docs.dexscreener.com/faq) · [API reference](https://docs.dexscreener.com/api/reference) · [API Terms](https://docs.dexscreener.com/api/api-terms-and-conditions) · [Marketplace](https://marketplace.dexscreener.com/).

## Exact observed absence/failure semantics

Anonymous `curl -sS --connect-timeout 10 --max-time 30 -D <headers> -o <body> -w '%{http_code}' <URL>` GETs ran at **2026-08-26 11:52:27–11:52:43 UTC**:

| Probe | Observed response | Safe interpretation |
|---|---|---|
| Known SOL token, `/token-pairs/v1/solana/So111…11112` | `200`, JSON array of 30 Pair objects | Indexed matches returned; not completeness proof |
| System Program used as unknown token, both token endpoints | `200 []` | No indexed pair returned for this request/cache snapshot; not on-chain nonexistence |
| Same address as unknown pair | `200 {"schemaVersion":"1.0.0","pairs":null,"pair":null}` | No indexed pair match; note undocumented singular `pair` beside documented `pairs` |
| Unknown chain string on token-pairs | `200 []` | Invalid/unsupported chain is not reliably distinguished from absent token |
| Search with no match / without `q` | `200 {"schemaVersion":"1.0.0","pairs":[]}` / `400 text/plain` `Bad Request` | Empty product result and malformed request are distinct here |
| Unknown paid-order target | `200 {"orders":[],"boosts":[]}` | Empty object differs from the reference’s bare-array example; parse observed shape defensively |
| Malformed pair path / malformed token-pairs path | `400` JSON containing quoted HTML / `200 []` | Validation is inconsistent across routes |
| Unknown meta slug | `500` with empty body | Missing and server failure are not consistently separated |
| Documented pair route missing final path parameter | `404`, HTML containing `Cannot GET /latest/dex/pairs/solana/` | Routing failure, not valid-pair absence |
| Unknown route | `404` HTML `Cannot GET …` | Routing failure |
| Known Orca SOL pair | `200`, one Pair; `fdv:null`, `marketCap:null` | Null means unavailable, not zero |

The first four core market probes ran at 11:52:27–11:52:43; supplemental failure-shape probes ran through **11:54:21 UTC**. Successful responses exposed `Cache-Control: public, max-age=30`, ETags, and observed `Age` values of 3–27 seconds, but no rate-limit or `Retry-After` headers. That proves CDN caching on these requests, not upstream freshness or a 30-second SLA. Sixty-five sequential anonymous GETs to a documented 60-RPM profile route still returned 200 through cache, so 429 semantics remain unobserved; preserve 429 as throttling with unknown body/reset semantics, and preserve timeouts/5xx separately from valid 200 absence shapes.

## Indexing latency and reliability

Repository evidence first queried a fresh Pump creation at approximately 0, 5, and 15 seconds and received `200 []` throughout. A corrected migration probe joined PumpAPI `poolId` to the exact DEX pair: exact-pair and token lookups stayed empty near 0.2, 5, and 15 seconds, then first populated near 35.2 seconds. This one case brackets one observed path at **>15 s and ≤35.2 s**; it is not a percentile or promise. [`dexscreener-owner-api-audit-2026-08-26.md`](dexscreener-owner-api-audit-2026-08-26.md) · [`planning/evidence/P-004-evidence.md`](../planning/evidence/P-004-evidence.md)

For actual use, record request/receipt UTC, status, raw body, body hash/ETag, `Age`, `Cache-Control`, `pairCreatedAt`, and first non-empty observation. Measure many finalized Pump/PumpSwap pools. Never substitute `pairCreatedAt` for first-index time or DEX Screener for finalized Solana state.

## Terms / license boundary

DEX Screener’s owner API Terms (last updated 2023-08-18) grant a limited, non-exclusive, non-transferable, non-assignable, revocable license; permit commercial and non-commercial use subject to restrictions; prohibit a product whose primary purpose directly competes with DEX Screener/API; restrict making API Services or portions available to third parties; state users gain no ownership in data obtained; allow suspension/termination without notice or liability; and promise breaking/discontinuation notice only to paying customers. Support is as-is. [API Terms](https://docs.dexscreener.com/api/api-terms-and-conditions)

Therefore anonymous/free access is **not** an open-data license or clear redistribution/resale grant. A private local recorder is the narrowest fit, but keep the adapter removable and obtain owner/legal confirmation before redistributing stored DEX-derived data or exposing a competing API.

## Recorder rule

Use sparse, failure-tolerant polling only after a finalized pool/migration candidate exists; join exact `poolId` ↔ `pairAddress`; retain null/empty/error/cache states; compare rolling aggregates to gap-flagged local PumpAPI calculations; and verify correctness-critical pair/reserve/trade facts against finalized chain data. Reject DEX Screener for launch discovery, completion/migration truth, gap recovery, historical OHLCV, executable routing, or any “reliable realtime” claim.
