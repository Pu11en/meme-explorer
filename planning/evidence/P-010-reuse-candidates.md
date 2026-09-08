# P-010 — Reuse-first candidates

## Best verified starting point

### PumpAPI live stream + historical replay

- Direct service: [PumpAPI](https://pumpapi.io/)
- Live stream: `wss://stream.pumpapi.io/`
- Historical replay: documented hourly compressed JSONL downloads.
- A local no-key trial on 2026-08-26 connected in about 0.5 seconds and immediately received live transfer and buy events.
- The observed buy event already included:
  - signature, block and timestamp
  - buy action, trader/signer and involved traders
  - mint and pool identity
  - token and quote amounts
  - current price and market cap
  - supply
  - token and quote amounts in the pool
  - virtual quote amount
  - name, symbol and metadata URI
  - token program, mint/freeze authorities and extensions
  - priority fee
  - post-transaction wallet balances
  - pool fee, pool creator, liquidity-burn label, mode flags and creator-fee address
- Direct docs describe historical replay as free; the open-source toolkit comments that one free stream connection per IP is available. Current terms/limits still need rechecking before deployment.

This source supplies substantially more than the current PumpPortal no-key creation stream and removes the need to decode Pump transactions for the first measurement MVP.

## Reusable open-source toolkit

### `Solana-Trading-Lab/pump.fun.meter`

- Repository: [pump.fun.meter](https://github.com/Solana-Trading-Lab/pump.fun.meter)
- MIT licensed; 26 stars at inspection time; active in August 2026.
- TypeScript modules already cover:
  - live PumpAPI WebSocket connection and reconnection;
  - typed create/trade/complete/transfer/migrate events;
  - historical replay download/decompression/parsing;
  - filtering;
  - token/wallet aggregation;
  - result caching and storage helpers.
- Important caveat: its checked-in `package.json` appeared unusually minimal and the code still needs an install/build/test audit before reuse. Treat it as reusable source/modules, not assumed drop-in production software.

## Useful smaller component

### `yksanjo/pumpportal`

- Repository: [PumpPortal CLI](https://github.com/yksanjo/pumpportal)
- MIT licensed Python project with tests.
- Already provides a PumpPortal new-token adapter, raw-event retention, SQLite memory, deployer history, and terminal viewing.
- Limitation: its source adapter only covers new-token events, so it cannot replace the richer PumpAPI trade/replay path by itself.

## Useful service enrichments

- [RugCheck](https://api.rugcheck.xyz/swagger/index.html): named risk findings; immediate summary worked in a local trial.
- [Birdeye](https://docs.birdeye.so/): holder profiles, first buyers, tagged wallets, token security, price/liquidity/activity; API key and package/CU costs.
- [Helius](https://www.helius.dev/docs/): transaction history, metadata/account indexing and reliable Solana streams; API key/plan.
- [DEX Screener](https://docs.dexscreener.com/api/reference): later pair/liquidity/volume snapshots; not suitable for the first seconds.
- [Jupiter](https://dev.jup.ag/docs/): later route/quote checks.
- [Bitquery Pump.fun API](https://bitquery.io/products/pumpfun-api): managed launches, trades, curves, streams, OHLCV and historical data; usage-based pricing.

## Rejected as a reuse foundation

- `boluwatifee4/pump.fun-Token-tracker` is conceptually close (16 metrics every 10 seconds for 45 minutes), but it has no detected license, commits an `.env`, has minimal adoption, and should be treated only as an idea reference—not copied.
- `vicentszr/pump-tracker` provides charts and whale views but had no detected repository license and no adoption at inspection time.
- `CodeMuscle/solbeam` advertises a broad dashboard but had no detected license, no adoption, and README screenshots still marked “coming soon.”
- GMGN documentation says it does not plan to open a general data API; it is not a suitable recorder backend.
- Reverse-engineered Pump website endpoints are excluded because they are unstable and not official contracts.

## Reuse recommendation

Do not build the blockchain data system from scratch.

Use:

1. **PumpAPI live stream** for current events;
2. **PumpAPI historical replay** for backfill and experiments;
3. selected MIT modules/patterns from **pump.fun.meter** after an audit;
4. a small Harness plugin only for local storage, token timelines, and manual review;
5. optional RugCheck/Birdeye/Helius enrichments later.

This changes the build from “create a Pump data collector” to “wrap and persist an existing working data stream.”
