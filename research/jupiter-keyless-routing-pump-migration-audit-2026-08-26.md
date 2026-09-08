# Jupiter keyless routing and Pump migration audit — 2026-08-26

**Evidence cutoff:** 2026-08-26 11:20 UTC  
**Scope:** owner documentation/repositories, current repository notes, and bounded no-key GET probes. No wallet, taker, signature, transaction submission, or `/execute` call was used. A quote is not a trade.

## 1. Evidence baseline

- Jupiter owner docs were pinned at [`jup-ag/docs@1dda348d206ca25211ec225e250caaf7fbc195d5`](https://github.com/jup-ag/docs/tree/1dda348d206ca25211ec225e250caaf7fbc195d5), committed 2026-08-21.
- Pump owner docs were pinned at [`pump-fun/pump-public-docs@9c82f61cb711b044a17f770ab8ce9f9bdf78f333`](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333), committed 2026-07-16.
- Repository cross-checks: `research/free-price-liquidity-routing-migration-audit.md`, `research/free-only-reliability-benchmark-audit.md`, `planning/evidence/P-005-provider-capabilities.md`, and `planning/evidence/P-012-capability-gap-ledger.md`.
- Sparse probes establish point-in-time behavior only. They do not prove availability, completeness, the published ceiling, or a post-migration indexing SLA.

## 2. Access lanes and exact published limits

| Lane | Host | Key | Published main-bucket limit | Cost/credits | Intended use |
|---|---|---:|---:|---|---|
| Keyless | `https://api.jup.ag` | No | **0.5 RPS / 30 requests per minute**, 60-second sliding window | No account; endpoint credit accounting is irrelevant without a plan | Owner says tests, prototypes, and AI agents; production applications should use a key |
| Free plan | `https://api.jup.ag` | Yes | **1 RPS / 60 requests per minute** | **$0; unlimited credits; rate-limited only** | Account/API-key production lane |

Evidence: [plans](https://developers.jup.ag/docs/portal/plans), [rate limits](https://developers.jup.ag/docs/portal/rate-limits), [setup](https://developers.jup.ag/docs/portal/setup), and pinned sources [plans.mdx](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/portal/plans.mdx), [rate-limits.mdx](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/portal/rate-limits.mdx).

Exact mechanics:

- The main limit is a **60-second sliding window**. Swap, Price, and Tokens requests share it.
- Keyed limits apply per organisation, not per API key; creating keys or teams does not multiply quota.
- `/swap/v2/execute` has a separate published bucket (keyless 20 RPS, Free 50 RPS, paid 100 RPS), but this audit did not call it because execution is a trade path.
- Successful and 429 responses can include `x-ratelimit-remaining`, `x-ratelimit-current`, and `x-ratelimit-reset`. Reset is when the oldest request ages out and one slot opens, not when the whole window empties.
- The owner says a no-header request is keyless; an invalid supplied key produces 401.

### Host migration

The current owner migration guide says keyless `api.jup.ag` replaces `lite-api.jup.ag` at 0.5 RPS. Lite is being progressively reduced and phased out when the new gateway is stable; no retirement date is promised. All endpoint paths are said to remain the same, with only the base URL changing. Evidence: [migration guide](https://developers.jup.ag/docs/portal/migration) and pinned [migration.mdx](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/portal/migration.mdx).

Observed 2026-08-26:

- `api.jup.ag/swap/v1/quote`: keyless HTTP 200 for SOL→USDC.
- `api.jup.ag/swap/v2/order`: keyless HTTP 200 without `taker`.
- `api.jup.ag/tokens/v2/recent`: keyless HTTP 200, 30 records.
- Deprecated `lite-api.jup.ag/swap/v1/quote`: still HTTP 200.
- `lite-api.jup.ag/swap/v2/order`: HTTP 404 text `Route not found`.

**Finding:** use `api.jup.ag`; current Lite reachability is not an entitlement and Lite does not expose the same observed V2 surface.

## 3. Quote/order schema and route semantics

### Current V2 quote-only order

Request: `GET /swap/v2/order` with required `inputMint`, `outputMint`, and atomic-unit `amount`; omit `taker` for a price check. Owner docs: [Order & Execute](https://developers.jup.ag/docs/swap/order-and-execute), [V2 OpenAPI](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/openapi-spec/swap/v2/swap.yaml).

Key fields:

| Field | Evidence-backed meaning |
|---|---|
| `inAmount` | Requested input in the mint's smallest unit for ExactIn |
| `outAmount` | Expected output before slippage; amount- and time-specific |
| `otherAmountThreshold` | Minimum output after the selected slippage treatment |
| `priceImpact` | **Percentage points**; e.g. `-0.1` means `-0.1%`; divide by 100 for a fraction |
| `priceImpactPct` | Deprecated decimal-ratio string; do not mix its units with `priceImpact` |
| `routePlan[]` | Proposed routing steps, not fills |
| `routePlan[].swapInfo` | `ammKey`, `label`, `inputMint`, `outputMint`, `inAmount`, `outAmount` |
| `routePlan[].percent`, `.bps` | Allocation fields; V2 requires both; `usdValue` is optional |
| `router` | Winning meta-router: `metis`, `jupiterz`, `dflow`, or `okx` |
| `transaction` | `null` without `taker`; base64 unsigned transaction with a buildable taker; `""` if pricing exists but transaction construction failed |
| `errorCode`, `errorMessage` | For `transaction:""`; match `router + errorCode`, never the human message |

### Legacy V1 quote

`GET /swap/v1/quote` is explicitly unmaintained/superseded by Swap V2, but remains useful as a Metis diagnostic. `outAmount` is after AMM/platform fees but before slippage; `otherAmountThreshold` applies `slippageBps`. `routePlan` is a proposal. Evidence: [V1 quote guide](https://developers.jup.ag/docs/swap/v1/get-quote), [V1 errors](https://developers.jup.ag/docs/swap/v1/common-errors).

### Quotes are not trades

- A V2 `/order` without `taker` returns `transaction:null`: quote only.
- With a taker, `/order` returns an **unsigned** transaction. It still has not traded.
- A trade requires wallet signing, POST `/swap/v2/execute`, and a successful execution/on-chain result. Actual result fields include `status`, `signature`, `code`, `totalInputAmount`, `totalOutputAmount`, `inputAmountResult`, and `outputAmountResult`.
- An HTTP 200, `outAmount`, `routePlan`, RFQ `quoteId`, or unsigned transaction is not evidence of a fill.

## 4. Route/no-route and failure taxonomy

| State | Documented/observed signal | Correct interpretation |
|---|---|---|
| Valid V2 quote-only route | HTTP 200, populated amounts/route, `transaction:null` when taker omitted | Route proposal for this mint pair, direction, amount, options, and instant; no trade |
| Pricing but unbuildable transaction | V2 `transaction:""` plus `router + errorCode` | Pricing can exist while swap cannot proceed |
| Metis no route | V1 `NO_ROUTES_FOUND`; V2 `/build` text `No routes found` | No Metis route for this request; V2 `/order` may still quote through JupiterZ/Dflow/OKX |
| Token unavailable to V1 | HTTP 400 `TOKEN_NOT_TRADABLE` | Mint is unavailable to that endpoint; not proof that every venue/router lacks a market |
| Route cannot consume amount | `ROUTE_PLAN_DOES_NOT_CONSUME_ALL_THE_AMOUNT` | Reduce amount and requote; amount-specific no-route/bad-route state |
| Bad request | HTTP 400 | Parameter/schema failure; keep separate from no route |
| Invalid supplied key | HTTP 401 | Omit header for keyless or correct key |
| Permission/firewall | HTTP 403 | Endpoint permission or firewall decision |
| Wrong URL | HTTP 404 | Not an indexing signal |
| Rate limit | HTTP 429 | Wait for `x-ratelimit-reset`; do not relabel as no route |
| Provider failure | HTTP 5xx | Retry with capped backoff; not proof of unsupported token |

Gateway evidence: [response codes](https://developers.jup.ag/docs/portal/responses). Product evidence: [market listing](https://developers.jup.ag/docs/swap/routing/market-listing), [V1 errors](https://developers.jup.ag/docs/swap/v1/common-errors).

Observed edge cases:

- V1, System Program used as a mint: HTTP 400, `TOKEN_NOT_TRADABLE`.
- V1, zero amount: HTTP 400, `NO_ROUTES_FOUND`.
- V2, System Program used as input mint: one HTTP 500, `{"error":"Something unexpected occurred"}`. Therefore clients cannot assume every unsupported/non-mint input is normalized to 400.

## 5. Amount-specific observations (no trades)

All V2 calls omitted `taker`, and all successful responses had `transaction:null`.

### SOL→USDC at 2026-08-26 11:19 UTC

| Atomic SOL input | SOL | `outAmount` atomic USDC | USDC | `router` | Route shape | `priceImpact` percentage points |
|---:|---:|---:|---:|---|---|---:|
| 1,000,000 | 0.001 | 97,593 | 0.097593 | `dflow` | 3 steps | 0.1201130969 |
| 100,000,000 | 0.1 | 9,744,720 | 9.744720 | `jupiterz` | 1 RFQ step | -0.0294623080 |
| 1,000,000,000 | 1 | 97,439,361 | 97.439361 | `jupiterz` | 1 RFQ step | -0.0136202589 |

These requests were sequential, not simultaneous. They prove that amount can change output, router, route plan, and impact. They do not establish a reusable price curve or execution result.

### Fresh Pump launch observation, not a migration-delay measurement

At 11:19:58 UTC, keyless `/tokens/v2/recent` returned a Pump launch mint `JEBFnNv28s9k7EtjY3Fs7feHQZAauaSCsqveEmrzpump` with:

- `launchpad:"pump.fun"`, Token-2022 program, `firstPool.id` equal to the mint, and `firstPool.createdAt:"2026-08-26T11:19:55Z"`;
- no observed `graduatedPool`/`graduatedAt` in the sampled record.

At 11:20:11–13 UTC, V2 `/order` quoted SOL→that mint through `router:"okx"` for 0.001 and 0.1 SOL. `outUsdValue` was 0 and `priceImpact` was -100 percentage points, while atomic `outAmount` and a route were present. This demonstrates:

1. token discovery/indexed metadata, route availability, and USD valuation/impact quality are distinct states;
2. V2 may quote through a non-Metis router;
3. `/tokens/v2/recent` is not a graduation feed and this sample must not be presented as post-migration latency.

## 6. Pump support and indexing after migration

### Owner-published support

Current Jupiter market-listing docs include both **Pump.fun** and **Pump.fun AMM** among DEXes eligible for instant routing. They say:

- new markets on supported DEXes are automatically listed during a grace period;
- grace is based on **token age, not market age**;
- a bonding-curve market that does not graduate before grace ends is removed;
- once it graduates to a new market, the graduated market is added to routing;
- normal-routing liquidity is rechecked every **30 minutes**.

The 30-minute statement is a periodic normal-market liquidity recheck, **not** a maximum post-migration indexing delay. No current owner page audited here promises a numerical maximum, percentile, completeness target, or SLA from Pump migration to Jupiter metadata, Metis route, or V2 meta-router route.

### Token schema

Tokens V2 `/recent` means the token's **first created pool**, not mint creation or Pump graduation, and defaults to 30 records. Search can resolve a mint directly. The schema includes nullable `launchpad`, `graduatedPool`, `graduatedAt`, `firstPool`, and `updatedAt`. Evidence: [Tokens recent](https://developers.jup.ag/docs/api-reference/tokens/recent), [Tokens schema](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/openapi-spec/tokens/v2/tokens.yaml).

**Finding:** metadata presence does not prove routability; `firstPool` does not prove migration; a quote does not prove metadata/price completeness; and none proves execution.

### Correct migration anchor

Pump owner docs distinguish curve completion from migration:

- BondingCurve `complete` becomes true when real token reserves reach zero.
- `migrate(user,mint)` permissionlessly migrates a completed curve to PumpSwap.
- `CompletePumpAmmMigrationEvent` carries `mint`, `bonding_curve`, `timestamp`, `pool`, and `quote_mint` (plus amounts/fee).
- Canonical PumpSwap pools are pools created by Pump's `migrate` instruction.

Evidence: [Pump program README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md), [Pump IDL migration event](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json), [canonical PumpSwap pool definition](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_CREATOR_FEE_README.md).

Use the finalized migration transaction/event as `t0`; do not use `/tokens/v2/recent`, mint creation, first trade, or curve completion as a substitute.

## 7. Repeated safe-probe plan

### Objective and exclusions

Measure four separate milestones after finalized Pump migration: (1) Tokens V2 graduation metadata; (2) Metis route; (3) V2 meta-router route; (4) amount-specific route quality. Do not call `/execute`, provide private keys, sign, submit, or call the result a trade.

### Schedule (keyless, shared main bucket)

A conservative baseline stays near 3 requests/minute:

1. SOL→USDC control V2 `/order`, quote-only, every 5 minutes.
2. `/tokens/v2/search?query=<mint>` every 60 seconds.
3. Target mint↔SOL V2 `/order`, quote-only, every 30 seconds; alternate direction.
4. At first route, run one predeclared atomic ladder (for example 0.001/0.01/0.1 SOL and supply-aware token sell amounts), one request every 5 seconds, once.
5. Optionally run V2 `/build` or legacy V1 `/quote` at a lower cadence strictly to isolate Metis from the V2 meta-router. Label V1 unmaintained.

This baseline avoids trying to empirically hit the 30/min ceiling. If cadence changes, enforce one global 60-second sliding-window limiter across Swap, Tokens, and Price.

### Record per attempt

- mint, finalized migration signature/slot/event timestamp/pool/quote mint;
- local monotonic and UTC receipt time;
- endpoint, direction, atomic amount, options, HTTP status, raw body hash/raw body;
- `x-api-gateway-request-id` and all rate headers;
- token `firstPool`, `graduatedPool`, `graduatedAt`, `updatedAt`;
- quote `inAmount`, `outAmount`, threshold, both impact fields with units, router, complete route plan, fees, and context fields;
- explicit classifier: `metadata_absent`, `metadata_present_ungraduated`, `graduated_metadata`, `metis_no_route`, `meta_route`, `bad_params`, `token_not_tradable`, `amount_not_consumed`, `429`, `5xx`, or `parse/schema_change`.

### Stop/retry rules

- 429: stop until `x-ratelimit-reset`; no immediate loop.
- 5xx/network: capped exponential backoff with jitter; preserve original failure.
- Stop each mint at a predeclared horizon (for example 60 minutes) and report `not observed within horizon`, never `unsupported forever`.
- Require repeated samples across multiple finalized migrations and report distributions/misses, not a universal indexing promise.

## 8. Access terms and unresolved owner contradictions

Owner legal pages say API/SDK use forms a binding agreement. Material clauses include limited/non-transferable use, no resale/transfer of API content, no excessive/abusive use or limit circumvention, no vulnerability scanning, branding/characterisation obligations, no uptime/performance guarantee, and AS-IS/AS-AVAILABLE treatment. The agreement also restricts competitive analysis and dissemination of uptime/response-time/benchmark information. Evidence: [SDK & API License Agreement](https://developers.jup.ag/docs/legal/sdk-api-license-agreement).

Unreconciled owner conflicts as of the cutoff:

1. Portal setup/plans/responses explicitly document no-key access, and same-day probes succeeded; Swap V2 overview/OpenAPI security declarations still say API key required.
2. The legal agreement says API access may only use issued keys and describes a fee-bearing/keyed model, while current Portal pages publish keyless and $0 lanes.
3. The current V2 product has Meta-Aggregator router identities beyond the older legal document's Ultra/Metis characterisation language.

**Evidence-backed conclusion:** keyless operation is technically and operationally documented at 0.5 RPS/30 RPM on `api.jup.ag`, but production entitlement, required labeling for current V2 router modes, and permission to publish indexing/performance benchmarks should be confirmed in writing with Jupiter. No free/keyless SLA was found; custom SLAs are Enterprise-only.

## 9. Decision-safe findings

- Use current V2 `/order` without `taker` for route/no-route and amount-specific checks; use V1 only as labeled Metis/legacy diagnostic.
- Treat each mint pair, direction, amount, option set, and observation time as a separate quote.
- Preserve `outAmount`, threshold, impact with units, router, and full route plan; do not collapse them into a universal token price.
- Keep `no route`, unsupported token, bad request, metadata-not-indexed, missing USD valuation, rate limit, provider failure, unbuildable transaction, and failed execution as separate states.
- Anchor Pump post-migration timing to a finalized `CompletePumpAmmMigrationEvent`, not `/recent` or curve completion.
- No owner evidence supports a numerical maximum post-Pump-migration Jupiter indexing/routing delay.
- A quote/order is not a trade. Only signed, submitted, confirmed execution with result/on-chain evidence is a trade.
