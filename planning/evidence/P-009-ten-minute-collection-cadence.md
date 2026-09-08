# P-009 — Ten-minute collection cadence

## Tracking window

- Begin when PumpAPI emits the token creation event (`t = 0`).
- Keep one shared PumpAPI WebSocket connection for all coins; never open one connection per coin.
- Give each coin an independent ten-minute in-memory tracking window.
- Retain every coin for the complete ten minutes.
- Do not implement an early-stop rule.

## Data and intervals

| Data | Source | Fastest responsible cadence | Verified timing / rule |
|---|---|---|---|
| Creation facts: mint, signer, signature, block/time, initial buy, supply, decimals, authorities, pool, URI | PumpAPI | Once at creation | Event-driven; 50/50 sampled creates contained signer/signature/block/time/mint |
| Buys and sells: amounts, price, wallet signer, balances, reserves, fees | PumpAPI | Every received event | Continuous WebSocket; no polling timer |
| Migration and liquidity changes | PumpAPI | Every received event | Continuous WebSocket |
| Local counters and paths: buy/sell counts and volume, net quote flow, active wallets, price path, high/low, drawdown, reserves, inactivity age | Local calculation | Recalculate after every relevant event | No external request |
| Local candles | Local calculation | Update after every trade; finalize one-minute bars | 40,927 sampled Pump-AMM trades contained required fields |
| Metadata bytes and raw links | URI from PumpAPI | Fetch once immediately; retry only on failure | Sampled JSON ~63–435 ms; sampled direct image ~1.3–1.6 s |
| Metadata retry schedule | Local fetcher | Recommended at 2 s, 10 s, 30 s, 2 min and 10 min after failure | Operational backoff recommendation; not a provider guarantee |
| Launch-signer history | Local signer index | Lookup once at creation; update whenever the same signer creates again | Repeated signers appeared during a 73-second sample |
| Indexed pair price/liquidity/activity | DEX Screener | Every 30 s after migration/pool candidate | 30-second cache; exact migrated pool 0/10 immediately, 9/10 by 60 s, 10/10 by 120 s |
| Approximate SOL/USD | One pinned DEX Screener WSOL/USDC pair | One global request every 30 s, shared by every coin | Observed refresh ~25–30 s |
| Finalized chain confirmation | Public Solana RPC | Sample only important events such as migration | Public RPC is not reliable continuous infrastructure |
| Missed-event repair | PumpAPI replay | Reconcile after the containing hour closes and an archive appears | Publication observed from ~10 s to more than 7 h after hour-end; not part of live loop |

## Descriptive inactivity field

No cutoff or early-stop mechanism will be implemented.

Include `seconds_since_meaningful_activity` as neutral display information. Meaningful activity is any buy, sell, reserve change, liquidity addition/removal, or migration/pool event. Update it locally every second and reset it after those events. It only shows how long a coin has been quiet and never terminates its ten-minute recording window.

## Required reliability fields

Every fetch/event retains:

- source;
- provider occurrence timestamp when available;
- local receipt timestamp;
- block/signature when available;
- cache age or provider update timestamp when available;
- success, timeout, HTTP/RPC error, rate limit, decode error and missing/not-indexed states;
- stream-gap and replay-reconciliation state.
