# P-007 — Plain recording contract

The recorder does not decide whether any fact is good or bad.

## 1. Launch

Record immediately:

- token name and symbol
- token address
- creator wallet
- creation transaction
- when the chain says it launched
- when our software first saw it
- creator’s initial purchase
- initial market-cap estimate supplied by the feed
- initial bonding-curve balances
- token mode/program
- metadata link
- complete untouched source message

## 2. Early activity timeline

Whenever early trade data is available, append:

- time of trade
- buy or sell
- amount of SOL/quote spent or received
- token amount
- wallet address
- market-cap/price estimate after the trade
- bonding-curve position after the trade
- transaction and chain position
- when our software received it

The viewer may summarize counts, unique wallets, buy/sell totals, and price/curve charts, but always keeps the underlying events.

## 3. Creator, ownership, and metadata snapshots

Attempt and timestamp:

- creator’s retrievable prior activity
- named third-party risk findings, kept separately rather than collapsed into one score
- token supply
- largest token accounts and known owners when available
- creator’s visible token balance
- metadata fetch success/failure and timing
- description, image, website, Twitter/X, Telegram, and unknown metadata fields
- authority/mutability facts when available

Missing, blocked, rate-limited, not-yet-indexed, and truly absent are separate states.

## 4. Completion and migration

Record:

- bonding-curve progress snapshots
- completion event and time
- migration event and time
- migrated pool address
- migrated token and SOL/quote amounts
- time from launch to completion and migration

## 5. In-window market facts

If migration occurs with time remaining in the overall run, attempt and timestamp available facts before timer expiry:

- pool token and SOL/quote reserves
- whether an indexed pair/route reference appears
- reported liquidity
- price and market cap
- volume, buys, sells, and trader counts
- data source, receipt time and cache/indexing age

No request is first started after timer expiry and no post-run outcome snapshot extends the observation window. Delayed replay may only repair a source event that occurred inside the original window.

## 6. Reliability record

Every observation includes:

- source/provider
- source timestamp or chain slot
- our receipt time
- confirmation level
- parser/schema version
- success, missing, delayed, blocked, rate-limited, or failed status
- retry count and error message
- raw response/payload when safe

## 7. Dataset and session inspection

For each run/token, the collector must provide:

1. versioned raw, normalized and derived machine-readable records;
2. chronological event ordering and reproducible formula versions;
3. source and timing beside every normalized fact;
4. visible gaps/errors and no false zero;
5. paginated session retrieval by run ID and coin;
6. no analysis, “buy,” “good,” “bad,” trend or composite score.
