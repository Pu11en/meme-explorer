# Free-only Solana RPC audit, part 1: Helius, Alchemy, Chainstack

**Accessed:** 2026-08-26 UTC.  
**Scope:** Owner pricing/docs only (`helius.dev`, `alchemy.com`, `chainstack.com` / `docs.chainstack.com`). “Free” excludes a card, funded wallet, purchased balance, paid package, and temporary trial. Included recurring credits/CUs/RUs are treated as quotas, not a funded metered balance, where the owner says they recur and cost $0. No signup was completed, so dashboard-only requirements remain an explicit caveat.

## Executive snapshot

| Provider | Durable free entitlement | HTTP RPC | WSS | Archive/history | gRPC | SLA | Support |
|---|---|---:|---:|---|---|---|---|
| **Helius** | **Yes, documented**: $0/month, 1M credits/month; no card/email required | Yes; 10 RPS, 1 credit for standard calls | **Yes**, standard methods; 5 connections, 1,000 subscriptions/connection; usage-metered | **Yes**, archival calls on free quota | **Mainnet: no. Devnet: contradictory docs** | None on Free | Community |
| **Alchemy** | **Yes, documented, with caveat**: 30M CU/month; first-party signup article says no card; downgrade path supports persistence | Yes; pricing headline 15 RPS / docs 300 CUPS | Yes, “Smart websockets” | Yes, “Full archive data” | **No**; PAYG/Enterprise only | No signed/custom SLA on Free | Standard; 48-hour target in pricing table |
| **Chainstack** | **Yes, strongest wording**: $0/month, 3M requests/RUs, no card, “No time limit, no trial” | Yes; **Solana Mainnet 5 RPS**, Devnet 25 RPS | Yes | **Ambiguous/contradictory for Free**; limited method set even when available | **No**; Yellowstone starts at $49/month | None on Free/Community | Community only; no response-time promise |

## 1. Helius

### Free entitlement and limits

- [Pricing](https://www.helius.dev/pricing) lists **Free — $0/month**, **1M credits**, **10 requests/sec**, **1 `sendTransaction`/sec**, standard LaserStream WSS, and community support. It also says: **“Get started in less than 10 seconds. No credit cards or email required.”**
- [Credits](https://www.helius.dev/docs/billing/credits) says credits reset monthly and gives the Free plan **$0/month / 1M monthly credits**. Standard RPC calls cost 1 credit; `getProgramAccounts` costs 10. This is a recurring included quota, not a required funded balance.
- [Rate limits](https://www.helius.dev/docs/billing/rate-limits) gives Free **10 RPC RPS**, 2 DAS/enhanced RPS, 5 `getProgramAccounts` RPS, and 1 `sendTransaction`/sec.
- Durability caveat: marketing says “Ideal for testing” / “Test-drive … for free,” but the actual plan is monthly at $0 with a recurring monthly allocation and no expiry date. The separate “2 months free” statement applies to **annual paid plans**, not the Free plan.

### Protocol/features

- **HTTP JSON-RPC:** Yes. Standard RPC calls are included and cost 1 credit ([credits](https://www.helius.dev/docs/billing/credits)).
- **WSS:** Yes for standard Solana subscriptions. [Credits](https://www.helius.dev/docs/billing/credits) says standard methods are “available on all plans” at **2 credits per 0.1 MB** uncompressed. [Rate limits](https://www.helius.dev/docs/billing/rate-limits) gives Free **5 concurrent connections**, **1,000 subscriptions/connection**, type **Standard**. Helius extensions such as `transactionSubscribe` require Developer+.
- **Archive/history:** Yes within the free credit pool. [Credits](https://www.helius.dev/docs/billing/credits) says “Historical data queries, sometimes called archival calls, cost **1 credit each**,” listing `getBlock`, `getBlocks`, `getSignaturesForAddress`, `getTransaction`, etc. `getTransactionsForAddress` starts at 10 credits; `getTransfersByAddress` is explicitly Developer+.
- **gRPC:** **No free Mainnet. Free Devnet is contradictory.** [Credits](https://www.helius.dev/docs/billing/credits) says LaserStream gRPC Mainnet is Business/Professional and Devnet is “available on all plans.” But [rate limits](https://www.helius.dev/docs/billing/rate-limits) shows Free as “—” under gRPC networks and Developer as Devnet; the pricing comparison likewise places Devnet at Developer, while the Free card’s extracted text is visually ambiguous. Do not claim free gRPC without dashboard/provider confirmation.
- **SLA:** None. [Pricing](https://www.helius.dev/pricing) shows Free support-response SLA “—”; latency/uptime SLA is Enterprise.
- **Support:** Community support only ([pricing](https://www.helius.dev/pricing)).

### Date/consistency notes

- [Credits](https://www.helius.dev/docs/billing/credits) carried `dateModified` **2026-07-23** when accessed 2026-08-26.
- The gRPC Devnet entitlement is the material internal contradiction. No future-dated Helius document was observed.

## 2. Alchemy

### Free entitlement and limits

- [Pricing](https://www.alchemy.com/pricing) says **“Free 30M CU per month,” “15 requests per second,”** 5 apps, 5 webhooks, and standard support. FAQ text says new Free users “immediately have access to **30M free Compute Units per month**.”
- [Pricing-plan docs](https://www.alchemy.com/docs/reference/pricing-plans) independently list Free **30,000,000 base CUs** and **300 CUPS** per app. The pricing page explains simple JSON-RPC may cost 10 CUs while typical traffic averages 27, so the 15-RPS headline and 300-CUPS limit are different units, not necessarily a direct conflict.
- **No-card evidence:** a first-party Alchemy signup explainer, [How to Get Base Sepolia ETH from a Faucet](https://www.alchemy.com/overviews/get-base-sepolia-eth), says: **“it’s free to sign up for an Alchemy account with no credit card required.”** No funded wallet or purchased balance is described for the Free RPC plan.
- **Durability:** [pricing](https://www.alchemy.com/pricing) specifies a monthly recurring free allocation and supports upgrading/downgrading. [Downgrade support](https://www.alchemy.com/support/how-to-downgrade-to-free-tier) documents returning to Free and deleting card details. Caveat: unlike Chainstack, the pricing page does not expressly say “no time limit/no trial”; persistence is inferred from recurring monthly entitlement and downgrade support.

### Protocol/features

- **HTTP JSON-RPC:** Yes. [Pricing-plan docs](https://www.alchemy.com/docs/reference/pricing-plans) mark Node API present on Free; [Solana RPC](https://www.alchemy.com/rpc/solana) documents hosted Solana RPC endpoints.
- **WSS:** Yes. Both [pricing](https://www.alchemy.com/pricing) and [pricing-plan docs](https://www.alchemy.com/docs/reference/pricing-plans) mark **Smart WebSockets** on Free.
- **Archive/history:** Yes. [Pricing](https://www.alchemy.com/pricing) and [pricing-plan docs](https://www.alchemy.com/docs/reference/pricing-plans) mark **Full Archive Data** on Free. It remains CU-metered within the 30M monthly quota; method-specific Solana retention/coverage is not stated on those pages.
- **gRPC:** No. [Yellowstone gRPC Quickstart](https://www.alchemy.com/docs/reference/yellowstone-grpc-quickstart) states: **“Yellowstone gRPC is only available to PAYG (Pay-As-You-Go) and Enterprise teams.”**
- **SLA:** No signed/custom SLA on Free. [Pricing](https://www.alchemy.com/pricing) places signed SLAs under Enterprise; [pricing-plan docs](https://www.alchemy.com/docs/reference/pricing-plans) mark Custom SLAs ✗ for Free and PAYG, ✓ for Enterprise.
- **Support:** Current [pricing](https://www.alchemy.com/pricing) says Standard support and its comparison table gives the Free column a **48-hour target response time** with email/ticket support. [Pricing-plan docs](https://www.alchemy.com/docs/reference/pricing-plans) also mark Email Support ✓.

### Date/consistency notes

- No visible last-modified date was found on the cited current pricing/docs pages.
- **Stale-claim warning:** older owner-domain search/index material can surface **100M CU/month**. The live pricing page and current pricing-plan docs both say **30M**, so use 30M as of 2026-08-26.
- No future-dated Alchemy source was used.

## 3. Chainstack

### Free entitlement and limits

- [Pricing](https://chainstack.com/pricing/) is explicit: Developer **$0/month**, **3M requests included**, one node, WebSockets, community support, **“No credit card required,”** and **“No time limit, no trial.”** This cleanly satisfies durable free-only criteria.
- The same pricing page says Developer has 25 requests/sec, but current [throughput guidelines](https://docs.chainstack.com/docs/limits) narrow Solana to **Mainnet 5 RPS** and **Devnet 25 RPS**. Use the protocol-specific 5/25 values.
- [Request units](https://docs.chainstack.com/docs/request-units) defines ordinary Full requests as **1 RU** and Archive requests as **2 RUs**. The pricing FAQ says Developer has **3,000,000 included request units**; thus the exact call count depends on archive mix.

### Protocol/features

- **HTTP JSON-RPC:** Yes; the product is a Solana node endpoint and the official Solana method references provide HTTP examples. Free quota is 3M RU with the 5/25 Solana RPS limits above.
- **WSS:** Yes, explicitly included on Developer ([pricing](https://chainstack.com/pricing/)). No free-plan concurrent-connection/subscription limit was found in the cited owner docs; mark that limit **undocumented/unknown** rather than unlimited.
- **Archive/history:** **Do not state unqualified Free archive access.** Current [throughput guidelines](https://docs.chainstack.com/docs/limits#solana-archive-methods-availability) say Solana Global Nodes can fetch archive data only for `getSignaturesForAddress`, `getTransaction`, `getBlock`, `getBlocks`, `getBlockHeight`, `getBlockTime`, and `getBlocksWithLimit`, Mainnet only. [Request units](https://docs.chainstack.com/docs/request-units#solana-method-scope) explains archive billing at 2 RU. However, the [pricing](https://chainstack.com/pricing/) Developer benefit card omits “Archive data” while Growth includes it, and a pricing control says archive nodes are Growth+. This may distinguish free **Global Node historical routing** from deployable archive nodes, but the owner docs do not resolve it clearly. Treat free archive/history as **ambiguous and method-limited** pending account-level confirmation.
- **Method caveat:** [throughput guidelines](https://docs.chainstack.com/docs/limits#solana-method-availability) say `getProgramAccounts`, `getSupply`, and `getTokenAccountsByOwner` are paid-plan-only; `getLargestAccounts` is dedicated-only. “Paid plans” here appears to exclude the $0 Developer plan.
- **gRPC:** No. The official [Yellowstone gRPC marketplace listing](https://chainstack.com/marketplace/featured/yellowstone-grpc-geyser-plugin/) starts at **$49/month for 1 stream**; the [2025-09-30 changelog](https://docs.chainstack.com/changelog/chainstack-updates-september-30-2025) likewise calls it a new $49 plan.
- **SLA:** None on Free. [Pricing](https://chainstack.com/pricing/) places custom uptime SLAs in higher/enterprise offerings; its Community support matrix has no SLA or response-time commitment.
- **Support:** Community only: knowledge base plus Discord/Telegram; **no email support, support hours, or target response time** on the Community level ([pricing](https://chainstack.com/pricing/)).

### Date/consistency notes

- [Throughput guidelines](https://docs.chainstack.com/docs/limits) was last modified **2026-08-05**; [Request units](https://docs.chainstack.com/docs/request-units) was last modified **2026-08-22**. Both dates precede the 2026-08-26 access date.
- Material contradictions/ambiguities: generic 25 RPS vs Solana Mainnet 5 RPS; Developer card omits archive while Global Node docs describe archive routing; “3M requests” marketing vs RU accounting (archive calls consume 2 RU). No future-dated Chainstack doc was used.

## Bottom line

All three have a current, owner-documented $0 recurring entitlement that does not require paying for a package; Helius and Chainstack explicitly say no card, and Alchemy says no card in first-party signup guidance. For a free Solana endpoint today:

- **Helius:** clearest free HTTP + standard WSS + archive, but free Devnet gRPC is internally contradictory.
- **Alchemy:** free HTTP + WSS + full archive; no free gRPC; use **30M CU/month**, not older 100M claims.
- **Chainstack:** strongest no-trial/no-card language and 3M RU, but Solana Mainnet is **5 RPS**, several RPC methods are excluded, and free archive entitlement is not cleanly reconciled across owner docs.
