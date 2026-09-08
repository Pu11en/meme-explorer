# Free holders, creator, and risk enrichment — strict audit

**Snapshot:** 2026-08-26 UTC  
**Rule:** “Free” excludes a funded wallet, paid or metered balance, paid package, payment card, and temporary trial. Primary/owner sources and safe no-key observations only. Observed responses are not an SLA.

## Corrected conclusion

None of the four named services is a documented, production-safe free dependency under that rule. The Solana-operated RPC is anonymous and free to read, but Solana explicitly says its public endpoints are not intended for production and may change limits or block traffic without notice. RugCheck currently permits useful anonymous single-token GETs, but publishes neither a free-service commitment/SLA nor a response contract for the full report. Helius Free and Birdeye Standard are excluded because both depend on metered monthly credits/CUs; Birdeye also requires an API key. A best-effort prototype can still use raw on-chain facts plus opportunistic RugCheck leads, but must retain local data, explicit missingness, retries, and independent reconciliation.

## Verified facts

### Solana public RPC and derivations

- `https://api.mainnet.solana.com` accepts no-key read calls. Owner documentation publishes 100 requests/10 seconds/IP, 40 requests/10 seconds/IP for one method, 40 concurrent connections/IP, 40 connection attempts/10 seconds/IP, and 100 MB/30 seconds/IP. These limits may change and are not a reliability guarantee; HTTP 429 may include `Retry-After`.
- A 2026-08-26 safe `getHealth` request returned HTTP 200, while runtime headers advertised 250 RPS, a 150-method ceiling, 40 connections, 40 connection attempts, and 10 PubSub subscriptions. These headers are an observation, not the published contract.
- `getTokenLargestAccounts` returns only the 20 largest **token accounts**, not wallets or beneficial owners. Exact raw `amount`/`uiAmountString` should be retained and divided by contemporaneous `getTokenSupply.amount`. A 2026-08-26 safe call returned HTTP 429 with `x-ratelimit-method-limit: 0` and `Retry-After: 10`; protocol support therefore does not establish current usability on the public endpoint.
- A complete owner-level snapshot requires enumerating accounts for the legacy SPL Token program and Token-2022, decoding mint/owner/amount, aggregating by owner, and declaring denominator and exclusion rules. HHI, Gini, top-k, and holder count are derivations, not RPC facts. Token-account splitting, wallet sybils, custody, LP/vault/burn accounts, and dust make all such metrics manipulable. A safe filtered public `getProgramAccounts` probe returned JSON-RPC `INTERNAL_ERROR`; this method is not a dependable free-public production path merely because it exists in the protocol.
- Mint/account parsing must support Token-2022 extensions. Authority-bearing or transfer-affecting extensions include permanent delegate, transfer fees/hooks, default account state, pausable state, metadata pointers, and other extension data; a classic fixed-size-only scanner is incomplete.

Primary sources: [public endpoints](https://solana.com/docs/references/clusters), [`getTokenLargestAccounts`](https://solana.com/docs/rpc/http/gettokenlargestaccounts), [`getTokenSupply`](https://solana.com/docs/rpc/http/gettokensupply), [`getProgramAccounts`](https://solana.com/docs/rpc/http/getprogramaccounts), [token extensions](https://solana.com/docs/tokens/extensions), [permanent delegate](https://solana.com/docs/tokens/extensions/permanent-delegate).

### Creator history and Pump attribution

- `getSignaturesForAddress` can be paged (up to 1,000 signatures per call) and joined to `getTransaction` for signature, slot, block time, status, account keys, instructions/logs, balances, and token balances.
- Correct Pump creator history requires decoding the owner-published Pump IDL and maintaining or querying a sufficiently complete Pump-wide creation-event index. Paging only the declared creator address is not guaranteed to find every `CreateEvent`, because creator attribution may be event/instruction data rather than a complete address-history index key.
- The defensible fact is “same declared creator address in the observed/indexed Pump events.” It does not establish a person, common control, or sybil linkage. “Wallet age” must be named earliest retrievable activity, not account creation time.

Primary sources: [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress), [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction), [transaction JSON](https://solana.com/docs/rpc/json-structures), [official Pump IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json). Repository cross-check: `planning/evidence/P-005-evidence.md` and `research/provider-variables-draft.md`.

### Metadata

- Metaplex metadata supplies issuer-controlled identity fields such as name, symbol, URI, creators, update authority, and mutability. An authorized update is possible only while the metadata remains mutable. URI JSON/media/social links are off-chain claims, not verified risk facts; store fetch time, redirect/failure state, content hash, URI, update authority, and mutability. Token-2022 metadata/extensions require separate decoding.

Primary sources: [Metaplex update-token](https://developers.metaplex.com/tokens/update-token), [Solana token extensions](https://solana.com/docs/tokens/extensions).

### RugCheck anonymous reads

- RugCheck Swagger attaches no security requirement to `GET /v1/tokens/{id}/report`, `/report/summary`, `/metadata`, `/insiders/graph`, or `/insiders/networks`. It attaches `ApiKeyAuth` to bulk requests, report writes, and **`GET /v1/tokens/{id}/lockers`**. `refresh=true` is documented as paid-API-key-only.
- Safe no-key calls on 2026-08-26 returned HTTP 200 for a report, summary, and metadata. The report exposed top-level keys including token/mint state, `token_extensions`, `topHolders`, authorities, risks/scores, markets/liquidity, holder counts, price, `rugged`, known accounts, verification/validation, insider fields, `detectedAt`, `creatorTokens`, launchpad, and deploy platform. A sampled top-holder row exposed address, amount, decimals, percentage, UI amounts, owner, and insider; a Token-2022 report exposed several extension fields.
- Those full-report fields are **observed payload availability only**: Swagger gives the full report's HTTP 200 no response schema. The summary does have a documented `dto.TokenCheckSummary` schema covering token program/type, risks, score fields, and LP-locked percentage.
- Anonymous responses exposed `X-Rate-Limit-Limit: 15` and a remaining counter, but no window or contractual anonymous tier limit is documented. Insiders endpoints returned HTTP 400 for the wrapped-SOL sample; endpoint openness does not guarantee data for every mint.
- RugCheck publishes no freshness SLA and forced refresh is paid-only. Scores, risk levels, rugged/insider/known-account/verification labels, and creator-history conclusions have no sufficiently public ground-truth methodology in Swagger. Treat them as leads and preserve raw evidence; independently recompute chain facts.

Primary source: [RugCheck Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json).

## Excluded under the strict free rule

### Helius

Helius documents a $0 Free plan with 1M monthly credits, 10 RPC requests/s, 2 DAS/Enhanced/Wallet requests/s, `getProgramAccounts` at 5/s, and Wallet API requests at 100 credits each. Its pricing page says no credit card or email is required, but the service still depends on a metered monthly credit balance and owner docs position Free for testing/development rather than production. It is therefore **not eligible under the supplied definition**, regardless of its useful DAS, Enhanced Transactions, and Wallet API fields. Programmatic Agent signup additionally requires 1 USDC.

Sources: [plans](https://www.helius.dev/docs/billing/plans), [credits](https://www.helius.dev/docs/billing/credits), [rate limits](https://www.helius.dev/docs/billing/rate-limits), [pricing](https://www.helius.dev/pricing), [Wallet history](https://www.helius.dev/docs/api-reference/wallet-api/history).

### Birdeye

Birdeye documents Standard at base price $0 with 30,000 included CUs, limited data, and 1 request/s. The current access matrix includes `/defi/v3/token/holder` and `/holder/v1/distribution` on Standard, and the holder endpoint documents token-account mode plus owner-wallet aggregation. However, requests require an API key and consume a metered CU allowance; strict eligibility fails even before the unresolved no-card signup question. The current access matrix excludes `/defi/token_security` from Standard, so it cannot be used as free security enrichment. Its indexed holder data has no numeric freshness SLA and cannot identify beneficial owners or sybils.

Sources: [pricing](https://docs.birdeye.so/docs/pricing), [authentication](https://docs.birdeye.so/docs/authentication-api-keys), [package access](https://docs.birdeye.so/docs/data-accessibility-by-packages), [V3 holder](https://docs.birdeye.so/reference/get-defi-v3-token-holder), [holder distribution](https://docs.birdeye.so/reference/get-holder-v1-distribution), [token security](https://docs.birdeye.so/reference/get-defi-token_security).

## Rejected draft claims

1. **“Solana public RPC is an accepted production source.”** Rejected as a production dependency; accepted only as anonymous best-effort protocol access/diagnostics.
2. **“RugCheck lockers is anonymous.”** Rejected; Swagger and a safe no-key call show `ApiKeyAuth`/HTTP 401.
3. **“RugCheck full-report fields are documented contract fields.”** Rejected; they are live observations because the full report has no 200 response schema.
4. **“Creator history can be completely rebuilt by paging only the creator address.”** Rejected; use a Pump-wide decoded event index, and report same-address evidence only.
5. **“Helius Free qualifies.”** Rejected under the explicit no-metered-balance rule; the 1M-credit allowance is metered.
6. **“Birdeye Standard qualifies.”** Rejected under the same rule; it requires an API key and a metered 30,000-CU allowance. Token security is also outside Standard.
7. **“Provider scores/labels establish risk facts.”** Rejected. Preserve and verify raw on-chain evidence; labels remain heuristics without public validation methodology.

## Production-prototype tests

1. Record request/response time, HTTP status, rate headers, source, slot/commitment, and explicit missing reason for every observation.
2. Contract-test `getTokenLargestAccounts` and filtered `getProgramAccounts` continuously; never assume protocol support equals public-endpoint availability.
3. Snapshot supply and token accounts at a consistent finalized slot where possible; aggregate by owner and publish raw-account, owner-level, and explicitly adjusted variants.
4. Decode both token programs and fail closed on unknown extensions; retain raw account bytes and parser/version hashes.
5. Build creator history from a locally retained Pump-wide event stream/index, not creator-address history alone; quantify index gaps and archival coverage.
6. Treat RugCheck as optional: cache raw payloads, schema-diff observed keys, tolerate 400/404/429, obey `Retry-After`, and recompute authorities, balances, concentration, and market/LP facts from chain state.
7. Hash metadata JSON/media and sandbox URI fetching against SSRF, redirects, oversized content, and hostile media.
8. Do not market the result as reliable or SLA-backed. No surviving strict-free source publishes the completeness, freshness, uptime, or retention guarantees needed for that claim.
