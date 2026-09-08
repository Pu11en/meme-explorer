# Bubblemaps Data API v0.2.2 — strict-free adversarial audit

**Audited:** 2026-08-26  
**Evidence policy:** Bubblemaps-owned documentation, OpenAPI, API responses, terms, plan API, and GitHub metadata only. No third-party sources or undocumented scraping.

## Verdict: **REJECTED**

Bubblemaps documents the needed Solana capabilities, but they do not satisfy the required **no-card, no-funded-wallet, no-usage-credit/CU, no-paid-trial** operating model. Every operation in the official OpenAPI 0.2.2 declares `X-ApiKey` security; the authentication guide requires an API key and ties available credits to a subscription. The relevant successful requests consume documented credits, and the current public plan catalog exposes only paid plans. There is no documented anonymous or zero-credit route for these capabilities.

Primary sources: [OpenAPI 0.2.2](https://docs.bubblemaps.io/openapi.json), [authentication](https://docs.bubblemaps.io/data/api/authentication), [plan catalog](https://shop-api-prod-456302412759.europe-west1.run.app/api-subscriptions/plans), [API Terms](https://bubblemaps.notion.site/API-Terms-Conditions-33b74566812c80ffadacdf8f8ec169a6).

## Capability and cost findings

| Required capability | Official route | Documented successful cost | Strict-free result |
|---|---|---:|---|
| Solana holder concentration | `GET /v0/tokens/holders/solana/{token_address}` | 1 credit base | Reject |
| Holder-cluster map and map relationships | `GET /v0/tokens/map/solana/{token_address}` | 25 credits base | Reject |
| Cluster-adjusted concentration metrics | `GET /v0/tokens/metrics/solana/{token_address}` | 25 credits | Reject |
| Relationships among supplied wallets | `POST /v0/relationships/subgraph` | 10 + 1 credit per address | Reject |

Sources: [top holders](https://docs.bubblemaps.io/data/api/tokens/top-holders), [map](https://docs.bubblemaps.io/data/api/tokens/map), [metrics](https://docs.bubblemaps.io/data/api/tokens/metrics), [subgraph](https://docs.bubblemaps.io/data/api/relationships/subgraph), [OpenAPI](https://docs.bubblemaps.io/openapi.json).

The holder API documents address-level amounts, ranks, and shares. The map documents top-holder nodes, inferred clusters, and grouped transfer relationships. The subgraph documents grouped transfers with aggregate value, transfer count, first/last dates, and token identity—not individual transaction signatures. These are useful contracts, but availability behind metered authentication fails the governing constraint.

## Adversarial authentication checks

No-key requests to the holder, map, and metrics `GET` routes and the relationship-subgraph `POST` route each returned:

- HTTP `401`
- `{"detail":"Authentication Required"}`
- an undocumented `x-credits-consumed: 0.05` response header

The `0.05` value is recorded only as **unexplained metering metadata**. It is not documented for these failed requests and is **not evidence that a user or account was billed**, especially because no API key identified an account. It also does not establish a usable 0.05-credit access path: every response denied the requested data.

## Plans, trials, and key acquisition

The authentication documentation directs users to Bubblemaps Pro to create/manage a key and states that credits depend on the subscription. The live first-party plan endpoint currently lists only:

- **Starter:** `100000` credits, price `170`
- **Standard:** `750000` credits, price `850`

The plan payload alone does not establish currency or billing cadence. The API Terms contemplate discretionary Free Tier and Free Trial concepts, but that is not proof that either is generally obtainable now; both still involve an account/key and limited usage. The current catalog contains no free plan. A paid trial is independently disallowed by the audit rules.

## Interpretation and reliability limits

Bubblemaps says its clustering links holders through indexed-token transfers and excludes or abstracts certain CEX, DEX, contract, supernode, Magic Node, and Time Node behavior. Therefore, clusters and cluster-adjusted metrics are analytical outputs—not proof of common control, beneficial ownership, or wrongdoing. Treat them as investigative leads. Sources: [token model](https://docs.bubblemaps.io/data/api/token-model), [map](https://docs.bubblemaps.io/data/api/tokens/map), [metrics](https://docs.bubblemaps.io/data/api/tokens/metrics), [How does it work?](https://wiki.bubblemaps.io/bubblemaps-v2/how-does-it-work).

Any documented statements about cache behavior, freshness headers, typical response time, coverage, or service performance are **Bubblemaps owner-stated claims**, not independently verified reliability results. Authentication prevented successful endpoint benchmarking under the permitted zero-cost conditions.

## Scraping, licensing, and implementation boundary

Undocumented website/app scraping, private-endpoint discovery, authentication bypass, and reverse engineering are outside scope. The API Terms restrict automated spiders/robots/crawlers/scrapers, bypassing authentication or rate limits, and interfering extraction. The only admissible integration path is the documented authenticated API, which fails the cost constraints.

The official [`bubblemaps/api-docs`](https://github.com/bubblemaps/api-docs) repository was pushed 2026-07-15. Official GitHub metadata reports `license: null`, and the repository [`/license`](https://api.github.com/repos/bubblemaps/api-docs/license) endpoint returns `404`. This establishes only that GitHub detects no repository license; it does not grant reuse rights or negate Bubblemaps’ terms. No official open-source clustering engine or zero-cost substitute is established by that repository.

## Final decision

**Reject Bubblemaps Data API v0.2.2 for this pipeline.** It has documented Solana holder, cluster-map, metric, and wallet-transfer functionality, but no verified route meets all strict constraints. Reconsider only if Bubblemaps publishes a generally available, documented plan requiring no card or funded wallet and imposing no usage-credit/CU balance—and confirm its terms before integration.
