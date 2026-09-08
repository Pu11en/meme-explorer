# GeckoTerminal / CoinGecko owner API — strict no-key OHLCV and pool-history audit

**Audited:** 2026-08-26 UTC  
**Boundary:** owner documentation, owner-hosted API schema/terms, current repository evidence, and bounded anonymous probes only. No key, account, trial, paid plan, or credential-bearing `/onchain` request was used. Successful requests prove point-in-time access, not entitlement, completeness, latency, or an SLA.

## Decision

**GeckoTerminal pool OHLCV is a distinct capability, but only a low-rate, manual/on-demand candidate.** It adds provider-indexed, pool-address-specific candles that this repository's PumpAPI live/replay layer does not provide directly. Do not promote it to a scheduled collector or production dependency: CoinGecko's current keyless page explicitly says keyless is unsuitable for production workloads, scheduled polling, or high-frequency updates; the API identifies itself as `v2-beta`; the current approximate limit is IP-shared and dynamic; and no pool-indexing, completeness, retention, or uptime SLA was found.

| Strict no-key lane | What it actually adds | Verdict |
|---|---|---|
| `api.geckoterminal.com/api/v2/.../ohlcv/...` | OHLCV derived from indexed onchain trades for one identified pool, with selectable minute/hour/day aggregation and pagination | **Distinct candidate for occasional chart/backfill enrichment.** Not canonical, gap-free, finality-proof, or production-schedulable. |
| `.../pools/{pool}/trades` | At most the last 300 indexed trades within 24 hours | **Reachable but not a durable history source.** Mostly narrower/duplicate evidence beside PumpAPI replay; useful only for sampled cross-checks. |
| `.../networks/new_pools` and network-scoped equivalent | Recent indexed pools and current rolling metrics, up to 20/page and at most pages 1–10 in the public schema | **Discovery aid only.** Not a complete launch feed, first-index clock, or historical reserve/liquidity series. |
| `api.coingecko.com/api/v3/coins/{id}/ohlc` | Coin-level OHLC across CoinGecko's market model | **Not pool OHLCV:** no volume and not pool-specific. Useful only as separate broad-market context. |
| `.../coins/{id}/market_chart` | Coin-level `prices`, `market_caps`, and `total_volumes` time-series | **Not candles and not pool history.** Broad-market context only. |

This resolves the repository's P-012 OHLCV candidate narrowly: the capability exists and schemas/access were observed, but reliability and product-use constraints keep it a **candidate**, not a checked production source. Repository context: [`P-012-capability-gap-ledger.md`](../planning/evidence/P-012-capability-gap-ledger.md), [`pumpapi-live-historical-audit.md`](pumpapi-live-historical-audit.md), and [`free-price-liquidity-routing-migration-audit.md`](free-price-liquidity-routing-migration-audit.md).

## Exact no-key access boundary

The current [Keyless Public API](https://docs.coingecko.com/docs/keyless-public-api) page is controlling evidence for anonymous access:

- CoinGecko root: `https://api.coingecko.com/api/v3`.
- GeckoTerminal root: `https://api.geckoterminal.com/api/v2`.
- It says no headers/auth are required and specifically says not to send `x-cg-demo-api-key` or `x-cg-pro-api-key`.
- It lists pool OHLCV and last-300 pool trades among keyless GeckoTerminal endpoints.
- Keyed CoinGecko plans use a different `/onchain` path. Demo/Pro reference examples that require keys do **not** prove a no-key entitlement on that host; use the separate GeckoTerminal root for this lane.

The owner-hosted [GeckoTerminal Swagger](https://api.geckoterminal.com/docs/v2/swagger.json) calls itself `v2-beta`, says it is subject to frequent changes, and recommends `Accept: application/json;version=20230203`. Omitting a version selects latest, so pin the documented version and keep tolerant raw-response parsing.

## Rate-limit conflict resolved

Owner pages conflict:

- Current [keyless guidance](https://docs.coingecko.com/docs/keyless-public-api): CoinGecko approximately **10–30 calls/minute**, dynamic with server load; GeckoTerminal approximately **10 calls/minute**; all keyless requests share an **IP-based** pool; 429 requires exponential backoff.
- Current [Swagger](https://api.geckoterminal.com/docs/v2/swagger.json): GeckoTerminal approximately **10 calls/minute**, potentially fluctuating with traffic.
- Legacy [GeckoTerminal FAQ](https://apiguide.geckoterminal.com/faq): **30 calls/minute**.

**Resolution:** this remains an owner-documentation conflict; no owner page says the legacy FAQ was formally superseded. For conservative operations, budget below the approximately 10/minute figure on the newer keyless page and current live schema, but do not encode 10/minute as a guaranteed quota or burst allowance. Because accounting is IP-shared and dynamic, one process cannot infer its remaining allowance from its own call count.

Observed on 2026-08-26: after successful low-rate requests, a third near-simultaneous request at 11:38:24 UTC returned HTTP 429 with the owner JSON error and `Retry-After: 0`. At most six requests from this audit were visible in the preceding rolling minute, but this harness uses shared egress; therefore the observation validates shared/dynamic throttling, **not** a six-call ceiling. Treat `Retry-After: 0` as one response observation, not a stable retry contract; apply exponential backoff with jitter and stop optional polling.

## Pool OHLCV contract

**Endpoint:** `GET /networks/{network}/pools/{pool_address}/ohlcv/{timeframe}`  
Owner sources: [Swagger](https://api.geckoterminal.com/docs/v2/swagger.json), [current pool OHLCV reference](https://docs.coingecko.com/reference/pool-ohlcv-contract-address), and [legacy owner FAQ](https://apiguide.geckoterminal.com/faq).

### Request semantics

- `timeframe`: `minute`, `hour`, or `day` in the no-key Swagger.
- `aggregate`: minute `1|5|15`; hour `1|4|12`; day `1`.
- `before_timestamp`: Unix seconds. The Swagger parameter says `type: string` while its nested schema/example describe integer-second semantics; treat this as an owner-schema inconsistency and serialize an integer-second value. The probe observed that the boundary itself was excluded and older rows were returned.
- `limit`: default 100, maximum 1,000.
- `currency`: `usd` or `token`.
- `token`: `base`, `quote`, or a token address, allowing inversion.
- `include_empty_intervals`: false by default. Current owner reference says omitted no-swap intervals can be filled with previous close for OHLC and zero volume. Such rows are synthetic carry-forward intervals, not observed trades.

The current keyed reference says one call spans at most six months and suggests `before_timestamp` for older data, but its history entitlement callout is plan-specific. The no-key page and no-key Swagger do not promise total anonymous retention. **Do not infer unlimited keyless backfill or a six-month retention floor.** The only safe no-key contract is the maximum 1,000 returned rows plus observed pagination while data remains available.

### Response schema

JSON API shape:

- `data.id`: opaque string ID; the owner schema does not define stronger semantics.
- `data.type`: `ohlcv_request_response` in the owner example.
- `data.attributes.ohlcv_list`: array of numeric rows ordered newest first in the owner example and probes.
- Row positional schema: `[timestamp_seconds, open, high, low, close, volume]`.
- `meta.base` and `meta.quote`: `address`, `name`, `symbol`, nullable `coingecko_coin_id`.

The owner FAQ describes these as OHLCV based on onchain trades. That does not prove complete ingestion, canonical finality, stable USD conversion, or agreement with a locally reconstructed chain candle. Preserve pool address, base/quote identity, request/receipt time, params, raw row, and raw payload.

## Pool trades and “pool history” boundary

**Endpoint:** `GET /networks/{network}/pools/{pool_address}/trades`.

The [owner reference](https://docs.coingecko.com/demo/reference/pool-trades-contract-address) and [Swagger](https://api.geckoterminal.com/docs/v2/swagger.json) define this as only the **last 300 trades in the past 24 hours**. Optional controls are minimum USD trade volume and token inversion. It is not paginated durable history.

Trade attributes are:

- `block_number` integer; `block_timestamp` datetime string;
- `tx_hash`, `tx_from_address` strings;
- `from_token_amount`, `to_token_amount`, `price_from_in_currency_token`, `price_to_in_currency_token`, `price_from_in_usd`, `price_to_in_usd`, and `volume_in_usd` as numeric strings;
- `kind`, `from_token_address`, and `to_token_address` strings.

On Solana, names such as `block_number`, `tx_hash`, and `tx_from_address` are provider-normalized cross-chain fields; do not silently relabel them as canonical Solana slot/signature/signer without checking each value against chain records.

No owner-documented no-key endpoint was found for historical pool reserves, liquidity depth, TVL, LP balances, or pool-state snapshots. Current pool resources expose `pool_created_at`, nullable price/valuation fields, rolling transaction and volume objects, and current `reserve_in_usd`; those are snapshot/rolling fields, not a reserve history.

## Pool discovery and index delay

Owner discovery endpoints are `GET /networks/new_pools` and `GET /networks/{network}/new_pools`. The current owner [latest-pools reference](https://docs.coingecko.com/demo/reference/latest-pools-list) says up to 20 pools per page and that pagination beyond 10 pages requires Analyst or above; the public Swagger caps `page` at 10. Therefore the keyless view is a bounded recent index, not an exhaustive pool registry.

No owner source reviewed publishes a maximum or percentile for brand-new-pool discovery/indexing delay. The Swagger's “as fast as 2–3 seconds after a transaction is confirmed” is a general data-update claim, subject to network availability. It is **not** a promise that a new pool is discovered, classified, and queryable in 2–3 seconds. Public responses are also cached for roughly a minute.

Observed 2026-08-26: a Solana `new_pools?page=1` request returned 200 and included pool `24ff…gAAG` with `pool_created_at=2026-08-26T11:34:40Z`; receipt was 11:35:43Z and response `Age` was 41 seconds. This proves appearance by about 63 seconds after the provider-reported creation time for one cached request path, not first appearance or an indexing-lag distribution. It cannot support an SLA.

Encode absence as “not returned by GeckoTerminal for this request/cache snapshot,” never “pool does not exist.” Owner support also documents that valid-address pool pages can be unavailable where the provider lacks sufficient chart/statistics/transaction history: [owner support article](https://support.coingecko.com/hc/en-us/articles/45908961308185-Why-is-a-pool-page-on-GeckoTerminal-with-a-valid-contract-address-giving-me-This-page-could-not-be-found).

## Freshness and cache evidence

Owner claims and observed transport behavior must remain separate:

- [Swagger](https://api.geckoterminal.com/docs/v2/swagger.json): all endpoints cached for one minute; data updated as fast as 2–3 seconds after confirmed transactions, subject to network availability.
- Current CoinGecko endpoint references describe public/keyless OHLCV and trades with roughly 60-second update/cache frequency.
- Observed GeckoTerminal headers: `Cache-Control: max-age=30, public, must-revalidate, s-maxage=60` for OHLCV; same with `s-maxage=30` for trades; `new_pools` used `s-maxage=60` and returned `Age: 41`.
- Four OHLCV reads 15 seconds apart were all 200 and reused the same ETag/body while observed `Age` progressed through 14, 30, and 44. This validates shared-cache reuse only. The pool had no newly reflected candle in that sample, so it does not measure upstream calculation lag.

There is no per-candle ingestion timestamp, source slot/finality field, or completeness marker. A candle timestamp identifies its interval, not when GeckoTerminal first indexed it. Capture local request/receipt time, HTTP `Age`, ETag/body hash, parameters, and raw response; compare finalized chain trades separately.

## CoinGecko keyless history is different data

### Coin OHLC

`GET https://api.coingecko.com/api/v3/coins/{id}/ohlc?vs_currency=...&days=...` is explicitly listed by the [keyless page](https://docs.coingecko.com/docs/keyless-public-api). The [owner endpoint reference](https://docs.coingecko.com/demo/reference/coins-id-ohlc) defines rows as `[timestamp_ms, open, high, low, close]`, with timestamp at candle close. It has no volume and is coin/market-level, not pool-level.

The Demo reference documents choices of 1, 7, 14, 30, 90, 180, or 365 days and restricts Demo history to 365 days; the keyless overview does not separately promise that depth. Auto granularity is 30 minutes for 1–2 days, 4 hours for 3–30 days, and 4 days for 31+ days. Owner Demo cache/update guidance is 15 minutes; the last completed UTC day is available about 00:35 UTC. Observed 2026-08-26: an anonymous Bitcoin one-day request returned 200 with 48 five-element rows; headers had `s-maxage=900` and `Age=825`. Treat longer anonymous depth as uncommitted until directly sampled, not as a keyless entitlement.

### Market chart

`GET /coins/{id}/market_chart` returns three arrays—`prices`, `market_caps`, and `total_volumes`—each as `[timestamp_ms, value]`, per the [owner reference](https://docs.coingecko.com/demo/reference/coins-id-market-chart). It is a time series, not OHLC candles and not pool history. The Demo reference documents auto granularity as five-minute data for one day, hourly for 2–90 days, and daily beyond 90 days, with Demo history restricted to 365 days; the keyless overview does not separately guarantee that history depth. Observed anonymous Bitcoin one-day access returned 200 with those three keys and `s-maxage=30`.

Do not merge CoinGecko coin-level volume with GeckoTerminal pool volume. Their scopes differ: aggregated coin-market context versus one indexed DEX pool.

## Repeated no-key probe record

All requests used owner hosts and no credentials.

| UTC observation | Request/result | Evidence-backed interpretation |
|---|---|---|
| 11:35:43 | Solana `new_pools?page=1` → 200 | Anonymous discovery reachable; one new pool present in cached index. |
| 11:37:15 | Fresh pool `/trades` → 200, 108 returned rows | Anonymous bounded trade history reachable; does not prove all pool trades. |
| 11:37:15–11:38:01 | Four one-minute OHLCV reads, 15s apart → four 200s | Anonymous repeated access worked; identical ETag/body and increasing `Age` show cache reuse. |
| 11:38:23 | Same OHLCV → 200, three rows | Reachability persisted; sparse new pool had fewer rows than requested limit. |
| 11:38:24 | Same pool with `before_timestamp` → 200, two strictly older rows | Pagination parameter worked on this sample. |
| 11:38:24 | Next anonymous request → 429 | Dynamic/shared throttling is operationally real; absence semantics could not be tested in that request. |
| 11:37:41 | CoinGecko Bitcoin `/ohlc` and `/market_chart` → both 200 | Coin-level keyless history currently reachable; schemas differ from pool OHLCV. |

No deliberate flood, authentication bypass, mutation, or high-cost bulk download was attempted.

## Terms and license boundary

The GeckoTerminal [Website Terms](https://www.geckoterminal.com/terms-conditions) (page states latest version 11 August 2025) say the GeckoTerminal API is currently available without charges subject to the API Terms, and route API use to CoinGecko's [API Terms](https://www.coingecko.com/en/api_terms) (page states latest version 5 September 2025).

Material API Terms constraints:

- limited, non-exclusive, non-assignable/non-transferable license; access and the service may be changed, suspended, or terminated;
- products may charge for services incorporating the API, but may not sell, rent, lease, sublicense, redistribute, or syndicate access to the API without a separate executed agreement;
- prominent `Powered by CoinGecko` attribution is required, with the terms specifying legible type no smaller than 10;
- caching/storage is discouraged, and the terms broadly prohibit storing, duplicating, or deriving from Data except where expressly permitted; where storage is permitted, they say refresh at least every 24 hours and apply strong security; termination generally requires deletion unless the terms, prior written consent, or applicable law permit retention;
- service/data are provided as-is/as-available without warranties of timeliness, accuracy, continuity, or omission-free operation.

This is not an open-data/public-domain grant. Provider-free access does not establish unrestricted historical warehousing, redistribution, or resale rights. Obtain provider/legal confirmation before shipping a retained candle corpus or exposing provider data to third parties.

## Safe implementation contract

1. Use only `api.geckoterminal.com/api/v2` and `api.coingecko.com/api/v3` in the strict no-key lane; never smuggle a Demo/Pro key or depend on keyed `/onchain` entitlements.
2. Keep GeckoTerminal optional and user/on-demand. Do not schedule it as a production poller contrary to current keyless guidance.
3. Budget materially below approximately 10 GeckoTerminal calls/minute per egress; centralize requests, cache locally within the terms, deduplicate identical requests, and back off exponentially with jitter on 429.
4. Pin `Accept: application/json;version=20230203`, preserve unknown fields, and retain raw payloads where legally permitted.
5. Key candles by network + pool + base/quote + timeframe + aggregate + currency + token orientation + timestamp. Never merge inverse or USD/token candles silently.
6. Preserve missing intervals as missing unless the caller explicitly requests synthetic empty intervals; mark filled intervals synthetic.
7. Use `before_timestamp` for bounded backfill and stop on repeated pages/no progress. Do not promise retention beyond what is observed.
8. Treat `new_pools` as a lossy bounded index. Discover canonical Pump/PumpSwap pool identity from PumpAPI and finalized chain state, then query the exact pool.
9. Reconstruct comparison candles from finalized PumpAPI/chain trades with signature dedupe and gap flags. Differences are expected from provider indexing, timing, USD conversion, omitted intervals, token orientation, and finality.
10. Store request/receipt time, HTTP `Age`/ETag, raw hash, and 200/404/429/5xx/timeout states. A provider 200 is not completeness; a miss is not nonexistence.

## Final acceptance

**Accept GeckoTerminal pool OHLCV only as a failure-tolerant, occasional chart/backfill enrichment for the local/manual MVP.** It fills the distinct candle capability technically. **Reject it as a strict-free production polling foundation, canonical pool history, complete trade archive, reserve/liquidity history, or launch discovery authority.** Keep P-012 reliability work open until a population-level first-index delay test, finalized-trade candle reconciliation, retention sampling, missing-interval analysis, and legal approval for the intended storage/display model are complete.
