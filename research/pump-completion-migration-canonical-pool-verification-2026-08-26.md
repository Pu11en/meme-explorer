# Pump completion, migration, and canonical PumpSwap pool verification — 2026-08-26

**Scope:** strict-free verification beyond PumpAPI. “Free” means no funded wallet, metered balance, paid plan, card, or trial. Protocol schema is pinned to [`pump-fun/pump-public-docs@9c82f61cb711b044a17f770ab8ce9f9bdf78f333`](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333); do not silently decode future program versions with this snapshot.

## Canonical chain checks

The authoritative distinction is **incomplete curve → completed curve → migrated canonical pool**.

### 1. Curve completion

Derive the Pump `BondingCurve` PDA under program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` from exact seeds:

```text
[b"bonding-curve", mint_pubkey]
```

At `finalized`, require the account owner to be the Pump program, the Anchor discriminator to equal `[23,183,248,55,96,216,172,96]`, and decode these pinned `BondingCurve` fields exactly in order: `virtual_token_reserves: u64`, `virtual_quote_reserves: u64`, `real_token_reserves: u64`, `real_quote_reserves: u64`, `token_total_supply: u64`, `complete: bool`, `creator: pubkey`, `is_mayhem_mode: bool`, `is_cashback_coin: bool`, `quote_mint: pubkey`. Including the discriminator, `real_token_reserves` begins at byte 24 and `complete` is byte 48. Completion requires both `complete == true` and `real_token_reserves == 0`; Pump documents that `complete` is set at the end of the completing buy. Independently decode a matching finalized `CompleteEvent` with exact fields `user`, `mint`, `bonding_curve`, `timestamp`, `quote_mint`. A complete curve is **not yet proof of migration**. Sources: [pinned Pump IDL: account and events](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json#L5611-L5655), [completion mechanics](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md#L145-L157), [coin-creation PDA](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/instructions/COIN_CREATION.md).

### 2. Migration

Require a finalized successful Pump `migrate` transaction and decode `CompletePumpAmmMigrationEvent` exactly:

```text
user: pubkey
mint: pubkey
mint_amount: u64
sol_amount: u64
pool_migration_fee: u64
bonding_curve: pubkey
timestamp: i64
pool: pubkey
quote_mint: pubkey
```

The pinned instruction is permissionless and idempotent, so `user` is not creator proof. Match its `mint`, `bonding_curve`, and `quote_mint` to the completed curve and retain the event’s `pool`; amounts and fee are evidence from that transaction, not from an indexer. Sources: [pinned migration instruction/accounts](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json#L2910-L3220), [migration event](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json#L5802-L5844), [permissionless/idempotent semantics](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md#L176-L182).

### 3. Canonical PumpSwap pool identity

For the pinned SOL migration path, derive:

```text
Pump pool_authority PDA (Pump program):
  [b"pool-authority", mint_pubkey]

Canonical pool PDA (PumpSwap program pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA):
  [b"pool", u16_le(0), pool_authority_pubkey, mint_pubkey,
   So11111111111111111111111111111111111111112]

LP mint PDA (PumpSwap program):
  [b"pool_lp_mint", pool_pubkey]
```

Require the derived pool to equal `CompletePumpAmmMigrationEvent.pool`, be owned by PumpSwap, have Anchor discriminator `[241,154,109,4,17,177,109,188]`, and decode the exact pinned `Pool` fields in order: `pool_bump: u8`, `index: u16`, `creator: pubkey`, `base_mint: pubkey`, `quote_mint: pubkey`, `lp_mint: pubkey`, `pool_base_token_account: pubkey`, `pool_quote_token_account: pubkey`, `lp_supply: u64`, `coin_creator: pubkey`, `is_mayhem_mode: bool`, `is_cashback_coin: bool`, `virtual_quote_reserves: i128`. Assert `index == 0`, `creator == pool_authority`, `base_mint == mint`, `quote_mint == WSOL`, `lp_mint` equals its PDA, and both stored vaults equal the appropriate pool ATAs. A mint pair alone is insufficient because noncanonical pools can coexist. Sources: [exact PDA constraints in pinned Pump `migrate`](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json#L2994-L3137), [PumpSwap pool seeds and canonical index](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_README.md#L63-L137), [pinned `Pool` layout](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump_amm.json#L6828-L6890).

## Minimum reconciliation tests

1. Persist signature, slot, commitment, raw bytes/logs, decoder/IDL pin, and local receipt time; reject failed transactions (`meta.err != null`) and deduplicate by signature plus event ordinal.
2. At finalized commitment, prove the curve PDA/owner/layout, `complete == true`, `real_token_reserves == 0`, and equality across curve, `CompleteEvent`, and mint/quote identities.
3. Separately prove a finalized migration event; never infer migration from completion, missing curve inventory, a provider label, or the existence of any same-pair AMM.
4. Re-derive `pool_authority`, canonical pool, LP mint, and vault ATAs; compare every identity field above with the migration event and Pool account.
5. Batch pool and vault reads where possible, retain each RPC response `context.slot`, and reject/retry cross-slot snapshots. Verify token-account mint/owner and use `raw_quote_vault + Pool.virtual_quote_reserves` for effective quote reserves.
6. Re-run finalized account reads after a later finalized slot and record disagreements, null transactions, decode failures, RPC gaps, provider misses, and schema drift rather than coercing them to “not migrated.”

## Free-source roles and limits

- **PumpAPI — trigger only.** Its free live/replay records may nominate signatures/mints/pools using observed/evolving fields such as `signature`, `block`, `timestamp`, live `action` or historical `txType`, `mint`, and migration/create-pool `poolId`. These are not a stable protocol schema or finality proof; replay adds `localTimestamp`, one repository audit found a missing hour, and owner terms provide no completeness/SLA guarantee. Reconcile every correctness-critical result above. Sources: [stream](https://pumpapi.io/stream), [replay](https://pumpapi.io/historical-replay), [legal](https://pumpapi.io/legal), repository audit [`pumpapi-live-historical-audit.md`](pumpapi-live-historical-audit.md).
- **PumpPortal — optional free trigger/corroboration.** Owner pages label `subscribeMigration` free, but the feed is live-only at `processed`, has no replay/versioned output schema/completeness SLA, and documented URLs include an API key. It cannot establish finalized migration or canonical pool identity. Token/account trade subscriptions fail strict-free because they require a funded wallet and metered fees. Sources: [real-time API](https://pumpportal.fun/data-api/real-time/), [fees](https://pumpportal.fun/fees/), [FAQ](https://pumpportal.fun/FAQ/).
- **DEX Screener — distinct post-index corroboration only.** Compare the chain-proven pool address to `pairAddress` and optionally inspect indexed price/liquidity/activity. Listing requires a pool and transaction; empty/null results are not nonexistence proof, and no indexing-delay/completeness SLA exists. Sources: [API reference](https://docs.dexscreener.com/api/reference), [listing rule](https://docs.dexscreener.com/token-listing), repository audit [`dexscreener-owner-api-audit-2026-08-26.md`](dexscreener-owner-api-audit-2026-08-26.md).
- **Jupiter — distinct route corroboration only.** A keyless amount-specific V2 order can show a proposed route involving the pool, but metadata presence, `graduatedPool`, `routePlan`, or `outAmount` does not prove Pump migration, canonical identity, or execution. Keyless is rate-limited and intended for tests/prototypes; no SLA applies. Sources: [setup/limits](https://developers.jup.ag/docs/portal/setup), [V2 order](https://developers.jup.ag/docs/api-reference/swap/v2/order), [market listing](https://developers.jup.ag/docs/swap/routing/market-listing), repository audit [`jupiter-keyless-routing-pump-migration-audit-2026-08-26.md`](jupiter-keyless-routing-pump-migration-audit-2026-08-26.md).

Solana public mainnet HTTP/WSS is currently no-key, but Solana explicitly says public endpoints are **not intended for production**. Published limits include 100 requests/10 seconds/IP, 40 requests/10 seconds for one RPC method, connection/bandwidth limits, and change without notice. `logsSubscribe.mentions` accepts one pubkey, processed observations can roll back, historical transactions may be unavailable/`null`, and public RPC offers no archival completeness, retention, replay, or uptime SLA. Sources: [public clusters and limits](https://solana.com/docs/references/clusters), [RPC](https://solana.com/docs/rpc), [`logsSubscribe`](https://solana.com/docs/rpc/websocket/logssubscribe), [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction), [`getAccountInfo`](https://solana.com/docs/rpc/http/getaccountinfo).

## Conclusion

**Reliable end-to-end strict-free operation is not supportable on documented guarantees.** A strict-free client can perform strong, finalized, cryptographic-PDA/account/event verification for individual observed migrations and use multiple free providers for discovery/corroboration. It cannot guarantee continuous detection, complete historical recovery, bounded latency, or production availability because the only free canonical access path here is public Solana RPC, which is explicitly non-production and non-archival/SLA-backed; all third-party free lanes are also best-effort. Therefore the defensible product claim is **bounded finalized verification with explicit unknown/gap states**, not reliable complete migration coverage.
