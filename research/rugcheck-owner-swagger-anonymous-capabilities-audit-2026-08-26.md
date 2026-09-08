# RugCheck owner Swagger and anonymous capability audit

**Snapshot:** 2026-08-26 UTC (safe probes 11:17–11:21 UTC; adversarial re-probe 11:50–11:51 UTC)  
**Rule:** strictly $0, no API key, no account dependency, no wallet, no funded balance, no trial. Owner/primary sources and current repository evidence only.  
**Owner sources:** [Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json) · [Swagger UI](https://api.rugcheck.xyz/swagger/index.html) · [RugCheck API page](https://rugcheck.xyz/api) · [owner-linked FluxRPC RugCheck docs](https://fluxrpc.com/docs/rugcheck) · [token docs](https://fluxrpc.com/docs/rugcheck/tokens) · [insider docs](https://fluxrpc.com/docs/rugcheck/insider-trading) · [vault docs](https://fluxrpc.com/docs/rugcheck/vaults) · [authentication](https://fluxrpc.com/docs/rugcheck/authentication) · [About](https://rugcheck.xyz/about) · [Privacy](https://rugcheck.xyz/privacy) · [owner-linked live plans](https://api.fluxrpc.com/v1/plans?api_type=rugcheck) · [FluxRPC terms](https://fluxrpc.com/terms-conditions)

## Verdict

RugCheck currently has a useful **anonymous, best-effort single-mint read lane**, but not a documented no-key production contract. The evidence-backed distinct additions beyond PumpAPI are:

1. documented named risk records and a documented aggregate LP-lock percentage in the summary;
2. observed current top-token-account rows and market/LP calculations in the undocumented full report;
3. observed insider network nodes/edges and network summaries from anonymous GETs;
4. observed provider-derived creator/prior-rug fields and labels, but not a documented evidence chain or methodology.

Authority facts are useful as a pull-based current snapshot, including Token-2022 extensions, but are **not categorically unique**: the current repository's PumpAPI live audit already observed token program/extensions/authorities in PumpAPI events. RugCheck's distinction is token-address lookup and provider analysis, not canonical authority truth.

Do not make RugCheck required for the strict-free MVP. Cache raw responses, schema-diff them, preserve missing/error states, and independently verify every on-chain fact. Full-report fields are observations, not Swagger contracts.

## Adversarial re-probe and exact outcome semantics

A second low-volume no-header probe at 2026-08-26 11:50–11:51 UTC confirmed the anonymous lane but narrowed what each outcome may mean:

| Observed outcome | Exact observation | Recorder meaning; claims explicitly rejected |
|---|---|---|
| Three consecutive summary `200`s for `HLyZ…pump` | Each body was a 137-byte object with `tokenProgram`, `tokenType`, `risks`, `score`, `score_normalised`, and `lpLockedPct`; the rate-remaining values were `14`, `13`, then `14`. | `available_snapshot`. It is not evidence of a monotonic global bucket, fixed anonymous rate, freshness, source slot, completeness, or future availability. |
| Full-report `200` | The same mint returned the 36-key observed object listed below. | `available_unversioned_snapshot`; do not promote the keys to a contract because Swagger's `200` has no schema. |
| Insider `200 []` | Graph and networks each returned an empty JSON array with `Cache-Control: public,max-age=120`. | `provider_returned_no_rows`. It is not proof that no insider relationship exists, nor the same state as 404, 400, timeout, or parse failure. |
| Insider `400 {"error":"invalid mint"}` | Wrapped SOL produced this result on graph. | `provider_rejected_mint_for_endpoint`; it does not prove the address is malformed or nonexistent on Solana. |
| Summary `400` for malformed Base58 | `not-a-mint` returned `{"error":"decode: base58: invalid base58 character"}`. | `invalid_address_encoding`; deterministic input error, not missing analysis. |
| Summary `400` for the system-program address | Returned `{"error":"invalid token mint"}`. | `not_accepted_as_token_mint`; not a cache miss. |
| Locker `401` | Returned `{"error":"this feature requires a paid Rugcheck plan from fluxrpc.com"}`. | `excluded_paid_auth`; never retry with a wallet, key, account, trial, or paid plan in strict-free mode. |
| Summary `404` | Swagger documents this as `Token not found`; earlier same-day `cacheOnly=true` probes for mints named by `/stats/recent` returned 404. | `provider_report_not_found_at_request_time`. It does not prove the mint is absent on-chain, permanently unindexed, or unsafe. |
| `429`, timeout/network error, 5xx, invalid JSON/schema mismatch | Swagger documents 429 only on full report; no overload was intentionally induced. | Separate transient/contract-failure states. They are never token-risk or missing-token results. Honor bounded `Retry-After`; do not fabricate an empty report. |

The re-probe also fetched Swagger at HTTP 200 with the same 61,063-byte SHA-256 recorded earlier and fetched the owner-linked plan feed: its `$0` Free row still specified 3 RPS and 3 API keys. That is an account/key product and does not document the no-key lane. `/v1/stats/recent` returned ten rows; three bounded `cacheOnly=true` summary probes returned 200, while the earlier same-day stale-score/404 observations remain evidence that list/report joins are not atomic or reliable.

## Strict anonymous endpoint matrix

| Endpoint | Swagger authentication | 2026-08-26 no-key probe | Contract / exact useful shape | Boundary |
|---|---:|---:|---|---|
| `GET /v1/tokens/{id}/report/summary` | none | 200 | `dto.TokenCheckSummary`: `error?: string`, `lpLockedPct: number`, `mint?: string` (bulk only), `risks: Risk[]`, `score: integer`, `score_normalised: integer`, `tokenProgram: string`, `tokenType: string`. `Risk`: `description`, `level`, `name`, `score`, `value`. | Best documented lane. No report slot/time or freshness SLA. `cacheOnly` is oddly typed `string`; `refresh: boolean` is “paid API keys only.” |
| `GET /v1/tokens/{id}/report` | none | 200 | HTTP 200 is only described as `OK`; **no response schema**. Observed schema below. | Richest lane, but unstable/non-contractual. `refresh=true` is paid-only by Swagger. |
| `GET /v1/tokens/{id}/insiders/graph` | none | 200 for a Pump mint; 400 `{"error":"invalid mint"}` for wrapped SOL | No Swagger 200 response/schema. Observed `[{net_id, network_type, nodes:[{id,participant,holdings}], links:[{source,target}], relatedMint}]`. | No edge signatures, slots, timestamps, amounts, or methodology; cannot audit graph directly from payload. |
| `GET /v1/tokens/{id}/insiders/networks` | none | 200 for a Pump mint; 400 for wrapped SOL | No Swagger 200 response/schema. Observed `[{id,size,activityType,totalAmount,numActiveAccounts}]`. | Shape differs from full report's observed `insiderNetworks` rows (`id,size,type,tokenAmount,activeAccounts`). |
| `GET /v1/tokens/{id}/metadata` | none | 200 | Swagger has no 200 schema. Observed `mint, decimals, imageUri, imageType, name, symbol, updateAuthority`. | Metadata is issuer/off-chain context, not risk truth; sampled response was cacheable for 172,800 seconds. |
| `GET /v1/stats/new_tokens` | none | 200 | Documented `Token[]`: `createAt, creator, decimals, events[], freezeAuthority, mint, mintAuthority, program, symbol, updatedAt`. | Indexed recent-detection list, not a complete Pump first-seen feed. Mostly overlaps PumpAPI discovery. |
| `GET /v1/tokens/{id}/lockers` and `/lockers/flux` | `ApiKeyAuth` | 401; body: `this feature requires a paid Rugcheck plan from fluxrpc.com` | Documented `dto.VaultResponse` for 200. | **Excluded** from strict anonymous use. Do not claim anonymous locker records or unlock schedules. |
| bulk reports, report/vote writes | `ApiKeyAuth` | not probed (mutation/keyed) | `Authorization` header JWT per Swagger security definition. | Excluded. |

Swagger defines `ApiKeyAuth` as an API key named **`Authorization`** in the request header, described as a JWT. The anonymous GETs above have no operation-level `security` requirement; the locker and bulk/write operations do.

## Exact observed full-report capability schema

A 2026-08-26 no-key report for Token-2022 Pump mint `HLyZ2Hjkse4gmL8r9SptPDJ22SfLFK9SmLZJEK6Vpump` exposed these top-level keys:

`mint`, `tokenProgram`, `creator`, `creatorBalance`, `token`, `token_extensions`, `tokenMeta`, `topHolders`, `freezeAuthority`, `mintAuthority`, `risks`, `score`, `score_normalised`, `fileMeta`, `lockerOwners`, `lockers`, `lockerScanStatus`, `markets`, `totalMarketLiquidity`, `totalStableLiquidity`, `totalLPProviders`, `totalHolders`, `price`, `rugged`, `tokenType`, `transferFee`, `knownAccounts`, `events`, `verification`, `validation`, `graphInsidersDetected`, `insiderNetworks`, `detectedAt`, `creatorTokens`, `launchpad`, `deployPlatform`.

Important nested observations:

- `token`: `{mintAuthority, supply, decimals, isInitialized, freezeAuthority}`.
- `token_extensions`: observed 17 keys: `nonTransferable`, `transferFeeConfig`, `defaultAccountState`, `permanentDelegate`, `metadataPointer`, `groupPointer`, `groupMemberPointer`, `tokenMetadata`, `mintCloseAuthority`, `confidentialTransferMint`, `interestBearingConfig`, `transferHook`, `confidentialTransferFeeConfig`, `tokenGroup`, `tokenGroupMember`, `scaledUiAmountConfig`, `pausableConfig`.
- each `topHolders[]` row: `{address, amount, decimals, pct, uiAmount, uiAmountString, owner, insider}`. `address` is a token account and `owner` is its owner; neither establishes beneficial ownership.
- each observed `markets[]` row included market/vault/mint accounts plus `lp`. Observed `lp` keys included `baseMint`, `quoteMint`, `lpMint`, prices, base/quote balances and USD values, `reserveSupply`, `currentSupply`, `pctReserve`, `pctSupply`, `holders`, `totalTokensUnlocked`, `tokenSupply`, `lpLocked`, `lpUnlocked`, `lpLockedPct`, `lpLockedUSD`, `lpMaxSupply`, `lpCurrentSupply`, `lpTotalSupply`.
- creator/rug-related fields were `creator`, `creatorBalance`, `creatorTokens`, `rugged`, `risks[]`, `events[]`, `knownAccounts`, `detectedAt`, and platform fields. Owner token docs describe `creatorTokens[]` rows as `{mint, marketCap, createdAt}` and `events[]` as `{event, oldValue, newValue, createdAt}` for authority/supply changes, but these are not defined in the full-report Swagger response.

The sampled Pump token had `creatorTokens: null`; a separate current risky report exposed only a named `Low Liquidity` risk and still had `creatorTokens: null`. Current repository evidence records an earlier same-day anonymous summary with the named risk **`Creator history of rugged tokens`**, proving label availability in at least one observation, but not a stable evidence-list contract. Owner docs characterize other creator tokens as scoring context when those tokens were rugs; they do not supply a complete proof methodology. Treat prior-rug conclusions as provider assertions unless reconstructed independently.

## Headers, rates, free status, and freshness

### Observed headers

Across safe no-key requests, responses advertised:

- `server: nginx`
- `content-type: application/json` or `application/json; charset=utf-8`
- `x-rate-limit-limit: 15`
- `x-rate-limit-remaining: ...`

The remaining counter was **not monotonic across routes/requests** (for example 13, 12, then 14), so it may be route/bucket dependent. No window/reset header was present. No deliberate over-limit test was run. Swagger documents HTTP 429 only for the full report and gives no numeric anonymous rate/window contract. A safe `OPTIONS` probe returned 204 with `Access-Control-Allow-Origin: *`, allowed methods `GET, POST, PUT, DELETE, OPTIONS, HEAD`, and allowed headers including `Authorization`, `X-Wallet-Address`, and `X-API-KEY`; listing those headers does not make a wallet or credential mandatory for the verified GETs.

The owner API page and owner-linked plan feed separately publish a **Free** plan at `$0`, `3` requests/second, and `3` API keys. The page describes that plan as “Single reports only” and “Only cached results,” and its CTA is “Create an Account.” That keyed/account plan must not be conflated with the observed no-key lane or with the anonymous `x-rate-limit-limit: 15` header. Under the user's rule, only the directly observed no-key lane qualifies.

### Freshness evidence

- Swagger exposes `cacheOnly` on summary and says forced `refresh=true` is for paid API keys only.
- Anonymous `summary?cacheOnly=true` and `summary?refresh=true` returned byte-identical 200 bodies in one sample. Anonymous `report?refresh=true` also returned 200, but that does **not** prove refresh was honored; the same `detectedAt` remained.
- Insider graph/network responses advertised `Cache-Control: public, max-age=120` plus matching `Expires`.
- Metadata advertised `Cache-Control: public, max-age=172800` (2 days).
- Full report and summary samples had no cache-control, source slot, commitment, analysis timestamp, or age header. `detectedAt` is a token/provider detection timestamp, not a guaranteed snapshot timestamp.
- Two full reports for an actively trading mint about 160 seconds apart changed market balances, price, top-holder rows, holder count, and liquidity, but neither response supplied a source slot/time. This demonstrates mutable snapshots and makes cross-source temporal alignment impossible from payload fields alone.
- No owner freshness, completeness, uptime, retention, or deprecation SLA was found.

## Response instability and semantics hazards

1. The Swagger JSON itself was reachable (HTTP 200, 61,063 bytes, SHA-256 `812adaed36e20b3bba66a50b0c66229df8cddd8c9a1f9db990a54c773730ddae`) during this probe, while a later repository audit had previously observed the same owner URL returning 404. Availability is not contractual.
2. Full report, metadata, and both insider endpoints lack documented 200 schemas. Graph and network shapes must be runtime-contract-tested.
3. `/v1/stats/recent` scores were stale/inconsistent with immediately fetched token summaries in the sample: one list score was `983`, while the fetched summary became `1`; several `cacheOnly=true` summary requests for listed tokens returned 404. Do not join indexed lists and reports as one atomic snapshot.
4. `lpLockedPct` is provider-defined across heterogeneous market types. The sampled pre-migration `pump_fun` market reported approximately 100% although it had no conventional LP mint (`111...` placeholder); do not interpret this generically as a third-party locker contract or unlock schedule.
5. `score`, `score_normalised`, risk levels/scores, `insider`, `knownAccounts`, verification/validation, and creator-history judgments have no sufficiently public calculation/validation methodology in Swagger. The owner About page only makes the general claim that on-chain data is attributed to risk metrics and the same scoring algorithm is applied. Owner token docs mark `rugged` deprecated/no longer used; a same-time probe also found it conflicting with a rugs-ticker event, so do not consume it.
6. Numeric token amounts appeared as JSON numbers in observed reports. Large raw amounts can exceed JavaScript's exact-integer range; preserve the raw JSON and prefer string/on-chain integer reconciliation rather than trusting parsed IEEE-754 values.

## Capability-by-capability decision beyond PumpAPI

| Capability | RugCheck evidence | Distinct from PumpAPI? | Decision |
|---|---|---|---|
| Authorities / Token-2022 controls | Full report observed mint/freeze authorities and 17 extension categories; recent-token schema also documents authority fields. | **Partly.** Pull-by-mint current snapshot and risk context are convenient, but PumpAPI events already expose program/extensions/authorities. Canonical fact remains on-chain. | Candidate optional enrichment; independently decode mint. |
| Named risks | Summary Swagger contracts explainable `Risk{name,description,level,score,value}` rows. Current `Low Liquidity` and prior repository `Creator history of rugged tokens` were observed. | **Yes.** PumpAPI supplies events/fields, not RugCheck's named analytical findings. | Best distinct lane, but use named facts only; score/methodology remain opaque. |
| LP locks | Summary contracts `lpLockedPct`; full report observed detailed market/LP calculations. | **Yes, as provider analysis.** PumpAPI does not provide a general lock analysis. | Candidate percentage only. Anonymous explicit locker endpoint is excluded; verify market semantics and lock accounts. |
| Holder concentration | Full report observed up to 20 `topHolders` token-account rows with percentages/owners/insider flags. | **Yes, as a current indexed snapshot.** PumpAPI event balances are not a complete current holder ranking. | Useful but undocumented and not beneficial-owner concentration. Recompute where correctness matters. |
| Insider graph | Anonymous graph/network reads returned nodes/edges and summaries for a Pump mint. | **Yes.** PumpAPI does not supply an inferred transfer network. | Lead generation only: no edge evidence, slot, signature, or methodology in response. |
| Creator / prior-rug | Observed `creator`, nullable `creatorTokens`, `rugged`, named creator-history risk, and platform fields. | **Derived label is distinct.** PumpAPI replay can support a local same-address launch history but does not publish a prior-rug judgment. | Weakest candidate: label can exist without cited evidence. Reconstruct before asserting. |

## Independent no-key on-chain checks

Use Solana's owner-operated public RPC only as best-effort verification; Solana says public endpoints are not for production and may change/block limits. Record slot, commitment, response time, parser version, and errors.

1. **Authorities and extensions:** call finalized `getAccountInfo` with `jsonParsed`; confirm the account's program owner, mint/freeze authorities, supply/decimals, and all Token-2022 extensions. For the sampled mint, public RPC returned at slot `441855736`: Token-2022 owner, null mint/freeze authorities, supply `1000000000000000`, decimals `6`, and matching metadata-pointer/token-metadata extensions. This independently matched the core RugCheck mint facts.
2. **Supply and concentration:** query finalized `getTokenSupply` and `getTokenLargestAccounts` at aligned slots; retain raw integer strings. The former matched the sample supply at slot `441855739`; the latter returned HTTP 429 in this audit. Even when available, it returns only the 20 largest **token accounts**, not wallets. Aggregate owners and explicitly report raw-account, owner-aggregated, and adjusted concentration; complete enumeration requires token-program account scans and is not dependable on the public RPC.
3. **LP/market locks:** identify each market program and decode its accounts using owner-published program/IDL data. Verify vault balances, LP mint supply/authorities, burn/locker/vault ownership, and unlock state/time at one slot. A Pump bonding curve is not a conventional LP lock; decode the official Pump account. For PumpSwap, decode the official Pump AMM pool and relevant vault/LP accounts. Never accept one cross-market `lpLockedPct` without naming the denominator and mechanism.
4. **Named risks:** convert each risk to a checkable proposition. For `Low Liquidity`, reconcile program vault balances and a timestamped price source. For mint/freeze/extension risks, decode the mint. For concentration, declare denominator/exclusions and compare raw account data. Provider risk scores are not independent evidence.
5. **Insider graph:** for every claimed node/link, retrieve and decode transaction history (`getSignaturesForAddress` + `getTransaction`) and retain signatures, slots, times, instructions, token balance deltas, and direction/amount. RugCheck's graph payload lacks these proof fields, so a link is not verifiable from the response alone. Absence from a graph is not proof of no common control, and transfers do not prove shared human identity.
6. **Creator/prior rug:** decode official Pump `CreateEvent`s from a locally retained Pump-wide event index and confirm transactions on-chain. Attribute only the same declared creator address, not a person. Define “rug” deterministically (for example liquidity removal or explicit reserve/price/outflow condition), retain the signatures/slots, and account for PumpAPI replay's start date and known gaps. Paging only the creator address is not guaranteed to find every creation event.

Primary chain sources: [Solana public endpoint policy/limits](https://solana.com/docs/references/clusters) · [`getAccountInfo`](https://solana.com/docs/rpc/http/getaccountinfo) · [`getTokenSupply`](https://solana.com/docs/rpc/http/gettokensupply) · [`getTokenLargestAccounts`](https://solana.com/docs/rpc/http/gettokenlargestaccounts) · [`getProgramAccounts`](https://solana.com/docs/rpc/http/getprogramaccounts) · [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress) · [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction) · [Token-2022 extensions](https://solana.com/docs/tokens/extensions) · [official Pump/PumpSwap IDLs](https://github.com/pump-fun/pump-public-docs).

## Legal/access boundary

- Technical access is evidenced: the listed single-token/stat GETs returned without authentication, and Swagger intentionally omits operation security on them.
- The owner API page markets integration and publishes a $0 Free plan, but that plan is account/API-key oriented and therefore not the no-key lane audited here.
- The reviewed owner Privacy page governs personal-information handling; it is not an API data license.
- Swagger has no `license` field and its `info.contact` is empty; no official RugCheck source repository or owner source/data-license grant was located.
- The owner-linked FluxRPC Terms (official bundle states updated 2026-04-01) reserve content/software/materials to FluxRPC or licensors except explicitly open-source components, provide the service as-is, disclaim uninterrupted/error-free availability, and permit suspension/termination. They do not establish a RugCheck-output redistribution grant.
- No owner API terms granting commercial reuse, bulk retention, redistribution, resale, derivative-dataset rights, schema stability, or continued anonymous access were found in the reviewed owner materials. Public reachability and `$0` pricing are not such a grant. Legal/product review or owner permission is required before redistributing/monetizing retained RugCheck output.
- No source-code license applies to the hosted API merely because Swagger is public.

## Implementation tests required before adoption

1. Low-volume contract probes for summary/report/graph/networks; hash raw payloads and alert on key/type/nullability changes.
2. Treat 400, 404, 401, 429, timeout, invalid JSON, and `200` with empty arrays as distinct outcomes; obey `Retry-After` if present.
3. Rate-limit below the stricter observed/documented boundary until the anonymous window is known; never infer a 15-RPS entitlement from `x-rate-limit-limit: 15`.
4. Store `requested_at`, `received_at`, response headers, source URL, mint, raw bytes/hash, parsed version, and independent Solana slot. Never label `detectedAt` as report freshness.
5. Reconcile authorities/supply on every accepted report; sample concentration/market/insider/creator claims independently and quantify disagreement.
6. Keep RugCheck optional and fail-open for ingestion but fail-closed for assertions: unavailable/unknown is not safe.

## Repository cross-checks

- [`pumpapi-live-historical-audit.md`](pumpapi-live-historical-audit.md): PumpAPI already emits authorities/extensions; live/replay are best-effort and replay is incomplete/evolving.
- [`free-holders-creator-risk-enrichment-audit-2026-08-26.md`](free-holders-creator-risk-enrichment-audit-2026-08-26.md): earlier same-day RugCheck/full-report and public-RPC observations.
- [`free-metadata-social-wallet-audit.md`](free-metadata-social-wallet-audit.md): later Swagger 404 observation; supports availability instability.
- [`free-only-reliability-benchmark-audit.md`](free-only-reliability-benchmark-audit.md): strict-free reliability boundary.
