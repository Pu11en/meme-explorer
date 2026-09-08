# P-012 — Distinct free-tool verification dossier

**Status:** complete  
**Updated:** 2026-08-26 UTC

## Final accepted stack

1. **PumpAPI live stream** — core best-effort raw events through one shared connection.
2. **Immediate local raw log** — signatures, all source clocks, schemas, missing/error states and stream-gap markers.
3. **PumpAPI hourly replay** — delayed best-effort gap repair, never assumed complete.
4. **DEX Screener exact-pair snapshots** — optional delayed post-migration price/liquidity/activity, normally attempted after 60 seconds and retried through at least 120 seconds.
5. **DEX Screener pinned WSOL/USDC** — delayed approximate visual USD conversion at no faster than its 30-second cache horizon.
6. **Hardened local IPFS/HTTPS fetcher** — metadata bytes with CID/hash, DNS/redirect/size/time controls and explicit failures.
7. **Local signer index and local candles** — deterministic observations derived from retained PumpAPI events.
8. **Solana public RPC** — sampled verification only, never continuous required infrastructure.

Jupiter Tokens v2 may be inspected only as a segregated private/manual cache pending written permission. No other researched provider enters the merged recorder stack.

## Checked capabilities

### 1. PumpAPI — broad live event capture

Checked only for:

- live create/buy/sell/transfer/migrate/pool/liquidity/claim actions;
- free hourly historical replay as best-effort backfill.

Every other PumpAPI operation is paid and excluded. See [PumpAPI capability checklist](P-012-pumpapi-capability-checklist.md).

### 2. DEX Screener — delayed indexed market snapshot

Distinct data beyond PumpAPI:

- USD/native price;
- reported USD/base/quote liquidity;
- rolling buy/sell counts, volume and price change;
- pair age, FDV and nullable market cap.

Expanded live verification across ten PumpAPI migration events:

- exact migrated pool visible for 0/10 at 0 seconds;
- 1/10 by 30 seconds;
- 9/10 by 60 seconds;
- 10/10 by 120 seconds;
- all 40 requests returned anonymous HTTP 200 and the PumpAPI connection had no disconnects;
- an earlier token-lookup test also showed that a mint may already return a different/pre-migration pair;
- responses advertised 30-second public caching.

The larger sample corrected the earlier three-token observation: universal visibility by 60 seconds did not generalize. Disposition remains **checked only as optional delayed enrichment**, never launch, completion, migration or executable-price truth. Raw: [expanded benchmark](P-012-dexscreener-expanded-migration-index-benchmark.json) and [initial benchmark](P-012-dexscreener-migration-index-benchmark.json).

### 3. Hardened IPFS/HTTPS metadata-byte retrieval

Twenty fresh PumpAPI creation URIs were classified and fetched with bounded safety controls:

- 11/20 used content-addressed IPFS and all 11 returned HTTP 200 valid JSON through `ipfs.io` in 79–275 ms;
- the remaining 9/20 used arbitrary HTTPS hosts; DNS was required to resolve only to globally routable IPs, redirects were disabled and responses were capped at 1 MiB;
- all nine arbitrary-HTTPS URIs returned 200 twice, 60 seconds apart, with identical hashes;
- eight were metadata JSON and one was a direct PNG, proving creation `uri` is not universally JSON across launchpads.

Disposition: **checked for best-effort metadata-byte retrieval**, not guaranteed availability. Store URI/CID, gateway or host, content type, response hash, receipt time and every failure. Metadata text and social links are creator-supplied claims, not verified identity or quality. Raw: [IPFS benchmark](P-012-metadata-gateway-benchmark.json) and [arbitrary-HTTPS benchmark](P-012-metadata-arbitrary-https-benchmark.json).

### 4. Forward launch-signer history — deterministic local capability

In 50 fresh PumpAPI creates, `txSigner`, signature, block, timestamp and mint were present 50/50. Five signer addresses launched more than once during the 73-second sample, including one with four creates. This supports a factual signer→local-create-signatures index from installation onward.

A single keyless Jupiter batch indexed all 50 and returned `dev` equal to PumpAPI `txSigner` 50/50, both immediately and 120 seconds later. Jupiter `dev` therefore did not add independent attribution for these fresh Pump tokens. `creatorFeeAddress` existed only 49/50 and cannot replace the signer. `devMints/devMigrations` remain provider-derived without signatures or methodology.

Disposition: **checked from local installation onward**. Label it launch signer—not person, owner, insider or rugger. Raw: [attribution benchmark](P-012-launch-signer-jupiter-attribution-benchmark.json).

### 5. DEX Screener pinned WSOL/USDC — delayed SOL/USD reference

Twelve probes over approximately 56 seconds all succeeded. Three distinct cached snapshots appeared, with prices `96.56`, `96.99` and `96.90`; refreshes occurred around the advertised 30-second cache boundary.

Disposition: **checked as a delayed venue reference** for approximate visual USD conversion. Multiply PumpAPI’s SOL-denominated value by the stored pair snapshot, while preserving source pair, receipt time and cache age. It is not an oracle, executable quote or guaranteed fair price. Raw: [cadence probe](P-012-dexscreener-sol-usd-cadence.json).

### 6. Deterministic local candles — durable OHLC and quote volume

A 161-second capture contained 40,927 Pump-AMM trade events across 771 pools. Signature, timestamp, block, action, pool/mint/quote identity, price, token amount and quote amount were present for all 40,927. The busiest sampled pool had 1,454 unique-signature trades and produced two complete minute candles plus partial boundary minutes.

After conversion with one delayed SOL/USD snapshot, the two complete local OHLC bars differed from GeckoTerminal by roughly 0.3–1.2%. This is a useful cross-check, not completeness proof. Gecko’s reported USD volume was approximately 2.3–2.4 times the locally converted quote amount, so provider volume must not replace or be merged with local volume.

Disposition: **checked for deterministic local OHLC and quote-volume bars**. Every bar retains event count, first/last event time, quote mint, conversion timestamp and stream-gap state. GeckoTerminal remains optional visual comparison only. Raw: [candle comparison](P-012-local-candle-geckoterminal-comparison.json).

## Technically useful but legally segregated

### Jupiter Tokens v2 — low-rate local/manual snapshot candidate

Current owner docs publish keyless access at 0.5 requests/second with no signup. Ten fresh Pump mints were all indexed within roughly three minutes and returned holder count, developer attribution/history fields, top-holder percentage, USD price, liquidity and timestamps. A five-token recheck also returned stable byte-identical bodies after 60 seconds. Three 429s in the ten-token pass succeeded after a ten-second pause.

This is distinct and technically useful, but not canonical: holder definitions, top-N/exclusions, developer attribution, graduation derivation, venue coverage and rolling-stat methodology are unpublished. Values can change materially within minutes and conditional fields appear/disappear. Scores and risk labels remain excluded.

The legal limitation is decisive: Jupiter’s agreement restricts sharing API content and combining it with content obtained outside Jupiter. Private internal use is plausible, but indefinite retention is not explicitly granted. Therefore this is **not checked into the merged recorder stack**; it may only be a segregated local/manual cache unless written permission covers retention and joining with PumpAPI. See [full audit](../../research/jupiter-tokens-v2-strict-free-audit-2026-08-26.md), [stability benchmark](P-012-jupiter-token-stability-benchmark.json), and [fresh-index benchmark](P-012-jupiter-fresh-token-index-benchmark.json).

## Rejected or downgraded capabilities

### RugCheck — rejected as reliable early-token facts

Five fresh tokens were queried immediately and again after 120 seconds:

- initial success: 2/5;
- initial `unable to generate report`: 3/5;
- later success: 5/5;
- all five later responses became the same body hash;
- one token changed from `Creator history of rugged tokens`, score 79 and LP locked 0% to no risks, score 1 and LP locked 100%.

Disposition: fast optional provider opinion only; not a reliable factual source for early risk, LP lock, creator history or holder conclusions. Raw: [benchmark JSON](P-012-rugcheck-fresh-token-benchmark.json).

### Jupiter — rejected from strict-free core

It adds amount-specific route/quote data, but current owner materials classify the relevant swap route as credit-consuming and keyless access as prototyping/testing. Terms also constrain API-content/performance use. It may be revisited only outside strict-free core.

### GeckoTerminal — manual/on-demand candidate only

It provides distinct pool OHLCV, but keyless is beta, approximately 10 calls/minute shared/dynamic, cached around 60 seconds, explicitly unsuitable for scheduled production polling, and has no indexing/completeness/SLA commitment. A recent migrated pool returned six minute candles, while an older onchain-verified canonical pool returned 404. Missing therefore cannot mean nonexistent, and provider coverage is not durable. Raw: [candle probe](P-012-geckoterminal-candle-probe.json).

### Solana public RPC — sampled verification only

Officially not intended for production. Method-specific 429s, null history and archive limitations prevent continuous free correctness infrastructure. Exact migration/pool verification is possible on samples, not reliably for every token.

### GoPlus — rejected

No-key Solana security responses worked and add interpreted security fields beyond PumpAPI, but no sufficiently scoped API-output/data-use license was found. The API is beta, has no freshness timestamp/SLA and owner marketing does not establish retained-data rights.

### Bubblemaps — rejected

Holder/cluster APIs require an API key and paid credits; no documented strict-free lane exists.

### Pyth SOL/USD — rejected

Owner docs moved hosted access to mandatory API keys with a free trial and paid ongoing plans on 2026-08-26. It is not a durable no-key source.

### DeFiLlama — rejected for new Pump tokens

No-key reads work for established assets, but fresh Pump mint probes returned empty maps. Anonymous limits are not documented, per-point provenance is absent, and terms restrict commercial reuse.

### PumpAPI Token Info and Balances — excluded

Owner fee page charges 10,000 lamports for each request. They are not free data endpoints.

## Capabilities not reliably filled yet

- full current holder concentration;
- reliable creator prior-launch/rug history before local installation;
- complete wallet funding graph;
- bot/insider/sybil identity;
- continuous finalized chain verification;
- durable strict-free USD reference;
- executable route quote under strict-free production terms;
- production-schedulable OHLCV;
- guaranteed metadata availability;
- provider-independent complete history.

## Capabilities achievable locally going forward

These do not need a new provider but require recording from installation onward:

- launch signers and their create signatures seen by the local PumpAPI log;
- each wallet’s buys/sells/transfers seen by the stream;
- local trade totals, price paths, unique-wallet counts and curve/pool changes;
- replay/live gap comparisons;
- exact raw-event history and source-schema changes;
- local metadata content hashes when fetches succeed.

## Research conclusion

Every high-importance capability in the [capability ledger](P-012-capability-gap-ledger.md) now has a final disposition: checked for the local/manual recorder, rejected/excluded, not reliably solvable under the strict-free rule, or not objectively knowable. No candidate remains pending.

The result is intentionally smaller than the set of technically reachable APIs. Tools were excluded when they duplicated PumpAPI, required funds/credits, lacked usable data rights, produced unstable factual-looking output, lacked necessary provenance, or could not support dependable free operation.
