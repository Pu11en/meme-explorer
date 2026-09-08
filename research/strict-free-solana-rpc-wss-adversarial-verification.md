# Strict-free local Pump.fun recorder: Solana RPC/WSS and Old Faithful adversarial verification

**Runtime/access date:** 2026-08-26 UTC (`date -u` returned `2026-08-26T12:05:08Z`; fresh probes below ran through 12:08 UTC).  
**Evidence rule:** protocol/provider-owner documentation, owner repositories, and the repository's existing owner-source audits only. “Strict-free” rejects credits/CUs/request units, trials, funded-wallet or deposit requirements, paid plans, marketing-only assertions, and undocumented scraping. It does not mean local bandwidth, storage, and compute cost nothing.

## Verdict

The candidate is technically valid only as a **best-effort, local, raw-chain recorder with explicit gaps and later finalized reconciliation**:

- Solana's anonymous public mainnet RPC/WSS is the only evidenced live lane that passes the strict provider-fee rule without signup, key, card, credits, CUs, trial, or wallet funding. It can expose correctness-critical facts not supplied authoritatively by PumpAPI, but Solana explicitly says the public service is rate-limited, limits may change, traffic may be blocked, and it is **not intended for production**. It therefore cannot support “lossless,” “complete,” “archive,” or reliability claims. [Solana public clusters/endpoints](https://solana.com/docs/references/clusters)
- Triton Old Faithful is a **narrow optional historical backfill lane**, not a live RPC/WSS replacement. Triton says the archives usable with self-run Jetstreamer are *currently* hosted free, with no per-query credits/rate limits, but expressly says this is **subject to change**. It requires the user's own hardware/client and Pump/PumpSwap decoding. [Triton: free archive + Jetstreamer](https://blog.triton.one/streaming-solanas-history-the-open-path-to-backfill-indexing/) · [Old Faithful requirements](https://docs.old-faithful.net/running-old-faithful/requirements) · [Sourcing data](https://docs.old-faithful.net/running-old-faithful/sourcing-data)
- No owner source reviewed establishes an anonymous strict-free **production SLA**, complete live delivery, WSS replay/cursor, or guaranteed public-RPC history horizon. The safe product claim is “locally records what it observes and reconciles what the available RPC/archive can retrieve.”

## What is genuinely distinct beyond PumpAPI

PumpAPI's live and replay products are its own event feed and archived copies of that feed; replay adds eventual closed-hour access and a replay-only `localTimestamp`, not independent corroboration. [PumpAPI stream](https://pumpapi.io/stream) · [PumpAPI Historical Replay](https://pumpapi.io/historical-replay)

Raw Solana data adds a distinct, owner/protocol-level evidence plane:

1. **Finality and failure truth.** Store processed/confirmed observation separately from finalized reconciliation. `getTransaction` returns transaction metadata including `err`, fee, balances, logs, inner instructions, loaded addresses, token balances, and possibly compute units; `meta.err == null` means execution succeeded, while a non-null transaction error means the observed Pump log/instruction was in a failed transaction. [Commitment](https://solana.com/docs/rpc) · [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction) · [transaction JSON structures](https://solana.com/docs/rpc/json-structures)
2. **Canonical account identity/state.** Derive Pump/PumpSwap PDAs locally, then verify the returned account's program owner, discriminator, stored bump, mint/creator/index relationships, and finalized state rather than trusting a provider's `pool`, `migration`, `complete`, or market fields. Pump's owner docs distinguish bonding-curve completion from migration; PumpSwap's owner docs say Pump-migrated pools use canonical pool index `0`. [Pump program README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md) · [PumpSwap README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_README.md) · [Pump owner IDLs](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl)
3. **Raw instruction/account provenance.** Transaction messages, inner instructions, logs, pre/post balances, account data, slots, and signatures allow independent decoding and later re-decoding against a pinned Pump IDL/repository revision. This is materially different from retaining PumpAPI's derived event JSON.
4. **Independent historical reconstruction when available.** Public RPC `getSignaturesForAddress` plus `getTransaction`, or Old Faithful's historical `getTransaction`, `getBlock`, and `getSignaturesForAddress`, can reconstruct events absent from PumpAPI or test PumpAPI records. This is capability, not a completeness guarantee. [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress) · [Triton archival methods](https://docs.triton.one/chains/solana/old-faithful-historical-archive-1)

Not distinct chain truth: PumpAPI names/symbols/URIs and calculated price/market-cap fields remain provider-derived/enrichment unless separately decoded or fetched from the authoritative account/metadata source. Conversely, chain availability does not prove every convenience field PumpAPI emits can be reproduced without additional metadata reads.

## Viable live design and its hard boundary

- Subscribe with explicit commitment to Pump and PumpSwap program activity using `logsSubscribe` (the `mentions` filter accepts one pubkey, so use separate subscriptions as needed), immediately persist each raw notification and local receipt time, then fetch the transaction. [`logsSubscribe`](https://solana.com/docs/rpc/websocket/logssubscribe)
- Treat WSS as detection, not durable delivery. Solana PubSub documents subscribe/unsubscribe/notifications but no cursor, resume token, replay window, or automatic gap fill. After every disconnect: reconnect, resubscribe, HTTP-backfill from the last durable slot/signature, deduplicate by signature plus event/instruction ordinal, and reconcile at `finalized`. [Solana WebSocket methods](https://solana.com/docs/rpc/websocket)
- A log notification is not proof of success or finality. Fetch `getTransaction` with explicit `commitment:"finalized"` and `maxSupportedTransactionVersion`; retain failed transactions and missing transactions as distinct states. [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction)
- `getSignaturesForAddress` is newest-first, accepts `before`/`until`, and is capped at 1,000 results per request. It is bounded pagination, not an archive promise. [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress)
- Solana publishes public-endpoint limits but says they are subject to change. HTTP 403 means traffic was blocked; HTTP 429 means rate limiting and clients should honor `Retry-After` when the response supplies it. Protocol method existence does not guarantee that a public node enables it. [Solana public clusters/endpoints](https://solana.com/docs/references/clusters)

### Fresh repeated probes — 2026-08-26 12:05–12:08 UTC

These bounded repeats sharpen implementation behavior but remain one endpoint/source-IP observation, not an SLA, retention promise, or completeness measurement:

- **Historical status requires explicit history search:** 3/3 `getSignatureStatuses` calls with `searchTransactionHistory:true` returned the old Pump signature finalized at slot `388775295`, while a correctly sized all-zero signature returned a positional `null`. Without `searchTransactionHistory`, that same old Pump signature returned `null` in 3/3 calls. This directly confirms the owner-documented recent-status-cache boundary: historical/reconnect checks must set the flag and must still preserve `null` as unavailable/unknown. [`getSignatureStatuses`](https://solana.com/docs/rpc/http/getsignaturestatuses)
- **Malformed is not missing:** an invalid 88-character signature caused the entire `getSignatureStatuses` and `getTransaction` requests to fail with JSON-RPC `-32602` / `WrongSize`; it did not produce a valid positional/result `null`. Validate signature decoding/length before batching, and store invalid-parameter errors separately from valid unknown signatures.
- **Unknown transaction null repeated:** 3/3 `getTransaction` calls for a correctly sized unknown signature returned HTTP 200 with `result:null`, matching “not found or not confirmed at the requested commitment.” [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction)
- **Recent address history repeated:** 3/3 mint `getSignaturesForAddress` calls returned the same two finalized rows. This is short-run repeatability for that query, not a horizon or gap-free-history guarantee. [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress)
- **Method availability differs:** 3/3 `getSupply` calls succeeded but took 6.3–6.8 seconds; 3/3 `getTokenLargestAccounts` calls returned HTTP/JSON-RPC `429`/code `429` with **no `Retry-After` header** in this fresh run. Older repository observations did receive `Retry-After`, so header presence is not stable; use it when supplied and otherwise apply bounded exponential backoff with jitter plus method-level circuit breaking. [`getSupply`](https://solana.com/docs/rpc/http/getsupply) · [`getTokenLargestAccounts`](https://solana.com/docs/rpc/http/gettokenlargestaccounts)
- **`logsSubscribe` reconnect mechanics worked, not delivery completeness:** 5/5 fresh sockets acknowledged an explicit-finalized `logsSubscribe`, then acknowledged unsubscribe, in 151–204 ms. This measures only handshake/subscription recovery. It says nothing about notification completeness, replay, uptime, or gap recovery. [`logsSubscribe`](https://solana.com/docs/rpc/websocket/logssubscribe)
- **Use `signatureSubscribe` for forward finality, not historical lookup:** subscribing at finalized commitment to an already-old finalized signature acknowledged but emitted no notification within 8 seconds in 3/3 trials. By contrast, three signatures captured live at `processed` each emitted a finalized notification about 11.5 seconds later. This observation is consistent with the owner contract describing notification when a signature reaches the requested commitment, but it does not establish a historical replay service. After reconnect or for an already-old signature, query `getSignatureStatuses(searchTransactionHistory:true)`; reserve `signatureSubscribe` for signatures being tracked forward from live observation. [`signatureSubscribe`](https://solana.com/docs/rpc/websocket/signaturesubscribe) · [`getSignatureStatuses`](https://solana.com/docs/rpc/http/getsignaturestatuses)

## Exact null, error, omitted, and missing semantics

These states must never be collapsed into “not a Pump event,” “not migrated,” or `false`:

| Observation | Owner-defined meaning / safe recorder state |
|---|---|
| `getAccountInfo.value == null` | The account does not exist at that pubkey/response context. Record `account_absent_at_context`; do not infer permanent nonexistence. [`getAccountInfo`](https://solana.com/docs/rpc/http/getaccountinfo) |
| One `getMultipleAccounts.value[i] == null` | That requested account does not exist; preserve positional correspondence and the common context slot. [`getMultipleAccounts`](https://solana.com/docs/rpc/http/getmultipleaccounts) |
| `getTransaction.result == null` | Transaction not found **or not confirmed at the requested commitment**. This is `tx_unavailable_at_commitment`, not failed, not non-migrated, and not proof no event occurred. [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction) |
| Transaction `meta == null` | Transaction metadata is unavailable. The transaction's presence does not supply execution outcome/log/balance evidence. [transaction JSON structures](https://solana.com/docs/rpc/json-structures) |
| `meta.err == null` | Transaction succeeded. A non-null value is the transaction error; retain it rather than dropping the record. [transaction JSON structures](https://solana.com/docs/rpc/json-structures) |
| `innerInstructions == null` | Inner-instruction recording was not enabled for that transaction; it does not mean no CPI occurred. [transaction JSON structures](https://solana.com/docs/rpc/json-structures) |
| `preTokenBalances` / `postTokenBalances` omitted | Token-balance recording was not yet enabled for that transaction; omission is not a zero balance/change. [transaction JSON structures](https://solana.com/docs/rpc/json-structures) |
| `logMessages == null` | Log recording was not enabled for that transaction; not “no logs.” [transaction JSON structures](https://solana.com/docs/rpc/json-structures) |
| Signature status entry `null` | No status found in the searched status set. Use `searchTransactionHistory:true` when intentionally searching beyond the recent status cache; still preserve null as unknown/unavailable. [`getSignatureStatuses`](https://solana.com/docs/rpc/http/getsignaturestatuses) |
| `getSignaturesForAddress == []` | No rows returned for that endpoint/query window. It does not prove an address has no older history or that another endpoint/archive has none. [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress) |
| HTTP/JSON-RPC 403, 429, 5xx; timeout; socket close | Access block, rate limit, server failure, transport timeout, or disconnect. Store separately from every valid JSON-RPC null/empty result. For 429, honor `Retry-After` when supplied. [Solana public clusters/endpoints](https://solana.com/docs/references/clusters) |
| Decode failure / unknown discriminator / unsupported tx version | `schema_or_decoder_unknown`, never absence. Retain raw bytes/response plus IDL commit/hash and decoder version. [Pump owner IDLs](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl) |
| PumpAPI replay HTTP 404 | Archive object unavailable at that key; not proof of no on-chain activity. PumpAPI documents hourly objects but no gap/completeness SLA. [PumpAPI Historical Replay](https://pumpapi.io/historical-replay) |

For Pump lifecycle specifically, preserve at least: `curve_incomplete`, `curve_complete_not_migration_proven`, `canonical_pool_verified`, `migration_tx_verified`, `account_absent_at_context`, `tx_unavailable_at_commitment`, `rpc_pruned_or_unknown`, `provider_gap`, and `decode_error`. Completion must not be promoted to migration solely from `complete == true`; verify the canonical PumpSwap pool/account relationship and, when available, the successful finalized migration transaction/event against pinned Pump owner docs/IDL.

## Strict-free and owner-terms screen

### Accepted narrowly

- **Solana public mainnet RPC/WSS:** anonymous and non-credit-metered, but best effort only. The owner warns against production use, allows changing limits, and documents blocking/rate-limit behavior. [Solana public clusters/endpoints](https://solana.com/docs/references/clusters)
- **Old Faithful public archives with self-run Jetstreamer:** current owner claim is free hosting with no per-query credits/rate limits, explicitly subject to change. It is historical raw-chain infrastructure, not hosted live WSS or an SLA. The owner repository is open source; software-license obligations are separate from any rights in third-party ledger/application content. [Triton article](https://blog.triton.one/streaming-solanas-history-the-open-path-to-backfill-indexing/) · [Old Faithful repository](https://github.com/rpcpool/yellowstone-faithful) · [Old Faithful RPC server](https://docs.old-faithful.net/usage/rpc-server)

### Rejected from the strict core

- Any plan described in monthly **credits, compute units, request units, API credits**, or prepaid balance, even if priced `$0`.
- Any temporary **trial**, card-dependent offer, paid package, overage path, or Triton hosted service requiring a wallet deposit/funding.
- Any trade/private-key path or stream that requires a **funded wallet**. Recording public chain data does not require signing transactions.
- Marketing claims such as “archive,” “unlimited,” “production-grade,” or “all events” without an owner contract defining retention, completeness, limits, and failure semantics.
- Undocumented Pump.fun/PumpAPI frontend endpoints, scraping, private routes, or reverse-engineered APIs. The accepted path uses documented Solana RPC/WSS, Pump's public protocol docs/IDLs, and documented Old Faithful interfaces only.

PumpAPI itself currently labels Data Stream and Historical Replay free, but its terms provide the service “as is” and “as available,” disclaim accuracy/availability, and permit modification/suspension/discontinuance; no explicit archive-data redistribution grant was found in the reviewed owner terms. Free access is not an SLA or redistribution license. [PumpAPI fees](https://pumpapi.io/fees) · [PumpAPI FAQ](https://pumpapi.io/FAQ) · [PumpAPI legal](https://pumpapi.io/legal)

## Old Faithful operational correction

Old Faithful should not be presented as “free archive RPC” without qualification:

- Triton's documented examples cover historical `getTransaction`, `getBlock`, and `getSignaturesForAddress`, but operation is epoch/archive oriented and self-run. [Triton archival methods](https://docs.triton.one/chains/solana/old-faithful-historical-archive-1) · [Old Faithful RPC server](https://docs.old-faithful.net/usage/rpc-server)
- Local hosting is resource-heavy; owner docs state a full local copy is roughly **250 TiB archive data plus 50 TiB indexes**. Jetstreaming selected history can avoid a full mirror but still consumes user compute, storage, and bandwidth. [Making a local copy](https://docs.old-faithful.net/hosting/making-a-local-copy)
- The free hosted archive statement is explicitly “currently” and “subject to change.” Therefore it is an optional recoverability improvement, not a durable entitlement or completeness foundation. [Triton article](https://blog.triton.one/streaming-solanas-history-the-open-path-to-backfill-indexing/)

## Date check and corrections to existing audits

The repository contains several audit files labeled **2026-08-26**. This report did not assume those observations were temporally possible: the runtime clock was checked directly and returned `2026-08-26T12:05:08Z`, and the incorporated probes ran through 12:08 UTC, so that date is **not future-dated relative to this runtime**. If this file is read or regenerated under a runtime earlier than 2026-08-26, all purported 2026-08-26 probes must be treated as future claims and unverifiable until independently rerun; document text alone cannot authenticate a future observation.

Key corrections consolidated from the existing audits:

1. Replace “strict-free production recorder” with **best-effort recorder plus explicit gap/finality reconciliation**.
2. Replace “Solana RPC provides archive” with **historical retrieval is endpoint-dependent and has no public free retention guarantee**.
3. Replace “WSS gives all Pump events” with **WSS detects observed notifications and has no documented replay/cursor/completeness contract**.
4. Replace “completion means migrated” with **completion and canonical PumpSwap migration are independently verified states**.
5. Replace “Old Faithful is a free hosted archive RPC” with **self-run historical tooling over currently free, subject-to-change hosted archives; no live WSS/SLA**.
6. Preserve valid null, omitted, empty, HTTP error, transport error, prune/retention unknown, malformed-signature error, and decode error as separate states.
7. Replace “`signatureSubscribe` checks any finalized signature” with **forward finality tracking for live-observed signatures; use `getSignatureStatuses(searchTransactionHistory:true)` for old/reconnect checks**.

## Acceptance gate

Proceed only if the implementation:

- stores raw WSS notifications and RPC/archive responses before decoding;
- records endpoint, receipt time, slot, commitment, signature + event/instruction ordinal, transaction version, `meta.err`, decoder version, and pinned Pump docs/IDL commit/hash;
- detects disconnects and performs bounded HTTP/archive gap backfill plus deduplication;
- uses `signatureSubscribe` only for forward tracking and `getSignatureStatuses(searchTransactionHistory:true)` for old/reconnect checks;
- validates signature size before RPC batching and keeps `-32602` malformed input distinct from valid `null` results;
- reconciles at finalized commitment and never turns null/empty/error into a negative lifecycle fact;
- contract-tests public RPC methods and rate-limit behavior continuously;
- treats Old Faithful as optional historical recovery and PumpAPI as replaceable hints/enrichment;
- makes no claim of production SLA, completeness, fixed retention, lossless WSS, or permanent free access.

Under those constraints, the concept adds real, independent chain evidence beyond PumpAPI. Without them, “strict-free recorder” overstates both reliability and historical completeness.
