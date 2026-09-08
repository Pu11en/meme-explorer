# PumpAPI audit — live and historical Pump streams

**Audit time:** 2026-08-26 07:37–07:39 UTC  
**Scope:** FREE-ONLY production prototype; PumpAPI owner pages and safe no-key requests only. The existing draft was treated only as a list of claims to test, not as evidence.

## Decision summary

PumpAPI's live WebSocket and replay downloads are **currently accessible without an account, API key, or listed provider fee**. A fresh no-key WebSocket connected and delivered events; replay listings and archive bytes were also accessible. This verifies present availability, **not** production reliability, completeness, retention, schema stability, or an SLA. PumpAPI's terms expressly make the service “as is” / “as available,” disclaim accuracy and availability, and allow suspension or discontinuance at any time.

A free-only prototype is therefore a **candidate only if PumpAPI is replaceable** and the prototype implements reconnect, deduplication, gap detection, raw capture, and independent chain reconciliation where correctness matters.

## Verified claims

| Claim | Verification / correction | Primary source |
|---|---|---|
| Live stream has no listed provider fee. | **Verified as a current price claim.** Fees table says `Data Stream — FREE`; FAQ says it is completely free and works without signup/API key. “Free” does not eliminate client bandwidth, storage, or compute costs and is not a price guarantee. | https://pumpapi.io/fees · https://pumpapi.io/FAQ |
| Historical Replay has no listed provider fee. | **Verified as a current price claim.** Fees and FAQ call it free. | https://pumpapi.io/fees · https://pumpapi.io/FAQ |
| Live no-key WebSocket is reachable at `wss://stream.pumpapi.io/`. | **Observed 2026-08-26.** Fresh no-key TLS/WebSocket handshake completed in **0.433 s**; the first event arrived about **0.002 s later**. A second trial connected in **0.455 s** and produced a Pump AMM sell after **0.021 s**. This is a point observation, not latency or uptime evidence. | https://pumpapi.io/stream · `wss://stream.pumpapi.io/` |
| Stream includes transfers and Pump-family trade events. | **Observed.** Trial 1 received native-transfer-shaped events. Trial 2 received a `pump-amm` sell. Owner docs promise transfers, creations, buys, sells, migrations, pools, liquidity changes, and creator-fee claims, but this short trial did not independently verify every event class or completeness. | https://pumpapi.io/stream |
| Rich trade fields are currently emitted. | **Observed on one live sell:** signature, block, timestamp, action, signer/traders, mint/pool, token and quote amounts, price, market cap in quote, supply, pool token/quote/virtual quote values, name/symbol/URI, token program/extensions/authorities, priority fee, balances, fee rate, pool creator, burn label, mode flags, and creator-fee address. This supports the claimed schema family but does **not** independently prove the draft's prior specific buy observation. | https://pumpapi.io/stream |
| One upstream connection must be shared. | **Verified provider rule.** Stream docs say one connection and reuse it; FAQ clarifies a strict **1 connection per IP address** and recommends local fan-out. | https://pumpapi.io/stream · https://pumpapi.io/FAQ |
| Reconnect logic is required. | **Verified warning, not an SLA.** Docs explicitly say connections can drop due to server updates or network issues. | https://pumpapi.io/stream |
| Replay uses hourly `.jsonl.zst` archives and is browsable. | **Observed.** No-key listing requests worked at year/month/day prefixes. Bounded streaming decompression yielded valid JSONL. At audit time the owner listing contained 3,126 hourly objects from `2026/04/18/00.jsonl.zst` through `2026/08/26/06.jsonl.zst`. | https://pumpapi.io/historical-replay · https://replay.pumpapi.io/2026/ |
| Replay begins April 18, 2026. | **Verified current documented/observed boundary.** Pre-start test URLs for 2024 and 2025 returned 404; the first listed object was `2026/04/18/00.jsonl.zst`. | https://pumpapi.io/historical-replay · https://replay.pumpapi.io/2026/04/18/ |

## Candidate claims / unresolved production risks

| Claim | Status / required correction | Primary source |
|---|---|---|
| “PumpAPI live/replay is a verified production foundation.” | **Candidate, not verified.** It is verified as presently reachable. There is no published SLA, uptime, durability, completeness, recovery-time, or support commitment on the reviewed owner pages. Terms disclaim accuracy/availability and permit change, suspension, or discontinuance without liability. | https://pumpapi.io/legal |
| Stream sends “all events.” | **Provider promise only.** Docs say the server sends all events, but a short sample cannot establish chain completeness, ordering, duplicate behavior, rollback semantics, or finality. Reconcile signatures/slots against Solana for canonical records. | https://pumpapi.io/stream |
| Historical replay is suitable for unrestricted backfill. | **Candidate with operational caveats.** Listed files were **222–642 MB compressed per hour**; owner docs estimate ~400 MB compressed/~2 GB decompressed. The tested archive ignored `Range` and returned HTTP 200 rather than 206, so consumers should assume a full-object transfer. This is provider-fee-free, not resource-free. | https://pumpapi.io/historical-replay · https://replay.pumpapi.io/2026/04/18/00.jsonl.zst |
| Replay retention is dependable. | **Unverified.** The page states a start date but publishes no minimum retention period, deletion policy, durability guarantee, or SLA. Mirror required hours locally while available. | https://pumpapi.io/historical-replay · https://pumpapi.io/legal |
| Persisting/redistributing replay data is clearly licensed. | **Unverified legal right.** The reviewed Terms contain use terms and disclaimers but no explicit data license or redistribution grant. Free access is not itself a redistribution license. Confirm with PumpAPI before redistributing or productizing a retained corpus. | https://pumpapi.io/legal |
| Schema is stable enough to code directly. | **Unverified.** Use version-tolerant parsing and retain raw events. Owner pages publish examples/field descriptions, not a versioned compatibility or deprecation policy. | https://pumpapi.io/stream · https://pumpapi.io/historical-replay |

## Rejected or corrected claims

| Draft/provider claim | Finding and correction | Primary source / observation |
|---|---|---|
| “Historical files contain the exact same format as the live Data Stream.” | **Rejected literally.** The replay page itself says replay adds `localTimestamp`, which “does not exist” live. The launch-day replay sample used `txType`; current live samples used `action`. Treat historical and live payloads as related, evolving schemas, not byte/schema identity. | https://pumpapi.io/historical-replay · https://pumpapi.io/stream |
| “Everything is saved every hour” implies gap-free archives. | **Rejected as observed completeness.** The year listing had one missing hourly key: `2026/05/09/19.jsonl.zst` returned 404. From the first archive through the latest completed hour, 3,127 hourly positions were possible but only 3,126 were listed. Provider wording is a promise, not proof of every-hour availability. | https://pumpapi.io/historical-replay · https://replay.pumpapi.io/2026/ · https://replay.pumpapi.io/2026/05/09/19.jsonl.zst |
| Docs example: events from `2026-04-18 00:00` to `01:00` live at `/2026/04/18/01.jsonl.zst`. | **Off-by-one correction.** Observed `/00` begins with `localTimestamp` `2026-04-18T00:00:00.276Z` and was uploaded shortly after 01:00; `/01` begins at 01:00. Treat the key as the **starting UTC hour** (`/00` covers the 00:xx receipt hour). Chain `timestamp` can fall just outside the receipt hour because replay bucketing uses provider receipt time. | https://pumpapi.io/historical-replay · https://replay.pumpapi.io/2026/04/18/00.jsonl.zst · https://replay.pumpapi.io/2026/04/18/01.jsonl.zst |
| A third-party toolkit comment is the authority for one free stream per IP. | **Source correction.** Do not cite the toolkit. PumpAPI's own FAQ states the strict one-connection-per-IP rule; its stream page says one connection only. | https://pumpapi.io/FAQ · https://pumpapi.io/stream |
| “Verified” means promised uptime/accuracy. | **Rejected.** Owner Terms say “as is” and “as available,” disclaim accuracy and availability, disclaim outage/error liability, and permit unilateral suspension/discontinuance. Say **observed available on 2026-08-26**, not reliable or SLA-backed. | https://pumpapi.io/legal |

## Date/impossibility check

- The draft's local-trial date, **2026-08-26**, is **not future-dated** in this runtime: audit clock was `2026-08-26T07:37:14Z`. The new no-key observations independently support the rough “about 0.5 seconds” handshake claim but do not authenticate the draft's earlier exact event sequence.
- The replay start date (**2026-04-18**) and Terms update date (**2025-12-27**) are both in the past as of this audit.
- No reviewed primary source supports observations before the replay start date; tested 2024/2025 replay paths returned 404.

## Free-only prototype acceptance boundary

**Accept only as a candidate** with: one shared connection per egress IP; exponential reconnect; signature-based dedupe; observed-at and provider timestamp capture; tolerant live/replay adapters; missing-hour detection; local mirroring of needed replay hours; and an independently replaceable provider boundary. Do not claim SLA, archive completeness, fixed retention, finality, or schema stability. Do not use trade/create endpoints in this prototype: the owner fees page lists trading at 0.25%, outside FREE-ONLY scope.
