# Independent audit — live and historical Pump streams (FREE-ONLY prototype)

**Audit time:** 2026-08-26 UTC  
**Method:** owner documentation, immutable official-repository revisions, and bounded no-key network probes. “Observed” means available during this audit only; it does not imply an SLA, completeness, retention, or future availability. A service is excluded from FREE-ONLY when it needs a funded wallet, paid balance/package, card, temporary trial, or metered credit/message balance.

## Corrected decision

- **PumpAPI is the strongest turnkey candidate for both live and replay in the audited set:** its owner pages currently list both as free/no-signup/no-key, and both worked without credentials. It is **not** a verified production-reliable foundation: there is no SLA, schema guarantee, completeness guarantee, or retention commitment, and one replay hour was actually missing.
- **Do not state globally that PumpAPI is “the only” qualifying source.** The audit establishes only that it is the only audited turnkey provider found with both observed anonymous live access and replay. Global uniqueness is not provable from these checks.
- **PumpPortal is not a FREE-ONLY full trade source.** Creation and migration are listed free and worked anonymously in bounded tests, but buy/sell subscriptions require a key plus a wallet funded with at least 0.02 SOL and are charged 0.01 SOL per 10,000 messages.
- **Solana public RPC is a no-key raw-chain fallback, not a production archive or hosted decoded Pump feed.** It can support a best-effort prototype, but Solana explicitly says its public endpoints are not intended for production.
- **PumpDev was additionally found and tested.** Its anonymous live WebSocket worked, but the owner page meters the anonymous tier at 10,000 trade messages/month and five subscriptions, and no historical replay was found. It does not satisfy the stated unmetered full live+history rule.

## Verified claims

### PumpAPI live

- Owner docs publish `wss://stream.pumpapi.io/`, say filtering is client-side because the server sends every event, require a single shared connection, and the FAQ makes the stricter rule **one connection per IP**. The docs explicitly require reconnect logic.
- Fees/FAQ currently label Data Stream and Historical Replay **FREE** and say no account, signup, or API key is required.
- A fresh anonymous WebSocket connected and immediately delivered events during this audit. One observed transfer had top-level `signature`, `action`, `txSigner`, `transfers`, `postBalances`, `addressLookupTables`, `priorityFee`, `block`, and `timestamp`; each transfer carried its own `programsUsed`. This corrects the draft’s implication that top-level `programsUsed` is universal.
- Current docs describe the action glossary as `transfer`, `create`, `buy`, `sell`, `migrate`, `createPool`, `add`, `remove`, `claimCashback`, **“etc.”** Separate samples also use `claimCreatorFees`. This is not a closed/versioned enum. No distinct PumpAPI `complete` action is documented; protocol completion must not be inferred solely from a missing provider action.
- Create, buy/sell, migrate, pool, liquidity, transfer, cashback, and creator-fee examples expose rich but event-specific shapes. They are examples and field descriptions, not a fixed versioned schema. Code must tolerate additive/optional fields and retain raw payloads.

Primary sources: [stream](https://pumpapi.io/stream), [FAQ](https://pumpapi.io/FAQ), [fees](https://pumpapi.io/fees), `wss://stream.pumpapi.io/`.

### PumpAPI historical replay

- Owner docs say replay starts on **2026-04-18**, uses hourly `YEAR/MONTH/DAY/HOUR.jsonl.zst` objects, and estimates about 400 MB compressed / 2 GB decompressed per hour.
- Anonymous directory listings and archive bytes worked. At audit time, 3,126 objects were listed from `2026/04/18/00.jsonl.zst` through `2026/08/26/06.jsonl.zst`; bounded decompression produced valid JSONL.
- Replay is **not literally identical** to live: the replay page itself says archives add `localTimestamp`, which live lacks. An observed launch-day replay used `txType`, while current live PumpAPI samples use `action`, proving schema evolution must be handled.
- The archive is **not observed gap-free**: `2026/05/09/19.jsonl.zst` was absent/404, leaving 3,126 listed objects for 3,127 hourly positions through the audit cutoff.
- The owner example mapping 00:00–01:00 to `/01.jsonl.zst` is off by one. Observed `/00` began at receipt time 00:00 and was uploaded after 01:00; treat the key as the starting UTC receipt hour. Chain timestamps can fall outside that receipt bucket.
- Listed objects were roughly 222–642 MB compressed/hour. The tested server ignored HTTP Range and returned a full object, so replay has substantial bandwidth/storage/compute cost even though provider access is free.

Primary sources: [historical replay](https://pumpapi.io/historical-replay), [archive index](https://replay.pumpapi.io/2026/), [missing object](https://replay.pumpapi.io/2026/05/09/19.jsonl.zst).

### PumpAPI terms and reliability boundary

- Terms are dated **2025-12-27**, disclaim Pump affiliation, provide the service “as is” and “as available,” disclaim accuracy/availability, and permit modification, suspension, or discontinuance at any time.
- No reviewed owner page publishes an uptime/completeness SLA, retention/deletion policy, schema compatibility promise, checksum/manifest/gap report, or explicit redistribution/data-license grant.
- Therefore PumpAPI is verified as **presently accessible**, not reliable, complete, immutable, or licensed for redistribution.

Primary source: [PumpAPI legal](https://pumpapi.io/legal).

### PumpPortal

- Owner docs list methods `subscribeNewToken`, `subscribeMigration`, `subscribeTokenTrade`, and `subscribeAccountTrade`; token/account subscriptions use `keys: [address, ...]`.
- Creation and migration are marked free. Token/account trade streams require a PumpPortal key, a linked wallet funded with at least 0.02 SOL, and charge 0.01 SOL per 10,000 received messages. That fails FREE-ONLY for buy/sell.
- Operational docs say one WebSocket connection, fewer than 200 subscription messages/second, no more than 5,000 addresses in a single message, and hourly-expiring temporary bans. FAQ says data is at `processed` commitment.
- Owner FAQ says it supplies live trading data only and directs historical users to RPC/another source.
- The documented URL template includes `?api-key=...`, but anonymous `wss://pumpportal.fun/api/data` connected during this audit. Anonymous `subscribeNewToken` returned an acknowledgement and live Pump creation events; an empty-key `subscribeMigration` returned an acknowledgement. This is an observation, not a contractual no-key promise.
- An anonymous `subscribeTokenTrade` probe was rejected with a message requiring an API key funded with at least 0.02 SOL, matching the owner docs. A bogus key warned that PumpSwap data would not be streamed while still emitting Pump creation events; anonymous PumpSwap coverage is therefore unsupported.
- An observed anonymous creation payload had: `signature`, `mint`, `traderPublicKey`, `txType`, `initialBuy`, `solAmount`, `bondingCurveKey`, `vTokensInBondingCurve`, `vSolInBondingCurve`, `marketCapSol`, `name`, `symbol`, `uri`, `is_mayhem_mode`, and `pool`. Owner docs do not publish a stable/versioned response schema.
- Terms grant a single personal, limited, non-transferable, revocable license; restrict unauthorized copying/distribution and reverse engineering; disclaim accuracy/currentness/availability; and allow access restrictions. Do not infer redistribution rights from free access.

Primary sources: [real-time docs](https://pumpportal.fun/data-api/real-time/), [fees](https://pumpportal.fun/fees/), [FAQ](https://pumpportal.fun/FAQ/), [legal](https://pumpportal.fun/legal/), `wss://pumpportal.fun/api/data`.

### Official Pump / PumpSwap artifacts

Official repository `main` resolved at audit time to immutable commit [`9c82f61cb711b044a17f770ab8ce9f9bdf78f333`](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333). Pin this SHA; `main` is mutable, the repository had no tags, and IDL metadata remaining at `0.1.0` is not a compatibility guarantee.

- Pump address: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`.
- PumpSwap address: `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`.
- Safe no-key `getAccountInfo` calls observed both as executable upgradeable programs. This does not cryptographically prove the checked-in IDLs match deployed binaries.
- Pump `CreateEvent` fields exactly match the draft: `name,symbol,uri,mint,bonding_curve,user,creator,timestamp,virtual_token_reserves,virtual_sol_reserves,real_token_reserves,token_total_supply,token_program,is_mayhem_mode,is_cashback_enabled,quote_mint,virtual_quote_reserves`.
- Pump `TradeEvent`, `CompleteEvent`, and `CompletePumpAmmMigrationEvent` field lists in the draft match the pinned IDL.
- PumpSwap `BuyEvent` and `SellEvent` field lists in the draft match the pinned IDL. The draft omitted `CreatePoolEvent`’s exact fields; its presence is verified in the IDL.
- Neither IDL defines a generic SPL/System transfer event. Transfer reconstruction requires the enclosing transaction’s outer/inner instructions and pre/post SOL/token balances.

Primary sources: [Pump IDL pinned](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json), [PumpSwap IDL pinned](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump_amm.json), [Pump README pinned](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md), [PumpSwap README pinned](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_README.md).

### Solana public RPC

- Official public mainnet HTTP/WSS RPC is available without an API key or funded wallet for reads. During this audit, `getHealth` worked and one shared WSS connection accepted separate `logsSubscribe` calls for both Pump program IDs and delivered a notification.
- `logsSubscribe` `mentions` accepts exactly one pubkey per subscription; use two subscriptions. Commitment is `processed|confirmed|finalized`, default `finalized`; notifications contain `context.slot` and `value.signature`, `err`, and `logs`.
- Public mainnet limits currently documented are 100 requests/10s/IP, 40 requests/10s/IP for one method, 40 concurrent connections/IP, 40 new connections/10s/IP, and 100 MB/30s. Solana says limits can change, high-traffic clients may be blocked, and public RPC is **not intended for production applications**.
- Best-effort history uses `getSignaturesForAddress` (newest-first; `before`, `until`, `limit`, `commitment`, `minContextSlot`) followed by `getTransaction`. `getTransaction` may return null. No public-endpoint archival-retention, replay, completeness, or uptime SLA is promised.
- Store raw logs/signatures/slots, pin the IDL SHA, and reconcile processed observations to finalized transactions. WebSocket logs alone have no replay cursor and cannot guarantee gap-free delivery.

Primary sources: [clusters/public endpoints](https://solana.com/docs/references/clusters), [logsSubscribe](https://solana.com/docs/rpc/websocket/logssubscribe), [getSignaturesForAddress](https://solana.com/docs/rpc/http/getsignaturesforaddress), [getTransaction](https://solana.com/docs/rpc/http/gettransaction), [transaction JSON](https://solana.com/docs/rpc/json-structures/transactions).

## Additional provider exclusions

- **PumpDev:** anonymous `wss://pumpdev.io/ws` connected, acknowledged `subscribeNewToken`, and delivered a creation event. Owner pricing describes anonymous `$0` as five subscriptions and **10,000 trade messages/month**; the free account is 25 subscriptions/50,000 messages. Because this requirement rejects metered usage balances and because no replay was found, it is excluded from the full free live+historical design. Source: [PumpDev Data API](https://pumpdev.io/data-api/).
- **PumpPortal full trades:** excluded for funded-wallet and per-message SOL charges.
- **QuickNode:** excluded because the no-card offer is a one-month, 10M-credit trial with Streams limits, not ongoing unmetered free service. Sources: [pricing](https://www.quicknode.com/pricing), [trial](https://support.quicknode.com/articles/5387074982-1-month-free-trial), [Streams billing](https://www.quicknode.com/docs/streams/billing).
- **Helius:** excluded because service usage is credit-metered/plan-based; a free credit allowance is still a metered balance under this requirement. Sources: [credits](https://www.helius.dev/docs/billing/credits), [pricing](https://www.helius.dev/pricing).
- **Undocumented pump.fun website/private endpoints and scraping:** rejected. Official Pump artifacts are programs/IDLs, not a hosted decoded event API. Do not elevate reverse-engineered private traffic into a production contract.

## Prototype acceptance contract

1. Put PumpAPI behind a replaceable adapter; use one shared upstream connection and local fan-out.
2. Persist raw events before decoding; include provider, receipt time, signature, block/slot when present, schema fingerprint, and parser version.
3. Implement reconnect/backoff, signature/event dedupe, live/replay overlap checks, and explicit gap states.
4. Mirror required PumpAPI archive hours while available; enumerate expected UTC hours and record missing objects. Do not assume retention.
5. Use separate tolerant adapters for live and replay (`action` versus legacy `txType`, replay-only `localTimestamp`).
6. Independently reconcile correctness-critical records against finalized Solana transactions and the pinned official IDL.
7. Treat completion and migration separately: Pump `CompleteEvent` is curve completion; `CompletePumpAmmMigrationEvent` is migration. PumpAPI does not document a distinct `complete` action.
8. Do not expose or redistribute retained provider data until rights are confirmed. Do not describe any audited free endpoint as SLA-backed.
