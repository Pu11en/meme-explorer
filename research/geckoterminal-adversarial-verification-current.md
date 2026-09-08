# GeckoTerminal keyless OHLCV — adversarial verification

**Audited:** 2026-08-26 UTC  
**Scope:** strict no-key/no-account/no-trial/no-credit/no-funded-wallet local Pump.fun recorder; owner docs, owner terms, and bounded anonymous probes.

## Verdict

GeckoTerminal's public pool OHLCV endpoint is a **candidate only for optional, on-demand enrichment of an already-known pool**. It is not acceptable as the continuous recorder, launch-discovery authority, canonical history, or reliability foundation. CoinGecko explicitly says its keyless lane is unsuitable for production workloads, scheduled polling, and high-frequency updates.

The distinct convenience over PumpAPI is direct provider-computed, pool-address-specific candles. PumpAPI documents events and replay, not a candle endpoint, so a PumpAPI client must aggregate candles itself. GeckoTerminal does not add an independently canonical event universe: its candles are derived from the provider's indexed onchain trades, while its last-300/24-hour trades and bounded new-pool discovery are narrower/duplicative beside PumpAPI and should not be accepted as distinct recorder capabilities.

## Access and cost boundary

- Owner keyless guidance lists `https://api.geckoterminal.com/api/v2` and says no authentication headers are required.
- GeckoTerminal Website Terms §3.3 say the API is currently available without charges, subject to API Terms.
- The tested endpoint is read-only and required no account, API key, Demo/Pro trial, monthly credits/CUs, or funded wallet.
- This is point-in-time zero-provider-fee access, not a permanent entitlement. Higher/stable limits are paid.

## Endpoint contract

`GET /networks/{network}/pools/{pool_address}/ohlcv/{timeframe}`

- `timeframe`: `minute`, `hour`, `day`.
- Aggregates: minute `1|5|15`, hour `1|4|12`, day `1`.
- `limit`: default 100, maximum 1,000.
- `before_timestamp`: integer Unix seconds serialized through a string-typed OpenAPI parameter.
- `currency`: `usd|token`.
- `token`: `base|quote|token address`, enabling inversion.
- `include_empty_intervals`: false by default; owner reference describes requested empty rows as previous-close OHLC plus zero volume, so they are synthetic.
- Response rows: `[timestamp_seconds, open, high, low, close, volume]` under `data.attributes.ohlcv_list`, plus base/quote metadata.

The no-key OpenAPI documents only a `200` response for OHLCV. It does not document an OHLCV 400/404/429 contract, total anonymous retention, a next cursor, completeness, or an empty-result distinction. By contrast, the trades operation documents 400 for invalid token and 404 for pool not found.

## Practical probes

No credentials were sent.

1. Three identical minute-OHLCV requests to Solana pool `5szx7C6BcoaZLbkUmxSm3pi1iCLXv6CHEh7tpUrRc93B`, 12 seconds apart at 12:01:25–12:01:50 UTC, returned HTTP 200. The ETag/body hash remained identical while `Age` progressed from absent to 12 to 24; `Cache-Control` was `max-age=30, public, must-revalidate, s-maxage=60`.
2. Those three responses contained three rows, but two rows shared timestamp `1785878700` with different OHLCV values. Therefore consumers must not assume one row per bucket, strict timestamp uniqueness, or safe timestamp-key overwrite; treat duplicate bucket rows as a provider anomaly requiring quarantine/reconciliation.
3. `before_timestamp=1785878700` later returned 200 with five rows all strictly older than the boundary in that sample.
4. A malformed pool address returned HTTP 404 with JSON API errors. A valid-shaped unknown address could not be classified because shared egress returned 429 first.
5. Multiple requests returned HTTP 429 with `Retry-After: 0` and an owner JSON rate-limit error. This validates dynamic/IP-shared throttling, not a stable quota or immediate-retry instruction.

## Missing and failure semantics

Record these states separately:

- `200 + rows`: provider supplied indexed rows; this does not prove completeness, finality, uniqueness, or correctness.
- `200 + []`: possible client state, but not observed in this probe and not separately specified in the no-key OpenAPI; do not equate it with no onchain trades or nonexistent pool.
- `404`: observed for malformed address and documented for pool-trades pool miss, but not specified for OHLCV; for a valid address it can also reflect provider non-indexing/insufficient history. It is not proof of onchain nonexistence.
- `429`: shared/dynamic throttle; honor backoff despite the observed `Retry-After: 0`.
- `5xx`, timeout, malformed JSON, schema drift: transport/provider failures, not empty history.
- Short page: available rows were fewer than requested; no total count or durable-retention promise exists.
- Pagination: stop on empty, repeated body/page, nondecreasing oldest timestamp, duplicate timestamp, or no progress; preserve the raw response.

## Reliability limits

- Current owner keyless guidance and Swagger say approximately 10 GeckoTerminal calls/minute, dynamic and IP-shared; a legacy FAQ says 30/minute. Budget conservatively, but neither figure is a guaranteed quota.
- Keyless guidance explicitly rejects production polling use.
- OpenAPI identifies the service as `v2-beta`, subject to frequent changes; pin `Accept: application/json;version=20230203` and parse tolerantly.
- The 2–3 second update wording is conditioned on confirmation/network availability and does not establish new-pool first-index latency.
- Public caching is roughly 30–60 seconds. No candle ingestion timestamp, source slot/finality, completeness marker, indexing SLA, uptime SLA, or anonymous-retention guarantee was found.
- No owner-documented no-key historical reserve, TVL, depth, LP-balance, or pool-state time series was found.

## Owner terms

CoinGecko API Terms (latest version shown: 5 September 2025) require prominent `Powered by CoinGecko` attribution in legible type no smaller than size 10. They discourage caching/storage; if data is stored, they call for refresh at least every 24 hours and strong security. Except as expressly permitted, they restrict duplicating, reproducing, copying, storing, deriving from, or translating Data. On termination, stored Data generally must be deleted unless the terms, prior written consent, or law permit otherwise. Products may charge for integrated services, but may not sell, rent, sublicense, redistribute, or syndicate API access absent a separate executed agreement. This is not an open-data grant; obtain legal/provider approval before retaining or redistributing a candle corpus.

## Acceptance tests still required

1. Compare GeckoTerminal candles against candles reconstructed from finalized, signature-deduplicated PumpAPI/chain trades across active, sparse, migrated, and old pools.
2. Quantify duplicate timestamps, missing intervals, late revisions, USD conversion differences, orientation errors, and synthetic-fill behavior.
3. Measure finalized pool creation-to-first-index delay across a population; do not use `new_pools` as launch truth.
4. Sample anonymous backfill depth by timeframe and pool age, recording empty/404/429/5xx/timeout/no-progress states.
5. Re-fetch frozen windows later to detect mutation and measure cache/candle publication lag.
6. Obtain legal approval for the intended local storage, display, deletion, and redistribution model.

## Primary sources

- https://docs.coingecko.com/docs/keyless-public-api
- https://api.geckoterminal.com/docs/v2/swagger.json
- https://docs.coingecko.com/reference/pool-ohlcv-contract-address
- https://docs.coingecko.com/reference/pool-trades-contract-address
- https://docs.coingecko.com/reference/latest-pools-list
- https://support.coingecko.com/hc/en-us/articles/45908961308185-Why-is-a-pool-page-on-GeckoTerminal-with-a-valid-contract-address-giving-me-This-page-could-not-be-found
- https://www.geckoterminal.com/terms-conditions
- https://www.coingecko.com/en/api_terms
- https://pumpapi.io/stream
- https://pumpapi.io/historical-replay
