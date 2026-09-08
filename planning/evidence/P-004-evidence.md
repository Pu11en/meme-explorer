# P-004 Evidence — accessible data and timing

- Accessed: 2026-08-26

## Candidate source 1 — PumpPortal Data API

- Source: [Pump.fun & PumpSwap real-time data](https://pumpportal.fun/data-api/real-time)
- Retrieval: one WebSocket connection to `wss://pumpportal.fun/api/data`, then `{"method":"subscribeNewToken"}`.
- Access/cost: the provider documents `subscribeNewToken` as free. Its fee page says token-creation and migration events carry no charge, while token/account trade streams are metered and require an API key plus funded wallet.
- Connection constraint: the provider instructs clients to use a single WebSocket rather than open one connection per token/account.

## Bounded live observation

- Date: 2026-08-26
- Probe: connected once without an API key, sent `subscribeNewToken`, ignored the subscription acknowledgment, and received a real creation event.
- Measured local timing: WebSocket connection/subscription acknowledgment in ~201 ms; first token event received 1.48 s after probe start. This is **not** event-to-chain latency—it is only cold-connect-to-first-observed-event time.
- Observed event-time fields:
  - identity/links: `signature`, `mint`, `traderPublicKey`, `bondingCurveKey`, `uri`, `pool`
  - event semantics: `txType` (`create`)
  - initial economics/curve state: `initialBuy`, `solAmount`, `vTokensInBondingCurve`, `vSolInBondingCurve`, `marketCapSol`
  - displayed metadata: `name`, `symbol`, `is_mayhem_mode`
- Fields not present in this one event: holder distribution, verified social links, creator history, token image/description, trade count/volume after creation, block time, source-generated receipt timestamp, or an explicit liquidity field.

## Candidate source 2 — token metadata URI

- Retrieval: HTTP GET to the event’s IPFS `uri`.
- Observation: the sampled event’s `https://ipfs.io/ipfs/...` URI returned HTTP 403 from this environment.
- Status: **unreliable/unvalidated**. The plugin must report this as an enrichment attempt, not assume metadata is available. Test a permitted gateway or provider-proxied metadata path in the next measurement phase.

## Harness plugin evidence

- Local installed web bundle: [`cordis.patch.yml`](../../../../.local/share/deepseek-harness/node_modules/.pnpm/@deepseek-ai+dsh-web-app@0.1.1-rc.2_ce3874dffedb66ab726b823cc1dadab8/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml) documents that `dsh.client` rows form the browser plugin roster and are scanned into `window.__DSH_BOOT__`.
- [DeepSeek Harness client-plugin guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/AGENTS.md) documents client plugins as `@deepseek-ai/dsh-client-<name>` packages that compose UI through registered slots and keep browser UI as presentation over host/data services.
- Superseded display effect: the node/data half still owns the WebSocket and measurement state, but the later [session-native adapter proof](P-008-session-native-adapter.md) established that model tools, an optional command and Agent notices can provide the requested session-only surface with no client plugin.

## Second bounded live observation — immediate enrichments

- Date: 2026-08-26
- Discovery: a creation event arrived 675 ms after cold probe start.
- Chain timestamp: Solana `getTransaction` returned the confirmed transaction in 462 ms. Comparing its estimated `blockTime` with local receipt time gave approximately 1.625 s, but block time has one-second granularity and is an estimated production time, so this is an approximate latency observation—not an exact network benchmark.
- Supply: `getTokenSupply` returned total supply in 387 ms.
- Creator history seed: `getSignaturesForAddress` returned two creator-wallet signatures in 460 ms, proving basic wallet-history enrichment can begin immediately; interpreting that history requires parsed transactions and explicit definitions.
- Concentration attempt: public Solana RPC returned HTTP 429 for `getTokenLargestAccounts`, so top-holder concentration was not reliably available from that endpoint in this trial. A production RPC/provider or retry budget must be evaluated.
- Metadata: this event used Arweave rather than IPFS. The metadata JSON arrived in 143 ms and exposed `name`, `symbol`, `description`, `image`, `website`, `twitter`, and `telegram`. These fields are self-asserted and manipulable; availability does not establish quality.

## Ten-event field/metadata sample

- Date: 2026-08-26
- Ten creation events arrived over 22.954 seconds.
- All ten used the same 15 creation-event fields already listed; no additional holder, trade-flow, social-quality, or creator-history variables appeared in the stream payload.
- Direct metadata retrieval succeeded for 2/10 events (100–220 ms), failed with HTTP 403 for 7/10, and one event had no usable URI. Successful metadata included combinations of description, image, website, Twitter, Telegram, `createdOn`, and `coin_community`.
- Effect: metadata/social presence is a potentially fast but inconsistently available and self-asserted variable. It must have explicit `available`, `missing`, and `fetch_failed` states rather than treating failure as absence.

## Early trade-stream access test

- Date: 2026-08-26
- A no-key `subscribeTokenTrade` request returned an explicit provider error: token/account trade subscriptions require an API key funded with at least 0.02 SOL.
- Effect: early buy/sell flow, unique-trader counts, net order flow, creator sells, and curve acceleration are technically available from the provider but are **not available to the no-key MVP**. They require a later explicit access/cost decision or a separate on-chain decoder.

## External indexer timing probe

- Date: 2026-08-26
- A fresh token was queried immediately, at ~5 seconds, and at ~15 seconds after local discovery.
- DEX Screener’s token-pairs endpoint returned HTTP 200 but zero pairs at every sample. Its useful pair metrics (`txns`, `volume`, `priceChange`, `liquidity`, `fdv`, `marketCap`) therefore cannot be assumed available during the earliest alert window.
- RugCheck’s public report-summary endpoint returned in 392–462 ms at every sample, including immediately after discovery. The observed summary exposed token program/type, LP-lock percentage, normalized/raw risk score, and a concrete risk named `Creator history of rugged tokens`.
- Effect: an immediate third-party creator/risk assessment appears technically possible, while DEX-indexed pair metrics are later-stage variables. RugCheck’s own score must remain decomposed into named risk facts so the plugin does not hide decisions inside an opaque aggregate.

## Limitations

- The observed creation events are not a coverage or latency benchmark.
- Provider payload schema is observed, not contractual; retain unknown fields and schema-version the normalized event.
- Solana `blockTime` is estimated and second-granularity, so the observed ~1.625 s event-to-receipt value is suitable for coarse measurement only.
- Availability and timing do not establish that any variable predicts a good buy. Predictive usefulness needs an explicitly defined outcome and retrospective/live validation dataset.
