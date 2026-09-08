# PumpPortal — live and historical Pump streams (free-only audit)

- **Audited:** 2026-08-26 UTC
- **Scope:** PumpPortal's Pump.fun/PumpSwap data interface for a production prototype that may use only no-cost methods. No credentials, wallet, or funds were used.
- **Evidence boundary:** Only PumpPortal-owned docs/terms and a low-volume, no-key WebSocket test were used. A successful test is an observation, not a promise of future access.

## Decision summary

| Classification | Finding |
|---|---|
| **Verified** | PumpPortal documents `subscribeNewToken` and `subscribeMigration` as free live streams. The provider says the stream is at Solana `processed` commitment. ([data docs](https://pumpportal.fun/data-api/real-time/), [fees](https://pumpportal.fun/fees/), [FAQ](https://pumpportal.fun/FAQ/#how-fast-is-the-pumpportal-realtime-data-websocket)) |
| **Candidate** | A free-only discovery/migration prototype can use those two methods, with reconnect logic and independent chain reconciliation. Anonymous no-key access worked in this audit, but the docs show an API-key URL and do not expressly promise anonymous availability. Anonymous **PumpSwap** coverage remains unverified. |
| **Rejected** | PumpPortal is not a historical source: its FAQ says it provides live data only and directs users to RPC or another source for history. ([FAQ](https://pumpportal.fun/FAQ/#do-you-provide-historical-pumpfun-token-data)) |
| **Rejected** | `subscribeTokenTrade` and `subscribeAccountTrade` are not free-only: they require an API key, a linked wallet funded with at least `0.02 SOL`, and cost `0.01 SOL` per 10,000 streamed trade messages. ([data docs](https://pumpportal.fun/data-api/real-time/), [fees](https://pumpportal.fun/fees/)) |
| **Rejected** | No contractual output schema, replay/cursor, completeness guarantee, ordering guarantee, or uptime/latency SLA was found. Observed fields must therefore be treated as versioned, provider-specific payloads rather than a stable contract. |

## Documented access and request contract

**Endpoint:** `wss://pumpportal.fun/api/data?api-key=your-api-key-here` ([official data docs](https://pumpportal.fun/data-api/real-time/)). The documented client sends JSON objects:

```json
{"method":"subscribeNewToken"}
{"method":"subscribeMigration"}
{"method":"subscribeTokenTrade","keys":["<mint>"]}
{"method":"subscribeAccountTrade","keys":["<account>"]}
```

The same page documents `unsubscribeNewToken`, `unsubscribeTokenTrade`, and `unsubscribeAccountTrade`; it does **not** list `unsubscribeMigration`. `keys` is an array of mint or account addresses for the two metered trade methods. The page labels creation and migration free, while trade/account subscriptions require the funded key described above. Its metering language is inconsistent: the data page refers to “events” and WebSocket “messages,” while the fee page says “trades streamed.” The exact billable-message semantics (for example, whether acknowledgements/errors count) are therefore unclear. ([data docs](https://pumpportal.fun/data-api/real-time/), [fees](https://pumpportal.fun/fees/))

### Limits and delivery status

- Use one WebSocket connection and add subscriptions to it; repeated concurrent connections may trigger a temporary ban. ([data docs](https://pumpportal.fun/data-api/real-time/))
- Do not exceed 200 subscription messages/second or 5,000 addresses in one message. The FAQ says subscriptions on one connection are “practically unlimited”; that is guidance, not a numerical entitlement or SLA. Temporary bans expire hourly. ([FAQ](https://pumpportal.fun/FAQ/#what-are-the-rate-limits-for-using-pumpportal-api))
- The feed is `processed`, so observations can precede confirmation/finality. The claimed typical delay of less than 100 ms behind gRPC applies to a server in New York and is not stated as a guarantee. ([FAQ](https://pumpportal.fun/FAQ/#how-fast-is-the-pumpportal-realtime-data-websocket))
- PumpPortal says WebSockets can disconnect because of network instability or server load rebalancing and recommends reconnect logic. No replay/backfill mechanism is documented. ([FAQ](https://pumpportal.fun/FAQ/#i-got-disconnected-from-the-realtime-data-websocket-what-happened))
- No devnet/testnet API is provided. ([FAQ](https://pumpportal.fun/FAQ/#is-there-a-pumpfun-devnet-api))

## Empirical no-key observations (not contractual availability)

On 2026-08-26 UTC, one connection to **`wss://pumpportal.fun/api/data` with no query string or credentials** opened successfully.

1. Sending `{"method":"subscribeNewToken"}` returned `{"message":"Successfully subscribed to token creation events."}`.
2. Sending `{"method":"subscribeMigration"}` returned `{"message":"Subscribed to 'migration' events."}`.
3. Within nine seconds, two creation events arrived. Their observed keys were: `signature`, `mint`, `traderPublicKey`, `txType`, `initialBuy`, `solAmount`, `bondingCurveKey`, `vTokensInBondingCurve`, `vSolInBondingCurve`, `marketCapSol`, `name`, `symbol`, `uri`, `is_mayhem_mode`, and `pool`.
4. In a separate single-connection test, an anonymous `subscribeTokenTrade` request received an error message saying token/account trade methods require an API key funded with at least `0.02 SOL`.

These observations verify current endpoint behavior only. The official page publishes request examples but no normative response schema, field types, nullability, version, event envelope, or compatibility policy. An implementation should retain raw payloads, accept unknown fields, validate types defensively, and reconcile signatures against confirmed/finalized chain data.

## History and “livestream” boundaries

- **Historical token/trade data:** explicitly unavailable from PumpPortal; live only. ([FAQ](https://pumpportal.fun/FAQ/#do-you-provide-historical-pumpfun-token-data))
- **Pump.fun video livestream/chat/comments:** also explicitly unavailable; PumpPortal says those off-chain data are accessible only from the Pump.fun site. This is distinct from the live blockchain-derived Data API. ([FAQ](https://pumpportal.fun/FAQ/#do-you-provide-pumpfun-livestream-data--chat--comments))
- Therefore a historical prototype must archive the live feed itself and/or use a separately approved RPC/history source; PumpPortal cannot fill gaps after a disconnect.

## Terms and production risk

PumpPortal states it is a third party with no affiliation or business relationship with Pump.fun or Raydium. Use constitutes acceptance of its terms. The terms permit only a “single, personal, limited” license, revocable at any time; reserve geographic and user-level access restrictions; prohibit copying/distributing the Interface or its contents to third parties unless expressly authorized; disclaim accuracy, completeness, currency, fitness, and uninterrupted availability; and impose individual arbitration/class-action waiver provisions. The page does not display an effective/revision date even though its change clause refers to an updated revision date. ([Terms of Use](https://pumpportal.fun/legal/))

**Production classification: candidate, not verified.** The free methods are documented, but no explicit commercial-production, redistribution, retention, or derived-data license was found. The terms' “personal” license and content-distribution language are material ambiguities for a user-facing production service and require owner clarification/legal review before launch.

## Unsupported or date-sensitive claims

- The fee page says the keyed/metered trading-data policy is **effective May 1, 2026**. That date is in the past relative to this 2026-08-26 audit, not future-dated. ([fees](https://pumpportal.fun/fees/))
- “Practically unlimited subscriptions” and “typically less than 100 msec” are provider statements without an SLA or independent support in the allowed sources; do not convert them into production guarantees. ([FAQ](https://pumpportal.fun/FAQ/))
- Anonymous access is **empirically observed but not expressly documented as a contractual no-key endpoint**. The documented URL includes an API-key placeholder, while only method pricing—not anonymous authentication semantics—is specified. ([data docs](https://pumpportal.fun/data-api/real-time/))
- No PumpPortal-owned public source repository or machine-readable WebSocket schema/OpenAPI contract was linked from the reviewed first-party pages; claims of stable response fields, historical access, or guaranteed anonymous access are unsupported.

## Prototype disposition

Use PumpPortal only as a **live, best-effort trigger for free creation and migration events**. For a genuinely free-only prototype, reject its trade/account streams and all claims of PumpPortal history. Persist raw events immediately, reconnect on failure, deduplicate by signature, and reconcile against a separately approved chain source. Do not expose or redistribute the feed in production until the license ambiguity is resolved.
