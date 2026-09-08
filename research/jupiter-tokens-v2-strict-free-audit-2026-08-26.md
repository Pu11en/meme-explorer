# Jupiter Tokens API v2 strict-free audit — 2026-08-26

**Evidence cutoff:** 2026-08-26 13:04 UTC  
**Question:** Can Jupiter Tokens API v2 serve as a distinct, strictly free enrichment source beyond PumpAPI for a local/manual Pump.fun recorder?  
**Method:** current Jupiter-owned documentation, API reference/OpenAPI, plans/setup/migration pages, Jupiter legal terms, and bounded unauthenticated `GET` probes only. No wallet, API key, account, card, credits, signing, or transaction submission was used. Sparse probes prove point-in-time behavior, not completeness or an SLA. This is a technical/contract-text audit, not legal advice.

## Executive verdict

| Acceptance dimension | Verdict | Reason |
|---|---|---|
| Technically keyless | **Pass** | `https://api.jup.ag/tokens/v2/...` worked with no `x-api-key`; current setup and plans expressly publish keyless access. |
| No card / no wallet / no account | **Pass for the keyless lane** | Setup says no sign-up is required. The probes supplied no identity, payment method, wallet, or credential. |
| No paid credits | **Pass operationally, with terminology caveat** | Keyless requests succeeded without a plan or credit balance. The plans page assigns `/search` 10 credits and `/recent` 1 credit, but credit accounting is a plan concept; the separate keyless lane has no account to debit. The keyed Free plan is also `$0` with unlimited credits, but it is unnecessary for manual keyless use. |
| Low-volume local/manual feasibility | **Pass** | Published keyless ceiling is 0.5 RPS / 30 requests per minute; one `/search` request can batch up to 100 exact mint addresses. |
| Distinct information beyond a raw Pump event recorder | **Yes, as provider-derived enrichment** | It exposes Jupiter's holder, developer-attribution, audit, price/liquidity, rolling trading-stat, first-pool, and graduation assertions. It is not an independent canonical Pump launch/migration ledger. |
| Stable schema / canonical facts | **Fail** | Fields are nullable/conditional, the guide says responses are subject to change, an undocumented `audit.devMigrations` appeared live, and several important methods/provenance rules are unpublished. |
| Legally clear private storage | **No — unresolved** | Internal informational/development use is licensed, but no explicit durable archival/retention grant or retention period was found; the agreement is also inconsistent with the newly documented keyless/$0 model. |
| Legally clear redistribution or combined dataset | **No — reject without written permission** | The API agreement forbids sharing/transferring API content to third parties and forbids combining it with content obtained outside the API. A Jupiter-enriched PumpAPI export is therefore not clearly permitted. |

**Decision:** Use Tokens v2 only as an optional, low-cadence, private-local enrichment cache if the operator accepts legal ambiguity and preserves raw provider attribution. Do **not** make it the source of truth for Pump creation, migration, holder ownership, developer identity, or risk. Do **not** publish, redistribute, or merge its output into a shareable PumpAPI-derived dataset without written Jupiter permission. If “strict-free” requires both `$0` access **and unambiguous archival/redistribution rights**, Jupiter Tokens v2 **fails**.

## 1. Primary-source baseline

Current owner pages used:

- [Getting Started](https://developers.jup.ag/docs/portal/setup)
- [Plans and Pricing](https://developers.jup.ag/docs/portal/plans)
- [Rate Limits](https://developers.jup.ag/docs/portal/rate-limits)
- [Developer Platform migration](https://developers.jup.ag/docs/portal/migration)
- [Token Information](https://developers.jup.ag/docs/tokens/token-information)
- [How to Get Token Information](https://developers.jup.ag/docs/guides/how-to-get-token-information)
- [Tokens v2 search reference](https://developers.jup.ag/docs/api-reference/tokens/search)
- [Tokens v2 recent reference](https://developers.jup.ag/docs/api-reference/tokens/recent)
- [Tokens v2 OpenAPI, immutable Jupiter-owned snapshot](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/openapi-spec/tokens/v2/tokens.yaml)
- [Gateway response codes](https://developers.jup.ag/docs/portal/responses)
- [SDK & API License Agreement](https://developers.jup.ag/docs/legal/sdk-api-license-agreement)
- [Terms of Use](https://developers.jup.ag/docs/legal/terms-of-use)

The owner documentation itself is internally inconsistent: the portal setup/plans pages explicitly authorize keyless access, while the Tokens OpenAPI declares `ApiKeyAuth`, and the “How to Get Token Information” guide says all requests require a key. Live no-key probes resolve technical behavior in favor of keyless access, but not the legal contradiction discussed below.

## 2. Exact endpoint and access model

### Recommended keyless endpoints

```text
GET https://api.jup.ag/tokens/v2/search?query=<mint-or-query>
GET https://api.jup.ag/tokens/v2/recent
```

`/search` accepts symbol, name, or mint. Comma-separated input is **only** for exact mint-address lookup and supports up to **100 mints** in one request; symbol/name search defaults to 20 results. `/recent` returns 30 records by default and means tokens that recently had their **first pool created**, not recently minted and not recently graduated. Sources: [Token Information](https://developers.jup.ag/docs/tokens/token-information), [search reference](https://developers.jup.ag/docs/api-reference/tokens/search), [recent reference](https://developers.jup.ag/docs/api-reference/tokens/recent).

Use `api.jup.ag`, not `lite-api.jup.ag`. The migration guide says keyless `api.jup.ag` replaces Lite; Lite is being progressively reduced and will be retired when the new gateway is stable, with no fixed retirement date. [Migration guide](https://developers.jup.ag/docs/portal/migration).

### Published ceilings

| Lane | Key/account | Price | Main bucket | Credits |
|---|---|---:|---:|---|
| Keyless | None | `$0` operationally | **0.5 RPS / 30 RPM** | No account/plan credit balance involved |
| Free plan | API key required | **$0** | **1 RPS / 60 RPM** | Unlimited, rate-limited only |

The main limit uses a **60-second sliding window**, shared across Swap, Price, and Tokens. Keyed quotas are per organisation, not multiplied by keys or teams. A successful or 429 response may carry:

- `x-ratelimit-remaining`: requests left; can be zero or negative;
- `x-ratelimit-current`: requests used;
- `x-ratelimit-reset`: absolute Unix seconds when the oldest request ages out and one slot opens.

Wait until `x-ratelimit-reset` after 429. Do not assume it is a fixed-window reset. Sources: [Plans](https://developers.jup.ag/docs/portal/plans), [Rate Limits](https://developers.jup.ag/docs/portal/rate-limits).

Tokens are assigned nominal per-request costs on the plans page: `/tokens/v2/search` **10 credits**, `/recent` **1**, category **5**, tag **50**. This does not make keyless calls paid: the same page separately offers keyless access, while the `$0` keyed Free plan has unlimited credits. It does mean “no credits” should be phrased as **no purchased or provisioned credit balance needed for keyless use**, not “Jupiter never assigns an internal credit weight.”

### Live limit-header caveat

A no-key `/recent` at `13:00:34Z` returned HTTP 200 with `x-ratelimit-current: 1`, `remaining: 4`, and reset. Later no-key requests showed `current: 3, remaining: 2` and `current: 5, remaining: 0`. These headers looked like a five-request active allowance at those instants, not a direct display of the published 30-RPM capacity. The docs allow additional firewall limits and say each response reports whichever bucket applied. Therefore:

1. treat **30 RPM** as the published main ceiling;
2. treat live headers as the immediate operational authority;
3. do not infer a new contractual five-request limit from one shared-IP sample;
4. serialize manual requests at roughly one every 2+ seconds and back off on low remaining/429.

## 3. Schema audit: what each requested field really supports

All fields below are Jupiter-returned assertions. “Factual-looking” does not mean canonical or independently verified. The owner schema provides types and a few labels but does not publish source lineage or complete computation methodology for most of them.

| Field | Owner-documented meaning | Reliability classification |
|---|---|---|
| `id` | Token mint address | **Strong identifier**, but still validate as a Solana pubkey and match the requested mint. |
| `createdAt` | Token creation timestamp | **Provider-derived factual assertion**. No commitment to on-chain instruction/slot used or finality policy. |
| `holderCount` | Nullable number called holder count | **Provider-derived aggregation**. No definition of holder, zero-balance/dust exclusions, token accounts vs owners, cadence, slot, or finality. Not canonical. |
| `dev` | Nullable “token's developer wallet address” | **Attribution assertion, not identity**. It is a wallet address, not a verified person/entity, creator signature, mint authority, update authority, or current owner. Attribution method is unpublished. |
| `audit.topHoldersPercentage` | Nullable 0–100 percentage of supply held by “top holders” | **Provider-derived concentration metric**. Unit is clear; top-N size, denominator, exclusions, LP/burn/curve treatment, owner aggregation, and snapshot slot are not. |
| `audit.devBalancePercentage` | Nullable 0–100 percentage held by developer | **Provider-derived** and dependent on undocumented `dev` attribution and balance methodology. |
| `audit.devMints` | Nullable “number of developer mint events” | **Unstable/ambiguous wallet-history feature**. Live values of 493 and 12,324 on individual tokens are incompatible with interpreting it as this token’s mint count. Do not relabel it “tokens created” without owner confirmation. |
| `audit.mintAuthorityDisabled` / `freezeAuthorityDisabled` | Nullable booleans | **Potentially on-chain-derived**, but slot/finality and Token-2022 extension handling are not documented. Verify independently for risk decisions. |
| `audit.isSus` | Present only when flagged; absence does not mean safe | **Unstable provider flag/score**. Schema explicitly says not all risky tokens are flagged. |
| `launchpad` | Nullable string; fresh Pump records returned `pump.fun` | **Provider classification**. Useful filter, not proof of a canonical Pump instruction. |
| `graduatedPool`, `graduatedAt` | Nullable string fields with no further schema descriptions | **Provider graduation assertions**. Presence is useful evidence; absence is unknown/not-yet-populated, not proof of no graduation. Verify canonical Pump migration on-chain. |
| `usdPrice` | Nullable number | **Provider-derived market estimate**. `priceBlockId` is documented as the Solana block for the price data point, but exact venues, routing, outlier handling, and quote currency construction are not documented here. |
| `liquidity` | Nullable “total liquidity in USD” | **Provider-derived aggregate**. Included pools, double counting, locked/curve inventory, and valuation method are unspecified. |
| `stats5m/1h/6h/24h` | Nullable rolling objects: price/holder/liquidity/volume changes; buy/sell and organic volumes; counts | **Provider-derived rolling aggregates**. Windows are named, but exact boundary/event inclusion, venue coverage, USD-volume units, wash filtering, revision policy, and finality are not specified. |
| `firstPool.id` | Pool address | **Provider first-pool assertion**. For fresh Pump curves it can equal the mint, so do not assume a conventional AMM pool account. |
| `firstPool.createdAt` | Pool creation timestamp | `/recent` ordering anchor; **not mint time and not graduation time**. |
| `updatedAt` | Last data update timestamp | **Provider processing timestamp**, not a guarantee that every field changed, nor an on-chain observation slot. |
| `organicScore`, `organicScoreLabel` | 0–100 activity score and high/medium/low label | **Explicitly unstable score**. Never store as a fact or gate recording. Keep separately from raw measurements. |
| `isVerified`, `tags` | Provider verification/classification | **Provider curation**, not proof of safety, authenticity, or canonical Pump origin. |

Schema source: [Tokens v2 OpenAPI](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/openapi-spec/tokens/v2/tokens.yaml). The Token Information guide warns that responses are subject to change. The Terms of Use says displayed information, including prices, may be third-party-provided and/or calculated for informational purposes, and disclaims accuracy, completeness, reliability, currency, and error-free operation.

### Adversarial schema findings

1. **Nullable in schema often means omitted in JSON.** Missing and explicit `null` must both map to unknown.
2. `audit` is conditional, and its children vary independently. Never deserialize it as a fixed full object.
3. Live JSON included undocumented `audit.devMigrations`; preserve unknown fields in raw payloads and avoid strict rejection on additions.
4. The guide’s TypeScript sketch omits `graduatedPool`/`graduatedAt` even though OpenAPI and live responses include them.
5. The OpenAPI marks `organicScore` and `updatedAt` non-nullable-looking, but defensive clients should still tolerate omission/schema drift because the owner warns that responses change.
6. Numeric counts are typed as generic `number`, not integer, so validate semantics rather than relying only on generated types.

## 4. Fresh Pump.fun live sample

### `/recent` snapshot: 2026-08-26 13:00:34Z

No key or identifying header was sent. Response:

- HTTP 200, 30 records, 47,054 bytes;
- 28/30 records had `launchpad:"pump.fun"`;
- `cache-control: public, max-age=5`, `cf-cache-status: HIT`, `age: 4`, and `last-modified: 13:00:30Z`;
- field coverage among all 30: `holderCount` 30, `dev` 30, `audit` 30, `audit.topHoldersPercentage` 13, `audit.devMints` 30, `usdPrice` 21, `liquidity` 20, `stats5m` 26, `firstPool` 30, `updatedAt` 30, `graduatedPool` 0, `graduatedAt` 0.

This single list demonstrates sparse enrichment on very fresh launches. It does **not** estimate long-run coverage: `/recent` is only 30 first-pool records and is dominated by seconds-old tokens.

Example first record, `hvSg…pump` (“WORK FROM ANYWHERE”):

- top-level and first-pool creation `13:00:25Z`; updated `13:00:30.053…Z`;
- `holderCount: 7`, `dev` present, `devMints: 1`;
- `usdPrice: 0.0000030834…`, `liquidity: 3111.77…`;
- only buy volume/count in `stats5m`; no graduation fields.

A different fresh record had `usdPrice:null`, `liquidity:null`, and `stats5m:null`, proving that discovery and market enrichment are separate states.

### Three-token batch over time

The same exact three fresh Pump mints were queried in one `/search` batch at `13:02:23Z` and again 65 seconds later at `13:03:28Z`.

| Mint | Initial `/recent` around 13:00:34 | Batch T1 13:02:23 | Batch T2 13:03:28 |
|---|---|---|---|
| `hvSg…pump` | holders 7; price `3.0834e-6`; liquidity 3111.77; no top-holder % | holders 4; price `2.84435e-6`; liquidity 2959.76; top holders 6.7279%; expanded sell/trader/change stats; `updatedAt 13:01:42.480Z` | Same returned values and same `updatedAt` |
| `GV6V…pump` | holders 3; price `4.3659e-6`; liquidity 3688.95; dev balance 15.33%; no top-holder % | holders 1; price `2.91106e-6`; liquidity 2912.37; top holders 22.5895%; `devBalancePercentage` omitted; `updatedAt 13:01:02.822Z` | Same returned values and same `updatedAt` |
| `9D6L…pump` | holders 12; price `6.3770e-6`; liquidity 4507.36; top holders 41.2958% | holders 1; price `2.84706e-6`; liquidity 2912.39; top holders 35.8937%; `devMints:12324`, undocumented `devMigrations:85`; `updatedAt 13:01:23.822Z` | Values unchanged, but `updatedAt` advanced to `13:02:55.821Z` |

Both batch responses were HTTP 200 with `cache-control: public, max-age=10`; rate headers were identical (`current:3`, `remaining:2` in the observed shared bucket).

**What this proves:** batch exact-mint lookup works keylessly; fresh-token holder/price/liquidity/audit/stats values can change materially within minutes; conditional fields can appear or disappear; and `updatedAt` can advance while selected values remain unchanged.

**What it does not prove:** accuracy, which snapshot was “right,” refresh cadence, 5m/1h window correctness, source completeness, or a cache/update SLA. Two observations 65 seconds apart are too small for statistical reliability.

### Graduated Pump live check

At `13:02:54Z`, keyless exact-mint search for Fartcoin (`9BB6…pump`) returned:

- `launchpad:"pump.fun"`;
- `firstPool.id` equal to the mint and `firstPool.createdAt: 2024-10-18T06:05:05Z`;
- `graduatedPool:"Bzc9…iiw"` and `graduatedAt: 2024-10-18T06:09:47Z`;
- holder, audit, USD price, price-block, liquidity, and all sampled rolling-stat fields.

This verifies that graduation fields can be populated live. It does not verify that the pool is Pump’s canonical migration pool or that the timestamp is an on-chain event time; Jupiter publishes no such provenance promise in the audited schema.

## 5. Cache, timestamps, and freshness

Observed cache policy:

- `/recent`: `public, max-age=5`; Cloudflare HIT with `age:4` in one probe;
- `/search`: `public, max-age=10`; one graduated-token search returned `last-modified` equal to response time.

These are current HTTP observations, not contractual TTL guarantees. A recorder should save:

1. local monotonic and UTC receipt time;
2. HTTP `Date`, status, cache-control, age, last-modified, ETag if ever present;
3. `x-api-gateway-request-id` and all rate headers;
4. raw response bytes/hash;
5. per-token `createdAt`, `firstPool.createdAt`, `graduatedAt`, `priceBlockId`, `updatedAt` separately.

Never collapse these clocks. `createdAt`, first-pool time, graduation time, price block, provider update time, CDN age, and recorder receipt time answer different questions. No owner source audited here gives a maximum indexing delay, percentile freshness bound, or free/keyless SLA. Plans state all tiers have the same freshness and latency; only Enterprise advertises custom SLAs.

## 6. Empty and error states

| State | Documented/observed result | Recorder handling |
|---|---|---|
| Exact mint not found | HTTP 200 `[]` observed and documented | `not_indexed_or_not_found`; not “token does not exist.” |
| Missing `query` | One direct probe returned HTTP 200 with body `{"status":400,"message":"Param: '/query'..."}`; another same-day owner-domain probe returned HTTP 400. OpenAPI expects 400 `{error:string}`. | Validate both HTTP and body; record gateway/schema inconsistency. |
| Invalid supplied API key | Owner docs/example: HTTP 401 `Unauthorized`; omit the header for keyless | Never send placeholder keys in keyless mode. |
| Rate limited | HTTP 429, documented body may be `{"message":"Rate limit exceeded"}` | Back off to `x-ratelimit-reset`; preserve 429. |
| Permission/firewall | HTTP 403 | Preserve separately from not-found. |
| Provider error | HTTP 5xx; OpenAPI lists generic 500 | Retry with bounded backoff; never relabel as no token/data. |
| HTTP 200 with null/omitted fields | Normal conditional state | Store `unknown`, not zero/false. |

Sources: [OpenAPI](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/openapi-spec/tokens/v2/tokens.yaml), [response codes](https://developers.jup.ag/docs/portal/responses), [token guide error examples](https://developers.jup.ag/docs/guides/how-to-get-token-information).

## 7. Reliable facts versus unstable scores

### Reasonably reliable as identifiers/observations, but still provider assertions

- requested/returned mint address;
- raw wallet/pool address strings;
- presence of a provider field at observation time;
- exact numeric/string value Jupiter returned;
- HTTP/status/cache/rate/request-id headers;
- `priceBlockId` as Jupiter's declared price-point block;
- first-pool, creation, update, and graduation timestamps **with their Jupiter labels intact**.

These are reliable records of **what Jupiter said**, not automatic proof that the underlying chain fact is correct.

### Provider-derived measurements requiring independent verification for decisions

- holder count and all holder changes;
- top-holder and developer-balance percentages;
- developer wallet attribution and wallet-history counts;
- graduation pool/time;
- price, market cap, FDV, liquidity;
- buy/sell volume and trader/transaction counts;
- mint/freeze authority flags.

### Unstable scores/flags — isolate from factual storage

- `organicScore` / `organicScoreLabel`;
- `audit.isSus`;
- `isVerified` and tags;
- “organic” volumes/buyer counts;
- any locally derived risk grade based on these fields.

Store these in a provider-score namespace with observation time and version/schema hash. Never overwrite raw facts or trigger destructive action solely from them.

## 8. Is Jupiter genuinely distinct beyond PumpAPI?

Yes, at the provider level: it is a separate Jupiter-operated endpoint and supplies cross-market/provider-derived enrichment such as USD price/liquidity, rolling trade/holder statistics, developer attribution/history features, concentration metrics, first-pool indexing, and graduation assertions.

But it is **not** a second canonical Pump event source:

- `/recent` is first-pool recency, not Pump mint/migration recency;
- `firstPool.id` can equal a Pump mint/curve identifier rather than a normal AMM pool;
- graduation fields are undocumented beyond names;
- no transaction signature, slot, event type, source venue list, finality, or derivation lineage accompanies the record;
- the same Jupiter index likely feeds multiple fields, so they are not independent confirmations of one another.

Correct architecture: Pump/on-chain events remain the event truth; Jupiter is a timestamped enrichment snapshot with explicit source label and independent missing/error states.

## 9. Legal audit: local storage and redistribution

### What is favorable

- Agreement §2.1 licenses internal development, informational, comparison, and testing use.
- Current setup/plans expressly invite no-sign-up keyless testing, prototyping, and AI-agent use.
- A private manual recorder is closer to internal informational/testing use than a public commercial data product.

### What prevents a clean legal pass

The [SDK & API License Agreement](https://developers.jup.ag/docs/legal/sdk-api-license-agreement) states:

- §2.1: license is limited, fee-bearing, non-transferable, and for internal development of an integrating product;
- §2.4: other use requires written consent at `info@jup.ag`;
- §3.1: copies only as necessary for the licensed purpose;
- §3.2(d): no selling, leasing, sharing, transferring, or sublicensing the API/SDK **or any content obtained through the API**, directly or indirectly, to a third party;
- §3.2(f): no competitive analysis or dissemination of API uptime/response-time/benchmark information;
- §3.2(g): no combining API content with content obtained through scraping **or any other means outside the API**;
- §3.2(e)/(h): no excessive use, probing, vulnerability testing, or limit circumvention;
- §8.4: an end-user product must prominently show “Powered by Jupiter” (subject to the older product-characterization clause);
- §§5.2, 9, 12: no availability/performance/accuracy warranty; service is AS-IS/AS-AVAILABLE;
- §13.4: termination requires destruction/return of API, SDK, and Documentation copies; it does not clearly state a post-termination retention rule for previously received data.

The agreement also says API access may only use issued keys (§5.1), subscription fees apply (§6), and a 30-day paid term applies (§13.1). Those provisions conflict with current owner setup/plans that explicitly offer keyless and `$0` Free lanes. The API definition and branding clauses are swap-centric and do not cleanly describe Tokens v2.

### Legal conclusion

- **Private local storage:** plausible under internal informational/development use, but **not expressly clear** as indefinite archival retention. Get written confirmation if legal clarity is part of “strict-free.”
- **Redistribution/public export:** **not permitted on the agreement’s plain text** without written consent because API content cannot be shared/transferred.
- **Combining with PumpAPI or other recorder data:** **not clearly permitted and likely prohibited by §3.2(g)**, even when kept in one merged dataset. Segregated raw stores reduce technical commingling but do not create permission.
- **Publishing this performance sample:** the agreement restricts dissemination of benchmark information; this audit records bounded functional observations, not a comparative benchmark, but the clause is broad enough to warrant caution.

For a written determination, ask Jupiter to confirm: (1) keyless Tokens v2 is covered despite §§5.1/6/13.1; (2) indefinite private raw-response retention; (3) joining fields to PumpAPI/on-chain records; (4) export/backup/redistribution boundaries; and (5) required attribution/branding for a private or later user-facing recorder.

## 10. Implementation rules if used

1. Keyless base URL only: `https://api.jup.ag`; never fall back to Lite.
2. Batch exact mints (up to 100) for manual snapshots; avoid symbol/name ambiguity.
3. One global limiter for Jupiter main-bucket calls; target below 0.5 RPS, honor headers, and stop on 429.
4. Preserve raw payload and unknown fields; parse known fields permissively.
5. Namespace every value as `jupiter_tokens_v2.*` with receipt time and request ID.
6. Store missing, null, zero, and false distinctly.
7. Do not infer no graduation from missing `graduatedPool/At`.
8. Do not treat `dev` as verified identity or `devMints` as token count.
9. Keep organic score, suspicious flag, verification, and tags out of factual/canonical tables.
10. Independently verify high-impact facts on-chain before alerts or decisions.
11. Keep Jupiter output segregated from PumpAPI data pending written permission; do not redistribute.
12. Re-audit docs, OpenAPI, response schema, headers, and legal terms before each release because all are changeable and no free SLA exists.

## Final answer

Jupiter Tokens API v2 is a **technically strict-$0, keyless, no-card, no-wallet, no-account source for low-volume local/manual snapshots** at the published 0.5 RPS / 30 RPM. It is meaningfully distinct as a Jupiter-derived enrichment source. It is **not** a canonical Pump recorder, and most requested risk/market fields are provider-derived with incomplete methodology.

The decisive blocker is legal clarity: private internal use is plausible, but durable storage is not expressly granted; redistribution and combining API content with externally obtained data are restricted. Therefore adopt only as an optional segregated local cache after accepting that ambiguity—or obtain written permission. It does not meet a definition of “strict-free” that requires unambiguous long-term storage and redistribution rights.
