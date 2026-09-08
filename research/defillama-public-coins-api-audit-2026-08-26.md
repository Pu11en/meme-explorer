# DeFiLlama public Coins API — primary-source audit

**Audited:** 2026-08-26 UTC  
**Evidence boundary:** DefiLlama and Pump owner documentation/repos, Pump owner state, Solana chain data, and bounded anonymous requests to owner endpoints. Live observations prove point-in-time behavior, not an entitlement, coverage guarantee, rate limit, cadence, or SLA.

## Decision

**Reject for strict new-Pump charting and for commercial product use unless DefiLlama gives written permission plus explicit quota, cadence, and Pump-coverage commitments.** Established Solana mints can work without an account or key, but two active/new Pump mints returned no price or chart data. The legal terms also do not grant an unrestricted commercial/data-republication licence.

## Published contract and actual host

The official [free OpenAPI](https://github.com/DefiLlama/api-docs/blob/main/defillama-openapi-free.json) gives each Coins operation an operation-level server of **`https://coins.llama.fi`**:

- current: `GET /prices/current/{coins}`;
- historical snapshot: `GET /prices/historical/{timestamp}/{coins}`;
- chart: `GET /chart/{coins}`, with optional `start`, `end`, `span`, and `period` query parameters.

Coin keys are comma-separated `{chain}:{address}` values (or `coingecko:{id}`). The documented current/historical spot object has exactly `decimals?`, `symbol`, `price`, `timestamp`, and `confidence`; the formal OpenAPI required list is `symbol`, `price`, and `timestamp`, while `decimals` is expressly omissible and `confidence` is present but not formally required. A chart coin object has `symbol`, `confidence`, `decimals?`, and `prices: [{timestamp, price}]`.

The owner [machine documentation](https://raw.githubusercontent.com/DefiLlama/api-docs/main/llms.txt) incorrectly assigns the coin paths to the global free base `https://api.llama.fi`. Live requests to [that host's current-SOL path](https://api.llama.fi/prices/current/solana:So11111111111111111111111111111111111111112) and [chart path](https://api.llama.fi/chart/solana:So11111111111111111111111111111111111111112?span=3&period=5m) returned HTTP 404; the same operations on `coins.llama.fi` returned 200. The operation-level OpenAPI server is therefore the working authority.

## Anonymous live behavior

No request below used an account, API key, cookie, or authorization header.

- [Current wrapped SOL](https://coins.llama.fi/prices/current/solana:So11111111111111111111111111111111111111112), [historical SOL](https://coins.llama.fi/prices/historical/1787747086/solana:So11111111111111111111111111111111111111112), and [SOL chart](https://coins.llama.fi/chart/solana:So11111111111111111111111111111111111111112?span=3&period=5m) all worked with HTTP 200 and the documented shapes.
- In a mixed request, supported SOL was returned and an unsupported key was omitted. An [all-unsupported current request](https://coins.llama.fi/prices/current/notachain:notacoin) returned HTTP 200 exactly as `{"coins":{}}`; unsupported historical/chart requests likewise returned an empty `coins` map. This is observed absence semantics, not a documented permanence or nonexistence guarantee.
- A bounded exact-current-SOL trace showed Cloudflare edge refresh associated with a five-minute UTC boundary. Within the sampled stable cache object, provider data timestamps were approximately **108–128 seconds behind** local receipt. Current responses exposed no provider freshness SLA.
- [Chart responses](https://coins.llama.fi/chart/coingecko:solana?span=3&period=5m) sent `Cache-Control: max-age=3600`. This transport cache directive is not an upstream computation/indexing cadence promise, and no cadence SLA was found in the reviewed owner sources.

## Rate limit

The [machine docs](https://raw.githubusercontent.com/DefiLlama/api-docs/main/llms.txt) publish only **“Standard”** for free and **“Higher”** for Pro; no exact free quota, window, burst rule, or accounting scope is published. DefiLlama's owner [Pro subscription page](https://defillama.com/subscription) advertises increased limits of **1,000 requests/minute**.

Live free responses contained no rate-limit, remaining, reset, or quota headers. A bounded 30-request burst against the same cached SOL URL returned 30/30 HTTP 200 responses, also without quota headers. That observation is **not** a 30-request limit, safe burst allowance, or entitlement.

## Terms and licensing

The owner [Terms of Use](https://defillama.com/terms), effective **2025-06-24**, include official public APIs within the Services and permit programmatic access to the official public API rather than unofficial APIs. But the operative licence is revocable, non-transferable, non-exclusive, and for **personal, non-commercial** use. The terms restrict competitive use, commercial exploitation without prior written consent, republishing without permission, and resale of data or access without permission. They also provide the Services/data as-is and allow change or suspension.

Accordingly, public technical reachability is not commercial-product, warehousing, redistribution, or resale permission. Obtain written provider permission for the intended product and data flow.

## Open-source claim audit

The OpenAPI description says the API server is “fully open source.” That claim is **not substantiated by the current default branch** of DefiLlama's public [`coins-api-v3`](https://github.com/DefiLlama/coins-api-v3) repository:

- default-branch HEAD was [`65c51cc`](https://github.com/DefiLlama/coins-api-v3/commit/65c51cc4f8aa7c2d51697013fa78e09df36e466a);
- its tree contains only Elastic/Kafka/S3 migration and cache/metadata scripts plus package files—no HTTP route/server implementation;
- it has no README or repository licence file, and exact [`package.json`](https://github.com/DefiLlama/coins-api-v3/blob/65c51cc4f8aa7c2d51697013fa78e09df36e466a/package.json) says `UNLICENSED`.

This does not prove that no server source exists elsewhere; it means the official claim is not supported by the cited current public default branch. The separate [`api-docs` MIT licence](https://github.com/DefiLlama/api-docs/blob/main/LICENSE) licenses that documentation/software repository, not the Coins server or DefiLlama data.

## New-Pump coverage probe

Pump's official [program documentation](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md) identifies program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` and says newly created SPL coins are instantly tradeable on a bonding curve. The official [IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json) defines `create_v2` as creating a new SPL-22 coin and bonding curve.

- Fresh `create_v2` mint: `4PkcWA36ZetGfLJAA7KW64XQaU2cjE1EQWQncnTCpump`. Its finalized [creation transaction](https://explorer.solana.com/tx/2JCiSkfXbS1GotdjDZ7yKB7LzpmH4xC4NYgKU24cgHnDRWEH37QicEQmZBHoMrVK9m6oBxCjyLSE4QMnDiT46Hi6) invoked the documented Pump program with `Instruction: CreateV2` at Unix `1787747086`. The exact [current](https://coins.llama.fi/prices/current/solana:4PkcWA36ZetGfLJAA7KW64XQaU2cjE1EQWQncnTCpump) and [chart](https://coins.llama.fi/chart/solana:4PkcWA36ZetGfLJAA7KW64XQaU2cjE1EQWQncnTCpump?span=3&period=1m) requests returned `{"coins":{}}` immediately and again after about 90 seconds; later confirmation remained empty.
- Active bonding-curve mint: `9KDwXBf7patui1Hr1CVUaCzzNidPRopNxCT2BXZSpump`. Pump's owner [coin-state endpoint](https://frontend-api-v3.pump.fun/coins/9KDwXBf7patui1Hr1CVUaCzzNidPRopNxCT2BXZSpump) reported `initialized:true`, `complete:false`, real/virtual reserves, and recent trading, while DeFiLlama's exact [current](https://coins.llama.fi/prices/current/solana:9KDwXBf7patui1Hr1CVUaCzzNidPRopNxCT2BXZSpump) and [chart](https://coins.llama.fi/chart/solana:9KDwXBf7patui1Hr1CVUaCzzNidPRopNxCT2BXZSpump?span=3&period=1m) requests returned `{"coins":{}}`.

These bounded misses do not prove categorical Pump non-support. They do prove that on-chain existence and instant Pump bonding-curve tradability do **not** imply immediate—or any committed—coverage by DeFiLlama Coins.

## Acceptance

Use the public Coins API only as optional, failure-tolerant enrichment for established Solana mints. **Reject it as the strict new-Pump chart source and reject commercial product dependence absent written permission and explicit free/paid quota, cadence, SLA, and Pump-coverage commitments.** Preserve empty-map responses as “not returned in this request/cache snapshot,” never as proof that a mint or market does not exist.
