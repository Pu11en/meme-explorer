# Pyth Hermes / Benchmarks strict-free SOL/USD audit

**Observed:** 2026-08-26 12:36–12:38 UTC  
**Decision:** **Reject as a durable strict-free/no-key dependency.** Pyth is technically suitable for timestamped SOL/USD reference observations, but owner documentation schedules mandatory API-key authentication for **2026-08-26 16:00 UTC**, says the key comes with a **free trial** while **paid plans cover ongoing use**, supplies no adequate public API-data license for the intended retention/redistribution use, and supplies no SLA or completeness guarantee.

## Evidence boundary

Primary sources only: Pyth/PumpAPI owner docs and legal pages, Pyth-operated OpenAPI/endpoints, Pyth's official repository, and bounded anonymous probes. No signup, credentials, card, wallet, credits/CUs, trial, trading, scraping, or access-control bypass was used.

## Corrected finding

| Constraint/question | Verified finding | Strict result |
|---|---|---|
| Date validity | Runtime clock and Pyth/PumpAPI HTTP `Date` headers independently read **2026-08-26** during the probes. The date was not future relative to those systems. The scheduled **16:00 UTC** cutover and end-of-day state were still future and therefore unverified. | Do not describe post-16:00 behavior as observed. |
| Canonical feed | Stable `Crypto.SOL/USD`: `ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`. | Pass. Pin the exact ID; fuzzy search returns wrapped/staked variants. |
| Timestamp capability | Benchmarks documents point `/v1/updates/price/{timestamp}` and inclusive interval `/v1/updates/price/{timestamp}/{interval}` requests; interval maximum is 60 seconds. Parsed data includes `publish_time`, `price`, `conf`, and `expo`. | Technically suitable, not proof of simultaneity or completeness. |
| Current no-key access | Before cutover, legacy Hermes latest and Benchmarks point requests returned 200. Upgraded Hermes feed discovery returned 200, but upgraded latest-price returned **401 `unauthorized`**. | Transitional observation only. |
| Durable no-key entitlement | Owner docs say every Core user will need an API key at 16:00 UTC; Benchmarks keeps its URL but every request must carry `Authorization: Bearer $PYTH_API_KEY`. | **Fail.** |
| No trial dependence | Upgrade guide says “a free trial is included, paid plans cover ongoing use.” Terminal advertises a trial token with no card required. | **Fail:** free/no-card trial is still a keyed trial and not durable free access. |
| No funded wallet / credits/CUs | No wallet or on-chain fee is needed merely to read REST data, and probes used none. However ongoing hosted access is plan-dependent. | Wallet/CU constraint passes; overall strict-free constraint fails. |
| Rate/access reliability | Documented limit is 10 requests/10 seconds/IP; excess receives 429 for the following 60 seconds. Public Hermes is described for testing; Pyth recommends providers for production resilience. | Unsupported as a guaranteed production dependency. |
| API/data license | Official repository is Apache-2.0 for **software**. Pyth Terms separately restrict Site price-feed data and grant only limited private/non-commercial informational use; no clear public open-data grant for commercial retention, derived datasets, or redistribution was found. | **Fail pending written license clarification.** |
| SLA/completeness | Price-feed disclaimer says as-is/as-available and disclaims interruption, delay, outage, and inaccuracy. No public uptime, retention, immutable-history, correction, per-second completeness, or support SLA was found. | **Fail for claimed reliability.** |

## Official sources

- [Pyth upgrade preparation](https://docs.pyth.network/price-feeds/core/upgrade/preparing): key required for Hermes; free trial included; paid plans for ongoing use; upgraded base URL and Bearer header.
- [Pyth historical data / Benchmarks](https://docs.pyth.network/price-feeds/core/use-historical-price-data): same Benchmarks URLs after cutover, but Bearer authentication required; point and interval behavior.
- [Pyth rate limits](https://docs.pyth.network/price-feeds/core/rate-limits): 10 requests/10 seconds/IP and 60-second 429 penalty.
- [Pyth Terminal](https://docs.pyth.network/price-feeds/pro/pyth-terminal): free **trial** token, no card required, and subscription management.
- [Pyth Hermes instance](https://docs.pyth.network/price-feeds/core/api-instances-and-providers/hermes): public instance/testing posture and provider recommendation.
- [Pyth SOL/USD feed table](https://docs.pyth.network/price-feeds/core/push-feeds/solana): canonical stable feed ID.
- [Benchmarks OpenAPI](https://benchmarks.pyth.network/openapi.json): owner-operated route/schema contract (version `0.3.7` observed).
- [Pyth Terms](https://www.pyth.network/legal/terms-conditions) and [Price Feeds Disclaimer](https://www.pyth.network/legal/disclaimer-for-pyth-network-price-feeds): data-use and no-warranty boundary.
- [Official `pyth-crosschain` license](https://github.com/pyth-network/pyth-crosschain/blob/main/LICENSE) and [Hermes client](https://github.com/pyth-network/pyth-crosschain/tree/main/apps/hermes/client/js): Apache-2.0 software and supported client/auth behavior; neither proves an open-data entitlement.

## Bounded no-key probes

At 12:36 UTC, without `Authorization`:

| Owner endpoint | Result |
|---|---|
| `hermes.pyth.network/v2/price_feeds?...SOL/USD...` | 200 |
| `hermes.pyth.network/v2/updates/price/latest?...` | 200 |
| `pyth.dourolabs.app/hermes/v2/price_feeds?...SOL/USD...` | 200 |
| `pyth.dourolabs.app/hermes/v2/updates/price/latest?...` | **401 `unauthorized`** |
| `benchmarks.pyth.network/v1/updates/price/1787746471?...` | 200 |

These prove only point-in-time reachability **before** the scheduled cutover. Anonymous metadata discovery does not imply anonymous price rights. No rate-limit threshold test was attempted.

## PumpAPI timestamp claim: usable field, unsupported semantics

PumpAPI's [Data Stream](https://pumpapi.io/stream) examples include a 13-digit `timestamp`. Its [Historical Replay](https://pumpapi.io/historical-replay) says every event has a millisecond-precision timestamp and separately defines replay-only `localTimestamp` as the time its Frankfurt replay server received the transaction. It also calls replay the “exact same format” as live despite documenting this extra replay-only field; literal schema identity is therefore false.

A safe one-message anonymous WebSocket probe returned:

```json
{"action":"transfer","block":441868353,"timestamp":1787747836326}
```

Local receipt was 280 ms later. Official Solana public RPC returned block time `1787747835` for that exact block, while PumpAPI's value decoded to `1787747836.326`; the fields are only roughly consistent at second scale. This **does not establish** what clock produces PumpAPI `timestamp`, its accuracy, finality, ordering, or immutability. PumpAPI's millisecond precision and 1–3 ms bundle heuristic are provider claims, not proof of millisecond chain truth.

PumpAPI currently says Data Stream and Replay are free/no-signup/no-key ([FAQ](https://pumpapi.io/FAQ), [Fees](https://pumpapi.io/fees)), but its [Terms](https://pumpapi.io/legal) provide the service as-is/as-available, disclaim accuracy/availability, and provide no explicit archive redistribution license or SLA.

### Safe alignment policy

If authenticated/licensed Pyth use later becomes acceptable:

1. Preserve PumpAPI `timestamp`, PumpAPI `localTimestamp` (when present), client receipt time, and Pyth `publish_time` as distinct clocks.
2. Query the integer PumpAPI event second or a bounded interval; inspect the returned `publish_time` rather than assuming equality.
3. Store requested time, returned time, signed offset, feed ID, integer price/confidence, exponent, metadata, and raw-response hash.
4. Treat Pyth SOL/USD as an aggregate reference, not the same instrument as a Pump pool/curve execution price.
5. Keep missing/stale/401/429/timeout states explicit; never silently interpolate or carry forward.

## Final disposition

- **As a timestamp reference:** technically credible and well specified at Unix-second publish-time resolution.
- **As the requested strict-free/no-key production source:** **rejected** because current owner policy requires a key and trial/paid-plan dependence after the scheduled cutover.
- **As a legally cleared retained/redistributable dataset:** **rejected pending explicit provider permission/license.** Apache-2.0 covers code, not returned data.
- **As a reliable sole source:** **rejected** because no SLA, completeness/retention guarantee, or supported anonymous production entitlement exists.
