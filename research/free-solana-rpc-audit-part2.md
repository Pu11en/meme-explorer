# Free-only Solana RPC audit, part 2: Shyft and Ankr

**Access context:** owner-controlled provider pages only, accessed **2026-08-26 UTC**. “Free” is applied strictly: no card, funded wallet, paid package, metered prepaid balance, or time-limited trial. A renewable quota is reported separately from a funded/PAYG balance; where the provider does not explicitly address card requirements, that is not assumed.

## Bottom line

| Provider | Strict durable-free verdict | HTTP RPC | WSS | Archive/history | Solana gRPC | Free SLA | Free support |
|---|---|---|---|---|---|---|---|
| **Shyft** | **Qualified yes.** Official pricing shows an ongoing **$0/month** plan with unlimited credits and no trial end date. However, reviewed owner docs do **not explicitly say “no card required”** or address funded-wallet requirements. | **Yes**, API-key endpoint; 10 RPC req/s. | **Supported in general**, but no plan-specific WSS connection/subscription limits or exact WSS URL were found. | **Not archive.** Only ~3–4 days / 2 epochs of transaction history is documented. | **No** on Free. | **None documented** for free RPC. | Dashboard support chat and Discord; no response-time/priority promise for Free. |
| **Ankr** | **No under the stated strict definition.** Freemium renews monthly with no top-up, no overdraft, and no charges, but usage is still metered against **200M API credits/month**. Docs do not explicitly say no card is required. A truly public/free Solana entitlement is not verified because the Solana chain page says Solana is for **Freemium and Premium**. | **Yes on Freemium**, under Public limits. | **Contradictory docs; not verified as free.** | **No Solana archive:** chain-specific docs say ~16 hours, contradicting the generic “Full and Archive data” table. | **Not verified for Solana or free.** | **No contractual SLA** on free/Public. | Community Discord only. |

## Shyft

### Free entitlement and limits

- Pricing page: **“Free / $0 / month / Unlimited Credits / 10 RPC req/sec / No gRPC Access”**. The comparison table also gives Free **10 RPC req/s**, **0 index req/s**, and **1 `sendTransaction`/s**.  
  Source: [Shyft Solana RPC & gRPC pricing](https://shyft.to/solana-rpc-grpc-pricing)
- Limits page confirms the current unlimited-plan Free row: **“Total Credits: Unlimited,” “RPC req/sec: 10,” “Index req/sec: 0,” “sendTransaction/sec: 1.”**  
  Source: [Solana RPC Limits](https://docs.shyft.to/solana/solana-rpc-limits)
- Durability: this is presented as a normal **$0/month** plan, not a temporary trial. No expiration date appears. Signup/API-key docs say **“Get an API key”** and direct users to sign up, but do not explicitly state whether a card is required.  
  Sources: [Start Building](https://docs.shyft.to/solana-shyft-api/start-building), [Shyft RPCs](https://docs.shyft.to/solana/shyft-rpcs)
- **Ambiguous wording:** the RPC overview says **“Unlimited RPC calls — no per-call credits, no rate throttling on usage,”** while the Free plan is explicitly capped at **10 req/s** and index-heavy calls at **0 req/s**. Best reading: no monthly credit ceiling, but hard per-second rate limits still apply.  
  Sources: [Shyft RPCs](https://docs.shyft.to/solana/shyft-rpcs), [Solana RPC Limits](https://docs.shyft.to/solana/solana-rpc-limits)

### HTTP RPC

- **Verified.** Mainnet endpoint format: `https://rpc.shyft.to/?api_key={your_api_key}`; devnet: `https://devnet-rpc.shyft.to/?api_key={your_api_key}`.  
  Quote: **“Your RPC URL will look like this: `https://rpc.shyft.to/?api_key={your_api_key}`.”**  
  Source: [Shyft RPCs](https://docs.shyft.to/solana/shyft-rpcs)
- Free limits: 10 standard RPC req/s; 0 index req/s; 1 `sendTransaction`/s. Unfiltered `getProgramAccounts` is blocked and gPA has a 1-second timeout.  
  Source: [Solana RPC Limits](https://docs.shyft.to/solana/solana-rpc-limits)

### WSS

- **Capability verified, free-plan operational limits incomplete.** Shyft says it supports **“the full set of standard Solana JSON-RPC methods over HTTP and WebSocket”** and publishes WebSocket PubSub methods.  
  Sources: [Shyft RPCs](https://docs.shyft.to/solana/shyft-rpcs), [Solana Websocket Methods](https://docs.shyft.to/solana/rpc-calls/solana-websockets)
- The reviewed docs do not publish an exact Shyft WSS endpoint, concurrent-connection cap, subscription cap, or a statement that the 10 req/s Free RPC limit maps to WSS subscriptions/notifications. Do not invent those values.

### Archive/history

- **No archive entitlement verified.** Shyft documents a custom historical method but only recent retention: **“Currently 2 epochs of data is available”** and elsewhere **“transaction history is currently available upto 3-4 days.”**  
  Sources: [`getTransactionsForAddress`](https://docs.shyft.to/solana/get-transactions-for-address), [Shyft RPCs](https://docs.shyft.to/solana/shyft-rpcs)
- These two descriptions are broadly compatible but not identical; no permanent/full-ledger archive promise or Free-specific history guarantee was found.

### gRPC, SLA, support

- **gRPC: explicitly unavailable on Free.** Quote: **“No gRPC Access.”** Paid Build/Grow/Accelerate plans include it.  
  Source: [Shyft pricing](https://shyft.to/solana-rpc-grpc-pricing)
- **SLA:** no contractual SLA for the Free HTTP/WSS RPC plan was found. A separate gRPC page says **“Shyft guarantees 99.9% uptime across all gRPC regions,”** but Free has no gRPC, so this cannot be attributed to Free RPC.  
  Source: [Shyft Yellowstone gRPC](https://shyft.to/solana-yellowstone-grpc)
- **Support:** **“support chat on your Shyft dashboard”** or **Shyft Discord**. No Free priority or response-time commitment is stated.  
  Source: [Solana RPC Limits](https://docs.shyft.to/solana/solana-rpc-limits)

### Date/staleness flags

- No “last updated” date was exposed on the reviewed Shyft pages. No dated future claim was found.
- The pricing UI still exposes **“Legacy Plans”** (Hack/Launch/Scale), and its FAQ says they are **“still available.”** This is not a Free-plan contradiction, but readers should not mix legacy paid credit limits with the current unlimited-credit Free row.  
  Source: [Shyft pricing](https://shyft.to/solana-rpc-grpc-pricing)

## Ankr

### Free entitlement and limits

- Ankr defines Freemium as **“a service plan to try out premium features”** with **“free 200M API credits monthly”** and says users sign in **“without topping up your account balance.”**  
  Source: [Service plans](https://www.ankr.com/docs/rpc-service/service-plans/)
- Charging policy makes the renewable nature clearer: **“Credits renew monthly; no overdraft and no charges”** and Freemium has **“no balance to manage.”** This supports a durable monthly entitlement rather than a one-time trial, despite the phrase “try out.”  
  Source: [Charging policy & account balance](https://www.ankr.com/docs/rpc-service/charging-policy/)
- **Strict-free caveat:** the 200M-credit allowance is metered usage. It is not a funded PAYG balance, but it may fail a definition that excludes any metered credit quota. Official docs do not explicitly state “no card required.”
- Freemium Solana limits: approximately **1,800 requests/min across all endpoints guaranteed**; more may be possible depending on load; Node API batch size **100**. The generic max-block-range field is **3,000**, but it is not labeled Solana-specific and should not be assumed to govern Solana methods.  
  Source: [Service plans](https://www.ankr.com/docs/rpc-service/service-plans/)
- Public endpoints are generically described as free, but the chain list specifically says Solana is **“Available for Freemium and Premium users.”** Therefore an unauthenticated Public Solana entitlement is not verified.  
  Sources: [Service plans](https://www.ankr.com/docs/rpc-service/service-plans/), [Supported chains S–T: Solana](https://www.ankr.com/docs/rpc-service/chains/chains-list/s-t/)

### HTTP RPC

- **Verified for Freemium.** The plan table lists Freemium connection as **HTTPS**, and Solana mainnet/devnet as HTTPS-capable. The example private endpoint contains `{your_token}`.  
  Sources: [Service plans](https://www.ankr.com/docs/rpc-service/service-plans/), [Supported chains S–T: Solana](https://www.ankr.com/docs/rpc-service/chains/chains-list/s-t/)
- Solana requests are listed at 500 API credits each on the pricing page, but that section is framed as Premium/PAYG pricing. Do not automatically convert Freemium’s 200M-credit quota into a precise request count without Ankr explicitly confirming the same debit schedule applies to Freemium.  
  Source: [Pricing](https://www.ankr.com/docs/rpc-service/pricing/)

### WSS

- **Contradictory; free WSS not safely claimable.** The generic plan table says Freemium connection is **“HTTPS”** while only Premium is **“HTTPS and WebSocket.”** Yet the Solana chain page says Solana is available to Freemium/Premium and lists both Mainnet and Devnet as **“HTTPS and WSS.”**  
  Sources: [Service plans](https://www.ankr.com/docs/rpc-service/service-plans/), [Supported chains S–T: Solana](https://www.ankr.com/docs/rpc-service/chains/chains-list/s-t/)
- Pricing meters Solana WSS subscription and notification actions at 500 API credits each, but does not say Freemium can use WSS. Treat free WSS entitlement as unresolved until Ankr reconciles the pages.  
  Source: [Pricing](https://www.ankr.com/docs/rpc-service/pricing/)

### Archive/history

- **Chain-specific answer: not archive.** Solana docs state: **“ledger size of ~100M, which retains approximately the last 16 hours of transaction history”** and **“For deeper historical lookups, use a Solana archive provider or a block explorer API.”**  
  Source: [Solana API](https://www.ankr.com/docs/rpc-service/chains/chains-api/solana/)
- **Direct contradiction:** the generic service-plan table marks **“Full and Archive data”** as available for Public, Freemium, and Premium. The newer/specific Solana page limits history to ~16 hours, so the generic archive checkmark must not be applied to Solana.  
  Source: [Service plans](https://www.ankr.com/docs/rpc-service/service-plans/)

### gRPC, SLA, support

- **Solana gRPC not verified.** Generic pricing lists gRPC billing (10 credits/method call and 5,000,000 credits/GB), but the Solana chain page lists only HTTPS/WSS and the plan connection table omits gRPC. No owner page reviewed grants Solana gRPC to Freemium.  
  Sources: [Pricing](https://www.ankr.com/docs/rpc-service/pricing/), [Supported chains S–T: Solana](https://www.ankr.com/docs/rpc-service/chains/chains-list/s-t/)
- **SLA:** Public/free endpoints are **“Best-effort”** and **“carry no contractual SLA.”** PAYG also has no individual self-serve SLA; only Enterprise has contractual 99.9%/service-credit terms.  
  Source: [SLA & service reliability](https://www.ankr.com/docs/rpc-service/sla/)
- **Support:** Public and Freemium receive **“Community Support (Discord)”**; priority portal support is Premium.  
  Source: [Service plans](https://www.ankr.com/docs/rpc-service/service-plans/)

### Date/staleness flags

- The reviewed Ankr pricing, service-plan, SLA, charging, Solana API, and supported-chain HTML pages display **“Last updated Aug 25, 2026”**; accessed **Aug 26, 2026 UTC**. This is recent, not stale or future-dated.
- The contradiction between the newly dated generic archive/WSS tables and the chain-specific Solana pages appears current, not merely a clearly stale legacy page.

## Audit conclusion

- **Shyft** is the stronger current free-only RPC claim: durable $0/month, unmetered credits subject to 10 req/s, HTTP plus documented WebSocket support, but no gRPC, no archive, and no free SLA. The no-card/no-wallet condition remains undocumented rather than proven.
- **Ankr** has a durable renewable Freemium allowance and no funded balance or charges, but it is credit-metered, and owner docs conflict on free WSS and Solana archive. Under the user’s strict exclusion of metered balances, it should **not** be labeled unqualified free-only.
