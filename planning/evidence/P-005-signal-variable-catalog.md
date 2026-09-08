# P-005 — Candidate signal-variable catalog

Status: research synthesis; **no variable or threshold is approved yet**.

The purpose is to identify measurable facts that could help distinguish rare outliers from the majority of launches. Availability is not evidence of predictive power. Every included variable must later be tested against an explicitly chosen outcome and horizon.

## Availability classes

- **T0 — creation event:** present when the token-creation event is received.
- **T1 — immediate enrichment:** usually queryable within seconds, but provider/indexer reliability must be measured.
- **T2 — early behavior:** requires observing trades/holders over a time window.
- **T3 — later market state:** appears only after external markets/indexers/routes exist.

## Candidate variables

| Variable | Exact observable | Earliest class | Confirmed source/path | Access state | Main weakness/manipulation |
|---|---|---:|---|---|---|
| Creator identity | creator public key | T0 | PumpPortal `traderPublicKey` | Confirmed, no-key creation stream | Wallets are disposable |
| Creator’s initial SOL | SOL spent by creator in create transaction | T0 | PumpPortal `solAmount` | Confirmed | Large buys can be staged; small buys may still succeed |
| Creator’s initial token amount/share | `initialBuy`; divide by confirmed supply for share | T0/T1 | PumpPortal + Solana `getTokenSupply` | Confirmed; supply returned in ~387 ms in one trial | Does not reveal linked wallets or later sells |
| Initial curve state | virtual SOL/token curve balances and creation-time market cap | T0 | PumpPortal curve fields | Confirmed | Mechanical consequence of launch/initial buy; may add little independent information |
| Token mode/program | `is_mayhem_mode`, pool, token program/type | T0/T1 | PumpPortal + RugCheck summary | Confirmed | Category/context, not inherently quality |
| Creator prior activity | wallet signature/transaction history; prior token creations | T1 | Solana `getSignaturesForAddress`; Helius enhanced history | Basic RPC availability confirmed | Requires correct transaction classification; wallets are disposable |
| Creator prior rug finding | named `Creator history of rugged tokens` risk | T1 | RugCheck report summary | Confirmed immediately in one trial | Provider-defined classification; must retain named evidence, not only opaque score |
| Creator funding/age | first observed transaction, funder, wallet age | T1 | Solana/Helius transaction history | Plausible, not yet measured end-to-end | Funding can be laundered through intermediate wallets |
| Metadata availability | metadata fetch state: available/missing/fetch-failed | T0/T1 | event `uri`, HTTP gateway | Confirmed but inconsistent | Gateway failures are not metadata absence |
| Social/website presence | non-empty website/Twitter/Telegram fields | T1 | metadata JSON | Confirmed in successful samples | Self-asserted and cheap to fake; presence is not legitimacy |
| Metadata quality/novelty | duplicate image/text/domain, domain age, reused social account | T1+ | metadata plus external checks | Plausible, not yet validated | More sources, privacy/terms, fuzzy matching; attackers can vary assets |
| Mint/freeze/authority facts | mint authority, freeze authority, token extensions | T1 | Solana token account/program; RugCheck | Plausible/partially exposed | Pump.fun mechanics may make some fields constant and non-discriminating |
| LP/risk facts | LP locked %, named risk findings | T1 | RugCheck summary/full report | Summary confirmed immediately | Third-party methodology; aggregate score is opaque unless decomposed |
| Top-holder concentration | top-N supply share, excluding known curve/program accounts | T1/T2 | Solana `getTokenLargestAccounts` or Birdeye holder API | Public RPC hit 429; provider path available but not validated | Early distribution changes rapidly; linked wallets evade concentration metrics |
| Holder count/growth | unique holder count and change over window | T2 | Birdeye holder/market data or indexed token accounts | Provider-documented, unvalidated here | Sybil wallets inflate count |
| Tagged holder mix | shares held by dev/bundler/sniper/insider/smart-trader tags | T2 | Birdeye holder profile/positions | Provider-documented, likely paid/keyed | Vendor labels can be delayed/wrong; opaque identity method |
| First-buyer quality | first buyer list, wallet history/net worth/tags | T2 | Birdeye first-buyers/holder products or own decoder | Provider-documented, unvalidated | Copy/bot wallets and delayed labels; potentially expensive |
| Unique buyers | distinct buyer wallets within an explicit window | T2 | PumpPortal token-trade stream or on-chain decoder | Technically available; PumpPortal requires funded API key and metered stream | Sybil buyers inflate count |
| Buy/sell counts | buys and sells within an explicit window | T2 | PumpPortal trade stream; later DEX Screener `txns` | Keyed/metered early; indexed later | Wash trading |
| Net SOL flow | buy SOL minus sell SOL in window | T2 | trade stream/on-chain decoder | Keyed/metered or custom decoder | Wash trades and self-funding |
| Flow velocity/acceleration | trades, unique buyers, or net SOL per second and their change | T2 | timestamped trade stream | Keyed/metered or custom decoder | Bot bursts; depends heavily on chosen window |
| Buyer concentration | share of early buy volume from top wallets; Herfindahl/Gini-style concentration | T2 | trade stream | Keyed/metered or custom decoder | Linked wallets defeat naive wallet-level concentration |
| Creator sell behavior | creator or linked-wallet sells/position reduction | T2 | token/account trade stream or decoder | Keyed/metered or custom decoder | Linked wallets and transfers can hide behavior |
| Curve progress | change in virtual curve balances / progress toward migration | T2 | trade stream and curve account state | Available with paid stream or chain decoding | Mechanical and gameable; needs explicit timing |
| DEX-indexed liquidity | reported USD/base/quote liquidity | T3 | DEX Screener pair endpoint; Birdeye market data | DEX Screener had no pair through 15 s in one trial | Delayed; reported liquidity can be temporary/manipulated |
| Volume/price change | indexed windowed volume and price change | T3 | DEX Screener/Birdeye | Provider-documented; not early in trial | Already reflects price move; prone to wash trading |
| Executable route/impact | quote availability, output, route, price impact for a fixed notional | T3 | Jupiter quote API once routable | Plausible, not yet trialed | No route before migration; quote changes rapidly |
| Migration event/time | whether and how quickly token migrates from curve | T3 | PumpPortal `subscribeMigration` | Documented as free; not yet trialed | Very late relative to earliest-entry alerts |
| Paid promotion | boosts/orders/paid visibility | T3 | DEX Screener boosts/orders APIs | Documented | Payment changes visibility, not token quality; may be confounder/risk rather than positive signal |

## Candidate variable families to decide individually

1. Creator provenance and behavior.
2. Creation economics and curve state.
3. Immediate security/authority facts.
4. Metadata and social facts.
5. Early buyer diversity and concentration.
6. Early order-flow direction and acceleration.
7. Holder distribution and tagged-wallet mix.
8. Later liquidity, routability, and migration.

## Required decision discipline

For every variable, record separately:

1. **Include for collection?** Collection may be broader than alerting.
2. **Role:** positive evidence, negative evidence, context-only, or excluded.
3. **Exact definition:** formula, exclusions, and missing-data behavior.
4. **Observation time:** creation, 5 s, 15 s, 30 s, etc.—never “early” without a window.
5. **Manipulation risk:** how cheaply an issuer or bot cluster can fake it.
6. **Outcome test:** what later result would support or refute its usefulness.
7. **Alert use:** only after enough observations show the variable separates the chosen outlier outcome.

## Sources

- [PumpPortal real-time data API](https://pumpportal.fun/data-api/real-time)
- [PumpPortal fees and access conditions](https://pumpportal.fun/fees/)
- [Solana `getTransaction`](https://solana.com/docs/rpc/http/gettransaction)
- [Solana `getTokenLargestAccounts`](https://solana.com/docs/rpc/http/gettokenlargestaccounts)
- [Solana `getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress)
- [Solana RPC transaction structures](https://solana.com/docs/rpc/json-structures)
- [RugCheck Swagger API](https://api.rugcheck.xyz/swagger/index.html)
- [Birdeye holder distribution](https://docs.birdeye.so/reference/get-holder-v1-distribution)
- [Birdeye holder profile](https://docs.birdeye.so/reference/get-token-v1-holder-profile)
- [Birdeye token security](https://docs.birdeye.so/reference/get-defi-token_security)
- [Birdeye market data](https://docs.birdeye.so/reference/get-defi-v3-token-market-data)
- [DEX Screener API reference](https://docs.dexscreener.com/api/reference)
- [Helius enhanced transaction history](https://helius.mintlify.app/api-reference/rpc/http/gettransactionsforaddress)
