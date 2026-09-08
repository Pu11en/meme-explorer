# Free-only Solana RPC audit, part 3: QuickNode and Triton One

_Accessed 2026-08-26 (CDT). Primary-source scope only: current provider-owned pricing, product, documentation, and provider blog pages. “Free” here excludes any card, funded wallet, deposited/metered balance, paid package, or temporary trial. No signup was performed, so onboarding behavior not stated in public docs was not inferred._

## Bottom line

| Provider / surface | Strict durable-free result |
|---|---|
| **QuickNode managed Solana endpoint** | **Fail.** The current pricing authority calls the $0 offer a **“Free trial”** and limits it to **one month**. A current Solana marketing page instead calls it a continuing “free tier”; this is a material contradiction. Under the strict definition, the explicit one-month pricing term controls and is not durable. |
| **Triton One managed Solana endpoint** | **Fail.** Current pricing requires a **$125 prepaid, non-refundable stablecoin deposit**, valid for 12 months. No qualifying free managed endpoint is documented. |
| **Triton Old Faithful public archive** | **Narrow exception, not a managed free RPC plan.** Triton currently hosts archive files for self-run Jetstreamer “for free, as a public good,” but explicitly says **“subject to change.”** It is archive/backfill access, not durable HTTP RPC + WSS + live gRPC + SLA entitlement. |

## QuickNode

### Entitlement and limits

- Current [pricing](https://www.quicknode.com/pricing) says: **“Free trial,” “10M credits · no overage,” “$0,” “1 month to test everything. No card required,” “15 requests per second,”** and **“Community support.”** The comparison table also gives the trial **1 endpoint**, **10 million API credits**, no purchasable additional credits, and no response-time SLA.
- Therefore it passes no-card signup but **fails durable-free entitlement** because it is expressly temporary. Exhausting 10M credits has “no overage”; the page does not document a durable post-trial free state.
- Contradiction: the current [Solana product page](https://www.quicknode.com/chains/solana) says **“The free tier covers prototyping and small production loads, no credit card required”** and **“The Quicknode free tier includes a private Solana RPC endpoint on both mainnet and devnet.”** This conflicts with the pricing page’s one-month “Free trial.” Treat “durable free tier” as **unverified/failed**, not established.

### Interfaces and data (during the temporary trial only)

- **HTTP RPC: yes.** The [Solana product page](https://www.quicknode.com/chains/solana) says the private endpoint supports mainnet and devnet and describes **HTTPS** endpoints with full method coverage.
- **WSS: yes, metered.** The same page says **“Both HTTPS and WebSocket endpoints are included.”** [Subscription strategy docs](https://www.quicknode.com/docs/solana/subscriptions) (shown as updated **Aug 07, 2026**, observed 2026-08-26) list WebSockets at **“Free Trial Plan & up”**, billed on metered data usage. Thus WSS exists inside the trial’s credit ceiling, not as durable unlimited/free access.
- **Archive/history: available on Solana mainnet, but trial-scoped and method-limited.** [Solana docs](https://www.quicknode.com/docs/solana) (last updated **Jul 9, 2026**) say **“Mainnet-beta has full archive support with no pruning,”** while Devnet/Testnet are pruned at 6,578,505/10,964,176 slots. Trial method docs impose smaller bounds: [`getBlocksWithLimit`](https://www.quicknode.com/docs/solana/getBlocksWithLimit) says the block range is **5 for Free Trial plans** versus 1005 for paid accounts. This verifies trial archive capability but not durable entitlement.
- **gRPC: no on the $0 trial.** [Solana gRPC docs](https://www.quicknode.com/docs/solana/solana-grpc/overview) (last updated **Aug 9, 2026**) say: **“included with Scale and Business plans. On Build and Accelerate plans, it remains available via the Solana gRPC add-on.”** The pricing comparison shows no trial concurrent streams/accounts. The broad Solana page’s “all interfaces” copy should not be read as free-plan inclusion.

### SLA and support

- **Support:** community only on the trial; no ticket support and no response SLA. [Pricing](https://www.quicknode.com/pricing) gives paid response targets of 24/12/8 hours and reserves **“Contractual uptime SLAs”** for Enterprise.
- **Uptime SLA:** **not verified for the trial.** The [Solana product page](https://www.quicknode.com/chains/solana) uses **“credit-backed uptime”** and elsewhere says managed RPC provides an uptime SLA, even “from the free tier upward.” Pricing, however, gives the trial no response SLA and explicitly places contractual uptime SLAs under Enterprise. No trial SLA percentage, service-credit formula, or enforceable term was found. Flag as marketing/pricing ambiguity, not a free SLA.

### Date/freshness flags

- The same [Solana docs](https://www.quicknode.com/docs/solana), despite a **Jul 9, 2026** update date, state Solana **“will migrate to the Alpenglow consensus protocol in early 2026.”** On the 2026-08-26 access date, that future tense/date is stale or unresolved. It does not change the pricing conclusion but lowers confidence in undated marketing copy.

## Triton One

### Entitlement and limits

- Current [pricing](https://www.triton.one/pricing) requires: **“Sign up and deposit $125,” “Create an account and deposit stablecoins to your balance,”** and **“Minimum deposit is $125… prepaid, non-refundable, and valid for 12 months.”** This fails the strict definition on funded wallet/metered balance and has no qualifying free plan.
- Usage is metered: standard RPC/unary gRPC/account/ledger queries are **$0.08/GB + $10/million calls**; streaming is **$0.08/GB**. “Every product is included on every plan” means no feature tier-gating, not free usage.
- Paid shared-service operational limit: [rate-limit docs](https://docs.triton.one/core-features/ratelimits) say **1,200 requests per 10 seconds per IP** for most methods, with lower undocumented limits for expensive methods such as `getProgramAccounts`; endpoint-specific limits are exposed at `https://<endpoint>.rpcpool.com/ratelimits`. [FAQ](https://docs.triton.one/core-features/support-faqs) says shared service is for frontend dApp traffic and **backend scripts/bots require a dedicated node**. These are not free entitlements.
- Ambiguous internal naming: [Rate Tiers API docs](https://docs.triton.one/account-management/api-access/rate-tiers) (observed as “Last updated 2 months ago” on 2026-08-26) show a rate-tier enum named **`free`**, but the endpoint is restricted to reseller-role account-management tokens and the same page says rate limits do not affect pricing and products are billed per million requests plus bandwidth. This is **not evidence of a customer free plan** and conflicts with any inference based on the enum name alone.

### Interfaces and data (managed paid endpoint)

- **HTTP RPC and WSS: yes, paid.** [Solana docs](https://docs.triton.one/chains/solana) (observed as “Last updated 7 days ago” on 2026-08-26) say **“complete compatibility with the standard Solana JSON-RPC and WebSocket APIs across Mainnet, Testnet, and Devnet.”** [FAQ](https://docs.triton.one/core-features/support-faqs) says to replace `https` with `wss` in the endpoint URL.
- **Archive/history: yes on paid endpoints.** The same Solana docs say: **“All our endpoints provide access to the full history… all the way back to genesis.”** [Old Faithful docs](https://docs.triton.one/project-yellowstone/old-faithful-historical-archive) clarify it is **“automatically integrated into your Triton One subscription”** for historical `getBlock`/`getTransaction` calls. Subscription language means this is not a free managed entitlement.
- **Live gRPC: yes, paid/metered.** [Dragon’s Mouth docs](https://docs.triton.one/project-yellowstone/dragons-mouth-grpc-subscriptions) require a customer endpoint + token; [pricing](https://www.triton.one/pricing) meters streaming at $0.08/GB.
- **Archive gRPC:** no current hosted entitlement. [Old Faithful docs](https://docs.triton.one/project-yellowstone/old-faithful-historical-archive) say **“The current hosted version of the gRPC interface is retired… You can still self-host this.”** The page was observed as “Last updated 3 months ago” on 2026-08-26. This contradicts its earlier generic feature line advertising access via high-performance gRPC streams; treat hosted archive gRPC as retired.

### Narrow free archive exception

- Triton’s official article [“Streaming Solana history: the open-source path to indexing”](https://blog.triton.one/streaming-solanas-history-the-open-path-to-backfill-indexing/) (updated **3 Jun 2026**) says: **“We currently host the archives you can use with Jetstreamer for free, as a public good (subject to change)”** and **“Runs on your own hardware against the free public archive, no per-query credits or rate limits.”** This is useful free historical backfill, but its explicit revocability defeats “durable,” and users supply their own hardware/client. It is not a Triton managed live RPC/WSS/gRPC plan and has no documented SLA/support entitlement.

### SLA and support

- **Support on paid endpoint:** [pricing](https://www.triton.one/pricing) says every endpoint includes **“1-1 support from senior engineers.”** [FAQ](https://docs.triton.one/core-features/support-faqs) lists `support@triton.one` and Telegram. No response-time SLA is stated.
- **Uptime:** pricing markets **“99.99% uptime, 24/7 reliability,”** but no owner page found in this audit calls it a contractual SLA or specifies service credits/remedies. Therefore **no free SLA**, and even for paid PAYG this is a performance claim rather than a verified contractual SLA.

### Date/contradiction flags

- [Pricing](https://www.triton.one/pricing) says a prepaid deposit is valid for 12 months, while the [FAQ](https://docs.triton.one/core-features/support-faqs) says standard billing is month-to-month and requires one calendar month’s cancellation notice. These may describe different/legacy arrangements; applicability to current PAYG is ambiguous.
- A dated official post, [“Triton One 101: Solana Accelerate edition”](https://blog.triton.one/triton-one-101-solana-accelerate-edition/) (**5 May 2026**), said Fumarole was free only **“Until June 1”** and only **“on any Triton plan.”** On the 2026-08-26 access date this promotion is expired and, because it required a plan, never qualified under the strict definition.

## Strict free-only capability matrix

| Provider | Durable free | HTTP RPC | WSS | Archive/history | gRPC | SLA | Support |
|---|---|---|---|---|---|---|---|
| QuickNode | **No** — $0 is a 1-month trial; marketing says “free tier” inconsistently | Trial only | Trial only; metered credits | Trial only; mainnet archive, tighter method limits | **No** on trial | None verified; enterprise contractual SLA only | Community only |
| Triton One managed | **No** — $125 prepaid non-refundable deposit | Paid only | Paid only | Paid subscription only | Paid/metered only | No free SLA; 99.99% is unspecific marketing | Paid endpoint includes 1:1 senior-engineer support; no response target |
| Triton Old Faithful public archive | **Not durable** — explicitly subject to change | Public HTTP archive mirror / self-run tooling, not managed standard endpoint | No | Yes, public backfill from genesis | Hosted archive gRPC retired; self-host possible | None documented | Docs/contact only; no entitlement |
