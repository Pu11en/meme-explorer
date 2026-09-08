# Strict-free verification of Pump curve completion, migration, and canonical PumpSwap pool identity

**Evidence cutoff:** 2026-08-26 11:32 UTC  
**Scope:** owner-published Pump/PumpSwap schemas and documentation, official Solana RPC contracts, third-party providers' own documentation, and bounded read-only/no-key probes. No wallet, API key, signing, transaction submission, or paid endpoint was used.

> **Date warning:** `2026-08-26` was the actual UTC date in this runtime (`date -u` returned `2026-08-26T11:26:48Z`), so it was verifiable only through the cutoff above. This note does not claim knowledge of the remainder of that day. If read or requested before that date, the date would be future and unverifiable; do not fabricate or backdate probes.

## Decision

PumpAPI can provide candidate signatures, mints, reserve-like fields, actions, and `poolId`, but none is canonical by itself. The strict-free verification path is:

1. derive the Pump bonding-curve PDA from the mint;
2. read and decode it at `finalized` commitment;
3. distinguish **completion** (`complete == true && real_token_reserves == 0`) from **migration**;
4. derive and validate the Pump-created index-0 PumpSwap pool;
5. when history is available, require a successful finalized Pump `migrate` transaction, its PumpSwap `create_pool` CPI, and matching migration/pool events;
6. use PumpAPI or PumpPortal only as discovery/triggers and reconcile every identity claim to chain state.

A same-mint PumpSwap pool is not necessarily the migrated canonical pool. PumpSwap permits multiple pools distinguished by `index`, `creator`, base mint, and quote mint.

## Source pin and program identities

The authoritative schema snapshot used here is the official [`pump-fun/pump-public-docs`](https://github.com/pump-fun/pump-public-docs) repository at commit [`9c82f61cb711b044a17f770ab8ce9f9bdf78f333`](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333), committed 2026-07-16 (+08:00) and observed as `main`/`HEAD` at the cutoff. Pin this hash rather than mutable `main`:

- [Pump IDL](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json)
- [Pump program README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md)
- [PumpSwap IDL](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump_amm.json)
- [PumpSwap README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_README.md)
- [Canonical-pool creator definition](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_CREATOR_FEE_README.md)

Pinned IDs:

| Identity | Address |
|---|---|
| Pump program | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| PumpSwap / Pump AMM program | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` |
| Wrapped SOL mint | `So11111111111111111111111111111111111111112` |

A checked-in IDL is the protocol owner's declared interface, not cryptographic proof that every deployed byte matches it. Retain the IDL commit and raw account/transaction bytes so decoder changes can be replayed.

## 1. Curve completion: exact current-state proof

### PDA

```text
bonding_curve = findProgramAddress(
  [UTF8("bonding-curve"), mint.toBytes()],
  PUMP_PROGRAM_ID
)
```

Exact constant seed bytes are `[98,111,110,100,105,110,103,45,99,117,114,118,101]`. Source: pinned [Pump README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md#L110-L157) and [Pump IDL](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json).

### `BondingCurve` fixed prefix at the pin

Offsets are the ordered Anchor/Borsh fields after the eight-byte account discriminator; integers are little-endian. Anchor documents the [IDL discriminator convention](https://www.anchor-lang.com/docs/basics/idl) and [account-space encoding](https://www.anchor-lang.com/docs/references/space).

| Offset | Field | Type |
|---:|---|---|
| 0 | discriminator | `[u8; 8]` = `[23,183,248,55,96,216,172,96]` |
| 8 | `virtual_token_reserves` | `u64` |
| 16 | `virtual_quote_reserves` | `u64` |
| 24 | `real_token_reserves` | `u64` |
| 32 | `real_quote_reserves` | `u64` |
| 40 | `token_total_supply` | `u64` |
| 48 | `complete` | `bool` (`0`/`1`) |
| 49 | `creator` | `pubkey` |
| 81 | `is_mayhem_mode` | `bool` |
| 82 | `is_cashback_coin` | `bool` |
| 83 | `quote_mint` | `pubkey` |

The pinned serialized prefix is 115 bytes. Do **not** require exact `dataSize`: Pump explicitly supports extending existing accounts and has appended fields. Validate the owner, discriminator, and at least the bytes needed by the pinned decoder.

### Acceptance rule

At an explicitly recorded slot, require all of:

```text
account exists
&& account.owner == PUMP_PROGRAM_ID
&& discriminator matches pinned BondingCurve
&& complete == true
&& real_token_reserves == 0
```

The owner README says `complete` is set at the end of a buy when `real_token_reserves == 0`, and separately defines a completed curve by both conditions. Price, market cap, a provider progress percentage, an API `migrate` label, or zero-looking floating values are not substitutes.

Optional historical corroboration is a successful finalized Pump transaction containing `CompleteEvent` discriminator `[95,114,97,156,212,46,152,8]` and fields, in order: `user pubkey`, `mint pubkey`, `bonding_curve pubkey`, `timestamp i64`, `quote_mint pubkey`. Current finalized account state is the current-state authority; an event alone can be provisional, missed, or rolled back.

## 2. Migration and canonical PumpSwap identity

Completion and migration are separate. The pinned [Pump README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md#L176-L182) says `migrate(user, mint)` is permissionless and idempotent and only operates on a completed curve.

### Published SOL/WSOL canonical derivation

The pinned `migrate` instruction fixes canonical index `0`, base mint = Pump mint, and quote mint = WSOL:

```text
pool_authority = findProgramAddress(
  [UTF8("pool-authority"), mint.toBytes()],
  PUMP_PROGRAM_ID
)

canonical_pool = findProgramAddress(
  [
    UTF8("pool"),
    U16_LE(0),
    pool_authority.toBytes(),
    mint.toBytes(),
    WSOL_MINT.toBytes()
  ],
  PUMPSWAP_PROGRAM_ID
)
```

Exact constants:

- `"pool-authority"` → `[112,111,111,108,45,97,117,116,104,111,114,105,116,121]`
- `"pool"` → `[112,111,111,108]`
- `U16_LE(0)` → `[0,0]` (not a one-byte zero and not text `"0"`)

PumpSwap's generic pool PDA is `["pool", U16_LE(index), creator, base_mint, quote_mint]`. Its README says pools created through Pump `migrate` use canonical index `0`; the canonical-pool README additionally defines `Pool.creator` as the Pump `pool-authority` PDA. This creator is a Pump PDA, not the token creator wallet or migration caller.

### `Pool` fixed prefix at the pin

| Offset | Field | Type |
|---:|---|---|
| 0 | discriminator | `[u8; 8]` = `[241,154,109,4,17,177,109,188]` |
| 8 | `pool_bump` | `u8` |
| 9 | `index` | `u16` |
| 11 | `creator` | `pubkey` |
| 43 | `base_mint` | `pubkey` |
| 75 | `quote_mint` | `pubkey` |
| 107 | `lp_mint` | `pubkey` |
| 139 | `pool_base_token_account` | `pubkey` |
| 171 | `pool_quote_token_account` | `pubkey` |
| 203 | `lp_supply` | `u64` |
| 211 | `coin_creator` | `pubkey` |
| 243 | `is_mayhem_mode` | `bool` |
| 244 | `is_cashback_coin` | `bool` |
| 245 | `virtual_quote_reserves` | `i128` |

The pinned minimum serialized prefix is 261 bytes; current accounts may be extended (the owner docs discuss 300-byte Pool accounts). Never exact-size filter.

### Canonical pool acceptance rule

Require the derived account to:

1. exist at `finalized` commitment;
2. be owned by PumpSwap;
3. match the pinned `Pool` discriminator;
4. decode with `index == 0`, `creator == pool_authority`, `base_mint == mint`, and `quote_mint == expected quote`;
5. have stored `pool_bump` equal the PDA derivation bump;
6. have `lp_mint == PDA(["pool_lp_mint", pool], PumpSwap)` and stored pool vaults equal the correct associated token accounts for the pool/mints/token programs.

The first five checks establish identity; the LP/vault checks harden against parser or account-selection mistakes. A valid same-pair pool with a different PDA, index, or creator is `valid_noncanonical_pumpswap_pool`, not a migration.

For reserve/liquidity work, use base-vault amount and `effective_quote_reserves = raw_quote_vault_amount + Pool.virtual_quote_reserves`, at one consistent slot. The owner README warns not to use raw quote-vault balance alone. `lp_supply` also does not directly equal current LP mint supply after direct burns.

> **Scope limit:** the exact derivation above is verified for the SOL/WSOL `migrate` instruction published in this pin. The account now carries `quote_mint`, but this pin does not publish a generalized non-WSOL migration instruction/derivation. Do not extrapolate canonical USDC or other-quote migration identity without a newer pinned official IDL or decoded on-chain instruction definition.

## 3. Historical instruction and event proof

Call Solana [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction) with `commitment:"finalized"`, `encoding:"jsonParsed"` (or raw bytes), and an appropriate `maxSupportedTransactionVersion`. Resolve address-table keys and inspect both outer and inner instructions.

Strong migration evidence is one successful transaction (`meta.err == null`) containing:

| Evidence | Program | Discriminator / exact fields |
|---|---|---|
| `migrate` instruction | Pump | `[155,234,231,146,236,158,162,30]` |
| `create_pool` CPI | PumpSwap | `[233,146,209,142,207,104,64,188]` |
| `CompletePumpAmmMigrationEvent` | Pump | `[189,233,93,185,92,148,234,148]`; `user`, `mint`, `mint_amount u64`, `sol_amount u64`, `pool_migration_fee u64`, `bonding_curve`, `timestamp i64`, `pool`, `quote_mint` |
| `CreatePoolEvent` | PumpSwap | `[177,49,12,210,160,118,167,116]`; includes `timestamp`, `index`, creator/base/quote mints and decimals, initial/pool amounts, liquidity/LP amounts, bump, `pool`, `lp_mint`, user vaults, coin creator, mode |

Reconcile every mint, curve, pool, quote, creator, index, and bump to local derivations. Anchor events may be emitted as `Program data:` logs or event-CPI inner instruction data; inspect both. Do not merely search a human-readable log string.

If the pool validates but a public RPC returns `null` for an old transaction, report **“current canonical pool verified; historical transaction unavailable from this endpoint.”** Missing RPC history is not proof of no migration. Solana documents `getTransaction` as returning `null` when the transaction is not found; endpoint ledger retention is a separate property.

## 4. PumpAPI and PumpPortal: useful hints, not authority

### PumpAPI claims

PumpAPI's owner pages currently call the [Data Stream](https://pumpapi.io/stream) and [Historical Replay](https://pumpapi.io/historical-replay) free; the schema pages are mutable and not commit-pinned. Its stream claims `signature`, `action`, `poolId`, `mint`, `quoteMint`, `pool`, `poolCreatedBy`, `vTokensInBondingCurve`, `vQuoteInBondingCurve`, token/quote amounts, block, timestamp, and other derived/enriched fields. It labels actions such as `migrate` and `createPool` and says one transaction can produce multiple events.

Treat these as provider assertions:

- `poolId` is a candidate address, not canonical identity;
- `action:"migrate"` is a trigger, not finalized instruction/event proof;
- floating reserve/progress/price/market-cap values are not the integer on-chain account fields;
- `poolCreatedBy:"pump"` is a provider classification, not a PDA check;
- signature-level dedupe is unsafe because one transaction can produce multiple events;
- live/replay schemas can drift, and “all events” is not an SLA or completeness proof.

Retain the raw frame, receipt time, schema fingerprint, and owner-page retrieval time, then perform the chain checks above.

### PumpPortal supporting evidence

PumpPortal's owner [real-time API page](https://pumpportal.fun/data-api/real-time/) and [fees page](https://pumpportal.fun/fees/) call `subscribeMigration` (and `subscribeNewToken`) free/no-charge; token/account trade subscriptions are metered. The documented URL includes an API key, so “free” does not necessarily mean contractually anonymous. A migration frame is only a candidate signature/mint/pool for reconciliation. There is no owner-published replay/completeness/finality SLA on those pages.

A no-key probe to `wss://pumpportal.fun/api/data` at the cutoff acknowledged `{"method":"subscribeMigration"}` with `{"message":"Subscribed to 'migration' events."}`; no migration arrived in the bounded 30-second window. This proves only that one anonymous subscription acknowledgement worked. A parallel 30-second PumpAPI filter also observed no migration-shaped frame; absence in a short live window says nothing about chain state or feed completeness.

## 5. Strict-free tools and public endpoint realities

| Tool/path | Monetary/key boundary | What it can prove | Limitation |
|---|---|---|---|
| [Solana public mainnet RPC](https://solana.com/docs/references/clusters) | No key, no provider fee for bounded reads | Account owner/data at a stated slot; available finalized transactions | Officially rate-limited, limits may change, not for production, no uptime/archive/completeness SLA |
| [`getAccountInfo`](https://solana.com/docs/rpc/http/getaccountinfo) / [`getMultipleAccounts`](https://solana.com/docs/rpc/http/getmultipleaccounts) | Public RPC | Atomic-ish account snapshots with `context.slot` | A response is tied to one endpoint and commitment; no historical event proof |
| [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction) and [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress) | Public RPC | Successful instructions/events where retained | Pagination and address-key selection required; `null`/pruned history possible |
| [`logsSubscribe`](https://solana.com/docs/rpc/websocket/logssubscribe) | Public WSS | Low-latency Pump log trigger | Live-only, disconnect gaps, no replay cursor; `mentions` supports one address per subscription |
| [Solana Explorer](https://github.com/solana-foundation/explorer) | Free/open source and public UI | Independent manual decoding/display cross-check | Usually consumes RPC/indexed data; not separate consensus evidence |
| [Agave](https://github.com/anza-xyz/agave) / [official CLI install](https://solana.com/docs/intro/installation) | Open-source software | Local PDA/account/transaction tooling; a self-run node can remove third-party parser trust | Software is free, but reliable node hardware/network/operations are not cost-free |
| [Helius free plan](https://www.helius.dev/docs/billing/plans) | $0 tier, account/API key, finite credits | A genuinely distinct RPC operator for sampled cross-endpoint reads | Quota/terms can change; not a Pump authority or SLA-backed free archive |
| [QuickNode Solana](https://www.quicknode.com/chains/solana) | Owner advertises a free endpoint after signup | Another distinct sampled RPC operator | Account/key and current-plan limits; recheck before use |

The official public-cluster page publishes limits but explicitly says they are subject to change. In one bounded `getVersion` probe, `https://api.mainnet.solana.com` returned HTTP 200, `solana-core:4.2.0`, and headers identifying tier `free`, method limit `150`, and RPS limit `250`; those observed edge headers differed from older published baseline numbers and are not an entitlement. Handle 429s and preserve headers rather than hard-coding a ceiling.

A second free provider reduces endpoint-specific omission/staleness but does not create two independent chain truths. Compare only after both endpoints have reached the target slot; do not majority-vote a stale response.

## 6. Reconciliation tests and stored evidence

1. **Pin test:** startup fails closed if the loaded Pump/PumpSwap program IDs, account/event discriminators, or IDL SHA/commit differ from the approved pin without a migration review.
2. **Atomic snapshot:** derive curve and canonical pool locally; call `getMultipleAccounts` at `finalized`; store endpoint, commitment, `context.slot`, raw base64, owner, lamports, executable/rent fields, and IDL pin.
3. **Completion invariant:** accept only owner + discriminator + `complete == 1` + `real_token_reserves == 0`. Provider disagreement loses to finalized chain state.
4. **Migration state machine:** `incomplete`; `completed_not_yet_migrated`; `canonical_pool_state_verified`; `migration_tx_and_state_verified`; never collapse the middle states.
5. **Canonical identity:** require derived address, owner, discriminator, bump, index, creator, base/quote mints, LP mint, and vault relationships. Reject same-pair look-alikes explicitly.
6. **Event reconciliation:** a provider frame remains `provisional` until its signature is finalized, successful, and its instruction/event identities equal local derivations. A rolled-back/missing signature becomes a provider/reorg discrepancy, not a migration.
7. **Current state versus history:** a valid pool plus unavailable old transaction remains current-state proof with history marked unavailable; never infer `not migrated` from `getTransaction:null`.
8. **Cross-endpoint read:** at a declared target slot, compare raw bytes through public RPC and one distinct $0 provider. Retry lagging endpoints; preserve disagreement rather than silently selecting one.
9. **Impossible-state alarm:** a validated canonical pool with an apparently incomplete curve, wrong owner, event/PDA mismatch, or unknown discriminator triggers raw re-fetch, second endpoint, IDL-version review, and manual transaction inspection.
10. **Provider coverage test:** for a completed UTC hour, compare PumpAPI unique `(signature,event-ordinal/type,pool)` records with finalized decoded Pump/PumpSwap events. Count misses, extras, duplicates, schema changes, and replay gaps; never dedupe only by signature.
11. **Finality test:** retain processed/confirmed observations as separate revisions and promote only finalized records. Record rollback/tombstone outcomes.
12. **Rate/failure contract tests:** distinguish HTTP 429, RPC error, `result:null`, missing account, unknown version, pruned history, WSS disconnect, and parser failure. None is “not completed” or “not migrated.”

Minimum durable record:

```text
mint, derived_curve, derived_pool, quote_mint,
source + endpoint, local_receipt_time, provider_time,
slot, block_time, signature, commitment, meta.err,
raw_provider_frame, raw_account_bytes, raw_transaction,
IDL repo + commit + schema hash, parser version,
PDA seeds + bumps, decoded values, verification_state,
missingness/error classifier
```

## 7. Safe probe results at the cutoff

These are reproducible point observations, not availability/latency benchmarks:

- Public mainnet `getVersion`: HTTP 200; `solana-core 4.2.0`, feature set `565236538`.
- Official README example curve `EsmVk4MTsoT71JFaRM5DWFZboKpMQjfY6EYzAgUuksXw` at finalized slot `441857103`: Pump owner; 150 bytes; correct discriminator; `complete=true`; `real_token_reserves=0`.
- Official README example pool `GseMAnNDvntR5uFePZ51yZBXzNSn7GdFPkfHwfr6d77J` at finalized slots `441857102–441857286`: PumpSwap owner; 300 bytes; correct discriminator; index `0`; stored bump `254`; base `7LSsEoJGhLeZzGvDofTdNg7M3JttxQqGWNLo6vWMpump`; quote WSOL. Local derivation produced the same pool and bump, and its stored creator equaled the locally derived Pump `pool-authority` PDA.
- PumpAPI's own documented Pump migration example identified signature `4nownD6mfEWqPobc7TrfYk6VyTiqdyzkXqgSbJb2hNVxsXoNfAQADJBRP3JzuYX921NTyY9TLNVZnREdcbo3D4NP`, mint `3x2vP4L8D63AHh7DhLR2XuRuMT7CsMqDHwVKTdFepump`, and pool `8xLk84gnavkayCu4o345bgC7Qk4oRNtU2AS1PaTqujwH`.
- Public `getTransaction` retrieved that signature at finalized slot `388775295`, block time `1766551227`, `meta.err=null`. It contained the exact outer Pump `migrate` discriminator, inner PumpSwap `create_pool` discriminator, and event-CPI data containing `CreatePoolEvent` and `CompletePumpAmmMigrationEvent` discriminators at byte offset 8.
- At finalized slot `441857543`, local PDA derivation and `getMultipleAccounts` reconciled that sample: curve owner/discriminator valid, `complete=true`, `real_token_reserves=0`; derived pool exactly equaled PumpAPI's `poolId`; pool owner/discriminator/bump/index/creator/base/quote all matched canonical expectations.

This one positive sample proves that the verification procedure can confirm a PumpAPI claim. It does **not** establish PumpAPI completeness, universal correctness, timing, or an SLA.

## Bottom line

Use PumpAPI/PumpPortal to learn **what to check**, not **what is true**. Truth for this purpose is the finalized Pump curve account plus the locally derived, structurally validated PumpSwap canonical pool; the strongest historical record adds the successful finalized migration transaction and matching instruction/event bytes. Keep completion, migration, canonical identity, provider delivery, and historical availability as separate facts.