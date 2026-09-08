# P-008 — What changes over time and how quickly we can see it

This is the recorder’s update model. “Live” means an event is pushed when it happens; “snapshot” means the recorder asks for the latest state on a schedule. Exact production latency must be measured and displayed rather than promised.

## Live changes

These should append to the token timeline whenever an event arrives:

| Data | What changes | Expected registration | Current access status |
|---|---|---|---|
| New token | token address, creator, initial purchase, initial curve state, name/symbol/metadata link | Live creation event. Local trials saw the first event 0.675–1.48 seconds after starting a cold connection; one coarse chain-time comparison was about 1.625 seconds. These are observations, not guarantees. | Working now through the no-key PumpPortal creation stream |
| Buys and sells | direction, wallet, SOL/quote amount, token amount, price/market-cap estimate, curve state | One update per trade, normally near chain time at processed commitment | Not available through the current no-key stream; requires a funded PumpPortal key or our own Pump event decoder/RPC stream |
| Curve movement | token/quote reserves, progress, implied price | Recalculated after every recorded buy or sell; alternatively pushed from curve-account changes | Requires the same trade/account stream as above |
| Creator selling | direct sells by the declared creator wallet | Immediately when a matching trade event is recorded | Requires trade stream; linked wallets remain unknown |
| Completion | curve marked complete | Live protocol/account event, followed by chain confirmation | Available from Pump chain state/events |
| Migration | migrated pool and amounts | Live migration event, then canonical chain confirmation | PumpPortal documents the migration stream as free; not yet measured locally |
| Post-migration swaps | PumpSwap buys/sells and changed reserves | One update per swap when a PumpSwap event stream is connected | Requires PumpSwap event decoding/provider access |

## Measurements recalculated after every live trade

Once trade events are available, the software can update these continuously without extra provider requests:

- latest price/market-cap estimate
- price path and percent change from launch
- highest and lowest observed value
- drawdown from the observed high
- total buys and sells
- total SOL/quote bought and sold
- net flow
- number of distinct trading wallets
- largest trade and trade-size distribution
- buys or trades per second/minute
- curve progress and change speed
- creator’s direct buys/sells

These are neutral charts and counters, not signals.

## Scheduled snapshots

These are not naturally delivered with every trade. The recorder checks them periodically and records both the result and response delay:

| Data | Why it changes | Practical behavior |
|---|---|---|
| Holder count and largest holders | transfers, buys, sells, and account creation change ownership | Snapshot from reliable RPC/indexer. Public Solana RPC returned HTTP 429 in our test, so update speed is not yet reliable |
| Creator/token balances | creator can buy, sell, or transfer | Snapshot on launch, after important events, and on a configurable schedule |
| RugCheck findings | token state and provider analysis can change | Initial request returned in roughly 0.4 seconds in one trial; later reports may be cached or require paid refresh |
| Metadata/social fields | metadata may appear, change, or fail through a gateway | Fetch at launch and retry failures; successful samples returned in 100–220 ms, but only 2/10 metadata fetches succeeded directly in one sample |
| Indexed price/liquidity/volume | external indexers must first discover and aggregate the market | Poll after migration/listing and store “not indexed yet” separately. DEX Screener still had no pair 15 seconds after one fresh launch |
| Trading-route quote | routes and available output change with liquidity | Request a quote for a visible fixed test amount after migration; store response time, route, output, and price impact |

The exact snapshot intervals should be configurable and visible. The recorder should begin conservatively, measure response limits, and avoid pretending that aggressive polling makes indexed data fresher.

## Four clocks shown in the UI

For every value, display:

1. **Occurred:** chain/event timestamp or slot.
2. **Seen:** when our recorder received it.
3. **Confirmed:** when stronger chain confirmation arrived.
4. **Refreshed:** when the latest snapshot request completed.

This lets manual review distinguish a genuine trend from delayed provider data.

## Trend display

The token screen should update as follows:

- append each live event to the timeline;
- update live counters/charts after every event;
- add snapshot points without overwriting earlier values;
- visibly mark source delays, gaps, reconnects, rate limits, and indexing waits;
- allow replay at the original event timing or instantly for inspection;
- never fill missing periods with invented values.
