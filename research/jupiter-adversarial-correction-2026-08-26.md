# Jupiter strict-free adversarial correction — 2026-08-26

**Cutoff:** 2026-08-26 11:49 UTC. **Scope:** owner docs plus bounded no-key GET probes. No wallet, taker, signature, submission, or `/execute` call.

## Decision

Reject Jupiter V2 `/order` as a **strict-free production dependency**. It remains a technically reachable quote-only diagnostic when `taker` is omitted, but it fails the stated acceptance rule because Jupiter classifies `/swap/v2/order` as a 1-credit endpoint, recommends keys for production applications, and its API agreement still describes fee-bearing access using issued keys. Current portal pages separately document keyless access at 0.5 RPS, so technical access is verified but production entitlement is unresolved.

Do not call the no-taker response an “executable quote”: `transaction:null` means pricing only. With a taker, a buildable response contains an unsigned transaction; execution still requires signing, `/execute`, and confirmation.

## What is actually distinct beyond PumpAPI

PumpAPI already documents a free stream containing token creation, trades, migrations, pool creation, liquidity changes, transfers, and fee claims, plus pool reserves and real-time price fields. Jupiter Tokens `/recent` is therefore not a distinct Pump launch or migration source; it is a 30-record first-pool list and may show pre-migration Pump bonding-curve launches.

Jupiter’s genuinely distinct observation is request-specific cross-router routing: atomic `outAmount`, `otherAmountThreshold`, `priceImpact`, winning router (`metis`, `jupiterz`, `dflow`, or `okx`), fee fields, and proposed `routePlan` for one pair, direction, amount, option set, and instant. “Time until Jupiter routes after Pump migration” is derived by joining a finalized Pump `CompletePumpAmmMigrationEvent` to repeated Jupiter probes; it is not a Jupiter field or guaranteed service property.

Sources: [PumpAPI stream](https://pumpapi.io/stream), [PumpAPI token info](https://pumpapi.io/get-token-info), [Jupiter order docs](https://developers.jup.ag/docs/swap/order-and-execute), [Tokens recent](https://developers.jup.ag/docs/api-reference/tokens/recent).

## Exact semantics

- HTTP 200 + populated quote + `transaction:null`: quote-only success because no taker was supplied.
- HTTP 200 + `transaction:""` with a taker: router quoted pricing but could not build; match `router + errorCode`, not human text.
- `outAmount`: expected output before slippage. `otherAmountThreshold`: minimum output after slippage. `priceImpact`: percentage points; deprecated `priceImpactPct` is a decimal-ratio string. `routePlan` is proposed routing, not fills.
- Metis removal is documented as V1 `NO_ROUTES_FOUND` and V2 `/build` “No routes found”; V2 `/order` can still route through JupiterZ, Dflow, or OKX. There is no single provider-wide no-route signal.
- Tokens V2 nullable properties are often omitted in live JSON. Missing `graduatedAt`/`graduatedPool` is not proof of no migration; `/recent` absence is not proof of no indexing because only 30 records are returned.
- Preserve HTTP 400, 401, 403, 404, 429, and 5xx separately from product states.

Sources: [V2 OpenAPI](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/openapi-spec/swap/v2/swap.yaml), [market listing](https://developers.jup.ag/docs/swap/routing/market-listing), [response codes](https://developers.jup.ag/docs/portal/responses), [Tokens OpenAPI](https://github.com/jup-ag/docs/blob/1dda348d206ca25211ec225e250caaf7fbc195d5/openapi-spec/tokens/v2/tokens.yaml).

## Live probes

At 11:46:09–11:46:16 UTC, no-key, no-taker SOL→USDC orders for 0.001, 0.1, and 1 SOL all returned HTTP 200 and `transaction:null`; outputs were 96,962, 9,686,453, and 96,855,582 atomic USDC, with routers Dflow, Dflow, and OKX. These sequential results verify amount/time specificity, not execution quality or a reusable curve.

At 11:47:36 UTC, `/tokens/v2/recent` returned a fresh Pump mint whose `firstPool.createdAt` equaled 11:47:36 and had no sampled graduation fields. At 11:48:03, 11:48:08, and 11:48:14, buy/sell/buy no-taker orders all returned HTTP 200 routes; the two buy outputs changed slightly and the winner changed from Metis/Pump.fun to OKX. This is pre-migration/launch routing evidence, not post-migration latency.

Observed failures: amount zero → HTTP 400 `{"error":"Invalid amount"}`; malformed mint → HTTP 400 `{"error":"Invalid inputMint"}`; System Program used as mint → HTTP 500 `{"error":"Something unexpected occurred"}`. Therefore unsupported inputs are not consistently normalized.

## Terms and reliability

The portal publishes keyless 0.5 RPS/30 RPM in a shared 60-second sliding window and a keyed $0 Free plan. It also assigns `/swap/v2/order` one credit. The API agreement says use forms a binding agreement; describes a limited, fee-bearing license and access only through issued keys; restricts transfer of API content, excessive use, performance-information dissemination, scraping combinations, and vulnerability probing; requires characterization/branding; provides no uptime guarantee; and supplies the service AS-IS/AS-AVAILABLE. These clauses conflict with current keyless portal documentation and require owner clarification before production reliance.

Sources: [setup](https://developers.jup.ag/docs/portal/setup), [plans](https://developers.jup.ag/docs/portal/plans), [rate limits](https://developers.jup.ag/docs/portal/rate-limits), [license agreement](https://developers.jup.ag/docs/legal/sdk-api-license-agreement).

No owner source found specifies maximum or percentile delay, completeness, or an SLA from finalized Pump migration to Tokens metadata, Metis routing, or V2 meta-routing. Normal-market liquidity checks every 30 minutes are not an indexing-delay bound. Custom SLAs are advertised only for Enterprise.
