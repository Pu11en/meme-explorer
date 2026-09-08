# PumpPortal audit — live and historical Pump streams

- **Accessed/tested:** 2026-08-26 UTC
- **Scope:** FREE-only production prototype; PumpPortal owner docs/legal and low-volume, no-key WebSocket probes only.
- **Evidence rule:** “Documented” is not an uptime/SLA promise; “observed” is one point-in-time behavior, not contractual availability. This is a technical reading, not legal advice.

## Verdict

PumpPortal is a **verified zero-data-fee candidate only for live new-token and migration discovery**. It is **rejected as a historical/backfill source** and, under a strict free-only constraint, its token/account trade streams are also rejected. Anonymous access worked in a probe but is not the URL contract shown in the docs. A production prototype must tolerate schema drift/disconnects, archive its own events, and obtain legal clarification before commercial use or redistribution.

## Verified (owner-documented)

- Endpoint/request contract: connect to `wss://pumpportal.fun/api/data?api-key=...`; send JSON with `method`. Methods are `subscribeNewToken`, `subscribeMigration`, `subscribeTokenTrade`, and `subscribeAccountTrade`; token/account methods take `keys: [...]`. Subscriptions should be added on one socket. Documented unsubscriptions are `unsubscribeNewToken`, `unsubscribeTokenTrade`, and `unsubscribeAccountTrade`; no `unsubscribeMigration` is listed. [Real-time data](https://pumpportal.fun/data-api/real-time/)
- **Free methods:** data from `subscribeNewToken` and `subscribeMigration` has no charge. [Fees](https://pumpportal.fun/fees/)
- **Key/funding/metering:** `subscribeTokenTrade` and `subscribeAccountTrade` require a PumpPortal API key and linked wallet funded with at least **0.02 SOL**; the stated price is **0.01 SOL per 10,000** streamed trade events/messages. The pages variously say “events,” “websocket messages,” and “trades streamed,” so exact billable-message semantics are not defined precisely. [Real-time data](https://pumpportal.fun/data-api/real-time/) · [Fees](https://pumpportal.fun/fees/)
- The fee page says this trading-data requirement is effective **May 1, 2026**. On the audit date, 2026-08-26, this is already effective—not future-dated. [Fees](https://pumpportal.fun/fees/)
- Limits/guidance: use one connection; do not exceed **200 subscription messages/sec** or **5,000 addresses in one message**. Repeated excess can cause a temporary ban; docs say bans expire hourly. “Practically unlimited subscriptions” on one socket is guidance, not a numeric total entitlement. [FAQ](https://pumpportal.fun/FAQ/)
- Delivery is at Solana **`processed` commitment**. The claimed `<100 ms` delay behind gRPC applies “typically” to a New York client and is not an SLA or finality guarantee. [FAQ](https://pumpportal.fun/FAQ/)
- **Live only:** PumpPortal explicitly says it provides only live trading data and directs historical-data users to RPC/another source. It also provides no devnet/testnet API. [FAQ](https://pumpportal.fun/FAQ/)
- Disconnects can occur from network instability or server load rebalancing; reconnect logic is recommended. No replay/cursor/backfill contract is published. [FAQ](https://pumpportal.fun/FAQ/)
- The public real-time page documents request examples but **does not publish an output JSON schema**, field types/version, ordering, replay, completeness, retention, or delivery SLA. [Real-time data](https://pumpportal.fun/data-api/real-time/)

## Observed / candidate, not contractual

Safe probes opened four short-lived sockets and sent one subscription each—far below published limits; no key, wallet, or funds were used.

- `wss://pumpportal.fun/api/data` (no query string) accepted the WebSocket upgrade and `subscribeNewToken`, acknowledged it, and emitted live Pump creation objects.
- An anonymous `subscribeTokenTrade` request was rejected at the application layer with a message requiring an API key funded with at least 0.02 SOL, matching the docs.
- `?api-key=` accepted and acknowledged `subscribeMigration`; no migration happened during the five-second sample, so event delivery/schema was not verified.
- A bogus key produced `Invalid API key. PumpSwap data will not be streamed.` but still accepted `subscribeNewToken` and emitted Pump creation events. Therefore **keyless/invalid-key free access is an observation, not a promised anonymous contract**, and anonymous PumpSwap coverage is unverified.
- Observed creation fields included `signature`, `mint`, `traderPublicKey`, `txType`, `initialBuy`, `solAmount`, `bondingCurveKey`, virtual reserves, `marketCapSol`, `name`, `symbol`, `uri`, `is_mayhem_mode`, and `pool`. These are samples only—not a documented stable schema. Acknowledgements/errors used separate `message`/`errors` objects.

## Rejected or unsupported claims

- **“PumpPortal supplies historical Pump data/replay.” — Rejected.** Owner FAQ says live only; archive locally or use RPC/another provider.
- **“Trade streams are free.” — Rejected under current owner documentation.** Token/account trades require a funded key and are metered.
- **“All WebSocket methods require a key.” — Rejected as a blanket claim.** Docs restrict the key/funding requirement to token/account streams; no-key new-token access also worked empirically. The documented example URL still includes a key, so anonymous availability remains non-contractual.
- **“PumpPortal publishes a stable response schema.” — Unsupported.** Only request examples are documented; sampled output cannot create a contract.
- **“The feed is complete, finalized, replayable, or guaranteed under 100 ms.” — Unsupported.** Docs state `processed`, use “typically” for latency, warn of disconnects, and publish no SLA/replay/completeness guarantee.
- **“Free includes anonymous PumpSwap coverage.” — Unsupported.** The bogus-key warning explicitly excluded PumpSwap; the short anonymous sample only observed `pool: "pump"` events.
- **“The May 1, 2026 API-key access requirement is future-dated.” — Rejected for this audit date.** It would have been prospective before that date, but is past-effective as of 2026-08-26. The fee page attaches that effective date expressly to API-key-gated trading-data access; it does not separately date the metering rate.

## Terms / production caveat

The Terms grant a **single, personal, limited, non-transferable, revocable** license; absent authorization they prohibit copying, selling, publishing, distributing, or letting third parties access/use the Interface or its contents. They permit access restriction/revocation at discretion, provide the service “as is/as available,” disclaim accuracy/completeness/currentness, and limit liability. They also impose jurisdiction/sanctions restrictions, individual arbitration/class waiver, and user compliance obligations. The page shows no visible revision/effective date. These terms do **not clearly grant commercial production or data-redistribution rights**; obtain written permission/legal review before either. [Terms of Use](https://pumpportal.fun/legal/)

## FREE-only prototype decision

- **Candidate:** opportunistic live discovery via `subscribeNewToken`/`subscribeMigration`, with permissive JSON parsing, raw-payload capture, reconnects, deduplication, and independent chain reconciliation.
- **Rejected as sole production data plane:** no history/backfill, no documented output schema or SLA, `processed` rollback risk, anonymous access not promised, PumpSwap anonymous coverage unclear, and commercial/redistribution rights unclear.
