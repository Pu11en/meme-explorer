# PumpAPI and RugCheck Solana API memo

**Requested cutoff:** 2026-08-26  
**Evidence rule:** owner documentation, owner-operated API contracts/responses, and current first-party repositories only. No secondary sources are used.

> **Future-date verification limitation.** I cannot independently verify what these products will expose or permit on a future date. This memo records owner artifacts reachable in this research session. Dates displayed by owner sites (including 2026-dated `updatedAt`, event, or archive values) are publisher-provided metadata, not independent proof of a future state. Re-check the linked owner contracts, pricing, and terms on 2026-08-26 before relying on the result.

## Executive finding under the hard constraints

| Candidate / mode | No card | No funded wallet | No credits/CUs | No paid trial | Documented access only | Constraint result |
|---|---:|---:|---:|---:|---:|---|
| **PumpAPI WebSocket Data Stream + Historical Replay** | Owner docs mention no card | Yes | Owner docs call both free; no CU system documented | Yes | Yes | **Fits the information-only constraints as documented.** It is an event/feed product, not a normalized token-risk report. |
| **PumpAPI REST `getTokenInfo` or transaction actions** | No card requirement documented | **No** | No CU system, but on-chain/service fees apply | Yes | Yes | **Fails:** `getTokenInfo`, balances, and non-stream actions require a private key or API key derived from a wallet and charge lamports; trades charge 0.25% of volume. [Fees](https://pumpapi.io/fees), [Get Token Info](https://pumpapi.io/get-token-info), [Trade API](https://pumpapi.io/trade-api) |
| **RugCheck public single-token GET report/summary** | No card requirement in contract | Yes | No credit/CU mechanism documented for these public GETs | Yes | Yes | **Fits the mechanical access constraints**, with caveats: public rate policy/window, score methodology, API-key acquisition/pricing, and service terms are not specified in the owner Swagger contract. Forced refresh is explicitly paid-only. [Swagger contract](https://api.rugcheck.xyz/swagger/doc.json) |
| **RugCheck bulk, lockers, verification/voting, or forced refresh** | Not established | Depends on operation | Pricing/credits not documented | **No for forced refresh** | Yes | **Does not satisfy the strict evidence standard:** JWT API key is required for bulk and several ancillary endpoints, and `refresh=true` is “paid API keys only”; owner contract does not explain key issuance or pricing. [Swagger contract](https://api.rugcheck.xyz/swagger/doc.json) |
| **GoPlus Solana Token Security baseline** | No card requirement documented | Yes | Owner support page calls API free | Yes | Yes | Public GET worked without a token in the documented shape; docs also allow an optional Bearer token. Published free limit is 30 calls/minute. [Solana endpoint](https://docs.gopluslabs.io/reference/solanatokensecurityusingget), [Support](https://docs.gopluslabs.io/reference/support) |

## 1. PumpAPI

### Exact documented Solana surfaces

1. **Real-time WebSocket:** `wss://stream.pumpapi.io/`; no request body or subscription message is documented. The client connects and receives every emitted JSON event. The owner documents a strict **1 connection per IP address**. [Stream](https://pumpapi.io/stream), [FAQ](https://pumpapi.io/FAQ)
2. **Historical replay:** `GET https://replay.pumpapi.io/YEAR/MONTH/DAY/HOUR.jsonl.zst`. Each decompressed line is one JSON event in the same format as the live stream. Owner docs say recording starts **2026-04-18**, data is flushed hourly, and directories can be browsed by year/month/day. [Historical Replay](https://pumpapi.io/historical-replay)
3. **Unified REST action endpoint:** `POST https://api.pumpapi.io` with an `action` discriminator. Documented actions include buy/sell, create token, burn, claim cashback, wrap SOL, transfer, `getBalances`, `getTokenInfo`, migration, multi-action transactions, and Jito bundles. Wallet-signing actions accept `privateKey` or `apiKey`; local transaction mode exists for supported transaction actions. [Trade API](https://pumpapi.io/trade-api), [Actions](https://pumpapi.io/actions), [Jito Bundles](https://pumpapi.io/jito-bundles)
4. **Wallet/API-key helper:** `POST https://wallet.pumpapi.io`, optionally with `privateKey`; response example is `{apiKey, publicKey, privateKey}`. PumpAPI defines its `apiKey` as an **AES-256 encrypted form of the wallet private key**, not an ordinary account/usage key. [Trade API](https://pumpapi.io/trade-api)

### Data-stream request and response fields

There is no request payload: connect to the documented WebSocket. The documentation provides examples rather than a formal JSON Schema, so the exact contract is the set of example fields, conditional by event type.

**Common transaction/event fields shown:** `signature`, `action`, `poolId`, `mint`, `quoteMint`, `txSigner`, `tokenAmount`, `quoteAmount`, `tokensInPool`, `quoteInPool`, `price`, `marketCapQuote`, `name`, `symbol`, `uri`, `supply`, `poolFeeRate`, `pool`, `decimals`, `mintAuthority`, `freezeAuthority`, `tokenProgram`, `tokenExtensions`, `tradersInvolved`, `programsUsed`, `postBalances`, `addressLookupTables`, `priorityFee`, `block`, `timestamp`. [Stream](https://pumpapi.io/stream)

**Conditional fields documented in examples:**

- launch/trade state: `initialBuy` or `initialSell`, `vTokensInBondingCurve`, `vQuoteInBondingCurve`, `breakdown[{action,trader,tokenAmount,quoteAmount}]`;
- provenance/risk: `poolCreatedBy`, `burnedLiquidity`, `poolFeeRateAfterMigration`, `lockedLiquidityAfterMigration`, `mayhemMode`, `cashbackEnabled`, `platform`, `launchpadConfig`, `migrationThresholds`, `creatorFeeAddress`, `minPrice`, `maxPrice`, `curveType`, `binStep`;
- transfer event: `transfers[{from,to,amount,isSolana,mint,programsUsed}]`;
- fee claim: `creatorFeeAddress`, `feeMint`, `feeAmount`;
- balances: `postBalances[address].sol` and mint-keyed token balances. [Stream](https://pumpapi.io/stream)

**REST `getTokenInfo`:** request is `privateKey` or `apiKey`, `action:"getTokenInfo"`, `mint`, optional `quoteMint`, optional `poolId`. Docs describe response as current price in SOL per token, total supply, pool name, decimals, burned liquidity, and quote/token reserves; the example returns `price`, `pool`, `vTokensInBondingCurve`, `vQuoteInBondingCurve`, `supply`, `timestamp`. With multiple pools, the largest is returned unless a pool is selected. [Get Token Info](https://pumpapi.io/get-token-info)

**REST `getBalances`:** request is `action:"getBalances"`, `privateKey` or `apiKey`, and optional `publicKey`. Response is `solBalance` plus `tokenBalances` keyed by mint, with `balance`, `tokenProgram`, and conditional `frozen`; non-ATA token accounts are skipped. [Get Balances](https://pumpapi.io/get-balances)

### Auth, keys, fees, credits, and rate limits

- FAQ says no account, signup, or API key is needed for the Data Stream or Trade API. Transaction REST calls nevertheless need signing material: a private key, encrypted wallet-derived API key, or the documented local-transaction flow. [FAQ](https://pumpapi.io/FAQ), [Trade API](https://pumpapi.io/trade-api)
- Data Stream and Historical Replay are listed as **FREE**. No usage-credit or CU unit is documented. [Fees](https://pumpapi.io/fees)
- Trade buy/sell fee: **0.25% of trade volume**. Create, cashback, migration, wrap, `getTokenInfo`, `getBalances`, burn, and transfer are each listed at **10,000 lamports (0.00001 SOL)**. [Fees](https://pumpapi.io/fees)
- Published stream limit: **1 connection per IP**. No owner-documented REST requests/minute figure was found in the cited PumpAPI docs. [FAQ](https://pumpapi.io/FAQ)

### Methodology and freshness

PumpAPI does **not** expose a normalized risk score/report. Its owner guidance tells clients to evaluate raw fields:

- SPL Token: require `mintAuthority == None`; generally require `freezeAuthority == None` (owner notes a stablecoin exception). [Scam-token guide](https://pumpapi.io/tutorials/detect_scam_tokens)
- Token-2022: inspect `tokenExtensions`. Owner labels `memoTransfer`, `transferFeeConfig`, `transferHook`, `permanentDelegate`, `defaultAccountState`, `nonTransferable`, confidential-transfer/mint/fee extensions, `pausableConfig`, and `cpiGuard` high risk; it separately lists metadata/group/display extensions as safe. [Scam-token guide](https://pumpapi.io/tutorials/detect_scam_tokens)
- Pools: evaluate `poolCreatedBy`, `burnedLiquidity`, `poolFeeRate`, `poolFeeRateAfterMigration`, `lockedLiquidityAfterMigration`, and launchpad origin. The guide warns that token safety does not imply pool safety and supplies protocol-specific rules and exceptions. [Scam-pool guide](https://pumpapi.io/tutorials/detect_scam_pools)
- Live events include millisecond `timestamp` and `block`. Replay is hourly and owner docs say it is the exact stream format; bundle grouping in replay is only a heuristic (same token within roughly 1–3 ms), because bundles are not explicitly labeled. [Stream](https://pumpapi.io/stream), [Historical Replay](https://pumpapi.io/historical-replay)

### Terms

Terms say the service is unaffiliated with named protocols; users are responsible for legal compliance; crypto transactions are irreversible; the service is “as is/as available” without accuracy or availability warranties; liability is limited; and PumpAPI may modify/suspend/discontinue the service or revise terms. The page says last updated December 27, 2025. [Legal](https://pumpapi.io/legal)

### Distinct value relative to GoPlus

Based only on owner-published surfaces, PumpAPI adds **transaction-level, protocol-specific market telemetry** rather than another normalized scanner: live creates/trades/transfers/liquidity changes, pool provenance, post-transaction balances, bonding-curve/pool reserves, DEX fee settings, migration settings, and an hourly downloadable replay. GoPlus instead returns a mint-keyed security snapshot. PumpAPI is therefore useful for low-latency monitoring and custom pool/Token-2022 rules; it is not a drop-in replacement for GoPlus’s holder/LP-holder, malicious-authority, DEX aggregation, and trusted-token fields. [PumpAPI Stream](https://pumpapi.io/stream), [GoPlus Solana endpoint](https://docs.gopluslabs.io/reference/solanatokensecurityusingget)

## 2. RugCheck

### Exact documented API surfaces

The owner-operated Swagger 2.0 contract uses host `api.rugcheck.xyz`, base path `/`, and describes token scoring “across multiple markets.” [Swagger UI](https://api.rugcheck.xyz/swagger/index.html), [Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json)

**Public GET:**

- `/ping`
- `/v1/domains` (`page`, `limit`, `verified`), `/v1/domains/lookup/{id}`
- `/v1/leaderboard` (`page`, `limit`), `/v1/search` (`q`, `limit`, `maxScore`, `page`), `/v1/maintenance`
- `/v1/stats/analytics` (`window`), `/v1/stats/new_tokens`, `/v1/stats/recent` (`window`, `limit`), `/v1/stats/rugs/stream`, `/v1/stats/rugs/ticker` (`limit`), `/v1/stats/rugs/top-liquidity` (`limit`), `/v1/stats/trending`, `/v1/stats/verified`
- `/v1/tokens/{id}/image`, `/metadata`, `/insiders/graph`, `/insiders/networks`, `/votes`
- `/v1/tokens/{id}/report` with optional boolean `refresh`
- `/v1/tokens/{id}/report/summary` with optional `cacheOnly` string and boolean `refresh`.

**JWT API-key protected:**

- `POST /v1/bulk/tokens/report` and `/summary`, body `{tokens: string[], cacheOnly: boolean}`
- `GET /v1/tokens/verified` (`cursor`, `limit`)
- `GET /v1/tokens/{id}/lockers` and `/lockers/flux`
- `POST /v1/tokens/{id}/report` (report suspicious token), `/vote`
- `POST /v1/tokens/verify`, `/verify/eligible`, `/verify/transaction`.

Authentication is `Authorization` header under `ApiKeyAuth`; the contract description calls it a **JWT token**. [Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json)

### Report request and response fields

**Summary:** `GET /v1/tokens/{mint}/report/summary`; response schema is:

- `mint`, `tokenProgram`, `tokenType`, `risks[]`, `score`, `score_normalised`, `lpLockedPct`, optional `error`;
- each risk: `name`, `value`, `description`, `score`, `level`.

**Full report:** `GET /v1/tokens/{mint}/report`; the Swagger contract does not attach a 200-response schema. A live response from that documented owner endpoint returned these top-level fields: `mint`, `tokenProgram`, `creator`, `creatorBalance`, `token`, `token_extensions`, `tokenMeta`, `topHolders`, `freezeAuthority`, `mintAuthority`, `risks`, `score`, `score_normalised`, `fileMeta`, `lockerOwners`, `lockers`, `lockerScanStatus`, `markets`, `totalMarketLiquidity`, `totalStableLiquidity`, `totalLPProviders`, `totalHolders`, `price`, `rugged`, `tokenType`, `transferFee`, `knownAccounts`, `events`, `verification`, `validation`, `graphInsidersDetected`, `insiderNetworks`, `detectedAt`, `creatorTokens`, `launchpad`, `deployPlatform`. Nested examples included `token.{mintAuthority,supply,decimals,isInitialized,freezeAuthority}`, `tokenMeta.{name,symbol,uri,mutable,updateAuthority}`, `transferFee.{pct,maxAmount,authority}`, and verification metadata. Because these fields are not schema-bound in Swagger, consumers should treat them as observed owner output rather than a versioned contract. [Documented report endpoint](https://api.rugcheck.xyz/v1/tokens/So11111111111111111111111111111111111111112/report), [Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json)

### Auth, keys, fees, credits, and rate limits

- Single-token GET report and summary are marked public; no funded wallet is part of either request.
- `refresh=true` is explicitly described as **“Force report regeneration (paid API keys only).”** Bulk report/summary requires the JWT API key. [Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json)
- Owner Swagger does **not** document card requirements, free-key issuance, price, trial terms, credits/CUs, quota units, or the rate-limit time window.
- The public owner report endpoint returned `X-Rate-Limit-Limit: 15` and `X-Rate-Limit-Remaining`, while Swagger documents HTTP 429. This establishes a live limit counter of 15 for the tested public report route, but **not its window or whether it is universal**. [Documented report endpoint](https://api.rugcheck.xyz/v1/tokens/So11111111111111111111111111111111111111112/report), [Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json)

### Methodology and freshness

- Owner Swagger says RugCheck provides token scoring across multiple markets and is intended to detect scams and provide trading signals. It exposes `risks[]` with per-risk `score`/`level`, aggregate `score` and `score_normalised`, holder/liquidity/locker/market/insider fields, and `rugged`. [Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json)
- The contract does **not** publish the scoring formula, risk weights, data sources, chain commitment, cache TTL, or refresh schedule.
- Freshness controls are explicit but incomplete: summary has `cacheOnly`; both report routes have `refresh`, but forced regeneration is paid-key-only. Full owner output includes `detectedAt`; the stats token model includes `createAt` and `updatedAt`. These are record timestamps, not a documented freshness SLA. [Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json)

### Terms and repository status

No API-specific terms, acceptable-use policy, paid-key terms, or data-retention license are included in the owner Swagger contract. The public `rugcheck-xyz` GitHub organization exposed only a `.github` profile repository during this check, not an API implementation or versioned schema repository; therefore no implementation-level methodology claim is made from source code. [RugCheck GitHub organization](https://github.com/rugcheck-xyz), [Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json)

### Distinct value relative to GoPlus

RugCheck’s documented/observed report adds an **opinionated aggregate score and explicit risk list**, `rugged`, LP-lock percentage/locker data, total market/stable liquidity, LP-provider and holder totals, creator balance/tokens, verification/validation, deploy/launchpad context, and insider graph/network indicators. GoPlus’s Solana endpoint instead exposes lower-level authority and Token-2022 controls plus DEX/holder/LP-holder structures and malicious-address flags. RugCheck’s distinct value is the score/risk/insider/locker/creator synthesis; the tradeoff is that its scoring formula and cache/refresh SLA are not published in the cited owner contract. [RugCheck report](https://api.rugcheck.xyz/v1/tokens/So11111111111111111111111111111111111111112/report), [RugCheck Swagger](https://api.rugcheck.xyz/swagger/doc.json), [GoPlus Solana endpoint](https://docs.gopluslabs.io/reference/solanatokensecurityusingget)

## 3. GoPlus baseline used for comparison

**Endpoint:** `GET https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=<mint>`; optional `Authorization: Bearer <token>`. Response wrapper: `code`, `message`, and `result` keyed by contract/mint address. [Solana reference](https://docs.gopluslabs.io/reference/solanatokensecurityusingget)

**Documented result fields:**

- authority/control: `balance_mutable_authority`, `closable`, `default_account_state`, `default_account_state_upgradable`, `freezable`, `metadata_mutable`, `mintable`, `none_transferable`, `transfer_fee`, `transfer_fee_upgradable`, `transfer_hook`, `transfer_hook_upgradable`;
- identity/reputation: `creators`, `metadata`, `trusted_token`;
- markets/ownership: `dex`, `holders`, `lp_holders`.

Authority structures include `status` and `authority[]` entries with address/malicious-address indicators. DEX entries include identity/type, fee rate, price, TVL, LP amount/burn percent, open time, and day/week/month price-volume structures; holder structures include addresses, balances/percentages, tags, NFT/listing/locked details, and malicious-address flags as defined in the OpenAPI schema. [Solana reference](https://docs.gopluslabs.io/reference/solanatokensecurityusingget)

**Commercial/access baseline:** owner support says the API is free at **30 calls/minute** and directs users needing more to apply for an access token. The API overview describes the services as free, real-time, dynamic, and automated; the Solana response itself has no observation timestamp or freshness SLA. [Support](https://docs.gopluslabs.io/reference/support), [API Overview](https://docs.gopluslabs.io/reference/api-overview)

## Bottom line

- For a zero-wallet, zero-credit pipeline, **PumpAPI is eligible only through its free WebSocket/replay surfaces**. Its fee-bearing REST information call is ineligible. Its distinct contribution is immediate DEX/transaction/pool telemetry for custom rules, not a scored risk verdict.
- **RugCheck’s public single-token GET report and summary are mechanically eligible** without wallet/key/credits, but strict production adoption still has unresolved owner-documentation gaps: rate window, score formula, cache TTL, terms, and whether continued public use is guaranteed. Do not use paid refresh or key-protected bulk under the stated constraints.
- Relative to GoPlus, **PumpAPI supplies event context and replay**, while **RugCheck supplies scoring plus insider/locker/creator synthesis**. Neither owner surface should be represented as having a documented accuracy guarantee or freshness SLA.
