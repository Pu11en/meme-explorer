# Strict-free Solana RPC/WSS capability audit — 2026-08-26

**Snapshot/access date:** 2026-08-26 UTC (the runtime clock was `2026-08-26`; probes ran at 11:43 UTC and shortly afterward). This date is therefore not projected. Pages without an owner-published modification date are evidence as accessed on this date, not proof that their contents will remain unchanged.

**Strict rule:** reject any path governed by monthly credits, compute units, request units, prepaid balance, funded wallet, card requirement, paid package, or temporary trial. A per-second anti-abuse rate limit is not a quota-credit plan. Distinguish an anonymous no-key public endpoint from an account/API-key free tier.

**Source rule:** provider/protocol owner documentation, owner status pages, and low-volume no-key probes only. Probe success shows point-in-time behavior from one source IP; it is not an SLA, retention promise, or global limit measurement.

## Conclusion

Only two current **anonymous, no-card, no-key, non-credit-metered** Solana RPC/WSS lanes were found:

1. **Solana-operated public mainnet RPC/WSS** — the only strict lane that covered all requested primitives in low-volume probes: finalized status, transaction retrieval, SOL/token supply, token accounts, and address-signature history. It is explicitly unsuitable for production, has no archive guarantee, and can disable individual methods with HTTP 429.
2. **Allnodes PublicNode anonymous Solana RPC/WSS** — works for finalized status, transaction retrieval, and recent address history, but anonymous supply/token-account/indexed calls were blocked, recent HTTP calls hit 429, and archive access is presented separately. It is not a complete substitute.

**No strict-free provider is evidenced as materially more reliable.** Solana disclaims production use; PublicNode publishes no owner SLA or numeric anonymous limit found in this audit and failed required methods; a single successful socket or marketing phrase is not comparative reliability evidence. Use either only as best-effort input, store raw results locally, and reconcile/backfill gaps. A production-completeness claim requires measured multi-day comparison or a paid/self-hosted endpoint.

## Strict eligibility matrix

| Lane | Strict result | Why |
|---|---|---|
| `https://api.mainnet.solana.com` / `wss://api.mainnet.solana.com` | **Pass, best effort** | Owner-documented public endpoint; no account/key/credit balance. Solana explicitly says public RPC is rate-limited, limits may change, traffic may be blocked, and it is not intended for production. |
| `https://solana-rpc.publicnode.com` / matching `wss://` | **Pass, partial** | Owner page markets a free public Solana RPC/WS endpoint; anonymous HTTP and WSS worked. Required indexed methods were blocked or token-gated, and no archive/SLA commitment was found. |
| `https://solana.drpc.org` anonymous public lane | **Fail as a current Solana option** | dRPC owner docs describe public nodes as always free, but every safe Solana HTTP probe returned HTTP 400 / code 35, “chain is not available on free plan”; no-key WSS closed without a response. |
| Shyft Free | **Not admitted** | It is the one non-credit-metered hosted near-miss: owner pricing says $0, unlimited credits/no credit consumption, and 10 RPC requests/s. However RPC access requires an API key and the reviewed owner pages do not establish no-card onboarding. It is not an anonymous public service; no free SLA is published. |
| Helius Free | **Reject** | 1M monthly credits; standard WSS is also credit-metered. No-card wording does not rescue a quota-credit plan. |
| Alchemy Free | **Reject** | 30M compute units/month. |
| Chainstack Developer | **Reject** | 3M request units/month, despite explicit no-card/no-trial wording. |
| Ankr Freemium | **Reject** | 200M API credits/month. |
| QuickNode $0 offer | **Reject** | One-month free trial and 10M credits. |
| NoLimitNodes | **Reject as durable strict-free** | Owner pages conflict: an older landing page says free forever/no card/unlimited requests, while the current development site calls the on-ramp a free trial and current pricing lists WebSocket access as paid. The temporary/current term controls; do not infer a durable entitlement from stale marketing. |
| Triton Old Faithful public archive | **Narrow pass, not live managed RPC/WSS** | Triton says it currently hosts archives for self-run Jetstreamer for free with no per-query credits/rate limits, but explicitly says “subject to change.” Useful for historical backfill on user-supplied hardware; not a live hosted RPC/WSS entitlement or SLA. |

Primary eligibility sources: [Solana clusters/public RPC](https://solana.com/docs/references/clusters), [PublicNode Solana](https://solana.publicnode.com/), [dRPC Solana API](https://drpc.org/docs/solana-api), [dRPC rate limiting](https://drpc.org/docs/howitworks/ratelimiting), [Shyft pricing](https://shyft.to/solana-rpc-grpc-pricing), [Shyft RPC access](https://docs.shyft.to/solana/shyft-rpcs), [Helius credits](https://www.helius.dev/docs/billing/credits), [Alchemy plans](https://www.alchemy.com/docs/reference/pricing-plans), [Chainstack pricing](https://chainstack.com/pricing/), [Ankr service plans](https://www.ankr.com/docs/rpc-service/service-plans/), [QuickNode pricing](https://www.quicknode.com/pricing), [NoLimitNodes current development site](https://dev.nolimitnodes.com/), [NoLimitNodes pricing](https://nolimitnodes.com/pricing), [Triton free public archive/Jetstreamer](https://blog.triton.one/streaming-solanas-history-the-open-path-to-backfill-indexing/).

## Requested capabilities

| Capability | Canonical RPC/WSS handling | Solana public | PublicNode anonymous |
|---|---|---|---|
| **Distinct finalized confirmation** | HTTP `getSignatureStatuses` exposes `confirmationStatus`; use `searchTransactionHistory:true` outside the recent status cache. WSS `signatureSubscribe` accepts `commitment:"finalized"` and notifies when that signature reaches the requested level. Preserve this separately from `processed`/`confirmed`. | **Yes.** HTTP returned `finalized`; finalized WSS subscription acknowledged and notified. | **Yes, observed.** Same finalized HTTP/WSS flow worked. |
| **Transaction reconstruction** | `getTransaction(signature,{commitment:"finalized",encoding:"json",maxSupportedTransactionVersion:0})`; response can contain message/instructions and metadata such as error, fee, balances, token balances, inner instructions, logs, loaded addresses, and compute units. Version handling must be explicit. | **Yes, best effort.** A current finalized transaction returned. A valid-shaped unknown signature returned HTTP 200 with `result:null`, matching the owner spec’s “not found at requested commitment” behavior. | **Yes for a current transaction.** Later anonymous calls hit rate limiting; no archive completeness is established. |
| **Supply** | `getSupply` for cluster SOL supply; `getTokenSupply` for one mint. Both accept commitment and return a context slot. | **Yes, observed at `finalized`.** `getSupply` took about 7.3 s in one probe; `getTokenSupply` returned HTTP 200. | **No for the strict anonymous lane in the probe.** Both `getSupply` and `getTokenSupply` returned HTTP 403 saying indexed requests require a personal token. |
| **Token accounts** | `getTokenAccountsByOwner` accepts either mint or token-program filtering plus commitment/encoding. It is a current-state query, not a historical owner ledger. For concentration, `getTokenLargestAccounts` is only the 20 largest token accounts, not beneficial owners. | **Partly usable.** `getTokenAccountsByOwner` succeeded; `getTokenLargestAccounts` returned HTTP 429 with per-method limit 0. Contract-test each method. | **No for required anonymous indexed calls in the probe.** `getTokenAccountsByOwner` returned HTTP 403 “Request blocked”; token-supply/largest-account calls required a personal token. |
| **Address history** | `getSignaturesForAddress` returns newest-first signature records with commitment and supports `before`/`until` pagination; a call returns at most 1,000. Fetch each transaction separately and retain null/missingness. | **Yes, bounded/best effort.** Current history and corresponding transaction retrieval worked; no retention SLA. | **Recent history observed.** One current signature returned, but no guaranteed horizon or full archive. |

Protocol sources: [commitment](https://solana.com/docs/rpc), [`getSignatureStatuses`](https://solana.com/docs/rpc/http/getsignaturestatuses), [`signatureSubscribe`](https://solana.com/docs/rpc/websocket/signaturesubscribe), [WebSocket methods/default commitment](https://solana.com/docs/rpc/websocket), [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction), [transaction JSON](https://solana.com/docs/rpc/json-structures), [`getSupply`](https://solana.com/docs/rpc/http/getsupply), [`getTokenSupply`](https://solana.com/docs/rpc/http/gettokensupply), [`getTokenAccountsByOwner`](https://solana.com/docs/rpc/http/gettokenaccountsbyowner), [`getTokenLargestAccounts`](https://solana.com/docs/rpc/http/gettokenlargestaccounts), [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress).

## Limits, nulls, 429, and history horizon

### Solana-operated public endpoint

Owner-published public limits are **100 requests/10 seconds/IP**, **40 requests/10 seconds/IP for one RPC**, **40 concurrent connections/IP**, **40 connection attempts/10 seconds/IP**, and **100 MB/30 seconds**; Solana says these are subject to change. HTTP 403 means blocked traffic; HTTP 429 means a rate limit was exceeded, and clients should honor `Retry-After` ([clusters/public RPC](https://solana.com/docs/references/clusters)).

Observed on 2026-08-26:

- Runtime headers advertised a different transient policy: `x-ratelimit-rps-limit: 250`, connection/connection-rate 40, PubSub 10, and method-specific limits varying by method (5, 10, or 150). These headers do not override the owner’s no-SLA warning.
- One `getTokenLargestAccounts` call returned **HTTP 429**, JSON-RPC code 429, `Retry-After: 10`, and `x-ratelimit-method-limit: 0`. The endpoint can therefore disable a supported protocol method independently of aggregate RPS.
- `getTransaction` for a valid-shaped unknown signature returned **HTTP 200 + `result:null`**. Null is data absence/not found at the requested commitment, not transport success for reconstruction.
- `getFirstAvailableBlock` returned `0`, while `minimumLedgerSlot` returned `441798099`. They measure different things; neither proves that every old transaction is retrievable. The owner publishes no free archive horizon.
- `getSignaturesForAddress` + `getTransaction` succeeded for a current finalized signature. A known finalized Pump migration transaction at slot `388775295` was also retrievable, proving at least one substantially older transaction was available; this is not a complete horizon guarantee. Historical pagination remains bounded and may still end in empty/null responses.
- Five bounded fresh WSS cycles each connected, acknowledged `logsSubscribe` at explicit `finalized`, acknowledged unsubscribe, and completed in approximately **640–741 ms**. This measures handshake/subscription recovery only—not notification completeness, replay, uptime, or gap recovery.

### PublicNode anonymous endpoint

The owner Solana page exposes RPC and WS endpoints and a separate **“Get Archive Access”** action ([PublicNode Solana](https://solana.publicnode.com/)). No numeric anonymous request, connection, subscription, retention, or reconnect limit was found in reviewed owner material.

Observed on 2026-08-26:

- `getHealth`, current `getSignaturesForAddress`, `getSignatureStatuses`, and `getTransaction` returned HTTP 200.
- Supply and token indexed methods returned **HTTP 403** with either “Indexed requests require a personal token” or “Request blocked.”
- A later `getTransaction` probe returned **HTTP 429**, code `-32005`, “Rate limit exceeded,” with **no `Retry-After` header**. This low-volume sequence is only a source-IP observation, not a universal numeric cap.
- `getFirstAvailableBlock` returned approximately `441370632` and `minimumLedgerSlot` `441370391`, consistent with a pruned local horizon rather than anonymous genesis archive. The same known finalized Pump migration transaction at slot `388775295` that Solana public returned produced HTTP 200 + `result:null` here. Do not translate the slot gap into a guaranteed number of hours/days.
- Across five bounded fresh WSS cycles, **4/5** acknowledged finalized `logsSubscribe` plus unsubscribe in approximately **271–310 ms**; one cycle produced no acknowledgement before an **8 s timeout**. A separate immediate two-cycle repeat was 2/2 successful and is included in that 4/5 total. This tiny shared-egress sample documents reconnect behavior but cannot establish an availability rate.

### dRPC anonymous endpoint

Although owner docs describe public nodes as free and give `https://solana.drpc.org/` examples, current safe probes returned HTTP 400/code 35 for all tested Solana methods: **“chain is not available on free plan, please upgrade to paid plan.”** A no-key WSS attempt closed without a JSON-RPC response. Current runtime behavior controls the strict verdict; documentation alone does not make it a working Solana option.

### Triton Old Faithful public archive

Triton's owner post says its archives can currently be used by self-run Jetstreamer **for free**, with **no per-query credits or rate limits**, and explicitly qualifies that hosting as **subject to change**. Owner docs identify historical `getTransaction`, `getBlock`, and `getSignaturesForAddress` access. This is distinct historical reconstruction/backfill capability and can exceed a pruned anonymous node's horizon, but it requires the user's own client/hardware and supplies no live WSS, managed endpoint SLA, or durable hosting entitlement. Sources: [free public archive/Jetstreamer](https://blog.triton.one/streaming-solanas-history-the-open-path-to-backfill-indexing/), [archive methods](https://docs.triton.one/chains/solana/old-faithful-historical-archive-1).

## Commitment and reconnect rules

- Name the state in storage: `observed_processed`, `observed_confirmed`, and `reconciled_finalized` must not collapse into one boolean. The [commitment definitions](https://solana.com/docs/rpc) make these confidence levels distinct.
- For one transaction, use `signatureSubscribe` with explicit `finalized`; do not rely on defaults even though the WebSocket overview says subscriptions default to finalized when commitment is omitted.
- Use HTTP `getSignatureStatuses(..., searchTransactionHistory:true)` after reconnect or for older signatures; without that flag only the recent status cache is searched.
- Solana PubSub defines subscribe/unsubscribe and notifications, but no cursor, resume token, replay window, or automatic client reconnection. PublicNode publishes no stronger reconnect contract. A disconnect therefore requires **reconnect → resubscribe → HTTP backfill from the last durable signature/slot → deduplicate → finalized reconciliation**.
- `signatureSubscribe` is transaction-specific, not a complete address-history stream. For address activity, combine an appropriate live subscription with `getSignaturesForAddress` pagination and transaction fetches after any gap.
- Back off HTTP 429 using `Retry-After` when present; when absent (observed on PublicNode), use bounded exponential backoff with jitter and a circuit breaker. Record 403, 429, timeout, socket close, empty list, and `result:null` as distinct outcomes.

## Reliability decision

There is **no owner-source basis to call one strict no-key service materially more reliable**:

- Solana’s owner documentation expressly rejects production dependence and warns that limits can change without notice. Its [status page](https://status.solana.com/) reports cluster/RPC component state, not a contractual free-RPC SLA or per-request completeness.
- PublicNode’s owner page provides a public service and marketing language, but no reviewed numerical anonymous limits, archive guarantee, reconnect/replay promise, or SLA. It also failed two requested capability classes in direct probes.
- dRPC’s load-balancing description is not relevant when the current anonymous Solana lane returns “not available on free plan.”
- Shyft may be operationally preferable after authenticated signup, but strict eligibility is not proven and no free SLA exists; it cannot answer the no-key/no-card question.

**Recommendation:** for a strict prototype, use Solana public as the primary capability-complete diagnostic lane and PublicNode only as a partial independent check for status/transaction/recent-history agreement. Do not promise uptime, archive completeness, or lossless WSS. A material-reliability claim needs a preregistered 24-hour-or-longer dual-feed test measuring disconnects, duplicate/missing signatures, 403/429/null rates, finalization lag, and backfill recovery.
