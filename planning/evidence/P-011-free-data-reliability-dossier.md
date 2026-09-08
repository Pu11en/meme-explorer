# P-011 — Free-only reliability dossier

**Audited:** 2026-08-26 UTC  
**Scope:** reusable, no-card, no-funded-wallet, non-metered sources for a Pump.fun observation recorder.  
**Evidence:** 15-agent primary-source research/verification workflow, direct documentation, repository inspection, safe no-key probes, and a 70-second dual-stream live comparison.

## Executive conclusion

There is no free source with a contractual completeness, latency, uptime, retention, or schema-stability guarantee.

The strongest free prototype stack is:

1. **PumpAPI live stream** as the broad real-time event firehose.
2. **Local raw event log** written immediately, because provider history is not guaranteed.
3. **PumpAPI replay** as delayed best-effort backfill, not guaranteed recovery.
4. **PumpPortal creation stream** as a second free launch detector for comparison only.
5. **Official Pump/PumpSwap IDLs + free Solana RPC** for sampled/finalized verification, not as a production event backend.
6. **RugCheck anonymous summary/report** as optional named-risk context.
7. **DEX Screener** for later indexed pair snapshots.
8. **Jupiter keyless/free route quote** for later amount-specific route checks.
9. **GeckoTerminal** only for low-rate manual candle enrichment, not frequent polling.

Helius and Birdeye are excluded from this strict MVP because their $0 plans are still metered by credits/compute units. PumpPortal trade/account streams are excluded because they require a funded wallet and per-message charges.

## What PumpAPI actually supplied in a local live test

A no-key connection to `wss://stream.pumpapi.io/` worked. One observed buy event included:

- action (`buy`)
- signature, block, and timestamp
- transaction signer and all traders involved
- mint, quote mint, pool, and pool ID
- token amount and quote amount
- price and market cap in the quote asset
- total supply and decimals
- tokens and quote held in the pool
- virtual quote amount
- name, symbol, and metadata URI
- mint/freeze authorities
- token program and Token-2022 extensions
- priority fee
- post-transaction wallet balances
- pool fee rate, pool creator, liquidity-burn label
- creator-fee address
- mode/cashback flags
- transaction breakdown

The stream also produced transfer, create, sell, claim-creator-fee, migrate, create-pool, add-liquidity, and remove-liquidity actions during the benchmark.

## Measurable free field inventory

### Common event identity and timing

- action/event type
- transaction signature
- block/slot-like position where supplied
- provider timestamp and local receipt time
- transaction signer
- mint, quote mint, pool, and pool ID

### Creation observations

- name, symbol, metadata URI
- creator/signer and creator-fee address
- initial buy
- price and market cap in quote units
- total supply, decimals, token program and extensions
- mint/freeze authorities
- initial real/virtual pool or bonding-curve quantities
- mode, cashback and fee settings

### Every reported buy/sell

- direction
- trader(s)
- token amount
- quote/SOL amount
- transaction breakdown
- price and quote-market-cap estimate
- token/quote pool amounts after the transaction
- virtual quote amount
- post-transaction balances for touched wallets/accounts
- priority fee and programs used when supplied

### Pool and lifecycle observations

- pool creation
- liquidity added/removed
- migration action and destination pool when supplied
- pool reserves, fee rate, pool creator, and liquidity-burn label where supplied
- creator-fee and cashback claims

### Free optional snapshots

- RugCheck named risk entries, authorities, LP-lock percentage, and provider score—with the score treated as an opaque opinion
- DEX Screener indexed price, liquidity, transaction counts, volume, price change, FDV and nullable market cap
- Jupiter route/no-route, expected output and price impact for an explicit amount
- GeckoTerminal indexed OHLCV at low polling frequency
- public Solana transaction, logs, balances, token supply and best-effort address history
- fetched metadata JSON/media/social fields with fetch status, byte hash and mutability context

### Explicitly not measurable as fact

- one human behind multiple wallets
- insider, bot or sybil identity
- organic intent or true community quality
- real-world creator identity
- future success or buy quality

The full source-by-source field semantics and manipulation limits remain in [`P-005-signal-candidates.md`](P-005-signal-candidates.md).

## 70-second PumpAPI versus PumpPortal comparison

Both free streams were connected concurrently.

### PumpAPI activity received

- 20,371 transfers
- 11,777 buys
- 7,152 sells
- 45 creates
- 12 creator-fee claims
- 5 migrations
- 9 pool creations
- 43 liquidity adds
- 50 liquidity removals

### Creation-event comparison

- PumpAPI creates: 45
- PumpPortal creates: 41
- Shared mints: 40
- PumpAPI-only mints: 5
- PumpPortal-only mints: 1

For the 40 shared creations, PumpAPI usually arrived before PumpPortal. The observed PumpAPI-minus-PumpPortal receipt deltas ranged roughly from **−466 ms to +11 ms**; most were around 50–140 ms earlier. This is one short comparison, not a stable latency guarantee.

The disagreement proves neither feed can be treated as complete truth on its own. A longer benchmark must identify whether non-shared mints reflect venue coverage, filtering, parser differences, missed delivery, or timing boundaries.

## PumpAPI limitations discovered

- Owner docs permit one connection per IP and say filtering is client-side.
- “Every event” is a provider claim, not independently proven completeness.
- The action set is open-ended rather than a closed versioned enum.
- No distinct PumpAPI `complete` action was documented; completion and migration must not be conflated.
- Replay uses hourly `.jsonl.zst` files and begins in April 2026.
- Replay files are large: owner estimate around 400 MB compressed / 2 GB decompressed per hour; observed listings included roughly 222–642 MB files.
- One expected historical replay hour returned 404 during the audit.
- Replay appears only after an hour closes, so it cannot immediately repair a current-hour disconnect.
- Live and replay schemas differ (`localTimestamp` is replay-only; older samples used `txType` while current live uses `action`).
- No published checksums, completeness manifest, retention promise, gap report, schema compatibility contract, or SLA.
- Terms describe the service as as-is/as-available and do not clearly grant data redistribution rights. Free technical access is not a data license.

## PumpPortal free lane

Free and retained only as a secondary observer:

- `subscribeNewToken`
- `subscribeMigration`

Excluded:

- `subscribeTokenTrade`
- `subscribeAccountTrade`

Those excluded streams require an API key, linked wallet funded with at least 0.02 SOL, and 0.01 SOL per 10,000 events.

Additional limitations:

- processed commitment can roll back;
- live-only, no replay;
- no stable output schema or completeness promise;
- anonymous access worked but is not clearly promised by the documented keyed URL;
- PumpSwap anonymous coverage was not established;
- terms do not clearly grant commercial redistribution.

## Free Solana verification lanes

### Solana public RPC

Useful for sampled verification and best-effort backfill:

- `logsSubscribe`
- `getTransaction`
- `getSignaturesForAddress`
- `getTokenSupply`
- account reads

Limitations:

- Solana explicitly says public endpoints are not intended for production;
- rates can change or traffic can be blocked;
- subscriptions have no replay cursor;
- history may be pruned and `getTransaction` may return null;
- `getTokenLargestAccounts` repeatedly returned HTTP 429 with a method limit of zero during research;
- token-account results are not beneficial-owner identities.

### Other $0 RPC plans

Potential development fallbacks, subject to signup checks:

- Alchemy Free advertises 30M CUs/month, WebSockets, and full archive classification, but is quota-metered and has no custom SLA.
- Chainstack Developer advertises $0/no card, 3M request units/month, one node, and WebSockets; free archive is not included.
- Ankr Freemium requires signup/key, is HTTPS-only, and Solana history is documented as roughly 16 hours.
- Helius Free and Shyft Free are quota-metered and excluded under the strict non-metered rule.
- QuickNode is a temporary trial, not ongoing free access.

Because the user requires strictly free and non-metered data, these are not MVP foundations.

## Free enrichment lanes

### RugCheck

Anonymous single-token report, summary, metadata, and insider graph/network reads were exposed without Swagger authentication and safe calls returned HTTP 200.

Use only as optional context:

- store named risk entries and raw evidence;
- do not treat the aggregate score, “rugged,” “insider,” or similar labels as ground truth;
- full-report HTTP 200 has no stable Swagger response schema;
- refresh is paid and lockers require authentication;
- no free-access continuity, freshness, or SLA promise.

### DEX Screener

Free unauthenticated indexed pair endpoints provide later:

- price
- transactions
- volume
- price change
- liquidity
- FDV
- nullable market cap

Limitations:

- listing requires a pool and at least one transaction;
- no creation truth, Pump curve completion, migration truth, historical candles, or executable quotes;
- no indexing-delay SLA;
- commercial-use/resale terms require review.

### Jupiter

Keyless access currently supports low-rate prototype quotes; owner docs identify 0.5 RPS keyless access and a $0 API-key plan at 1 RPS.

Use later for:

- route exists / no route
- amount-specific expected output
- route plan and price impact

A quote is not execution and availability depends on indexing, route support, mint, amount, options, and request time. Signup/card rules for the keyed free plan must be verified before use; keyless is the strictest MVP lane.

### GeckoTerminal

Keyless pool/token/OHLCV access exists, but current owner materials conflict between roughly 10 and 30 calls/minute, probes hit HTTP 429, and keyless access is described as evaluation-oriented. Suitable only for occasional manual enrichment.

## Holder and identity gaps

No strict-free reliable provider was found for complete owner concentration or human identity.

Possible raw derivations are limited:

- top token accounts are not top people;
- one person can use many wallets;
- exchanges/custodians can combine many people;
- public RPC may block holder-heavy methods;
- full Token and Token-2022 account enumeration is expensive and requires careful vault/burn/pool exclusions;
- creator address history is not a complete Pump creator index;
- wallet age means earliest retrievable activity, not actual creation;
- bot, sybil, insider, and common-control labels remain heuristics.

## Metadata and social gaps

Free local fetching can record:

- name, symbol, URI
- metadata JSON/media fetch status
- description, image, website, and social links when present
- update authority and mutability
- content hashes and timestamps

It cannot prove:

- project legitimacy
- social-account ownership
- real-world creator identity
- community authenticity
- that mutable content will remain unchanged

A backend metadata fetcher must defend against SSRF, redirects, private-network addresses, DNS rebinding, oversized/decompression payloads, hostile SVG/HTML, and misleading MIME types.

## Open-source reuse audit

### `Solana-Trading-Lab/pump.fun.meter`

- MIT licensed
- active August 2026
- includes PumpAPI live stream, reconnection, replay, filters, aggregators, and cache code
- no detected tests in the shallow repository audit
- initial `npm ci` failed because `.npmrc` uses `${REGISTRY}` and the environment variable was absent
- a second install with the public npm registry also failed: the lockfile requested unavailable `ioredis-typed@^1.0.128`
- therefore it is **not currently buildable as checked in**; individual MIT source modules may be studied, but the repository is not a drop-in foundation

### `Solana-Trading-Lab/replayer-rust`

- focused PumpAPI replay downloader
- no detected license in the audit
- cannot be copied into the project without permission/license clarification

### `streamingfast/substreams-solana-pump-fun`

- useful Pump decoder reference
- no detected license in the audit
- cannot be treated as reusable code without permission/license clarification

### `nirholas/pump-fun-sdk`

- broad SDK/decoder/tooling repository
- repository license says all rights reserved
- cannot be copied or incorporated

### Smaller trackers

Several tracker/dashboard repositories were unlicensed, minimally adopted, incomplete, or committed unsafe artifacts such as `.env`. They remain idea references only.

## Recommended free-only architecture

Do not copy an entire tracker and do not write a Pump chain indexer first.

Build a small adapter around PumpAPI:

1. one WebSocket connection;
2. append every raw frame immediately to a local log;
3. create tolerant versioned parsers for each action;
4. identify events by signature plus exact event/breakdown position where available;
5. deduplicate without collapsing repeated actions in one transaction;
6. record disconnects and sequence gaps;
7. request completed replay hours and compare signatures;
8. retain unresolved gaps explicitly;
9. compare creation events with PumpPortal as a secondary observer;
10. sample/finalize important transactions through free Solana RPC;
11. add RugCheck, DEX Screener, Jupiter, or metadata fetching as optional adapters that may fail independently;
12. display source, occurred time, received time, confirmation state, and missing reason for every fact.

## Reliability benchmark before calling the source dependable

Run continuously for at least 24 hours before implementation claims, then longer before broader use:

- capture PumpAPI and PumpPortal concurrently;
- independently sample official Pump program logs through Solana WSS;
- compare exact signatures and event positions;
- record duplicates, feed-only events, disconnects, reconnect recovery, and finality rollbacks;
- verify completed PumpAPI replay hours, publication delay, schema changes, corrupted files, and missing files;
- compare live/replay overlap by signature;
- measure per-event receipt deltas without calling them absolute chain latency;
- fingerprint field names and types per action;
- preserve raw payload hashes and source/access-term snapshots;
- never turn HTTP 200-empty, 404-not-indexed, 429, timeout, parse failure, and valid no-route into one generic missing value.

## Recommendation status

**Recommended for a local/manual Harness MVP:** PumpAPI + local raw log + replay reconciliation + secondary PumpPortal creation comparison.

**Not proven:** production reliability, complete history, redistribution rights, stable schema, or predictive usefulness.

## Raw and supporting evidence

- [Live stream comparison JSON](P-011-live-stream-comparison.json)
- [Open-source license/build audit](P-011-open-source-audit.md)
- [`research/live-historical-pump-streams-audit.md`](../../research/live-historical-pump-streams-audit.md)
- [`research/free-solana-rpc-audit-2026-08-26.md`](../../research/free-solana-rpc-audit-2026-08-26.md)
- [`research/free-holders-creator-risk-enrichment-audit-2026-08-26.md`](../../research/free-holders-creator-risk-enrichment-audit-2026-08-26.md)
- [`research/free-price-liquidity-routing-migration-audit.md`](../../research/free-price-liquidity-routing-migration-audit.md)
- [`research/free-metadata-social-wallet-audit.md`](../../research/free-metadata-social-wallet-audit.md)
- [`research/free-only-reliability-benchmark-audit.md`](../../research/free-only-reliability-benchmark-audit.md)

## Primary source index

- PumpAPI: [stream](https://pumpapi.io/stream) · [historical replay](https://pumpapi.io/historical-replay) · [fees](https://pumpapi.io/fees) · [FAQ](https://pumpapi.io/FAQ) · [legal](https://pumpapi.io/legal)
- PumpPortal: [real-time API](https://pumpportal.fun/data-api/real-time/) · [fees](https://pumpportal.fun/fees/) · [FAQ](https://pumpportal.fun/FAQ/) · [legal](https://pumpportal.fun/legal/)
- Official Pump: [pinned repository](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333) · [Pump IDL](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json) · [PumpSwap IDL](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump_amm.json)
- Solana: [public clusters and limits](https://solana.com/docs/references/clusters) · [`logsSubscribe`](https://solana.com/docs/rpc/websocket/logssubscribe) · [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction) · [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress)
- RugCheck: [owner Swagger](https://api.rugcheck.xyz/swagger/doc.json)
- DEX Screener: [API reference](https://docs.dexscreener.com/api/reference) · [terms](https://docs.dexscreener.com/api/api-terms-and-conditions)
- Jupiter: [portal setup](https://developers.jup.ag/docs/portal/setup) · [plans](https://developers.jup.ag/docs/portal/plans) · [rate limits](https://developers.jup.ag/docs/portal/rate-limits)
- GeckoTerminal/CoinGecko: [authentication](https://apiguide.geckoterminal.com/authentication) · [FAQ](https://apiguide.geckoterminal.com/faq) · [keyless guidance](https://docs.coingecko.com/docs/keyless-public-api)
