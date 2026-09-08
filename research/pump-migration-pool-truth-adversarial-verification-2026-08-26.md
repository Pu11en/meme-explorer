# Adversarial verification: strict-free Pump migration and pool truth

**Evidence cutoff:** 2026-08-26 11:58 UTC  
**Scope:** no account, API key, card, credits/CUs, funded wallet, paid trial, transaction, or undocumented scraping. Owner docs, pinned owner IDLs, and bounded no-key probes only. “Observed” is not an SLA.

## Verdict

The candidate is technically sound after narrowing its product claim. A local PDA/account/transaction decoder adds authoritative finalized state and byte-level identities that PumpAPI does not provide, but a **reliable complete recorder is not supportable on documented strict-free guarantees**. Solana public RPC is explicitly rate-limited/non-production and third-party free feeds have no completeness, replay, retention, latency, or uptime SLA.

Do not count launch-only discovery as a migration capability. Reject PumpPortal token/account trade subscriptions under strict-free because owner docs require a key linked to a wallet funded with at least 0.02 SOL and meter the stream. PumpPortal `subscribeMigration` is only an opportunistic live trigger. DEX Screener and Jupiter add indexed/route corroboration, not Pump migration truth, and are not needed for the canonical decision.

## What is genuinely distinct beyond PumpAPI

PumpAPI supplies candidate provider records (`signature`, action/legacy transaction type, mint, pool, provider times, derived reserves and labels). The local verifier adds materially different data:

1. finalized RPC `context.slot`, account owner and exact raw account bytes;
2. locally derived Pump curve, Pump `pool-authority`, canonical index-0 PumpSwap pool, LP-mint PDA, and vault relationships;
3. exact integer curve state (`complete`, `real_token_reserves`) rather than provider floating progress/reserve assertions;
4. exact PumpSwap Pool identity fields, including bump/index/creator/base/quote/LP/vault identities;
5. finalized transaction success/failure (`meta.err`) and exact outer/inner instruction and event bytes when history is retained;
6. explicit current-state-versus-history and unknown/gap classifications.

These are correctness and audit-evidence additions. They do **not** create guaranteed discovery coverage, archival history, or uptime.

## Pinned schema verification

The owner repository commit [`9c82f61cb711b044a17f770ab8ce9f9bdf78f333`](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333) was retrievable. Its commit time is 2026-07-15T18:22:27Z. Fresh downloads produced:

- `idl/pump.json`: SHA-256 `b90bc471327f671449271d5d1d42354d1fae6f5a06502f5834459a3108138e49`; Pump address `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`; candidate Pump account/instruction/event discriminators and `BondingCurve` field order matched.
- `idl/pump_amm.json`: SHA-256 `6b5c7ec4e5ef9742fa99dc57b0d75b1031b379bba02a7e1b3c5a4cad68d77e56`; PumpSwap address `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`; candidate `create_pool`, `CreatePoolEvent`, Pool discriminator, and Pool field order matched.

The pinned [Pump README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md) separates completion from permissionless/idempotent migration. The pinned [PumpSwap README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_README.md) and [creator-fee README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_CREATOR_FEE_README.md) support the generic pool seeds and Pump migration creator/index interpretation.

The exact SOL/WSOL derivation must remain pin-scoped; do not generalize it to other quote mints. Do not exact-size filter extensible accounts. A published IDL is owner-declared schema, not proof that an upgradeable deployed binary always matches it; fail closed and retain bytes.

## Corrected proof levels

- **Completed curve:** at a recorded finalized response context, curve exists, owner is Pump, discriminator/layout match, `complete == true`, and `real_token_reserves == 0`.
- **Current migration state:** the independently derived canonical SOL/WSOL pool exists and passes PumpSwap owner, discriminator, bump, index 0, Pump pool-authority creator, base/quote mint, LP-mint, and vault checks. This proves current canonical pool state even if transaction history is unavailable.
- **Full historical proof at this pin:** a successful finalized transaction with Pump `migrate`, PumpSwap `create_pool` CPI, and matching pinned Pump/PumpSwap migration/create-pool event bytes, all reconciled to the same local derivations.
- **Provider record:** remains provisional until reconciled. Completion is not migration; any same-pair pool is not necessarily canonical; migration caller `user` is not token-creator proof.

Call `getMultipleAccounts` a **single-response finalized slot-context snapshot**, not an unqualified atomic snapshot. Across providers, `minContextSlot` only imposes a floor; responses can be at different slots. Compare immutable identity fields and preserve each response slot. Do not require mutable account bytes to match across different slots.

## Exact missing/failure semantics

Never coerce these cases into `not_completed` or `not_migrated`:

- HTTP 429/5xx/timeout/TLS/WSS close: transport/provider availability failure; affected interval is `unknown_gap` until backfilled.
- JSON-RPC `error`: request/node failure; retain code/message/data.
- `getTransaction` JSON result `null`: Solana documents “not found at requested commitment”; classify `transaction_unavailable_from_endpoint`, not failed or absent forever. “Pruned” is only a more specific diagnosis when independently established.
- `getAccountInfo`/`getMultipleAccounts` null value: no account returned by that endpoint at the response context; recheck endpoint/slot/derivation before a semantic absence decision.
- transaction object with `meta.err != null`: transaction executed unsuccessfully; do not accept migration evidence from its instructions/logs.
- unknown transaction version/discriminator/short or extended-unapproved layout/parser error: `decode_unsupported_or_failed`; retain raw bytes and fail closed.
- PumpAPI replay HTTP 404: replay object unavailable at probe time, not proof the hour had zero events. The known `2026/05/09/19` key returned 404 twice while `2026/04/18/00` returned 200 twice.
- PumpAPI/PumpPortal WebSocket silence: no delivered matching frame during the observed window, not “no migration.” A subscription acknowledgement proves only acknowledgement.
- DEX Screener empty/null: `not_indexed_or_unavailable`, not no pool. Jupiter no route is amount/request/market-state specific, not no migration.

Preserve distinct states: `incomplete`, `completed_not_yet_migrated`, `canonical_pool_state_verified_history_unknown`, `migration_tx_and_state_verified`, `provider_unreconciled`, and the failure classes above.

## Repeated probes

At 2026-08-26 11:56–11:57 UTC:

- Five sequential no-key `getVersion` calls to `https://api.mainnet.solana.com` returned HTTP 200, `solana-core 4.2.0`, feature set `565236538`, and runtime `free`/method-limit headers; latency was 0.042–0.102 s. This is reachability only.
- Three reads of PumpAPI’s documented migration signature returned finalized slot `388775295`; three syntactically valid unknown-signature reads returned HTTP 200 with JSON `result:null`.
- Three reads of an official example curve returned non-null account values; three random-account reads returned HTTP 200 with `value:null`.
- Three sequential no-key PumpAPI WebSocket connections each delivered a frame after connection; all three sampled frames were `action:"transfer"`. This verifies reachability/schema samples, not migration coverage.
- Three sequential anonymous PumpPortal `subscribeMigration` probes were acknowledged; one six-second window delivered one `txType:"migrate"` frame and two delivered none. This demonstrates why silence is not absence and why acknowledgement is not completeness.
- Owner documentation pages for PumpAPI, PumpPortal, DEX Screener and Jupiter returned HTTP 200 during bounded checks.

The existing positive control remains useful: PumpAPI signature `4nownD6mfEWqPobc7TrfYk6VyTiqdyzkXqgSbJb2hNVxsXoNfAQADJBRP3JzuYX921NTyY9TLNVZnREdcbo3D4NP` was repeatedly available at finalized slot `388775295`. One sample validates the decoder method, not provider completeness.

## Owner terms and licensing

- [PumpAPI legal](https://pumpapi.io/legal): service is “as is/as available,” with no accuracy/availability guarantee and suspension/discontinuance risk; reviewed terms contain no explicit redistribution/data-license grant.
- [PumpPortal terms](https://pumpportal.fun/legal/): limited, personal, non-transferable, revocable license; restrictions include unauthorized copying/publishing/distribution/access; service may be restricted and is provided without reliability guarantees. Free data pricing is not redistribution or commercial-use permission.
- [PumpPortal fees](https://pumpportal.fun/fees/) and [real-time docs](https://pumpportal.fun/data-api/real-time/): migration/new-token subscriptions have no data charge; token/account trade subscriptions are funded-wallet/metered and therefore rejected here. The documented URL includes an API key, so anonymous acceptance is observational, not contractual.
- [DEX Screener API terms](https://docs.dexscreener.com/api/api-terms-and-conditions) and [API reference](https://docs.dexscreener.com/api/reference) govern use/rate limits; do not infer redistribution rights or completeness from public reachability.
- [Jupiter setup/plans](https://developers.jup.ag/docs/portal/setup): keyless access is rate-limited and positioned for testing/AI-agent use; it is not a free production SLA.
- The pinned `pump-public-docs` repository reports no detected license and returned 404 for `LICENSE` at the pin. Implementing a published interface is distinct from copying repository code; obtain legal review before copying/redistributing it.

## Practical acceptance tests

1. Pin commit plus exact downloaded IDL hashes, program IDs, discriminators, layouts, parser version, and PDA seeds/bumps; fail closed on drift.
2. Persist raw provider frames, raw RPC responses/account/transaction bytes, endpoint, local receipt time, provider time, commitment, context slot, signature, block time, `meta.err`, and event ordinal.
3. Re-read finalized curve and canonical pool in one `getMultipleAccounts` response; validate owners, layouts and all identity invariants.
4. Reconcile provider events only after finalized success and exact local identities; retain provisional, rollback, failed, duplicate and missing outcomes.
5. Run completed-hour PumpAPI live/replay versus finalized-chain coverage tests keyed by `(signature,event type,event ordinal,pool)`; count missing replay objects, misses, extras, duplicates and schema fingerprints.
6. Force/test HTTP 429, timeout, JSON-RPC error, transaction null, account null, failed transaction, unsupported version, unknown discriminator, short layout, WSS disconnect and parser failure separately.
7. Reconnect with bounded backoff and record explicit gap intervals; backfill only from documented sources. Never claim recovered coverage unless measured.
8. Compare a second ongoing-$0 RPC operator only as endpoint-diversity evidence. Preserve slots and disagreements; do not call it independent chain truth or a free SLA.

## Sources

- https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333
- https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json
- https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump_amm.json
- https://solana.com/docs/references/clusters
- https://solana.com/docs/rpc/http/getaccountinfo
- https://solana.com/docs/rpc/http/getmultipleaccounts
- https://solana.com/docs/rpc/http/gettransaction
- https://solana.com/docs/rpc/websocket/logssubscribe
- https://pumpapi.io/stream
- https://pumpapi.io/historical-replay
- https://pumpapi.io/legal
- https://pumpportal.fun/data-api/real-time/
- https://pumpportal.fun/fees/
- https://pumpportal.fun/FAQ/
- https://pumpportal.fun/legal/
- https://docs.dexscreener.com/api/reference
- https://docs.dexscreener.com/api/api-terms-and-conditions
- https://developers.jup.ag/docs/portal/setup
