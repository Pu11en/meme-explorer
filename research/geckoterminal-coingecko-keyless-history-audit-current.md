# GeckoTerminal / CoinGecko keyless pool-history audit — current

**Evidence cutoff:** 2026-08-26 12:04 UTC. The runtime clock and owner API `Date` header both place 2026-08-26 in the present audit window, so the supplied candidate's date is **not future-dated in this runtime**. It is still only a point-in-time cutoff, not a claim about later availability.  
**Boundary:** GeckoTerminal/CoinGecko owner docs, owner Swagger, owner terms/support, the live owner API, and the repository's PumpAPI owner-source audit. No secondary source, account, API key, paid trial, credit balance, card, wallet, or credential-bearing `/onchain` request was used.

## Verdict

**Technically yes; operationally and legally narrow.** The GeckoTerminal Public API presently exposes anonymous, provider-fee-free, exact-pool-address OHLCV. That is more than launch discovery: it adds a pullable provider-indexed candle view for a known pool, including selectable aggregation, USD/token orientation, time pagination, and optional synthetic empty intervals. PumpAPI emits/replays underlying Pump-family events and values but does not document a pool-address OHLCV query. The addition is therefore a **distinct aggregation/access pattern**, not a distinct canonical trade universe or independent completeness proof.

For a **strict-free local Pump.fun recorder**, accept it only as **manual/on-demand, failure-tolerant enrichment/backfill within the currently enforced public window**. Reject it as a scheduled recorder foundation, canonical history, complete archive, or redistributable stored dataset: a live probe found a 180-day Public API cutoff; current keyless guidance explicitly says the lane is unsuitable for production workloads, scheduled polling, or high-frequency updates; the API is beta; rate capacity is approximate, dynamic, and IP-shared; no coverage/indexing/retention/uptime/completeness SLA was found; and the API Terms impose attribution and restrictive storage/deletion/redistribution conditions.

| Question | Evidence-backed answer |
|---|---|
| No key / no account? | **Yes, currently.** Owner guidance says “No headers, no auth,” no sign-up, and says key headers are unnecessary/ignored. |
| No paid trial / no credits? | **Yes for this keyless host.** It does not enroll the caller in a plan, trial, or credit balance. “Higher credits” belongs to the separate paid upgrade path, not an anonymous-call prerequisite. |
| No funded wallet/card? | **Yes for read access.** No wallet, SOL, card, checkout, or payment operation appears in the request contract or was needed in probes. |
| Permanently free entitlement? | **No.** GeckoTerminal's site terms say the API is available without charges “as of now,” subject to API Terms; access and terms may change. |
| Distinct beyond PumpAPI? | **Yes, narrowly:** exact-pool provider-computed candles and queryable historical aggregation. Underlying trades overlap data PumpAPI can emit/replay and a local recorder can aggregate itself. |
| Suitable for continuous strict-free recording? | **No under current owner guidance.** Occasional/manual reads only. |

Primary access sources: [Keyless Public API](https://docs.coingecko.com/docs/keyless-public-api) · [GeckoTerminal authentication](https://apiguide.geckoterminal.com/authentication) · [GeckoTerminal site terms](https://www.geckoterminal.com/terms-conditions).

## What is genuinely distinct beyond PumpAPI

The owner FAQ says historical token price/volume requires identifying the trading pool and passing that **pool address** to the OHLCV endpoint. The endpoint is:

`GET https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool_address}/ohlcv/{timeframe}`

That is not merely `new_pools` discovery. It returns one pool's provider-indexed OHLCV rows. The recorder can take a PumpAPI `poolId`/chain-verified PumpSwap pool address and query that exact pool. Distinct conveniences are:

- ready-made minute/hour/day candles rather than replaying and aggregating raw PumpAPI trades;
- provider USD conversion or token-denominated orientation;
- bounded backward lookup with `before_timestamp`;
- explicit optional carry-forward rows for intervals with no indexed swaps.

The distinction must not be overstated. PumpAPI already supplies Pump creation/trade/pool/migration events and hourly replay, so GeckoTerminal does not add a new authoritative Pump event universe. Candles are derived from GeckoTerminal's index. They include no source slot/finality, per-candle ingestion timestamp, completeness marker, or list of contributing signatures. They cannot prove that PumpAPI or GeckoTerminal captured every trade. Compare the repository's [`pumpapi-live-historical-audit.md`](pumpapi-live-historical-audit.md) with the owner [GeckoTerminal FAQ](https://apiguide.geckoterminal.com/faq).

`/networks/new_pools` remains only bounded discovery (20 rows/page observed; public Swagger allows pages 1–10). It is not a complete launch feed, first-index timestamp, or substitute for PumpAPI/chain pool identity.

## Exact OHLCV contract—and what is not contracted

Owner sources: [public Swagger](https://api.geckoterminal.com/docs/v2/swagger.json) · [current OHLCV reference](https://docs.coingecko.com/reference/pool-ohlcv-contract-address) · [keyless overview](https://docs.coingecko.com/docs/keyless-public-api).

### Request

- `timeframe`: `minute`, `hour`, or `day`.
- `aggregate`: minute `1|5|15`; hour `1|4|12`; day `1`.
- `before_timestamp`: Unix seconds; docs say return data **before** it. This is time-cursor pagination, not page-number pagination.
- `limit`: default 100, maximum 1,000. Swagger inconsistently declares the parameter itself as string while its nested schema is integer.
- `currency`: `usd` or `token`.
- `token`: `base`, `quote`, or a token address; changing it can invert the chart.
- `include_empty_intervals`: false by default.
- Recommended version header: `Accept: application/json;version=20230203`; omission selects latest.

The current reference says one call spans at most six months and directs older reads through `before_timestamp`, but its displayed history entitlements are paid-plan-specific (Basic six months; Analyst+ from September 2021 depending on pool tracking start). The keyless page and public Swagger do **not** separately promise total anonymous retention. A six-month maximum query span is not a six-month keyless retention guarantee.

### Success response

JSON:API-like body:

- `data.type`: observed `ohlcv_request_response`;
- `data.id`: opaque UUID-like value; no stable identity semantics are documented;
- `data.attributes.ohlcv_list`: positional rows `[timestamp_seconds, open, high, low, close, volume]`;
- `meta.base` and `meta.quote`: address/name/symbol and nullable `coingecko_coin_id`.

Owner examples and successful probes return newest rows first, but the Swagger does not state an ordering guarantee. Do not make ordering or strict boundary exclusion a permanent contract; verify monotonic progress and deduplicate timestamps while paging.

### Empty intervals and empty history

- Default: intervals with no indexed swaps are **omitted**, so timestamp gaps are expected and do not by themselves prove provider failure.
- `include_empty_intervals=true`: owner docs say fill gaps with previous close for O/H/L/C and `volume=0`. These rows are synthetic carry-forward intervals, not trades and not evidence that ingestion was complete.
- Owner docs do not define leading-gap behavior when no prior close exists, how far synthetic filling extends, or a completeness flag.
- The Swagger documents only HTTP 200 for this OHLCV operation and does not document the exact body for an exhausted cursor/no tracked candles. Therefore code should accept a 200 with `ohlcv_list: []` if encountered, but this audit does **not** elevate that plausible shape into a guaranteed contract.

### Missing, invalid, throttled, and transport failure

The API does not provide one universal “missing” shape:

| Condition | Current evidence | Safe recorder meaning |
|---|---|---|
| Unknown network | Observed `404` JSON `{"errors":[{"status":"404","title":"Not Found"}],"meta":{"ref_id":...}}` | Provider did not resolve the network/request; not chain nonexistence. |
| `limit=0` | Observed `400` JSON error: `Invalid limit. must be positive integer less than or equal to 1000` | Invalid request. |
| Rate limit | Repeatedly observed `429` JSON under top-level `status`, `Retry-After: 0`, and no-store cache directives | Shared/dynamic throttle. Back off exponentially with jitter; `0` is an observation, not a stable retry contract. |
| Unknown pool | Public Swagger does not document an OHLCV 404 schema. Owner support says even valid pool pages can be unavailable when chart/statistic/transaction history is insufficient. | “Not returned/tracked for this request,” never “pool does not exist.” |
| 5xx / timeout / DNS/TLS | No endpoint-specific owner body or retry contract found. | Preserve separately from valid empty/missing responses; retry boundedly. |

The trades endpoint is different: its Swagger explicitly lists 404 “Specified pool not found,” 400 invalid token, and 200. It only exposes the last 300 trades in the past 24 hours and is not paginated durable history.

Owner support: [valid-address pool page can be unavailable](https://support.coingecko.com/hc/en-us/articles/45908961308185-Why-is-a-pool-page-on-GeckoTerminal-with-a-valid-contract-address-giving-me-This-page-could-not-be-found).

## Practical anonymous probes

All calls used the public GeckoTerminal host with no credentials. No flood or bypass was attempted.

| UTC (2026-08-26) | Probe | Result / interpretation |
|---|---|---|
| 12:01:32 | Solana `new_pools?page=1` | `200`, 20 resources; first pool address `6ywgu…CkSRp`, provider `pool_created_at=12:00:37Z`; response `Age: 20`, `s-maxage=60`. Anonymous discovery was reachable, not complete or uncached. |
| 12:01:57–12:02:29 | Five OHLCV/absence variants, spaced ~8 s | Five `429`s with `Retry-After: 0`. Shared egress was already constrained; spacing below a nominal average did not yield capacity. |
| 12:02:37 | Unknown network | `404` owner JSON error. |
| 12:02:53 | `limit=0` | `400` owner JSON validation error. |
| 12:03:13 | Exact fresh pool OHLCV, minute/1, limit 5 | `200`; one pool-address-specific row, `data.type=ohlcv_request_response`, base AIRLOVER mint and wrapped-SOL quote metadata. |
| 12:03:21 and 12:04:12 | Same pool with `before_timestamp` | `429` both times; pagination exhaustion/boundary semantics were not independently reproduced in this pass. |

The successful candle proves current anonymous functionality and exact-pool scope. The 429-heavy sequence proves operational throttling and shared-IP interference, not a personal call quota or availability percentage. It also adversarially narrows the supplied candidate: prior one-sample statements about cursor exclusion or empty-history shape are observations, not owner-guaranteed semantics.

## Limits, cache, and unsupported reliability claims

Current owner sources conflict:

- Current [keyless guidance](https://docs.coingecko.com/docs/keyless-public-api): GeckoTerminal approximately **10 calls/minute**, all keyless calls sharing an IP-based pool; 429 requires exponential backoff; keyless is unsuitable for production, scheduled polling, or high-frequency updates.
- Current [public Swagger](https://api.geckoterminal.com/docs/v2/swagger.json): approximately **10 calls/minute**, potentially fluctuating with traffic.
- Legacy [GeckoTerminal FAQ](https://apiguide.geckoterminal.com/faq): **30 calls/minute**.

Use neither 10 nor 30 as a guaranteed entitlement, burst budget, or per-process quota. Conservatively budget below ~10/minute per egress for occasional user-triggered reads and expect unrelated clients to consume the same pool.

Swagger calls the API `v2-beta`, subject to frequent changes. It says endpoints are cached for one minute and data may update “as fast as 2–3 seconds” after confirmation, subject to network availability. Live headers showed `Cache-Control: max-age=30 ... s-maxage=60`. None of these establish a maximum index delay, first-pool discovery latency, per-candle freshness, trade completeness, retention, finality level, uptime, or SLA.

Reject these claims unless separately measured and contractually supported:

- “real-time,” “all trades,” “complete OHLCV,” “gap-free,” or “finalized”;
- fixed 2–3 second indexing, fixed 60-second freshness, or fixed 10/30 RPM;
- unlimited/full-history anonymous backfill;
- 404/empty means no pool or no trades on-chain;
- stable schema/order/pagination/error bodies;
- production reliability or recovery guarantees.

## Storage, attribution, and redistribution terms

Owner terms reviewed: [CoinGecko API Terms](https://www.coingecko.com/en/api_terms) (page: latest version 5 September 2025) · [GeckoTerminal Terms](https://www.geckoterminal.com/terms-conditions) (page: latest version 11 August 2025).

Material restrictions:

- License is limited; CoinGecko may change, suspend, restrict, or discontinue access.
- Prominent `Powered by CoinGecko` attribution is required; the API Terms specify legible type no smaller than font size 10 and link the owner brand guide.
- Products may charge for services incorporating the API, but may not sell, rent, lease, sublicense, redistribute, or syndicate **access to the API** without a separately executed agreement.
- Terms say caching/storage is not encouraged; if done, refresh at least every 24 hours and apply strong encryption/security.
- Except as expressly permitted, terms prohibit duplicating, reproducing, copying, storing, deriving from, or translating Data/information expressed by Data.
- On termination, stored Data generally must be promptly and permanently deleted (unless applicable law, an express term, or prior written consent permits otherwise).
- External-user products require a protective user agreement/privacy policy and must identify CoinGecko ownership and disclaim CoinGecko liability.
- Service/data are `as is` and `as available`; no accuracy, timeliness, continuity, accessibility, or omission-free warranty is supplied.

**Recorder consequence:** current free access is not an open-data license. A private local cache is narrower than public redistribution, but a durable historical recorder conflicts with the terms' discouragement, 24-hour refresh language, broad restrictions, and termination deletion duty. The terms do not clearly grant the right to publish, resell, or redistribute a retained candle corpus. Obtain written owner/legal confirmation before retaining long-term provider-derived OHLCV, exposing it to third parties, or using it as a product dataset. Attribution does not cure storage/redistribution restrictions.

## Safe acceptance rule

1. Discover/verify Pump/PumpSwap pool identity through PumpAPI plus finalized chain state; never depend on `new_pools` completeness.
2. Query exact GeckoTerminal pool OHLCV only on explicit user demand; do not schedule continuous polling on keyless.
3. Pin API version, preserve raw response/error/cache metadata only where terms permit, and parse unknown fields defensively.
4. Key rows by network, pool, base/quote, timeframe, aggregate, currency, orientation, and timestamp.
5. Mark `include_empty_intervals` rows synthetic; otherwise preserve timestamp gaps as missing/unknown.
6. Cursor backward with strict local progress checks and timestamp dedupe; stop on empty/no-progress/429.
7. Preserve 200-empty, 400, 404, 429, 5xx, timeout, and parse errors as distinct states.
8. Reconstruct important candles from gap-flagged PumpAPI/finalized-chain trades and retain contributing signatures; treat GeckoTerminal only as a cross-check/convenience view.
9. Do not promise retention, completeness, indexing latency, finality, uptime, or redistribution rights.

**Final disposition:** **accept exact-pool OHLCV as a genuinely distinct, occasional strict-free technical enrichment; reject GeckoTerminal keyless as the recorder's continuous collection/archive foundation or as legally cleared redistributable storage.**
