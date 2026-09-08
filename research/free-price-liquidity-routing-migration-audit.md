# Free price, liquidity, routing, and migration data — independent audit

**Audited:** 2026-08-26 UTC  
**Scope:** FREE-ONLY production prototype. A source is excluded if it requires a funded wallet, paid or temporary-trial package, card, or metered credit/message balance. Rate limiting by itself is not a monetary balance. “Observed” means a bounded no-key request worked during this audit; it is not an SLA, completeness claim, or promise of future availability.

## Corrected finding

No single audited free source supplies canonical Pump curve state, gap-free trade history/OHLCV, indexed USD market data, and executable routing. A workable prototype must separate: (1) canonical Pump/PumpSwap state and events decoded from Solana, (2) optional PumpAPI live/replay convenience data, (3) indexed DEX Screener/GeckoTerminal snapshots and candles, and (4) amount-specific Jupiter routes. Public Solana RPC and every third-party source reviewed are best-effort and publish no relevant end-to-end production SLA.

## Verified claims

### PumpAPI (third party)

- Owner pages currently label Data Stream and Historical Replay **FREE**, no signup/key; anonymous live and archive access were observed in the repository’s same-date bounded audit. The stream documentation covers Pump, PumpSwap, Raydium, and Meteora events and examples include create/buy/sell/migrate/createPool/add/remove and rich reserve/market-cap fields. This can feed trades, reserve-derived price inputs, curve context, migration, and post-migration events. It does **not** document a candle endpoint; OHLCV must be aggregated from events/replay.
- Replay starts at documented/observed `2026-04-18`, uses hourly `.jsonl.zst`, and is resource-heavy (~400 MB compressed/hour by owner estimate). Live and replay are not schema-identical: replay adds `localTimestamp`, and observed historical/current samples used `txType` versus `action`.
- Availability is only observed. Owner terms say “as is/as available,” provide no uptime, completeness, schema, retention, correction, or redistribution guarantee, and allow suspension/discontinuance. One expected replay hour (`2026/05/09/19`) was observed missing. One connection per IP is the documented limit.

Sources: [stream](https://pumpapi.io/stream), [replay](https://pumpapi.io/historical-replay), [fees](https://pumpapi.io/fees), [FAQ](https://pumpapi.io/FAQ), [legal](https://pumpapi.io/legal).

### PumpPortal (third party)

- Owner docs mark only `subscribeNewToken` and `subscribeMigration` data as free. They state token/account trade subscriptions require an API key, a linked wallet funded with at least `0.02 SOL`, and cost `0.01 SOL / 10,000` messages/events. Those trade streams **fail** this FREE-ONLY definition.
- Anonymous new-token access and an empty-key migration acknowledgement were observed, but the documented URL includes an API key. A bogus key warned that PumpSwap data would not be streamed. Treat anonymous access and PumpSwap coverage as observations/unknowns, not contracts.
- The feed is live-only, at `processed` commitment, without historical replay, a versioned output schema, completeness guarantee, or SLA. The owner’s “typically <100 ms” New York claim is not a maximum latency promise.

Sources: [real-time API](https://pumpportal.fun/data-api/real-time/), [fees](https://pumpportal.fun/fees/), [FAQ](https://pumpportal.fun/FAQ/), [terms](https://pumpportal.fun/legal/).

### DEX Screener

- The owner’s unauthenticated pair/token/search REST APIs document `priceNative`, nullable `priceUsd`, rolling transactions/volume/price change, nullable liquidity, nullable FDV, and nullable market cap; relevant pair/search/token endpoints are limited to 300 requests/minute. A no-key Solana token-pairs request returned HTTP 200 during this audit.
- It is useful only after indexing. Owner listing rules require a liquidity pool and at least one transaction, creating a documented pre-pool blind spot. The official reference has no historical OHLCV endpoint, Pump curve account/completion field, migration event, executable route, or size/slippage quote.
- FDV and market cap are distinct nullable fields. Neither a returned snapshot nor a spot price proves executable output. Observed REST responses carried 30–60 second cache directives, but those headers are not a freshness guarantee. API terms allow commercial use subject to restrictions including direct competition/resale; access is revocable/as-is. No pair-indexing freshness or completeness SLA was found.

Sources: [API reference](https://docs.dexscreener.com/api/reference), [listing rule](https://docs.dexscreener.com/token-listing), [API terms](https://docs.dexscreener.com/api/api-terms-and-conditions).

### GeckoTerminal

- Owner docs describe a free keyless Public API with pool/token market data and pool OHLCV, but current CoinGecko keyless guidance says approximately 10 calls/minute while the legacy GeckoTerminal FAQ says 30 calls/minute. Reject a firm current 30/minute entitlement. The owner also says keyless access is for evaluation, not production/scheduled/high-frequency use.
- A no-key Solana pool-list request returned HTTP 200 during this audit; a following OHLCV request returned HTTP 429 from the shared egress IP. Another bounded audit saw four 200s followed by 429. This demonstrates IP-shared throttling and observed access, not reliability.
- It can provide indexed pool candles and market context after discovery. It is not authoritative Pump completion/migration state, raw reserve truth, or an executable router. The Public API is beta; no coverage, maximum indexing delay, uptime, or completeness SLA was found.

Sources: [Public API introduction](https://apiguide.geckoterminal.com/), [authentication](https://apiguide.geckoterminal.com/authentication), [legacy FAQ](https://apiguide.geckoterminal.com/faq), [current keyless guidance](https://docs.coingecko.com/docs/keyless-public-api).

### Jupiter

- Jupiter has two qualifying no-cost paths: keyless at `0.5 RPS` with no signup, intended for tests/demos, and a $0 Free API-key plan at `1 RPS`. Current owner docs say Free has unlimited credits and is rate-limited rather than depleted from a metered balance; no card/funded wallet requirement was found. For a low-traffic production prototype, prefer the Free key. Neither path has an SLA; custom SLA is Enterprise-only.
- Safe no-key requests to both legacy Swap V1 quote and current Swap V2 order returned HTTP 200 during this audit. Both yielded amount-specific route/output information; a walletless V2 order can return `transaction:null`. V2 is the current path, while owner docs say V1 is superseded and not actively maintained.
- A route is request-specific to input mint, output mint, amount, and options. `routePlan`, output amount, threshold/slippage, and price impact describe a current quote/order, not execution or universal PumpSwap coverage. Jupiter is not an OHLCV, bonding-progress, or migration-history source. Equal data freshness across plans is an owner service claim, not a latency/SLA guarantee.

Sources: [setup/keyless limits](https://developers.jup.ag/docs/portal/setup), [plans](https://developers.jup.ag/docs/portal/plans), [rate limits](https://developers.jup.ag/docs/portal/rate-limits), [Swap V2 order](https://developers.jup.ag/docs/api-reference/swap/v2/order), [legacy V1 quote](https://developers.jup.ag/docs/swap/v1/get-quote).

### Official Pump and PumpSwap state

- The official repository is the protocol schema/SDK documentation, not a hosted market-data service. The repository’s audited pin is [`9c82f61cb711b044a17f770ab8ce9f9bdf78f333`](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333); pinning is necessary because `main` is mutable.
- Pump’s mint-derived bonding-curve PDA/account includes virtual/real reserves and `complete`. `complete` is canonical curve state once read at a declared slot/commitment. Completion and migration are separate: `CompleteEvent` records curve completion; `CompletePumpAmmMigrationEvent` records migration/pool. “Curve progress” is not a canonical account field: define and version a derived formula (for example, remaining real token inventory relative to a recorded initial state) rather than presenting one percentage as protocol truth.
- PumpSwap docs define pool ATAs and effective quote reserves as raw quote-vault balance plus signed `Pool.virtual_quote_reserves` (currently documented as zero, but integrations must still include it). Same-slot pool/vault/config reads plus the current integer SDK can support local AMM simulations. Canonical pools use dynamic market-cap fee tiers; noncanonical pools use flat fees, and each fee component has defined rounding. Therefore balances plus pool state or a fixed fee assumption are insufficient for an exact quote. USD liquidity/market cap still need an external quote-asset USD price.
- On-chain account state is canonical only for the selected slot/commitment; checked-in IDLs are not cryptographic proof that every deployed binary matches them. OHLCV and trade flow require transaction/event decoding and complete-enough history. Use the current official SDK/IDL pin and contract tests rather than copying a stale formula.

Sources: [Pump README pinned](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md), [Pump IDL pinned](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json), [PumpSwap README pinned](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_README.md), [PumpSwap IDL pinned](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump_amm.json).

### Solana public RPC

- Official mainnet HTTP/WSS endpoints are no-key and free for reads. A no-key `getVersion` returned HTTP 200 during this audit, with headers identifying a free rate-limit tier.
- Owner docs explicitly rate-limit public endpoints (currently 100 requests/10 seconds/IP, 40 requests/10 seconds for one RPC method, connection and bandwidth limits), say limits may change, and say public endpoints are not intended for production applications.
- Account/token-balance reads can recover Pump/PumpSwap state. `logsSubscribe`, `getSignaturesForAddress`, and `getTransaction` can support event/history reconstruction, but public RPC publishes no archival completeness, retention, replay, or uptime SLA; `getTransaction` may return null. Use processed observations only as triggers and reconcile correctness-critical state at finalized commitment.

Sources: [clusters/public endpoints](https://solana.com/docs/references/clusters), [RPC overview](https://solana.com/docs/rpc), [logsSubscribe](https://solana.com/docs/rpc/websocket/logssubscribe), [getSignaturesForAddress](https://solana.com/docs/rpc/http/getsignaturesforaddress), [getTransaction](https://solana.com/docs/rpc/http/gettransaction), [token balance](https://solana.com/developers/cookbook/tokens/get-token-balance).

## Rejected draft claims

1. **“PumpPortal trade data has no per-message charge after 2026-05-01.”** Rejected: current owner pages state `0.01 SOL / 10,000` trade messages/events plus a wallet funded with at least `0.02 SOL`.
2. **“Jupiter’s only qualifying free path is keyless 0.5 RPS” or “the Free plan is metered credit.”** Rejected: current owner docs describe both keyless 0.5 RPS and a $0 Free key at 1 RPS with unlimited credits; prefer the Free key for a low-traffic production prototype. V2 is current and V1 is legacy.
3. **“Curve progress is an official Pump field.”** Rejected: `complete` and reserves are official; any progress percentage is a consumer-defined derivation.
4. **“PumpSwap balances and pool state always suffice for an exact quote.”** Overstated: include effective virtual quote reserves, fee/config state, token decimals/program behavior, and a consistent slot; simulation still is not execution.
5. **“Indexed market cap/spot price proves routeable liquidity.”** Rejected: DEX Screener fields are nullable indexed snapshots; Jupiter route/output is amount- and time-specific.
6. **“Public Solana RPC is a production archival backend.”** Rejected by owner limits and production warning.
7. **“Free/currently reachable means SLA-backed or complete.”** Rejected for every audited third-party endpoint.

## Prototype acceptance and tests

1. Store source, local receipt time, provider timestamp, signature, slot, commitment, raw payload, schema fingerprint, and parser version.
2. At a finalized slot, compare Pump/PumpSwap account state and transactions with first appearance in PumpAPI, DEX Screener, GeckoTerminal, and Jupiter; measure misses and delay distributions rather than claiming “real-time.”
3. For one pre-completion mint, decode `BondingCurve`, verify `complete`, preserve initial/current reserves, and publish the exact versioned progress formula. Compare only like quote mints.
4. At completion/migration, separately verify `CompleteEvent`, finalized `CompletePumpAmmMigrationEvent`, canonical pool identity, and provider event/index times.
5. For a PumpSwap pool, fetch pool, vaults, fee/config state at a consistent slot; reproduce official-SDK outputs for several sizes, then compare Jupiter V2 order and finalized settlement.
6. Reconstruct candles by paging signatures/transactions and compare with PumpAPI replay and GeckoTerminal OHLCV. Record null transactions, missing hours, reorg/finality differences, and volume-definition differences.
7. Contract-test HTTP 200/401/404/429/5xx, WebSocket reconnect/dedup/gaps, unknown fields, and no-route versus bad-price versus not-indexed states.
8. Recheck owner pricing/terms and safe no-key access at deployment. Do not redistribute retained third-party data until rights are confirmed.
