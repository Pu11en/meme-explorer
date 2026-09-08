# DeFiLlama no-key Solana mint USD-price and history audit

**Evidence cutoff:** 2026-08-26 12:27 UTC. The runtime UTC clock and owner API `Date` headers both placed 2026-08-26 in the current audit window, so this is not a future-dated simulation in this runtime. It is still only point-in-time evidence: no claim is made about behavior after the stated cutoff.  
**Source boundary:** official DefiLlama/CoinPaprika/DexPaprika/CoinGecko/GeckoTerminal documentation, owner GitHub repositories, live owner API responses, and owner terms only. No secondary sources, account, key, paid trial, card, or deliberate rate-limit exhaustion was used.

## Bottom line

- **No presently verified project satisfies every requested property at once:** openly licensed backend, hosted no-key access, arbitrary Solana-mint input, USD spot, historical charts, and dependable brand-new Pump.fun coverage.
- **DeFiLlama's public Coins API is presently no-key and supports Solana identifiers syntactically** as `solana:{mint}`. It exposes current, point-in-time historical, batch-historical, first-price, and regular-interval chart routes. A known wrapped-SOL mint worked anonymously.
- **It is not reliable coverage for arbitrary Solana mints or new Pump/Pump.fun tokens.** In bounded live probes, known SOL returned a price, while BONK, two fresh Pump-family mints, a current Token-2022 Pump mint, and other Pump examples were silently omitted. Unsupported inputs returned HTTP 200 with an empty or partial `coins` object—not a per-token error.
- **The response does not identify the actual source used for a token.** It returns price, timestamp, symbol, optional decimals, and optional confidence. The docs describe a global source hierarchy (CoinGecko, bridges/custom adapters, then DEX-derived fallback), but no response field names the contributing source, venue, pool, quote, trade, slot, or finality.
- **No exact public free-tier rate limit or availability/update SLA was found.** DefiLlama says Pro gives higher limits. The live chart route emitted `Cache-Control: max-age=3600`; this is cache behavior, not a one-hour ingestion promise. Do not build a launch recorder around an undocumented ceiling or freshness assumption.
- **The API implementation is not verifiably open source today.** Official docs and client SDKs are source-available/openly licensed, but the only current owner repo named `coins-api-v3` is explicitly `UNLICENSED`, contains ingestion/migration scripts rather than the public HTTP routes, and does not substantiate the docs' “API server is fully open source” sentence.
- **Best currently verified no-key technical alternative: DexPaprika.** It has a direct Solana mint detail route with `summary.price_usd`, exact-pool OHLCV, explicit limits, and active MIT SDK/MCP repos. It indexed fresh Pump.fun and PumpSwap pools that DeFiLlama omitted. However, its keyless Free plan is non-commercial, requires `Powered by DexPaprika` attribution, is beta, and is limited to 15 requests/minute and 50,000 credits/month/IP.
- **GeckoTerminal remains a narrower alternative for known-pool OHLCV**, not arbitrary-mint launch coverage: approximately 10 calls/minute on shared IP capacity, beta, owner guidance against production/scheduled polling, and restrictive CoinGecko attribution/storage terms. See the repository's dedicated [owner-source audit](geckoterminal-coingecko-keyless-history-audit-current.md).

## 1. DeFiLlama public Coins API contract

Primary contracts: [official free OpenAPI](https://github.com/DefiLlama/api-docs/blob/main/defillama-openapi-free.json) · [official TypeScript SDK price module](https://github.com/DefiLlama/api-sdk/blob/master/src/modules/prices.ts) · [official SDK price types](https://github.com/DefiLlama/api-sdk/blob/master/src/types/prices.ts).

### Identifier and authentication

The owner OpenAPI assigns these routes to `https://coins.llama.fi`. Tokens are comma-separated `{chain}:{address}` identifiers; Solana therefore uses `solana:{mint}`. The SDK joins arrays with commas and calls the public host without a key when `new DefiLlama()` is used. Its README labels that configuration “Free tier”; a key is shown only for Pro endpoints. [SDK README](https://github.com/DefiLlama/api-sdk#quick-start)

Example:

```http
GET https://coins.llama.fi/prices/current/solana:So11111111111111111111111111111111111111112
```

No auth header, query key, account, wallet, or payment was needed in the live probes.

**Owner-doc inconsistency:** the generated [free text reference](https://api-docs.defillama.com/llms-free.txt) announces a global `https://api.llama.fi` base, but each coin operation in the official OpenAPI overrides that with `https://coins.llama.fi`. Live verification returned 404 from `https://api.llama.fi/prices/current/coingecko:bitcoin` and 200 from the same path on `coins.llama.fi`. Use the per-operation host.

### Exact routes and request syntax

| Purpose | Request | Parameters / notes |
|---|---|---|
| Current USD price | `GET /prices/current/{coins}` | `{coins}` is comma-separated `chain:address`. The SDK additionally supports optional `?searchWidth=4h`-style values, although the current free OpenAPI omits that query parameter. |
| One historical time | `GET /prices/historical/{timestamp}/{coins}` | `timestamp` is Unix seconds. SDK supports optional `searchWidth`. The returned timestamp may be the selected price record, not necessarily the requested second. |
| Many coins/times | `GET /batchHistorical?coins={json}` | `coins` is a URL-encoded JSON object mapping each identifier to an array of Unix timestamps, e.g. `{"solana:mint":[1787700000,1787703600]}`. SDK also sends optional `searchWidth`. |
| Chart | `GET /chart/{coins}` | Optional `start` **or** `end` Unix seconds (live service rejects using both with HTTP 400 `{"message":"use either start or end parameter, not both"}`), `span` point count (documented default 0), `period` (documented default 24h), and SDK-only `searchWidth`. `period` accepts candle-style number plus W/D/H/M, case-insensitive. |
| Earliest price | `GET /prices/first/{coins}` | Returns earliest recorded record for each supported identifier. |

The SDK also wraps `/percentage/{coins}`, but it is a calculated change route, not a historical chart substitute. [SDK implementation](https://github.com/DefiLlama/api-sdk/blob/master/src/modules/prices.ts)

### Exact documented/typed success fields

Current and single-time historical:

```json
{
  "coins": {
    "solana:<mint>": {
      "decimals": 9,
      "symbol": "SOL",
      "price": 96.804984526797,
      "timestamp": 1787746850,
      "confidence": 0.99
    }
  }
}
```

- `coins`: map keyed by the requested identifier.
- Per coin: required `price` number, `symbol` string, `timestamp` Unix-seconds number; optional `decimals` and `confidence`.
- `confidence` is documented as 0–1 reliability. It is not a source identifier or completeness score.

Chart:

```json
{
  "coins": {
    "solana:<mint>": {
      "symbol": "SOL",
      "confidence": 0.99,
      "decimals": 9,
      "prices": [
        {"timestamp": 1787743370, "price": 97.4826158729011}
      ]
    }
  }
}
```

Batch historical has per-coin `symbol`, optional `decimals`/`confidence`, and `prices[]` records containing `timestamp`, `price`, and optional `confidence`. First-price records contain `price`, `symbol`, and `timestamp`. The free OpenAPI documents only HTTP 200 and generic 502 for these price operations; it does not contract 400/404/429 bodies. [OpenAPI](https://github.com/DefiLlama/api-docs/blob/main/defillama-openapi-free.json)

### Price source and attribution limitations

The current route description says the base is CoinGecko, then extends coverage through bridged-token relationships and custom adapters; a final fallback uses high-liquidity pools on Uniswap, Curve, and Serum and attaches confidence because those prices cannot be confirmed in the same way. This is a **global methodology description**, not per-record provenance. [Official free OpenAPI route description](https://github.com/DefiLlama/api-docs/blob/main/defillama-openapi-free.json)

No documented or observed price object contains `source`, `provider`, `dex`, `pool`, `quote`, `block`, `slot`, `signature`, `observed_at`, or `finality`. Therefore:

- do not label a record “CoinGecko price” merely because CoinGecko is the documented base;
- do not infer that confidence 0.99 means a specific source, 99% statistical accuracy, finalized chain state, or complete market coverage;
- retain DefiLlama as the provider attribution and treat actual upstream provenance as unknown unless separately verified.

### Update cadence and freshness

The owner contract promises chart points at requested “regular time intervals” and documents a default 24-hour period. It gives **no maximum indexing delay, current-price refresh interval, historical backfill delay, retention floor, uptime, or SLA**.

Observed on 2026-08-26:

- wrapped SOL current record timestamp was 12:20:50 UTC in a 12:22:43 response (about 113 seconds old);
- repeated SOL spot observations changed at apparent five-minute cache boundaries;
- `chart?...span=3&period=1h` returned records near 10:22:50, 11:22:50, and 12:20:50;
- current responses exposed no stable `Cache-Control` contract in the reviewed probes;
- chart and first-price responses emitted `Cache-Control: max-age=3600`.

These establish observed cache/refresh behavior only. They do **not** prove a guaranteed five-minute upstream update cadence, a two-minute freshness ceiling, or a one-hour ingestion schedule. Applications should display the returned `timestamp`, record response time, reject stale data by their own policy, and avoid describing it as real-time.

### Unsupported-token and failure behavior

A mixed current request at 12:22:43 UTC asked for wrapped SOL, BONK, two recent Pump-family mints, and the System Program. It returned HTTP 200 with only wrapped SOL under `coins`. Individual fresh-Pump chart, first, and historical probes each returned:

```json
{"coins":{}}
```

At 12:26:59–12:27:01, a just-indexed PumpSwap mint (`EccQ…Rpump`) and an actively traded Pump.fun mint (`GhVh…zpump`) again returned `{"coins":{}}` from current/chart. Safe interpretation: **DefiLlama supplied no price record for that identifier/request snapshot**. It does not prove mint nonexistence, no trades, bad address, permanent lack of support, or an error.

Parser rule:

1. treat missing map key as `unsupported_or_unavailable`, never price zero;
2. preserve HTTP/transport errors separately from a valid 200-empty result;
3. validate freshness from each returned timestamp;
4. never assume every requested key is echoed;
5. parse unknown fields defensively because only 200/502 are documented.

### Rate limits

No numerical limit for anonymous `coins.llama.fi` was found in the official free OpenAPI, SDK, terms, or reviewed owner issues. The OpenAPI introduction says Pro offers “higher rate limits,” which proves the free path is constrained but does not disclose the ceiling, accounting scope, burst rules, headers, or 429 schema. [Official API docs repository](https://github.com/DefiLlama/api-docs)

Do not adopt numbers copied from unofficial wrappers. Use conservative batching, cache completed history, exponential backoff with jitter, and stop on 429/5xx. A bounded audit deliberately did not exhaust the service.

## 2. New Pump/Pump.fun coverage

### DeFiLlama result

Coverage is **selective, not nonexistent**. The official [Pump-owned latest-coins feed](https://frontend-api-v3.pump.fun/coins?offset=0&limit=10&sort=created_timestamp&order=DESC&includeNsfw=true) plus live DeFiLlama requests confirmed established Pump-created mints including ANSEM (`9cRC…pump`), Fartcoin (`9BB6…pump`), arc (`61V8…pump`), BAN (`9PR7…pump`), CATE (`Ai66…pump`), PNUT (`2qEH…pump`), jellyjelly (`FeR8…pump`), and WOULD (`J1Wp…pump`). ANSEM returned `decimals:6`, `symbol:"ANSEM"`, a USD `price`, Unix `timestamp`, and `confidence:0.99`. The main PUMP mint (`pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn`) also returned current and chart data. These are established-token examples, not proof of namespace-wide support.

Point-in-time tests found **no evidence that the Coins API prices arbitrary Pump bonding-curve or newly migrated PumpSwap mints**:

| Mint / state | Owner-source cross-check | DeFiLlama result |
|---|---|---|
| `JEBFn…rzpump`, recent Pump-family creation | Previously captured from owner Jupiter/Pump evidence in this repository; DexPaprika knew metadata but had zero pools and null price at 12:23 | Current/chart/first/historical omitted it |
| `BznPL…Yppump`, recent Token-2022 Pump creation | Owner Pump stream evidence in repository; DexPaprika knew metadata but returned null price and zero pools | Mixed current request omitted it |
| `GhVh…zpump`, fresh Pump.fun pool with nonzero trades/liquidity | DexPaprika pool search returned `dex_id=pumpfun`, price and activity | DeFiLlama current omitted it |
| `EccQ…Rpump`, fresh PumpSwap pool | DexPaprika returned `dex_id=pumpswap`; exact-pool OHLCV produced candles | DeFiLlama current and 1-minute chart omitted it |
| `4PkcWA…TCpump`, fresh Pump `create_v2` mint at Unix `1787747086` | Owner Pump creation evidence supplied during the audit | Immediate DeFiLlama spot and chart both returned empty `coins` |
| `9KDwXB…ZSpump`, active Pump bonding-curve mint | Owner/live Pump activity evidence supplied during the audit | DeFiLlama spot remained empty despite active curve trading |

This is a bounded negative sample, not a universal statement that no Pump token can ever appear. A sufficiently established token may later enter CoinGecko or another DefiLlama source. The correct product contract is **best-effort sparse support, not launch coverage**.

### DexPaprika contrast

At 12:24–12:27 UTC, owner API responses exposed recently created Solana pools with `dex_id`/`dex_name` values `pumpfun`/`Pump.fun` and `pumpswap`/`PumpSwap`, including token ids, `price_usd`, liquidity, transactions, and creation time. An exact PumpSwap pool query:

```http
GET https://api.dexpaprika.com/networks/solana/pools/Ahor6Kwc1tkP7t5toP7HC9Xfs35uaXkUWUU5w9epRqM2/ohlcv?start=2026-08-26T12:20:00Z&interval=1m&limit=10
```

returned HTTP 200 with rows containing exactly `time_open`, `time_close`, `open`, `high`, `low`, `close`, and optional `volume`. It already had candles for 12:24 and 12:26 by the 12:27:03 response. This demonstrates current coverage in one case, not a guaranteed indexing latency or completeness SLA.

## 3. Current owner open-source repository audit

“Open-source client/docs” must be separated from “open-source hosted backend” and “open data.” Repository code licenses do not license API output.

| Owner repository | Current evidence at cutoff | License / consequence |
|---|---|---|
| [DefiLlama/api-docs](https://github.com/DefiLlama/api-docs) | Active; free OpenAPI is the canonical route/schema source | GitHub detects MIT, but its LICENSE copyright is Scalar and governs repository software/docs—not DefiLlama datasets or API terms. |
| [DefiLlama/api-sdk](https://github.com/DefiLlama/api-sdk) | Active official JS/TS client; implements all price/history calls | `package.json` and README say MIT, but no root LICENSE file was present. Treat the grant as less cleanly packaged than a full MIT file. |
| [DefiLlama/python-sdk](https://github.com/DefiLlama/python-sdk) | Active official Python client with price/history support | MIT LICENSE present. |
| [DefiLlama/coins-api-v3](https://github.com/DefiLlama/coins-api-v3) | Public and unarchived, but only a small set of DB/Kafka/S3 migration/ingestion scripts; no public route implementation; last push observed 2025-02-27 | `package.json` says **`UNLICENSED`**. It is not an open-source implementation consumers can lawfully reuse and does not substantiate the hosted server. |
| [coinpaprika/dexpaprika-sdk-ts](https://github.com/coinpaprika/dexpaprika-sdk-ts), [Python](https://github.com/coinpaprika/dexpaprika-sdk-python), [Go](https://github.com/coinpaprika/dexpaprika-sdk-go), [PHP](https://github.com/coinpaprika/dexpaprika-sdk-php), [Rust](https://github.com/coinpaprika/dexpaprika-sdk-rust) | Active official SDKs; owner repo metadata showed 2026 pushes | MIT. These are clients, not the hosted indexer's source or a data license. |
| [coinpaprika/dexpaprika-mcp](https://github.com/coinpaprika/dexpaprika-mcp) | Active official MCP wrapper around token/pool/OHLCV API | MIT. Same client-vs-data distinction. |
| [coinpaprika/dexpaprika-cli](https://github.com/coinpaprika/dexpaprika-cli) | Active official CLI with pool-OHLCV commands | No GitHub-detected license at cutoff; do not assume reuse rights without inspecting/obtaining a license grant. |

**Conclusion:** there are healthy open-source clients and schemas, but this audit did not verify an openly licensed hosted indexer/backend for either DefiLlama or DexPaprika. If “open source” is a hard requirement for the price computation itself, neither service qualifies based on current owner evidence.

### Other current owner candidates and repositories

| Candidate | What owner evidence verifies | Why it does not satisfy the whole requirement |
|---|---|---|
| **Pyth Core / Hermes / Benchmarks** | [`pyth-network/pyth-crosschain`](https://github.com/pyth-network/pyth-crosschain) is Apache-2.0. Public [Hermes](https://docs.pyth.network/price-feeds/core/api-instances-and-providers/hermes) supplies latest data by feed id; public [Benchmarks](https://docs.pyth.network/price-feeds/core/api-instances-and-providers/benchmarks) supplies TradingView-style history. Owner [rate-limit docs](https://docs.pyth.network/price-feeds/core/rate-limits) say 10 requests/10 seconds/IP. A curated `Crypto.PUMP/USD` feed existed and returned `price`, `conf`, `expo`, `publish_time`, plus history arrays `t,o,h,l,c,v`. | Genuinely open-source components, but feed-id/symbol allowlist—not arbitrary Solana mint lookup or automatic new-Pump coverage. The software licence does not create a hosted-service SLA. |
| **Jupiter Price V3** | Owner [OpenAPI](https://github.com/jup-ag/docs/blob/main/openapi-spec/price/v3/price.yaml) defines `GET https://api.jup.ag/price/v3?ids={mints}` with `createdAt`, `liquidity`, `usdPrice`, `blockId`, `decimals`, and `priceChange24h`; owner [rate docs](https://github.com/jup-ag/docs/blob/main/portal/rate-limits.mdx) define keyless 0.5 RPS / 30 RPM. Fresh Pump mints resolved in live probes. | Owner guide says historical prices are unavailable; poll/store yourself. Owner [API/SDK agreement](https://github.com/jup-ag/docs/blob/main/legal/sdk-api-license-agreement.mdx) treats the API as proprietary and requires prominent `Powered by Jupiter`; no OSS pricing backend was verified. |
| **DEX Screener** | Owner [API reference](https://docs.dexscreener.com/api/reference) exposes `GET /token-pairs/v1/solana/{mint}`, current `priceUsd`, DEX/pair identity, liquidity and activity; published ceiling 300 RPM. Fresh Pump pairs resolved. | No owner historical/OHLCV API route and no owner OSS backend. Governed by [API Terms](https://docs.dexscreener.com/api/api-terms-and-conditions), not an open-data licence. |
| **GeckoTerminal / CoinGecko** | Keyless token/pool/OHLCV APIs and an official MIT [OpenAPI specification repo](https://github.com/coingecko/coingecko-api-oas). Fresh Pump mint/pool coverage was observed. | The MIT repo is a specification, not the hosted backend. Charts are pool-specific and current keyless operational/terms restrictions remain material. |

**Time boundary inside the cutoff:** Pyth's official [Solana contract-address page](https://docs.pyth.network/price-feeds/core/contract-addresses/solana) announced an upgrade for **2026-08-26 16:00 UTC**. This audit ended before 12:27 UTC, so it can report the announcement only—not completion, success, failure, or post-upgrade behavior. Nothing here guarantees availability, coverage, limits, or terms after the observation instant.

## 4. DexPaprika no-key alternative: exact contract and limits

Primary sources: [token route](https://docs.dexpaprika.com/api-reference/tokens/get-a-tokens-latest-data-on-a-network) · [OHLCV route](https://docs.dexpaprika.com/api-reference/pools/get-ohlcv-data-for-a-pool-pair) · [rate limits](https://docs.dexpaprika.com/knowledge-base/rate-limits) · [errors](https://docs.dexpaprika.com/knowledge-base/error-handling) · [API Terms](https://dexpaprika.com/api/terms).

### Current price

```http
GET https://api.dexpaprika.com/networks/solana/tokens/{mint}
```

The response includes top-level metadata and:

- `summary.price_usd` (nullable), `fdv`, `liquidity_usd`, `pools`;
- window objects for 24h, 6h, 1h, 30m, 15m, 5m, and observed 1m, with volume/transactions/buys/sells/change fields;
- `last_updated` timestamp;
- `price_stats` (nullable).

Unsupported address is documented/observed as HTTP 404 `{"message":"not found"}`. A known-but-unpriced fresh token can instead return 200 with `summary.price_usd:null`, `pools:0`, and zero activity. Preserve those states separately.

Batch current prices:

```http
GET /networks/solana/multi/prices?tokens={mint1},{mint2}
```

allows up to 10 tokens. Owner error docs say no supported prices returns HTTP 200 `[]`.

### Historical charts

1. Find pools with current replacement route (the older token `/pools` route now returns 410):

```http
GET /networks/solana/pools/search?token_address={mint}&limit=5
```

2. Query exact pool:

```http
GET /networks/solana/pools/{pool_address}/ohlcv?start={ISO-or-Unix}&end={optional}&interval=1m&limit=366&inversed=false
```

Supported intervals: `1m`, `5m`, `10m`, `15m`, `30m`, `1h`, `6h`, `12h`, `24h`; `start` is required; `end` may be up to one year after start; maximum 366 rows. Rows expose `time_open`, `time_close`, O/H/L/C and optional `volume`. `inversed=true` flips token orientation. History is pool-specific—not an automatic cross-pool canonical mint series. [Historical tutorial](https://docs.dexpaprika.com/tutorials/retrieve-historical-data)

### Limits, cadence, attribution, terms

- Keyless: **15 requests/minute and 50,000 credits/month per IP**; one regular call costs one credit, batch calls one credit/item. 429 includes `Retry-After`; exhausted monthly allowance is 402 with reset metadata. No-key lane uses `api.dexpaprika.com`.
- API is beta and owner docs warn against critical use/breaking-compatibility assumptions.
- Live token GETs emitted 15-second cache directives; OHLCV emitted 60-second directives. Owner docs describe completed candles as cacheable forever, but current candle incomplete. Cache headers are not indexing SLAs.
- API Terms effective 2026-07-14 grant Free use for development/integration but state **commercial use is only eligible on plans other than Free**.
- Every API use must prominently display **“Powered by DexPaprika”**, legible at font size 10 or larger. Further distribution of API/Data/Services outside the licensed purpose is restricted; access may be changed or terminated.
- MIT SDK licenses do not override these API/Data terms.

Therefore DexPaprika is technically much better for current Pump coverage and pool charts, but keyless Free is suitable only for a non-commercial, attributed, quota-aware prototype unless the owner grants different rights.

## 5. GeckoTerminal/CoinGecko alternative boundary

Owner GeckoTerminal exposes anonymous exact-pool OHLCV:

```http
GET https://api.geckoterminal.com/api/v2/networks/solana/pools/{pool_address}/ohlcv/{minute|hour|day}
```

with aggregation, `before_timestamp`, `limit` up to 1,000, USD/token orientation, and optional synthetic empty intervals. It does not remove the need to discover/verify the correct Pump/PumpSwap pool. Current owner guidance says approximately 10 calls/minute on a shared IP pool and explicitly says keyless is unsuitable for production, scheduled polling, or high-frequency updates. CoinGecko API Terms require `Powered by CoinGecko` and impose restrictive storage/deletion/redistribution conditions. Primary sources: [keyless API](https://docs.coingecko.com/docs/keyless-public-api) · [public Swagger](https://api.geckoterminal.com/docs/v2/swagger.json) · [CoinGecko API Terms](https://www.coingecko.com/en/api_terms).

Use it only as occasional exact-pool chart enrichment. Full owner-source details and live failure probes are in [the dedicated current audit](geckoterminal-coingecko-keyless-history-audit-current.md).

## 6. DefiLlama licensing and terms

[DefiLlama Terms of Use](https://defillama.com/terms) were effective 2025-06-24 and expressly cover the official public APIs. They state:

- Content/data sets and underlying code are owned or licensed by DefiLlama except where attributed to third parties;
- the general licence is revocable, non-transferable, non-exclusive, personal, and non-commercial;
- reselling data/access, republishing data, competitive use, and commercial exploitation without prior written consent are prohibited;
- Services/data are `as is`/`as available`, without uninterrupted/error-free warranty;
- API/data access may be suspended or terminated.

No separate open-data licence or mandatory display phrase such as “Powered by DefiLlama” was found in the reviewed terms. Absence of an explicit display phrase is **not** permission to remove proprietary notices, republish, redistribute, or commercialize. The MIT docs/SDK licences apply to those repositories, not hosted API data.

## 7. Recommended implementation rule

1. **Do not use DeFiLlama as launch/Pump price truth.** Query it as optional best-effort enrichment for established assets; missing key is normal.
2. Key raw price records by provider + chain + mint + returned timestamp; display source as **DefiLlama**, not an inferred upstream.
3. Apply explicit staleness thresholds and log request/receipt time, status, response body hash, and cache headers.
4. For Pump-family tokens, derive live price from finalized chain/Pump events or a verified pool and use provider indexes only as cross-checks.
5. For a non-commercial attributed prototype, DexPaprika can supply direct mint snapshots plus exact-pool OHLCV; keep 15 RPM/50k monthly/IP and beta semantics in code.
6. For occasional secondary chart checks, GeckoTerminal can serve exact-pool OHLCV; do not schedule keyless polling.
7. Obtain written owner/legal clearance before any commercial use, redistribution, public API resale, or durable provider-derived archive. “No key,” “free,” “public repo,” and “MIT SDK” do not mean open data.
8. Keep providers removable and preserve null/empty/404/410/429/402/5xx/timeout states distinctly.

## Final disposition

**DeFiLlama: accept as a no-key, sparse, established-token price/chart adapter; reject as a complete Solana-mint or new-Pump price source.**  
**DexPaprika: accept technically for non-commercial, attributed, quota-aware Pump/pool enrichment; reject keyless Free for commercial production.**  
**GeckoTerminal: accept only for occasional known-pool OHLCV; reject as a scheduled launch-recorder foundation.**
