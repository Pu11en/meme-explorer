# Provider FREE-ONLY audit: Pump.fun data dependencies

**Audited:** 2026-08-26  
**Rule applied:** A service is **not FREE-ONLY** if normal use requires a funded wallet, purchased/metered balance, paid package, payment card, or temporary trial. A free API key or open-source client does not by itself prove free hosted service. “Observed” checks below were safe, unauthenticated point-in-time tests, not uptime measurements.

## Corrected concise claims

| Dependency / capability | Strict FREE-ONLY result | Corrected claim |
|---|---:|---|
| Bitquery Pump.fun GraphQL / subscriptions | **Reject** | Token-authenticated and quota/points-metered. Current pricing describes only a temporary 7-day trial before paid plans. WebSocket delivery is at-most-once with no replay; historical GraphQL access depends on paid plan/retention. |
| Bitquery CoreCast gRPC | **Reject** | Uses a Bitquery V2 token, but entitlement depends on the workspace plan. “Free API key” means free credential creation, not durable free service. No CoreCast replay; at-most-once delivery. |
| Bitquery Kafka | **Reject** | Enterprise/contact-sales credentials, paid access, checkpoint/offset replay only within retention. Technical docs state at-least-once semantics and possible duplicates; “100% guaranteed delivery” marketing is not exactly-once or indefinite replay. |
| PumpPortal `subscribeNewToken` / `subscribeMigration` | **Pass, narrow and fragile** | First-party fees call these event classes free, and a no-key WebSocket test received live token-creation events. This does **not** make PumpPortal’s token/account trade feeds free. No replay, retention commitment, delivery guarantee, or SLA was found. |
| PumpPortal `subscribeTokenTrade` / `subscribeAccountTrade` | **Reject** | Metered at **0.01 SOL per 10,000 events** and documented as requiring a PumpPortal API key. This fails the no-funded-wallet/no-metered-balance rule. |
| PumpAPI live Data Stream | **Pass** | Official pricing says Data Stream is free; `wss://stream.pumpapi.io/` accepted a no-key connection and delivered live events. No contractual delivery or uptime SLA was found. |
| PumpAPI Historical Replay | **Pass, retention uncommitted** | Official pricing says replay is free and hourly archives require no key. Recent archives were reachable, but the provider publishes no retention-duration commitment; do not claim permanent history. |
| PumpAPI Trade API | **Reject** | Trading is charged **0.25% of trade volume**. Its existence does not disqualify the separately free live/replay data endpoints, but trading itself is not FREE-ONLY. |
| Helius LaserStream | **Reject** | Mainnet requires Business/Professional. Devnet eligibility conflicts across first-party pages, and even the broadest interpretation bills streamed bytes in credits. A two-day trial is also advertised and is explicitly ineligible. |
| Triton One hosted Yellowstone / Dragon’s Mouth | **Reject** | Requires a customer endpoint/token and prepaid metered service: minimum $125 deposit and streaming bandwidth charges. Public `api.rpcpool.com` reachability is not free subscription access. |
| Self-hosted `yellowstone-grpc` | **Not a hosted provider** | AGPL-licensed source is available, but operating it requires an Agave validator/Geyser infrastructure. It has configurable—possibly zero—replay and no hosted SLA. Anza/solana-labs do not publish a free first-party Yellowstone endpoint in the reviewed material. |

## Evidence and semantics

### 1. Bitquery: GraphQL, CoreCast, and Kafka

- Pump.fun GraphQL/API access outside the IDE requires an access token; V2 uses `Authorization: Bearer …`: [Pump.fun API docs](https://docs.bitquery.io/docs/blockchain/Solana/Pumpfun/Pump-Fun-API/), [token generation](https://docs.bitquery.io/docs/authorization/how-to-generate/).
- Current [pricing](https://bitquery.io/pricing) describes a **7-day free trial** with a small quota, then paid Personal/Pro/Scale plans. The [points page](https://docs.bitquery.io/docs/ide/points/) instead says new users receive 10K free points for the first month. Both are temporary/metered and therefore fail this audit; the differing trial duration/quota is a first-party contradiction.
- Bitquery’s [streaming comparison](https://docs.bitquery.io/docs/streams/) describes GraphQL WebSocket and CoreCast as **at-most-once**, with no retention/replay. Historical GraphQL queryability is not equivalent to stream replay.
- [CoreCast introduction](https://docs.bitquery.io/docs/grpc/solana/introduction/) says it uses V2 tokens and that enablement depends on plan/account entitlements. The [CoreCast product page](https://bitquery.io/products/corecast) says “free API key”/“start streaming free” but also places use in paid plans with a 7-day trial. Treat the key as authentication, not proof of a perpetual free tier.
- Kafka requires separate support-issued SASL credentials; IDE credentials do not work. See [Kafka concepts](https://docs.bitquery.io/docs/streams/kafka-streaming-concepts/) and [Kafka product](https://bitquery.io/products/kafka-streams). It is Enterprise/contact-sales access.
- Kafka can resume from committed offsets within retention. Technical docs warn about duplicate messages and describe at-least-once delivery (exactly-once is configuration-dependent). The stated Proto-stream retention is **4 hours**. Marketing’s “100% guaranteed delivery + replay” is therefore bounded replay, not permanent history or unconditional exactly-once delivery.
- SLA is marketed under Enterprise, not trial/free access. No strict-free Bitquery SLA applies.

**Observed no-key check:** `GET https://streaming.bitquery.io/graphql` returned HTTP **401** with an instruction to provide documented authorization. This confirms auth enforcement but does not test an entitled stream.

### 2. PumpPortal

- [Fees](https://pumpportal.fun/fees/) say that, effective 2026-05-01, trading data requires a PumpPortal API key. They separately say `subscribeNewToken` and `subscribeMigration` data are free, while `subscribeTokenTrade` and `subscribeAccountTrade` are metered.
- The [Data API docs](https://pumpportal.fun/data-api/) and [Bonk API example](https://pumpportal.fun/data-api/bonk-fun-data-api/) document `wss://pumpportal.fun/api/data` and the subscription methods. The latter states token/account subscriptions are metered at **0.01 SOL per 10,000 events**.
- [Trading setup](https://pumpportal.fun/trading-api/setup/) creates an API-key-linked wallet and instructs the user to fund it for trading. That path is not FREE-ONLY.
- No first-party replay/archive, retention promise, delivery guarantee, public status history, or contractual SLA was found. The [terms](https://pumpportal.fun/legal/) disclaim guarantees rather than promise availability.

**Authentication boundary and observation:** the docs require a key for metered token/account trade subscriptions but call creation/migration events free. On 2026-08-26 a no-key connection to `wss://pumpportal.fun/api/data` upgraded successfully, accepted `{"method":"subscribeNewToken"}`, acknowledged the subscription, and delivered live creation events. This supports only the narrow free creation feed. It does not prove that paid trade subscriptions can be bypassed or that unauthenticated access will persist.

### 3. PumpAPI

- Official [fees](https://pumpapi.io/fees) list **Data Stream — FREE**, **Historical Replay — FREE**, and **Trade (buy/sell) — 0.25% of trade volume**.
- [Live-stream docs](https://pumpapi.io/stream) publish `wss://stream.pumpapi.io/` without an API key requirement.
- [Historical Replay docs](https://pumpapi.io/historical-replay) publish unauthenticated hourly URLs of the form `https://replay.pumpapi.io/YEAR/MONTH/DAY/HOUR.jsonl.zst`. They do not commit to a retention duration or completeness SLA.
- The [legal page](https://pumpapi.io/legal) provides the service “as is” and “as available”; no contractual availability/delivery SLA was found.

**Observed no-key checks on 2026-08-26:** the WebSocket upgraded and delivered live events. Replay `HEAD` checks returned **200** for completed UTC hours `2026/08/26/06` and `/07`, and for samples on `2026/08/25` and `2026/07/26`; `2026/01/01` returned **404**. These samples show current free availability and at least about one month of data, **not** a guaranteed retention floor.

### 4. Helius LaserStream

- The current [plans table](https://www.helius.dev/docs/billing/plans) gives no LaserStream to Free, Devnet to Developer ($49/month), and Devnet + Mainnet to Business/Professional. The [LaserStream overview](https://www.helius.dev/docs/laserstream) and [credits page](https://www.helius.dev/docs/billing/credits) conflict by saying Devnet is available on all plans. The latter still meters every user at **2 credits per 0.1 MB** of uncompressed stream data. Either interpretation fails FREE-ONLY.
- [Quickstart](https://www.helius.dev/docs/laserstream/grpc) requires a dashboard API key used as the authentication token. Helius also advertises an application-reviewed **2-day trial**, which is temporary and ineligible.
- [Historical replay](https://www.helius.dev/docs/laserstream/historical-replay) supports `fromSlot` for roughly **216,000 slots / 24 hours**. Roughly the latest 20 minutes preserve requested commitment/forks/intra-slot updates; older replay is finalized-only historical storage.
- The [delivery-guarantees page](https://www.helius.dev/docs/laserstream/delivery-guarantees) claims exactly-once delivery and no skipped/duplicate messages, with ordering qualifications. This conflicts with the overview’s “at-least-once” label and the [FAQ](https://www.helius.dev/docs/faqs/laserstream), which says ordering is not guaranteed. The [SDK repository](https://github.com/helius-labs/laserstream-sdk) also still describes only 3,000 slots/~20 minutes of backfill, conflicting with the current 24-hour service page.
- Contractual uptime commitments are reserved for custom Enterprise in [plans](https://www.helius.dev/docs/billing/plans); “maximum uptime” is marketing, not a free SLA.
- First-party status APIs—[status](https://helius.statuspage.io/api/v2/status.json), [components](https://helius.statuspage.io/api/v2/components.json), and [incidents](https://helius.statuspage.io/api/v2/incidents.json)—showed the service operational at audit time but retain a resolved network-degradation incident affecting LaserStream regions. Current green status does not prove an SLA.

**Observed no-key check:** generic HTTP/2 requests reached both Devnet and Mainnet LaserStream hosts and returned gRPC status 12 for an unsupported generic request. This proves edge reachability only, not authenticated subscription availability.

### 5. Yellowstone gRPC / Triton One

- Triton’s [`yellowstone-grpc` repository](https://github.com/rpcpool/yellowstone-grpc) is AGPL-3.0 server/client software built on Agave’s Geyser interface. Open source is not a public hosted endpoint.
- Hosted Dragon’s Mouth uses a customer endpoint and `x-token`: [subscription docs](https://docs.triton.one/project-yellowstone/dragons-mouth-grpc-subscriptions), [getting started](https://docs.triton.one/getting-started).
- Current [Triton pricing](https://www.triton.one/pricing/) requires a **minimum $125 prepaid, non-refundable deposit** valid for 12 months and charges streaming bandwidth (listed as **$0.08/GB**). It therefore fails FREE-ONLY.
- `from_slot` can replay server-retained updates before continuing live. `SubscribeReplayInfo` reports the first available slot; stale requests fail. Retention is not universal: self-hosted operators set `replay_stored_slots`, including zero. Reconnecting from the last slot can duplicate updates, so client-side deduplication is required. See the [Dragon’s Mouth replay documentation](https://docs.triton.one/project-yellowstone/dragons-mouth-grpc-subscriptions).
- Triton markets **99.99% uptime** on pricing, but the reviewed public material does not provide contractual SLA/remedy terms. Its former public Statuspage is deleted, so current public history could not corroborate the claim.

**Observed no-key check:** `https://api.rpcpool.com` returned HTTP **200** and identified Triton One RPC. That only establishes web-front-door reachability; it does not establish a free or working authenticated Yellowstone subscription.

## Adoption guidance

1. For a hard **$0/no-account-balance** pipeline, use only **PumpAPI live + replay**, or PumpPortal’s narrowly free creation/migration events, and design for gaps because neither publishes an SLA or durable delivery guarantee.
2. Do not describe any Bitquery offering, Helius LaserStream, or Triton-hosted Yellowstone endpoint as “free” under this policy.
3. Treat replay separately from live delivery: PumpAPI archives have unspecified retention; Bitquery GraphQL/CoreCast have no stream replay; Bitquery Kafka replay is retention-bounded; LaserStream is about 24 hours; Yellowstone replay is server-configured.
4. Persist signatures/slots, deduplicate, monitor gaps, and backfill independently. A successful WebSocket connection or green status page is not proof of completeness or SLA attainment.
