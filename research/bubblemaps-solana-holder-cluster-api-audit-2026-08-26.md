# Bubblemaps Solana holder-cluster / wallet-relationship API audit

**Verified at:** 2026-08-26 12:21–12:24 UTC  
**Requested cutoff:** 2026-08-26. In this runtime that date is **today**, not a future cutoff. The newest first-party documentation found and verified was the 2026-07-13 changelog; the official `api-docs` repository was last pushed 2026-07-15. Claims below are limited to primary sources accessible on 2026-08-26.

## Bottom line

Bubblemaps has a documented Data API for Solana token holders, cluster maps, and transfers among wallets. The production base URL is `https://api.bubblemaps.io`; the current map route is `GET /v0/tokens/map/solana/{token_address}` and the arbitrary-address relationship route is `POST /v0/relationships/subgraph`. Every route in the published OpenAPI 0.2.2 declares `X-ApiKey` authentication. The authentication guide says a key is required, credits depend on a subscription, and exhausted credits produce `429` responses. There is **no documented anonymous/no-key API** and **no documented zero-credit endpoint** in the current API docs. Direct no-key checks of both `/v0/chains` and a Solana map returned `401 {"detail":"Authentication Required"}` on the verification date.

The API Terms define a possible **Free Tier**, but it still requires a valid Bubblemaps account/API key and is subject to caps; it is not an anonymous API. Moreover, the current public plan catalog returned only paid Starter and Standard plans. Thus a free tier is legally contemplated, not proven generally available on the verification date.

**Website scraping is explicitly rejected as an implementation option.** Use the documented API. The API Terms prohibit automated spiders/robots/crawlers/scrapers against the API Services, prohibit bypassing authentication/rate limits, and prohibit scraping/extraction that interferes with Bubblemaps systems. Scraping the website or reverse-engineering private app endpoints would also be unstable, unsupported, and unnecessary given the official API.

Primary sources: [Data API introduction](https://docs.bubblemaps.io/data/api/introduction), [authentication](https://docs.bubblemaps.io/data/api/authentication), [official OpenAPI 0.2.2](https://docs.bubblemaps.io/openapi.json), [API Terms](https://bubblemaps.notion.site/API-Terms-Conditions-33b74566812c80ffadacdf8f8ec169a6), [official API docs repository](https://github.com/bubblemaps/api-docs).

## Relevant endpoints

All requests use `X-ApiKey: <key>`. `solana` is a documented `ChainIdV0`; Solana addresses are case-sensitive ([token model](https://docs.bubblemaps.io/data/api/token-model)).

| Purpose | Method and route | Base credit cost | Important limits/options |
|---|---|---:|---|
| Supported chains | `GET /v0/chains` | 0.01 | Returns current chain IDs; authenticated despite low cost ([docs](https://docs.bubblemaps.io/data/api/chains/supported)). |
| Search tokens | `GET /v0/tokens/search?query=...` | 0.5 | Required query string, minimum length 2 ([OpenAPI](https://docs.bubblemaps.io/openapi.json)). |
| Token metadata | `GET /v0/tokens/metadata/{chain}/{token_address}` | 0.1 | Optional `return_token_stats`; returns token key, metadata, and optional stats ([OpenAPI](https://docs.bubblemaps.io/openapi.json)). |
| Batch token metadata | `POST /v0/tokens/metadata` | 0.1/token | JSON array of token keys, maximum 1000 ([OpenAPI](https://docs.bubblemaps.io/openapi.json)). |
| Token top holders | `GET /v0/tokens/holders/{chain}/{token_address}` | 1 | Default/allowed `limit`: 80; enum also permits 250/500. Metadata, refresh, and history cost extra ([docs](https://docs.bubblemaps.io/data/api/tokens/top-holders)). |
| Full holder map/clusters/relationships | `GET /v0/tokens/map/{chain}/{token_address}` | 25 | `limit` 80/250/500; optional nodes, relationships, clusters, history, refresh; magic/time nodes default on ([docs](https://docs.bubblemaps.io/data/api/tokens/map)). |
| Metrics only | `GET /v0/tokens/metrics/{chain}/{token_address}` | 25 | Supply statistics and decentralization scores ([docs](https://docs.bubblemaps.io/data/api/tokens/metrics)). |
| Relationships among supplied addresses | `POST /v0/relationships/subgraph` | 10 + 1/address | 2–1000 addresses; optional context token forces inclusion of that token’s transfers ([docs](https://docs.bubblemaps.io/data/api/relationships/subgraph)). |
| Address metadata | `GET /v0/addresses/metadata/{address}`; `POST /v0/addresses/metadata` | 1/address | The 2026-04-29 changelog says these are custom-plan-only; batch accepts 1–2500 addresses ([changelog](https://docs.bubblemaps.io/data/api/changelog/2026-04-29), [OpenAPI](https://docs.bubblemaps.io/openapi.json)). |

Deprecated `GET /maps/{chain}/{token_address}` and `GET /chains` were scheduled for removal on 2026-07-01. Do not build against them; use `/v0/...` ([2026-04-29 changelog](https://docs.bubblemaps.io/data/api/changelog/2026-04-29)).

## Exact documented map contract

### Request

`GET https://api.bubblemaps.io/v0/tokens/map/{chain}/{token_address}`

- Header: `X-ApiKey` (required by endpoint security scheme).
- Path `chain`: enum `eth | base | solana | tron | bsc | sonic | ton | avalanche | polygon | monad | hyperevm | arbitrum | robinhood` in OpenAPI 0.2.2.
- Path `token_address`: string; Solana is case-sensitive.
- Query `limit`: enum integer `80 | 250 | 500`, default `80`.
- Query `timestamp`: integer or null, minimum 0 (Unix timestamp/history mode).
- Query `refresh`: boolean, default `false`.
- Query `use_magic_nodes`: boolean, default `true`.
- Query `use_time_nodes`: boolean, default `true`.
- Query `return_nodes`: boolean, default `false`.
- Query `return_relationships`: boolean, default `false`.
- Query `return_clusters`: boolean, default `true`.

Source: [map endpoint](https://docs.bubblemaps.io/data/api/tokens/map), [OpenAPI](https://docs.bubblemaps.io/openapi.json).

### Response (`MapDataV0`)

Required top-level fields are `metadata` and `metrics`; optional/nullable result sections are `nodes`, `relationships`, and `clusters`:

- `metadata`: `{ dt_update: string, ts_update: integer }`.
- `metrics`:
  - `supply_stats`: required numeric `cexs`, `dexs`, `contracts`, `fresh_wallets`, `top_10_adjusted`, `bundles`.
  - `scores`: required `bubblemaps_score: number`, `gini_index: number`, `herfindahl_hirschman_index: number`, `nakamoto_coefficient: integer`. The prose says `bubblemaps_score` can rarely be null even though OpenAPI 0.2.2 types it as `number`; clients should tolerate this documented inconsistency.
- `nodes` (object or null):
  - `top_holders` (required array) of `{ address, address_details, holder_data, is_shown_on_map }`.
  - `magic_nodes` (array or null) of `{ address, address_details, is_shown_on_map }`.
  - `time_nodes` (array or null) of `{ address, relationships }`.
  - `holder_data`: required numeric `amount`, integer `rank`, numeric `share`.
  - `address_details`: `label: string|null`, required `degree: integer`, required booleans `is_supernode`, `is_contract`, `is_cex`, `is_dex`; `is_paid_label: boolean` default false; `entity_id: string|null`; required integers `inward_relations`, `outward_relations`; `first_activity_date: date-time string|null`.
- `relationships` (array or null) of grouped transfers:
  - `from_address: string`, `to_address: string`, `rel_type: "GROUPED_TRANSFER"`, `data`.
  - `data`: required `total_value: number`, `total_transfers: integer`, `first_date: integer`, `last_date: integer`, `token_key`.
  - `token_key`: `{ chain: ChainIdV0, address: string }`.
- `clusters` (array or null), each with required `share: number`, `amount: number`, `holder_count: integer`, `holders: string[]`.

All documented share fields use `[0,1]`, e.g. 42% is `0.42`. Deprecated `decentralization_score` and `metadata.identified_supply` were scheduled for removal 2026-07-01; use `metrics` ([2026-05-22 changelog](https://docs.bubblemaps.io/data/api/changelog/2026-05-22)).

## Exact holder and subgraph contracts

### Top holders

`GET /v0/tokens/holders/{chain}/{token_address}` request fields: the same `chain`/`token_address` paths, `limit` enum 80/250/500 default 80, `timestamp: integer|null` minimum 0, `refresh: boolean` default false, and `return_metadata: boolean` default false.

Response is an array of `TokenHolderV0`: required `address: string` and `holder_data { amount:number, rank:integer, share:number }`; `address_details` is an object or null and uses the exact fields listed above. No holders gives `404`; rare unsupported tokens may give `400` ([top-holder docs](https://docs.bubblemaps.io/data/api/tokens/top-holders)).

### Address subgraph

`POST /v0/relationships/subgraph` JSON request:

```json
{
  "addresses": ["addressA", "addressB"],
  "context_token_key": { "chain": "solana", "address": "<case-sensitive mint>" }
}
```

- `addresses` is required, 2–1000 strings.
- `context_token_key` is optional/null; when set, required child fields are `chain` and `address`.
- Response is an array of the same `GroupedTransferV0` objects defined above.
- By default only indexed-token transfers are included; `context_token_key` forces inclusion of a specified token.
- Cost is `10 + 1 × requested address` credits.

Source: [subgraph docs](https://docs.bubblemaps.io/data/api/relationships/subgraph), [OpenAPI](https://docs.bubblemaps.io/openapi.json).

## Methodology and interpretation

First-party explanations establish the following:

1. A bubble represents a current top holder; bubble size reflects holdings. Links mean an on-chain transfer occurred between holders. Clusters are connected holders, not proof of common ownership or wrongdoing ([How does it work?](https://wiki.bubblemaps.io/bubblemaps-v2/how-does-it-work)).
2. The API base map analyzes the top 80 by default; the UI wiki describes maps up to 250. CEXs, DEXs, contracts, and hypernodes are hidden by default and excluded from relationship/score/cluster computation. Relationships between two supernodes are ignored; a supernode-to-non-supernode relationship remains ([map docs](https://docs.bubblemaps.io/data/api/tokens/map)).
3. Transfer rows are aggregated by `(from_address, to_address, token_key)`, with total value/count and first/last timestamps; they are not individual transactions ([subgraph docs](https://docs.bubblemaps.io/data/api/relationships/subgraph)).
4. Bubblemaps considers only transfers of its maintained set of “indexed” tokens when computing maps to reduce false-positive clusters. The map’s own context token is always included even if unindexed ([token model](https://docs.bubblemaps.io/data/api/token-model)).
5. **Magic Nodes** add non-holder intermediary addresses to reveal indirect links, such as holders funded by one outside address or sending to one deposit address ([Magic Nodes](https://wiki.bubblemaps.io/bubblemaps-v2/magic-nodes)).
6. **Time Nodes** split CEX/DEX/whitelisted-contract interactions into time-window abstractions so wallets are linked only when they interact with the same venue in that window; they model coordinated timing rather than a direct wallet-to-wallet transfer ([Time Nodes](https://wiki.bubblemaps.io/bubblemaps-v2/time-nodes), [map docs](https://docs.bubblemaps.io/data/api/tokens/map)).
7. Metrics: `fresh_wallets` means less than 10 days old; `top_10_adjusted` is the top ten clustered entities excluding CEX/DEX/etc.; `bundles` is the top ten clusters excluding those entities. Gini and HHI use clustered entities normalized to exclude CEX/DEX holdings. Nakamoto coefficient is the minimum independent entities reaching 50% of supply. Bubblemaps score is 0 (less decentralized) to 100 (more decentralized) ([metrics docs](https://docs.bubblemaps.io/data/api/tokens/metrics)).

These are heuristics and graph abstractions. A cluster or Time Node should be treated as an investigative lead, not an identity attribution.

## Credits, availability, and operational limits

- Key acquisition: create/manage a key on [Bubblemaps Pro](https://pro.bubblemaps.io); send it in `X-ApiKey` ([authentication](https://docs.bubblemaps.io/data/api/authentication)).
- Credits reset on the subscription monthly renewal date. Exhaustion yields `429`. All keys on one account share quotas/rate limits under the API Terms.
- IP-level rate limit: 10,000 calls/minute.
- Map credit additions: base 25; `limit=250` +50; `limit=500` +100; `return_nodes=true` +25; `refresh=true` +25; `timestamp` +50. The docs list no surcharge for `return_relationships`, `return_clusters`, magic nodes, or time nodes.
- Holder additions: base 1; `limit=250` +10; `limit=500` +25; `return_metadata=true` +25; `refresh=true` +25; `timestamp` +50.
- Map cache TTL varies with token age; `X-Dt-Update` reports freshness and `refresh=true` bypasses cache. Query time ranges from milliseconds for cache hits to up to about one minute for outliers; most should be under 15 seconds.
- Full map and holder endpoints support all tokens by default, including NFTs; no holders returns 404 and rare unsupported tokens may return 400.
- The public first-party plan API returned only: Starter, 100,000 monthly credits, price `170`; Standard, 750,000 monthly credits, price `850` ([live plan catalog](https://shop-api-prod-456302412759.europe-west1.run.app/api-subscriptions/plans)). The payload does not state currency/billing-period semantics, so do not infer them solely from that response; the Pro UI labels plans per month.
- API Terms (revised 2026-05-27) define Free Tier and Free Trial, both discretionary/limited, but also require an account and keys. The current catalog did not list a free plan. Therefore: **no verified generally available free tier, and definitely no documented keyless tier, as of 2026-08-26.**

## Legal / terms findings

The [API Terms](https://bubblemaps.notion.site/API-Terms-Conditions-33b74566812c80ffadacdf8f8ec169a6) were revised 2026-05-27 and supplement the [General Terms](https://bubblemaps.notion.site/Bubblemaps-Terms-Conditions-6b2610c5432b48fc932cfa859ab33ecf). The General Terms identify the operator as **Bmaps Solutions OÜ**, Estonia registration 17115233.

Material API clauses:

- License is limited, non-exclusive, non-assignable/non-transferable, and revocable for developing/testing/integrating third-party software.
- No sublicensing/reselling API access; no competitive product/service; no unauthorized reproduction, redistribution, or commercial exploitation of API Content.
- Keep keys confidential; the account owner is responsible for key activity. Bubblemaps may suspend/revoke/rotate keys for misuse, security breach, or terms violations.
- Do not exceed rate limits, bypass authentication/security/rate limiting, reverse engineer, scrape/data-mine in an interfering manner, or use spiders/robots/crawlers/scrapers against the API Services.
- Do not profile personal data without a legal basis. Do not use API Content as the basis for investment decisions/financial advice or represent it that way.
- Bubblemaps retains ownership/IP/database rights in API Services and API Content. Permission beyond the terms can be requested at `api@bubblemaps.io`.
- The non-compete text specifically names token-holder visualization, wallet clustering, and on-chain distribution analytics and purports to continue after subscription cancellation/termination. Obtain legal review before embedding these capabilities in a commercial product.
- Paid payments already made are final/non-refundable on ordinary cancellation; access continues through the billing cycle. Pricing may change with notice for active subscriptions.
- API Content is informational only and not investment advice; services/content are provided “as is”/“as available” with broad warranty and liability disclaimers. The terms require deletion of API Content on termination and select Estonian law/courts.

The [Privacy Policy](https://bubblemaps.notion.site/Bubblemaps-Privacy-Policy-676d478607c449a0a57fed194e45c1f4) was also revised 2026-05-27. It says blockchain data can constitute personal data and may be immutable/outside Bubblemaps’ control; GDPR/Estonian-law protections apply, EEA transfers use adequacy decisions or standard contractual clauses, and users have access/rectification/erasure/restriction/portability/objection rights. This matters if wallet relationships are used to profile natural persons.

This is a source audit, not legal advice.

## Official repositories

The current [official `bubblemaps` GitHub organization](https://github.com/bubblemaps) exposed only two public repositories on 2026-08-26:

1. [`bubblemaps/api-docs`](https://github.com/bubblemaps/api-docs) — active, unarchived, main branch; pushed 2026-07-15. It contains the published OpenAPI and Mintlify documentation. This is the only official repository relevant to Data API integration. Use its [`openapi.json`](https://github.com/bubblemaps/api-docs/blob/main/openapi.json) as the machine-readable contract.
2. [`bubblemaps/oft-solana`](https://github.com/bubblemaps/oft-solana) — active/unarchived but unrelated to holder maps; it is Solana OFT/LayerZero token infrastructure, not a map or relationship API client/server.

No official open-source map engine, Solana holder clustering implementation, or supported SDK was found in the owner organization. Repositories under similarly named accounts or third-party owners are not authoritative and were excluded.

## Integration recommendation

Use only the documented API with an assigned key. For a Solana token map, request:

```http
GET /v0/tokens/map/solana/{mint}?return_nodes=true&return_relationships=true&return_clusters=true
X-ApiKey: …
```

Budget 50 credits for that default-80 request (25 base + 25 nodes), subject to plan availability. If only direct relationships among known addresses are needed, use `POST /v0/relationships/subgraph`; if only holders are needed, use the much cheaper holder endpoint. Store `dt_update`/`ts_update` and observed `X-Dt-Update`, handle 400/401/404/422/429, tolerate new chain enum values and future relationship types, and avoid treating clusters as identity proof.

Do **not** scrape `v2.bubblemaps.io`, `app.bubblemaps.io`, or iframe/app internals, and do not rely on undocumented legacy endpoints.
