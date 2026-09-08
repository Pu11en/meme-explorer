# Candidate variables observable at Pump.fun token creation or within minutes

_Status: structured research draft. Sources checked: first-party documentation/specifications only. No secondary sources. No thresholds proposed._

## Scope and interpretation

This inventory is about **observability**, not a claim that any field predicts future returns. “At creation” means the creation transaction can be observed from a Solana stream or fetched once it reaches the requested commitment. “Within minutes” includes fields that require provider indexing, off-chain metadata retrieval, holder/account aggregation, or an initial activity window.

**Predictive-value finding:** none of the official sources reviewed provides an empirical out-of-sample study showing that any listed variable predicts Pump.fun token performance. Provider copy sometimes calls fields useful for “alpha screens,” “trading opportunities,” or risk review, but that is a product/use-case statement, not statistical validation. Accordingly, every candidate below is marked **plausible only / not validated by the primary sources**.

## Timing and data-quality baseline

- Solana observations depend on commitment. RPC methods and subscriptions expose `processed`, `confirmed`, and/or `finalized` states; higher certainty generally arrives later. [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction) returns a confirmed transaction or `null` when it is not found at the requested commitment.
- Helius Enhanced Transactions does **not** support `processed`; its documented choices are `confirmed` and `finalized`, with `finalized` the default. [Helius Enhanced Transactions](https://www.helius.dev/docs/api-reference/enhanced-transactions/gettransactions)
- Indexed APIs can lag the chain. Helius DAS explicitly returns `last_indexed_slot`, the latest slot through which indexing is guaranteed complete. [Helius `getAsset`](https://www.helius.dev/docs/api-reference/das/getasset)
- A token can exist before an indexer recognizes it as a “new listing,” before a market price exists, or before off-chain metadata resolves. Treat “not found,” `null`, and zero as different states.

## Structured variable inventory

### 1. Creation provenance and timing

| Variable | Definition | Exact official endpoint/source | Earliest timing | Access / cost | Failure or manipulation modes | Predictive validation |
|---|---|---|---|---|---|---|
| `creation_signature` / `txHash` | Signature of the transaction identified as mint/token creation. | Birdeye `GET https://public-api.birdeye.so/defi/token_creation_info` ([reference](https://docs.birdeye.so/reference/get-defi-token_creation_info)); Solana [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction); Helius [`POST /v0/transactions`](https://www.helius.dev/docs/api-reference/enhanced-transactions/gettransactions). | Stream detection at the selected commitment; indexed lookup shortly afterward. | Birdeye: `X-API-KEY`, Lite through Enterprise, **50 CU/request** per its endpoint page. Helius: API key/credit plan ([credits](https://www.helius.dev/docs/billing/credits), [plans](https://www.helius.dev/docs/billing/plans)). Solana RPC access depends on the chosen node/provider. | Birdeye may not have indexed a very new mint; Helius enhanced parsing can omit/label unsupported program semantics; `getTransaction` can return `null` at the requested commitment. A creator can launch through another wallet or intermediary, so signature provenance does not prove human identity. | Plausible only; no official predictive study. |
| `creation_slot`, `block_time`, `age_seconds` | Ledger slot and block timestamp for the creation transaction; age is derived at observation time. Birdeye returns `slot`, `blockUnixTime`, and `blockHumanTime`. | [Birdeye creation info](https://docs.birdeye.so/reference/get-defi-token_creation_info); Solana [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction). | Once transaction is available at requested commitment/indexing state. | Same as preceding row. | `blockTime` may be `null`; client clock skew affects derived age; creation transaction classification may differ from first trade/listing time. Never substitute provider receipt time for chain time without labeling it. | Plausible only; no official predictive study. |
| `creator_or_owner_address` | Address Birdeye attributes as token creation owner; the creation-info schema returns `owner`. Security data separately exposes creator/update-authority fields. | [Birdeye creation info](https://docs.birdeye.so/reference/get-defi-token_creation_info); [Birdeye token security](https://docs.birdeye.so/reference/get-defi-token_security). | After Birdeye indexes creation/security context. | Creation info: 50 CU, Lite–Enterprise. Security: API key, Lite–Enterprise, **25 CU/request**. | Attribution is address-level, not person-level. Wallets can be newly funded, rotated, shared, or controlled by the same actor. Null owner/creator-owner fields are documented response possibilities. | Plausible only; no official predictive study. |
| `fee_payer`, `signers`, `fee`, `compute_units` | Transaction payer/signing addresses, network fee, and optional compute-unit consumption. | Shyft `GET https://api.shyft.to/sol/v1/transaction/parsed` and `/transaction/history` ([transaction API](https://docs.shyft.to/solana-apis/transactions/transaction-apis)); Solana [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction) and [transaction JSON structure](https://solana.com/docs/rpc/json-structures). | As soon as transaction is retrievable/streamed at chosen commitment. | Shyft HTTP uses `x-api-key`; plan details are in the [Shyft dashboard pricing page](https://dashboard.shyft.to/pricing). Solana RPC depends on node access. | Fee payer may be a relayer or service wallet rather than creator. Priority fee/compute usage reflects congestion and transaction construction, not intent. Shyft documents parsed/API history as limited to roughly 3–4 days, so archive immediately if needed. | Plausible only; no official predictive study. |
| `pre_post_sol_delta`, `pre_post_token_delta` | Balance changes across accounts in the creation transaction, derived from `preBalances`, `postBalances`, `preTokenBalances`, and `postTokenBalances`. | Solana [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction) / [JSON structures](https://solana.com/docs/rpc/json-structures); Shyft raw transaction option in [Transaction APIs](https://docs.shyft.to/solana-apis/transactions/transaction-apis). | Same transaction, once metadata is available. | Standard RPC/provider access; Shyft requires API key. | Deltas include rent, fees, inner instructions, and unrelated bundled actions; they require account-role decoding. Bundling can deliberately obscure who supplied capital. | Plausible only; no official predictive study. |

### 2. Direct Pump.fun creation and trade stream variables

| Variable | Definition | Exact official endpoint/source | Earliest timing | Access / cost | Failure or manipulation modes | Predictive validation |
|---|---|---|---|---|---|---|
| `new_mint_address` from creation stream | Mint read from the creation transaction’s `postTokenBalances[0].mint` in Shyft’s official Pump.fun example. | [Shyft: Detect new token launches on Pumpfun](https://docs.shyft.to/solana-yellowstone-grpc/examples/pumpfun/solana-grpc-pumpfun-new-token-detection); stream uses Yellowstone `Subscribe` with Pump.fun program in `accountInclude`. | Real-time stream at configured commitment; example uses `CONFIRMED`. | Shyft gRPC endpoint plus `x-token` authentication ([gRPC docs](https://docs.shyft.to/solana-yellowstone-grpc/docs)); pricing is plan-specific in [dashboard](https://dashboard.shyft.to/pricing). | The example assumes the desired mint is index 0; production code should decode program instructions/events rather than depend on ordering. Stream disconnects, filter mistakes, failed transactions, commitment choice, and program upgrades can cause misses. | Shyft calls this useful for alerts/opportunities but provides no empirical predictive validation. |
| `pump_instruction_type` / `pump_event_type` | Decoded Pump.fun `create`, `buy`, or `sell` instruction/event type from the program’s IDL and transaction/event parser. | [Shyft Pump.fun transaction parsing](https://docs.shyft.to/solana-yellowstone-grpc/examples/pumpfun/solana-grpc-pumpfun-transaction-parsing); [Shyft buy/sell detection](https://docs.shyft.to/solana-yellowstone-grpc/examples/pumpfun/solana-grpc-pumpfun-detect-transaction-type). | Streamed transaction at selected commitment. | Shyft gRPC auth/plan; open-source parser/example code is linked by Shyft. | IDL/parser can become stale after a program upgrade; inner instructions and events must be handled; parser exceptions or unsupported variants can drop events. Event type is factual but activity can be self-generated or wash-like. | Plausible only; no official predictive study. |
| `early_buy_count`, `early_sell_count`, `early_unique_wallets`, token/SOL flow | Aggregates derived from decoded Pump.fun buy/sell events and transaction balance changes over a declared elapsed-time or slot window. | Same Shyft Pump.fun stream pages above; raw fields are also available through Solana [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction). | Continuously from first post-creation events; meaningful only after an explicitly recorded observation window. | gRPC/RPC plan-dependent. | Wallet count is not actor count; splitting, self-trading, bots, bundled transactions, and circular flows can inflate activity. Late stream start and reconnect gaps bias counts. Do not invent a “good” threshold. | Plausible only; no official predictive study. |

### 3. Mint configuration and token controls

| Variable | Definition | Exact official endpoint/source | Earliest timing | Access / cost | Failure or manipulation modes | Predictive validation |
|---|---|---|---|---|---|---|
| `decimals`, `supply` | Mint decimals and current total token supply. | Solana [`getTokenSupply`](https://solana.com/docs/rpc/http/gettokensupply); Helius [`getAsset`](https://www.helius.dev/docs/api-reference/das/getasset) `token_info.decimals` and `token_info.supply`; Birdeye [creation info](https://docs.birdeye.so/reference/get-defi-token_creation_info) returns decimals. | On-chain immediately after mint creation; indexed copies may lag. | Solana RPC/provider access. Helius API key/credits. Birdeye 50 CU. | Supply is a point-in-time value and may change if mint authority exists. UI conversion mistakes can create false signals. Indexed values can lag; verify Helius `last_indexed_slot`. | Plausible only; no official predictive study. |
| `mint_authority_present` / address | Authority currently permitted to mint additional supply, as exposed by the mint account/Helius token info. | Helius [`getAsset`](https://www.helius.dev/docs/api-reference/das/getasset) `token_info.mint_authority`; Solana [SPL Token Basics](https://solana.com/docs/tokens/basics) and [`getAccountInfo`](https://solana.com/docs/rpc/http/getaccountinfo). | On-chain immediately after account creation; Helius after indexing. | RPC or Helius credit plan. | Snapshot can become stale if authority is revoked/transferred after observation. `null` must be distinguished from indexer omission. Authority presence is a capability, not proof it will be used. | Plausible risk feature only; no official predictive study. |
| `freeze_authority_present` / address | Authority currently permitted to freeze token accounts. | Helius [`getAsset`](https://www.helius.dev/docs/api-reference/das/getasset) `token_info.freeze_authority`; Solana [SPL Token Basics](https://solana.com/docs/tokens/basics); Birdeye [token security](https://docs.birdeye.so/reference/get-defi-token_security) `freezeable` / `freezeAuthority`. | Immediately on chain; indexed services after ingest. | Helius credits; Birdeye 25 CU; raw RPC provider terms. | Same snapshot/null caveats. Capability may be legitimate or dangerous; absence does not rule out other controls. | Plausible risk feature only; no official predictive study. |
| `token_program`, `is_token_2022`, transfer controls | Whether the mint uses the legacy Token Program or Token-2022 and whether extensions such as transfer fees/non-transferability are reported. | Helius [`getAsset`](https://www.helius.dev/docs/api-reference/das/getasset) `token_info.token_program`; Birdeye [token security](https://docs.birdeye.so/reference/get-defi-token_security) `isToken2022`, `transferFeeEnable`, `transferFeeData`, `nonTransferable`; Solana [Token Extensions](https://solana.com/docs/tokens/extensions) and [Transfer Fees](https://solana.com/docs/tokens/extensions/transfer-fees). | On-chain at mint initialization; indexers may lag. | Same provider requirements as above. | Extension decoding support may vary; future extension/config updates can change behavior. A reported flag is not a complete audit of all extension state. | Plausible risk/operability feature only; no official predictive study. |

### 4. Metaplex identity, content, and authority variables

| Variable | Definition | Exact official endpoint/source | Earliest timing | Access / cost | Failure or manipulation modes | Predictive validation |
|---|---|---|---|---|---|---|
| `name`, `symbol`, `uri` | On-chain Token Metadata fields; `uri` points to off-chain JSON. | Metaplex [Token Metadata overview](https://www.metaplex.com/docs/smart-contracts/token-metadata), [fungible-token metadata guide](https://www.metaplex.com/docs/smart-contracts/token-metadata/guides/how-to-add-metadata-to-spl-tokens), and official program [`Metadata` source](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/programs/token-metadata/program/src/state/metadata.rs); Helius [`getAsset`](https://www.helius.dev/docs/api-reference/das/getasset) returns content/metadata. | Metadata account can be created in the launch transaction; Helius after indexing and URI fetch. | Metaplex program has no separate data API fee; read through RPC. Helius is credit-plan based. | Names/symbols are not unique and are trivially spoofed. URI can be changed when mutable, unavailable, slow, malformed, or point to mutable centralized hosting. Never execute/render untrusted content unsafely. | Plausible only; no official predictive study. |
| Off-chain `description`, image/files, external links/social fields | Content retrieved from metadata JSON or normalized by an indexer. | Helius [`getAsset`](https://www.helius.dev/docs/api-reference/das/getasset) `content.json_uri`, `content.files`, `content.metadata`, `content.links`; Metaplex metadata docs above. | After URI is reachable and provider has fetched/indexed it; potentially later than creation. | RPC plus client-side HTTP, or Helius credits. | Fully creator-controlled, mutable unless storage/account constraints prevent it, and subject to dead links, redirects, phishing, content swaps, and provider caching. Presence is not authenticity or quality. | Plausible only; no official predictive study. |
| `update_authority`, `mutable` | Address authorized to update metadata and flag controlling whether updates are allowed. | Metaplex [Updating Assets](https://www.metaplex.com/docs/smart-contracts/token-metadata/update) and official [`Metadata` account source](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/programs/token-metadata/program/src/state/metadata.rs); Helius [`getAsset`](https://www.helius.dev/docs/api-reference/das/getasset) authorities/`mutable`; Birdeye [security](https://docs.birdeye.so/reference/get-defi-token_security) `metaplexUpdateAuthority` / `mutableMetadata`. | On-chain with metadata account; indexers after ingest. | RPC, Helius credits, or Birdeye 25 CU. | Authority can be transferred or metadata made immutable later. Mutable does not imply malicious use; immutable does not validate off-chain content or creator identity. | Plausible risk/governance feature only; no official predictive study. |
| `creators[]`, `verified`, `share` | Creator addresses, allocation shares, and whether each creator signed/verified the association. | Metaplex [Token Metadata overview](https://www.metaplex.com/docs/smart-contracts/token-metadata) states that verified creator status means that creator signed; Helius [`getAsset`](https://www.helius.dev/docs/api-reference/das/getasset) creators list. | When metadata is created/updated and indexed. | RPC or Helius credits. | Verification proves control of the listed address, not reputation, legal identity, independence, or future behavior. Creator arrays can be absent. | Plausible only; no official predictive study. |

### 5. Holder concentration and ownership distribution

| Variable | Definition | Exact official endpoint/source | Earliest timing | Access / cost | Failure or manipulation modes | Predictive validation |
|---|---|---|---|---|---|---|
| `largest_token_accounts` and shares | The 20 largest token accounts for a mint, with balances; derive each account’s share using current supply. | Solana [`getTokenLargestAccounts`](https://solana.com/docs/rpc/http/gettokenlargestaccounts) and [`getTokenSupply`](https://solana.com/docs/rpc/http/gettokensupply). | Immediately after relevant account state reaches selected commitment. | RPC/provider access. On QuickNode, methods consume plan API credits; see [Solana endpoint/credit docs](https://www.quicknode.com/docs/solana/endpoints) and [credit table](https://www.quicknode.com/api-credits/sol). | Token accounts are not beneficial owners. One actor can split holdings; custodians/pools/bonding-curve/burn accounts can aggregate many actors or non-circulating supply. Top-20 truncation misses the tail. Account labeling must be separate and timestamped. | Plausible only; no official predictive study. |
| `top10HolderPercent`, `top10UserPercent` | Birdeye’s concentration aggregates over top holders/users. | [Birdeye token security](https://docs.birdeye.so/reference/get-defi-token_security). | After Birdeye security/holder indexing, potentially within minutes but not guaranteed at creation. | `X-API-KEY`; Lite–Enterprise; 25 CU/request. | Depends on Birdeye’s holder/user grouping and labels; Sybil splitting and unlabeled related wallets defeat beneficial-owner interpretation. Pools/bonding curves may dominate. Null/partial data is possible. | Plausible only; no official predictive study. |
| `creator_balance_pct`, `update_authority_balance_pct` | Birdeye-reported creator or metadata-update-authority balance as a percentage of supply. | [Birdeye token security](https://docs.birdeye.so/reference/get-defi-token_security). | After indexing; refresh as holdings change. | Same 25-CU security endpoint. | Easy to move or split holdings; attribution is address-based. A low direct percentage does not imply low insider control. | Plausible only; no official predictive study. |
| holder count / distribution | Count and distribution of indexed token owners/positions. | Birdeye [`GET /holder/v1/distribution`](https://docs.birdeye.so/reference/get-holder-v1-distribution), [`GET /defi/v3/token/holder`](https://docs.birdeye.so/reference/get-defi-v3-token-holder), and [Token Overview](https://docs.birdeye.so/reference/get-defi-token_overview). | After token accounts exist and Birdeye indexes them; likely minutes rather than atomic creation. | API key; package accessibility/CU costs are endpoint-specific—check [data accessibility](https://docs.birdeye.so/docs/data-accessibility-by-packages), [CU costs](https://docs.birdeye.so/docs/compute-unit-cost), and [rate limits](https://docs.birdeye.so/docs/per-api-rate-limit). | Account count is not user count; dusting can inflate it, consolidation can deflate it, and indexing lag can make early snapshots incomplete. | Plausible only; no official predictive study. |

### 6. Early market activity, price, liquidity, and quote variables

| Variable | Definition | Exact official endpoint/source | Earliest timing | Access / cost | Failure or manipulation modes | Predictive validation |
|---|---|---|---|---|---|---|
| `price`, `liquidity`, `marketCap`, `fdv`, `holder` | Birdeye’s current market/valuation/holder snapshot for one token. | `GET https://public-api.birdeye.so/defi/token_overview` ([reference](https://docs.birdeye.so/reference/get-defi-token_overview)). | Only after Birdeye has indexed sufficient token/market state; not guaranteed in the creation transaction. | `X-API-KEY`; Starter–Enterprise; **20 CU/request**. | No/illiquid market can yield null or unstable values. Thin trading can move mark price and derived market cap/FDV sharply. Liquidity definitions are provider-aggregated; do not assume executable depth. | Birdeye suggests use in screens, but no empirical predictive validation. |
| activity windows: `trade*`, `buy*`, `sell*`, `uniqueWallet*`, `v*`, price change | Counts and volume over requested frames and comparisons to the previous matching window. Official docs allow standard 1m/5m frames and custom 5-second multiples. | [Birdeye Token Overview](https://docs.birdeye.so/reference/get-defi-token_overview); granular trades via [`GET /defi/v3/token/txs`](https://docs.birdeye.so/reference/get-defi-v3-token-txs) and [`GET /defi/v3/token/trade-data/single`](https://docs.birdeye.so/reference/get-defi-v3-token-trade-data-single). | After the first trades; fields evolve through the requested seconds/minutes. | Overview: 20 CU, Starter–Enterprise. Other endpoint CU/package limits vary in official cost/access tables. | Wash/self-trading, Sybil wallets, bots, sandwiching, and tiny trades can inflate counts/unique wallets/volume. Window alignment and indexer latency matter greatly for very new tokens. “Buy” and “sell” classification depends on trade parsing. | Plausible only; no official predictive study. |
| first-buyer / holder trading history fields | Birdeye holder/profile/positions surfaces first-trade time, buy/sell volumes, average buy price, PnL, trade counts, and an official first-buyer slot rule where documented. | [Birdeye holder profile](https://docs.birdeye.so/reference/get-token-v1-holder-profile); [holder positions](https://docs.birdeye.so/reference/get-token-v1-holder-positions). | After Birdeye processes initial trades and wallet histories. | API key; package/CU limits are endpoint-specific. | Earliest wallets may be bots, creator-linked, or split identities. PnL/average cost depend on coverage and pricing assumptions; related-wallet inference is not supplied by these fields. | Plausible only; no official predictive study. |
| Pump.fun executable quote: input/output amount and quote context | QuickNode Swap API’s Pump.fun quote gives a current route/execution estimate for specified input/output mints and amount; usable to derive contemporaneous effective price and size sensitivity by requesting declared sizes. | `POST .../pump-fun/quote` ([QuickNode official endpoint](https://www.quicknode.com/docs/solana/pump-fun-quote)); [official Pump.fun API guide](https://www.quicknode.com/guides/solana-development/tooling/solana-kit/pump-fun-api); [Swap API overview](https://www.quicknode.com/docs/solana/swap-api). | Once the token is quoteable by Pump.fun/QuickNode; potentially seconds after launch. | QuickNode endpoint token plus Swap API/Metis access; availability and pricing are plan/add-on dependent—see [QuickNode pricing](https://www.quicknode.com/pricing). | Quote is not execution and can stale immediately. Output depends on request size, slippage configuration, current curve state, intervening trades, fees, and provider availability. Repeated probes must store request parameters; do not turn arbitrary sizes into hidden thresholds. | Plausible liquidity/executability feature only; no official predictive study. |
| Helius DAS `token_info.price_info` | Helius price field for supported fungible assets. | [Helius `getAsset`](https://www.helius.dev/docs/api-reference/das/getasset). | Not suitable as a creation-second field. Helius documents a **600-second cache** and availability only for the top 10k tokens by 24h volume. | Helius API/credits. | Explicitly can be up to 600 seconds old and absent for a fresh/low-volume token. Do not use as a real-time early price without independent validation. | Plausible only; no official predictive study. |

### 7. Provider/stream integrity variables worth recording

These are not token traits, but are necessary controls for any model built from early observations.

| Variable | Definition | Official source | Why record it / failure mode |
|---|---|---|---|
| `observed_slot`, `commitment`, `provider_received_at` | The ledger context and local receipt time for each observation. | Solana RPC/subscription docs: [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction), [`logsSubscribe`](https://solana.com/docs/rpc/websocket/logssubscribe), [`programSubscribe`](https://solana.com/docs/rpc/websocket/programsubscribe). | Separates chain event time from network/indexer latency; prevents mixing confirmed/finalized snapshots. |
| `last_indexed_slot` | Latest slot Helius DAS guarantees complete. | [Helius `getAsset`](https://www.helius.dev/docs/api-reference/das/getasset). | If creation/current slot is above it, absence or stale metadata cannot safely be interpreted as token state. |
| `source_endpoint`, HTTP status, retry count | Exact provider/method and delivery outcome. | Helius [Webhooks](https://www.helius.dev/docs/webhooks) and [Webhook FAQ](https://www.helius.dev/docs/faqs/webhooks). | Helius documents retries, possible duplicate deliveries, and permanent loss after retry exhaustion; consumers need signature-based idempotency and RPC backfill. |
| `parser_version` / IDL hash | Version of transaction parser and Pump.fun IDL used. | Shyft [Pump.fun transaction parsing](https://docs.shyft.to/solana-yellowstone-grpc/examples/pumpfun/solana-grpc-pumpfun-transaction-parsing). | Program/parser drift can silently change classifications. Keep raw transaction data when permitted so parsing can be reproduced. |
| `missing_reason` | Enumerated reason such as not indexed, no market, URI unavailable, rate limited, parser unsupported, or RPC null. | Birdeye endpoints document 401/403/429/500 responses (for example [creation info](https://docs.birdeye.so/reference/get-defi-token_creation_info)); Helius DAS exposes indexing boundary; Solana `getTransaction` documents `null`. | Prevents conflating unavailable data with zero/false and reduces survivorship/coverage bias. |

## Provider-by-provider implementation notes

### Helius

**Useful sources/endpoints**

- [`POST /v0/transactions`](https://www.helius.dev/docs/api-reference/enhanced-transactions/gettransactions): parsed transfers/swaps/DeFi operations for known signatures; confirmed/finalized only.
- [Enhanced transactions by address](https://www.helius.dev/docs/api-reference/enhanced-transactions/gettransactionsbyaddress): address history once the mint/creator is known.
- [Webhooks](https://www.helius.dev/docs/webhooks) and [Create Webhook](https://www.helius.dev/docs/api-reference/webhooks/create-webhook): push raw/enhanced events for watched addresses.
- [`getAsset`](https://www.helius.dev/docs/api-reference/das/getasset): metadata, authorities, mutability, supply/decimals, token program, mint/freeze authority, plus `last_indexed_slot`.

**Access/cost:** Helius account/API key; usage is credit-based. Use the current official [credit schedule](https://www.helius.dev/docs/billing/credits), [plan table](https://www.helius.dev/docs/billing/plans), and [rate limits](https://www.helius.dev/docs/billing/rate-limits) rather than hard-coding prices.

**Key caveats:** enhanced parsing is not the raw ledger and can have unsupported classifications; webhook retries can duplicate events and exhausted retries can lose them; DAS is indexed; DAS price is cached up to 600 seconds and coverage-limited. Preserve signature/slot and backfill from raw RPC.

### Birdeye

**Useful sources/endpoints**

- [`GET /defi/token_creation_info`](https://docs.birdeye.so/reference/get-defi-token_creation_info): tx hash, slot, mint, decimals, owner, block time; 50 CU; Lite–Enterprise.
- [`GET /defi/token_security`](https://docs.birdeye.so/reference/get-defi-token_security): creator/update-authority holdings, metadata mutability, top-holder concentration, freeze and Token-2022 controls; 25 CU; Lite–Enterprise.
- [`GET /defi/token_overview`](https://docs.birdeye.so/reference/get-defi-token_overview): price/liquidity/valuation/supply/holder and configurable short-window activity; 20 CU; Starter–Enterprise.
- [`GET /defi/v2/tokens/new_listing`](https://docs.birdeye.so/reference/get-defi-v2-tokens-new_listing): discovery of newly **listed** tokens; listing is not identical to mint creation.
- [Holder distribution](https://docs.birdeye.so/reference/get-holder-v1-distribution), [V3 holders](https://docs.birdeye.so/reference/get-defi-v3-token-holder), [token trades](https://docs.birdeye.so/reference/get-defi-v3-token-txs), and [trade-data single](https://docs.birdeye.so/reference/get-defi-v3-token-trade-data-single).

**Access/cost:** `X-API-KEY` is required ([authentication](https://docs.birdeye.so/docs/authentication-api-keys)). Packages, compute units, and per-endpoint limits are documented separately in [pricing](https://docs.birdeye.so/docs/pricing), [data accessibility](https://docs.birdeye.so/docs/data-accessibility-by-packages), [CU costs](https://docs.birdeye.so/docs/compute-unit-cost), and [rate limits](https://docs.birdeye.so/docs/per-api-rate-limit).

**Key caveats:** index lag/coverage, listing-vs-creation mismatch, wallet-vs-actor ambiguity, wash activity, manipulable thin-market price, and null/partial security fields. Birdeye itself says security data should be one input rather than a standalone signal.

### Shyft

**Useful sources/endpoints**

- Official Pump.fun Yellowstone examples for [new-token detection](https://docs.shyft.to/solana-yellowstone-grpc/examples/pumpfun/solana-grpc-pumpfun-new-token-detection), [transaction parsing](https://docs.shyft.to/solana-yellowstone-grpc/examples/pumpfun/solana-grpc-pumpfun-transaction-parsing), [buy/sell detection](https://docs.shyft.to/solana-yellowstone-grpc/examples/pumpfun/solana-grpc-pumpfun-detect-transaction-type), and [migration detection](https://docs.shyft.to/solana-yellowstone-grpc/examples/pumpfun/solana-grpc-pumpfun-detect-token-migration).
- [`GET /sol/v1/transaction/parsed`](https://docs.shyft.to/solana-apis/transactions/transaction-apis) and history endpoint for fee payer, signers, actions, raw balances/logs, slot, and optional events.
- [All transactions of a token](https://docs.shyft.to/solana-yellowstone-grpc/docs/transaction-streaming/all-transactions-of-a-token) for follow-up activity.

**Access/cost:** HTTP API uses `x-api-key`; Shyft Yellowstone requires an endpoint and `x-token` ([gRPC docs](https://docs.shyft.to/solana-yellowstone-grpc/docs)). Current plans are published in the [Shyft dashboard](https://dashboard.shyft.to/pricing).

**Key caveats:** Shyft documents HTTP/RPC transaction history as limited to about 3–4 days; stream reconnect/backfill is mandatory; parser/IDL drift and commitment choice affect coverage; official sample assumptions such as `postTokenBalances[0]` should not be treated as a protocol invariant.

### QuickNode

**Useful sources/endpoints**

- Standard Solana HTTP/WSS methods through a QuickNode endpoint ([Solana endpoints](https://www.quicknode.com/docs/solana/endpoints)); use the canonical Solana RPC semantics listed below.
- [Solana gRPC overview](https://www.quicknode.com/docs/solana/solana-grpc/overview) and [`subscribe`](https://www.quicknode.com/docs/solana/solana-grpc/subscribe) for low-latency transactions/accounts/slots.
- [Pump.fun quote](https://www.quicknode.com/docs/solana/pump-fun-quote) and [Swap API overview](https://www.quicknode.com/docs/solana/swap-api) for contemporaneous quote/executability fields.

**Access/cost:** endpoint URL contains the QuickNode authentication token. RPC methods consume API credits ([Solana credits](https://www.quicknode.com/api-credits/sol)); gRPC is documented as included with Scale and Business plans; Swap API/Metis access is plan/add-on dependent. Use [current pricing](https://www.quicknode.com/pricing).

**Key caveats:** provider infrastructure does not change underlying chain semantics; quotes are ephemeral and size-dependent; plan credit exhaustion/rate limits create selective missingness; stream filters and reconnects can miss events.

### Metaplex Token Metadata

Metaplex defines the metadata account and its mutability/authority/creator semantics; it does not itself supply a market-prediction API. Read the account through RPC or an indexer such as Helius. Official sources: [Token Metadata overview](https://www.metaplex.com/docs/smart-contracts/token-metadata), [fetching assets](https://www.metaplex.com/docs/smart-contracts/token-metadata/fetch), [updating assets](https://www.metaplex.com/docs/smart-contracts/token-metadata/update), and the [official program source](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/programs/token-metadata/program/src/state/metadata.rs).

The critical distinction is between on-chain fields (`name`, `symbol`, `uri`, creators, update authority, mutability) and content fetched from `uri`. Both can be creator-controlled; verified creator means the listed address signed, not that any external identity was verified.

### Solana RPC

Canonical primitives:

- [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction): transaction, slot/block time, metadata, fees, balances, token balances, logs, inner instructions.
- [`getAccountInfo`](https://solana.com/docs/rpc/http/getaccountinfo): raw or `jsonParsed` account state.
- [`getTokenSupply`](https://solana.com/docs/rpc/http/gettokensupply): current mint supply.
- [`getTokenLargestAccounts`](https://solana.com/docs/rpc/http/gettokenlargestaccounts): 20 largest token accounts.
- [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress): confirmed signatures referencing an address, newest first.
- [`logsSubscribe`](https://solana.com/docs/rpc/websocket/logssubscribe) and [`programSubscribe`](https://solana.com/docs/rpc/websocket/programsubscribe): live logs or program-owned account changes.

Public RPC and commercial RPC nodes can differ in limits/history/performance, but the method semantics above are the primary protocol documentation. Archive raw inputs and record provider/commitment because reproducibility depends on both.

## Suggested raw schema (no thresholds)

```text
identity:
  mint, token_program, decimals
creation:
  signature, slot, block_time, observed_at, commitment
  creator_attribution, fee_payer, signers, fee, compute_units
  pre_post_sol_deltas, pre_post_token_deltas
metadata:
  name, symbol, uri, uri_fetch_status
  update_authority, mutable, creators[], verified_flags[]
  description_present, image_present, external_links[]
controls:
  supply, mint_authority, freeze_authority
  token_2022, transfer_fee_config, non_transferable
ownership_snapshot:
  slot, supply, largest_accounts[], top10_holder_pct
  creator_balance_pct, update_authority_balance_pct, holder_count
market_snapshot:
  observed_at, source, price, liquidity, market_cap, fdv
  quote_request_params, quote_response, quote_context
activity_window:
  start_slot/time, end_slot/time
  buys, sells, unique_wallets, token_volume, sol_or_usd_volume
integrity:
  source_endpoint, provider_received_at, last_indexed_slot
  parser_version, idl_hash, retry_count, missing_reason
```

## Research conclusion

The primary sources support collecting a rich, timestamped creation/early-life dataset. They support **definitions and operational availability**, not claims of alpha. The most defensible design is to preserve raw transactions and explicit observation metadata, treat indexed/market/off-chain fields as potentially delayed or missing, and evaluate predictive value later with leakage-aware historical testing. No official source reviewed justifies a numeric cutoff for concentration, volume, wallet count, liquidity, quote impact, metadata completeness, or creator holdings.
