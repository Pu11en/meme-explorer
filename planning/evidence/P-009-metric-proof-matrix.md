# P-009 — Metric speed and proof matrix

## What “proved” means here

The tests prove bounded availability, observed timing, field coverage and deterministic calculations for the tested samples. They do **not** prove that PumpAPI or any free provider is globally complete, final, always available or correct forever. Every metric therefore retains source, timestamps and gap/error state.

## Fast metrics — update from every PumpAPI event

These require no repeated HTTP fetch. They update as quickly as the shared PumpAPI WebSocket delivers events.

| Metric/data | Update cadence | Direct evidence | What is and is not proved |
|---|---|---|---|
| Buy count / sell count | Every trade event | 40,927 Pump-AMM trades observed in 160.71 s; `action` present 40,927/40,927 | Counting received deduplicated events is deterministic; stream completeness is not guaranteed |
| Token and SOL amount | Every trade event | `tokenAmount` and `quoteAmount` present 40,927/40,927 | Exact values received from PumpAPI; not independently chain-confirmed for every event |
| Local price | Every trade event | `price` present 40,927/40,927 | Reliable as a recorded provider value; not an executable quote or finality proof |
| Buy/sell volume and net SOL flow | Every trade event | Derived from action + `quoteAmount`, each present 40,927/40,927 | Arithmetic is deterministic for received events; gaps make totals incomplete |
| Active signer/wallet count | Every trade event | Trade payload coverage included signer/trader fields for the same bounded capture | Counts observed addresses, not human owners or independent people |
| Pool reserves / curve movement | Every event carrying reserve values | PumpAPI emitted token/quote pool values throughout tested Pump-AMM trade payloads | Provider-decoded state; preserve missing values and never invent between events |
| High, low, price change and drawdown | Every price event | Derived locally from the 40,927/40,927 price values | Correct for received values within the chosen window; stream gaps can miss extrema |
| Time since last meaningful activity | Update local clock every second; reset on relevant event | Relevant action and timestamp fields were present throughout the tested trade sample | Exact relative to received events; a missed provider event can make the displayed age too high |
| Local OHLC and quote-volume candles | Update every trade; finalize every minute | Two full local minute OHLC bars differed from GeckoTerminal by about 0.3–1.2% after one delayed USD conversion | Local aggregation is deterministic; comparison does not prove either provider complete. Gecko volume differed by 2.3–2.4×, so volumes must remain separate |
| Launch signer and forward signer history | Once at creation; update on another create | `txSigner`, signature, block, timestamp and mint present 50/50; five repeated-signer groups appeared within 73.59 s | Factual address/signature history from installation onward; not identity, ownership or intent |
| Launch facts | Once at creation | 50/50 coverage for mint, signer, signature, timestamp, block, URI, price and amounts; `creatorFeeAddress` only 49/50 | Fields with 50/50 coverage are usable with missing-state handling; creator-fee address is explicitly nullable |

Primary raw evidence: [local candle benchmark](P-012-local-candle-geckoterminal-comparison.json) and [launch-signer benchmark](P-012-launch-signer-jupiter-attribution-benchmark.json).

## Medium-speed data

| Data | Responsible interval | Observed speed | Proof and limitation |
|---|---|---|---|
| Metadata JSON | Once immediately; retry only after failure | IPFS JSON 78.5–274.5 ms; arbitrary HTTPS JSON 63.1–434.6 ms | 19 JSON documents succeeded across 20 fresh URIs; the remaining URI was a direct PNG, so URI does not always mean JSON |
| Metadata image/bytes | Once immediately; retry only after failure | Sampled direct PNG 1.27–1.57 s | Bounded sample only; remote hosts are mutable and have no uptime guarantee |
| Approximate SOL/USD | One global fetch every 30 s | HTTP latency 54.8–243.2 ms, but source snapshot refreshed about every 25–30 s | 12/12 requests succeeded; five-second polling mostly repeated cached data. It is a venue price, not an oracle |

Primary raw evidence: [IPFS benchmark](P-012-metadata-gateway-benchmark.json), [HTTPS benchmark](P-012-metadata-arbitrary-https-benchmark.json), and [SOL/USD cadence](P-012-dexscreener-sol-usd-cadence.json).

## Slow data

| Data | Responsible interval | Observed delay | Proof and limitation |
|---|---|---|---|
| DEX Screener migrated-pair market snapshot | Poll every 30 s after migration/pool event | 0/10 immediately, 1/10 by 30 s, 9/10 by 60 s, 10/10 by 120 s | All 40 requests returned 200, but there is no universal indexing bound or SLA |
| DEX Screener rolling volume/activity/FDV/liquidity | Same 30-second polling after indexing | At least the pair-index delay above, then cached snapshots | Useful provider aggregates; window methodology and completeness are not independently proved |
| Public Solana RPC confirmation | Sample only important events | One supply request returned in 71 ms; holder-heavy request returned HTTP 429 | Method latency can be fast, but access is too unreliable for a continuous required metric |
| PumpAPI replay repair | After the containing hour closes | Publication observed from roughly 10 s to over 7 h after hour-end | Useful delayed repair only; missing/late hours, schema eras, no checksums and no SLA |

Primary raw evidence: [expanded migration benchmark](P-012-dexscreener-expanded-migration-index-benchmark.json), [PumpAPI checklist](P-012-pumpapi-capability-checklist.md), and [capability ledger](P-012-capability-gap-ledger.md).

## Data we cannot truthfully provide as reliable metrics

- Complete independently verified holder concentration.
- Human ownership behind wallets.
- Insider, bot or smart-money identity as fact.
- Complete creator history before local recording begins.
- “Scam,” “good,” “bad,” or future-outlier labels.
- Canonical executable quote through the strict-free stack.
- Continuous finality confirmation through public RPC.
- A gap-free claim for any free provider.

RugCheck was specifically rejected after fresh-token risk and LP-lock values materially reversed within 120 seconds. Jupiter holder/developer fields are technically reachable but excluded from the merged recorder because definitions/provenance are incomplete and its legal agreement restricts combining/redistribution.
