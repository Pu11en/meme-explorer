# P-005 Evidence — How each candidate outcome is observed

This note defines the **tools and raw data needed to observe** fast breakout, migration, and durable-market behavior. It does not select an outcome, window, threshold, or alert rule.

## Shared clocks and identity

Every measurement needs:

- `mint`
- creation `signature` and `slot`
- Pump event timestamp/block time when available
- local `observed_at`
- source/provider
- commitment (`processed`, `confirmed`, `finalized`)
- parser version and pinned Pump IDL hash
- reconciliation status

The low-latency provider receipt starts observation. Finalized Pump/Solana events provide canonical reconciliation.

## 1. Fast-breakout observability

### What must be observed

A breakout is a **post-creation price/executable-value path**, not merely transaction count or market-cap text. Raw observations needed:

- every successful Pump `TradeEvent`
- event signature, slot, timestamp, direction, and user
- executed token amount and quote/SOL amount
- post-trade virtual and real token/quote reserves
- applicable protocol/creator fees
- quote mint and decimals
- current bonding-curve account state
- local receipt time and commitment

From those facts the plugin can later calculate, for any explicitly chosen window:

- reserve-implied price path
- fixed-notional executable buy and sell quotes
- maximum/minimum value after a hypothetical entry
- return path, peak return, drawdown, and time to peak
- buy/sell flow, unique users, and curve progress as possible explanatory inputs

No calculation is final until entry notional, fee/slippage treatment, decision timestamp, and observation horizon are specified.

### Tool paths

| Path | Exact use | Access/timing | Limitation |
|---|---|---|---|
| Official Pump IDL + Solana/Helius/Shyft stream | Decode canonical `TradeEvent` and curve-account changes | Near-chain time at selected commitment; commercial RPC likely needed for reliable production | We must implement event/account decoding, reconnect/backfill, and fork reconciliation |
| PumpPortal `subscribeTokenTrade` | Fast managed trade stream for selected mints | API key + linked wallet funded with at least 0.02 SOL; metered 0.01 SOL/10,000 events | Processed/provider-derived; no contractual output schema; unavailable to current no-key MVP |
| QuickNode Pump.fun quote | Request contemporaneous quote for a declared mint/amount | Endpoint/add-on plan | Quote is ephemeral and size-dependent; not execution |
| Local exact curve calculator | Reproduce Pump formula and fees from the pinned official docs/IDL and current reserves | Immediate after state is known | Must be contract-tested against provider/on-chain outcomes and versioned |

### Earliest workable MVP

Collect creation events now, then either:

1. add a paid keyed trade stream, or
2. decode Pump program transactions/events from an RPC stream.

Without one of those paths, the plugin cannot honestly measure a fast breakout in the first seconds.

## 2. Curve completion and migration observability

### What must be observed

Completion and migration are explicit protocol states/events:

- initial Pump `CreateEvent`
- repeated `BondingCurve` snapshots, especially `real_token_reserves` and `complete`
- finalized `CompleteEvent`
- finalized `CompletePumpAmmMigrationEvent`
- migration event timestamp/slot, mint amount, quote/SOL amount, migration fee, and pool address
- canonical PumpSwap pool identity/index and base/quote mints

From those facts the plugin can later calculate:

- whether completion occurred
- creation-to-completion elapsed slots/time
- whether migration occurred
- completion-to-migration and creation-to-migration elapsed slots/time
- right-censored status for tokens that have not completed/migrated by the observation cutoff

### Tool paths

| Path | Exact use | Access/timing | Limitation |
|---|---|---|---|
| Pump curve account + official Pump IDL | Read `complete` and reserve state | Direct chain state at chosen commitment | Account decoder/version handling required |
| Official Pump log/event decoder | Detect finalized completion and migration events | Chain stream/RPC | Must handle missed streams and backfill |
| PumpPortal `subscribeMigration` | Low-latency migration trigger | Documented free | Trigger must be reconciled to finalized chain state |
| Shyft Pump migration detector | Managed Yellowstone example/path | API token/plan | Provider parser and plan dependency |

### Earliest workable MVP

Migration can be measured without the paid PumpPortal trade stream: keep the free creation/migration streams and reconcile both against Solana transactions and the Pump curve account.

## 3. Durable-market observability

### What must be observed

Durability begins after migration and requires repeated, timestamped market snapshots—not one liquidity number:

- finalized canonical PumpSwap pool
- pool base-token vault balance
- raw quote-vault balance
- `virtual_quote_reserves`
- LP mint supply and pool `lp_supply` kept separately
- every PumpSwap `BuyEvent` and `SellEvent`, or provider rolling trade statistics
- executable quotes for declared trade sizes
- quote route availability and price impact
- indexed liquidity, volume, buy/sell counts, traders, price, market cap, and FDV
- snapshot slot/provider timestamp and indexing lag

From these facts the plugin can later calculate, at any explicitly selected horizon:

- whether a route still exists
- executable depth for a fixed notional
- pool reserve/liquidity retention
- price/valuation retention
- post-migration volume and trader activity
- drawdown and market inactivity

### Tool paths

| Path | Exact use | Access/timing | Limitation |
|---|---|---|---|
| Official PumpSwap IDL + pool/vault RPC reads | Canonical pool, reserves, swaps, LP semantics | Immediately after migration | Requires AMM decoding and same-slot account reads |
| Jupiter quote API | Routability and amount-specific quote/price impact | After Jupiter indexes/routes the token; API key/platform limits | No quote is distinct from bad quote; indexing delay must be recorded |
| Birdeye token overview/trade/holder APIs | Liquidity, price, volume, activity, holders | API key/package/CU; after indexing | Provider-derived and potentially delayed/null |
| DEX Screener token-pairs API | Pair identity, transactions, volume, price change, liquidity, pair age | Unauthenticated polling; after pool has at least one transaction | Our fresh-token trial found no pair through 15 seconds; no latency SLA |
| QuickNode quote | Declared-size Pump/Jupiter-style quote where supported | Endpoint/add-on plan | Ephemeral, size-dependent |

### Earliest workable MVP

Store the migration/pool identity first. Then schedule repeated pool and quote snapshots. Birdeye and DEX Screener are supplementary indexed views; canonical PumpSwap reserves and direct executable quotes should remain distinguishable from provider-reported liquidity.

## What the Harness plugin can build before choosing any outcome

A measurement-only MVP can:

1. detect every new Pump token;
2. store the raw creation event and chain reconciliation;
3. show which data planes are available for that token;
4. attempt and time immediate enrichments;
5. follow completion and migration for free;
6. when an approved trade-data path exists, record the full early price/flow path;
7. after migration, record pool reserves, route quotes, and indexed market snapshots;
8. display all three outcome timelines without labeling any token a buy.

This produces the dataset needed to decide exact outcomes and input variables later.

## Primary sources

- [Pinned official Pump IDL](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json)
- [Pinned official PumpSwap IDL](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump_amm.json)
- [Pump program README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md)
- [PumpSwap README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_SWAP_README.md)
- [PumpPortal real-time API](https://pumpportal.fun/data-api/real-time/)
- [Solana getTransaction](https://solana.com/docs/rpc/http/gettransaction)
- [Jupiter API documentation](https://dev.jup.ag/docs/)
- [Birdeye token overview](https://docs.birdeye.so/reference/get-defi-token_overview)
- [DEX Screener API reference](https://docs.dexscreener.com/api/reference)
- [QuickNode Pump.fun quote](https://www.quicknode.com/docs/solana/pump-fun-quote)
