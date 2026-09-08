# RugCheck vs. Bubblemaps: Solana holder concentration and wallet relationships

**Snapshot:** 2026-08-26 UTC  
**Evidence rule:** RugCheck claims use only RugCheck's owner-operated Swagger/API and official GitHub organization. Bubblemaps comparison claims use only Bubblemaps' official docs/OpenAPI. No third-party wrappers, articles, or reverse-engineered clients are used.

## Bottom line

**RugCheck already exposes both holder concentration and wallet-relationship data for Solana, but with an important contract gap.** Its Swagger formally documents the routes, yet the holder and insider routes' useful response fields are largely **not schema-documented**:

- `GET /v1/tokens/{id}/report` is documented, but its HTTP 200 response is only described as `OK`, with no schema. A current official-API response contains `totalHolders`, 20 `topHolders` rows, `graphInsidersDetected`, and `insiderNetworks`.
- `GET /v1/tokens/{id}/insiders/graph` and `GET /v1/tokens/{id}/insiders/networks` are documented methods, but Swagger gives neither a 200 response nor a response schema. Current official responses expose wallet nodes, bare links, holdings, and network summaries.
- `GET /v1/tokens/{id}/report/summary` has a documented response schema, but it contains no holder-concentration or wallet-relationship fields.

**Bubblemaps is not merely a visualization layer.** Its current Data API has a documented raw top-holder endpoint with 80/250/500-holder modes, historical timestamp mode, and exact `address` + `amount` + `rank` + `share` fields. That is materially more documented holder coverage and temporal access than RugCheck's undocumented 20-row snapshot. Bubblemaps also documents grouped transfer evidence (`total_value`, transfer count, first/last dates, token key), which is more auditable than RugCheck's bare `source`/`target` links.

However, **Bubblemaps' main analytical differentiation is clustering, exclusions/classification, and visualization—not a new kind of canonical ownership fact.** Its `top_10_adjusted`, `bundles`, Gini, HHI, Nakamoto coefficient, clusters, “magic nodes,” “time nodes,” and score are derived after entity clustering and/or CEX/DEX exclusions. They should not be presented as proof that wallets share beneficial ownership. The defensible framing is:

> Bubblemaps adds a better-documented and broader holder snapshot plus transfer aggregates and history; its headline “connected supply” and decentralization metrics are chiefly cluster-derived interpretations of those facts.

## 1. What RugCheck formally documents

Primary contract: [RugCheck Swagger JSON](https://api.rugcheck.xyz/swagger/doc.json) and [Swagger UI](https://api.rugcheck.xyz/swagger/index.html).

### Methods relevant to holders and wallet relationships

| Method | What Swagger says | Documented 200 schema? |
|---|---|---:|
| `GET /v1/tokens/{id}/report` | “Generate a detailed report for given token mint”; optional `refresh:boolean`, described as “Force report regeneration (paid API keys only).” | **No.** HTTP 200 is only `description: "OK"`. |
| `GET /v1/tokens/{id}/report/summary` | “Generate a report summary for given token mint”; optional `cacheOnly:string` and paid-key-only `refresh:boolean`. | **Yes:** `dto.TokenCheckSummary`. |
| `GET /v1/tokens/{id}/insiders/graph` | “Generate an insider graph for given token mint.” Required path `id:string` is the token mint. | **No.** Swagger defines only a 400 error response. |
| `GET /v1/tokens/{id}/insiders/networks` | “Generate an insider networks for given token mint.” Required path `id:string` is the token mint. | **No.** Swagger defines only a 400 error response. |

None of these GET operations has operation-level `ApiKeyAuth` in Swagger. This contrasts with protected operations such as locker reads, bulk reports, votes, and report writes. That describes the contract's authentication marking, not an availability or continued-free-access guarantee.

### The one schema-documented report response

`dto.TokenCheckSummary` contains exactly:

- `error: string`
- `lpLockedPct: number`
- `mint: string` — described as used only in bulk responses
- `risks: Risk[]`
- `score: integer`
- `score_normalised: integer`
- `tokenProgram: string`
- `tokenType: string`

Each `rugcheck_api.Risk` contains `description:string`, `level:string`, `name:string`, `score:integer`, and `value:string`.

**Consequence:** RugCheck's schema-documented summary supplies no holder list, top-N concentration, owner aggregation, cluster percentage, or relationship edge. Holder/relationship capabilities come from the full report and insider endpoints, whose successful response schemas are absent from Swagger.

## 2. What the official RugCheck API currently returns (observed, not a schema contract)

A safe read on 2026-08-26 of the documented endpoint for mint `FZqdw6oSDCbHtKYxmhnfbi97SnyVy8jaYpdCoMrrjKa2` returned HTTP 200. Primary response URLs:

- [Full report](https://api.rugcheck.xyz/v1/tokens/FZqdw6oSDCbHtKYxmhnfbi97SnyVy8jaYpdCoMrrjKa2/report)
- [Insider graph](https://api.rugcheck.xyz/v1/tokens/FZqdw6oSDCbHtKYxmhnfbi97SnyVy8jaYpdCoMrrjKa2/insiders/graph)
- [Insider networks](https://api.rugcheck.xyz/v1/tokens/FZqdw6oSDCbHtKYxmhnfbi97SnyVy8jaYpdCoMrrjKa2/insiders/networks)

These shapes are current owner-operated API observations, **not fields guaranteed by Swagger**.

### Holder/concentration fields in the full report

The response includes:

- `token.supply` and `token.decimals`
- `totalHolders`
- `topHolders` — 20 rows in this observation
- `creator`, `creatorBalance`
- `knownAccounts`
- `graphInsidersDetected`
- `insiderNetworks`

Each observed `topHolders[]` row has exactly:

```text
address, amount, decimals, pct, uiAmount, uiAmountString, owner, insider
```

Interpretation boundary:

- `address` is the token-account address in the observed Solana response, while `owner` is the account owner/wallet field. RugCheck therefore exposes both token account and owner identity in each row.
- `pct` is a per-row concentration value; `amount` and the UI amount fields expose balances.
- `insider` is a RugCheck classification. Swagger publishes no calculation or validation method for that flag.
- The sample's 20 rows permit top-N arithmetic, but Swagger does not guarantee 20 rows, ordering, exclusions, owner deduplication, freshness, or how special accounts are treated.
- `totalHolders` is a current observed aggregate, not a Swagger-defined field.

### Wallet-relationship fields

The current `insiders/graph` response is an array whose rows contain:

```text
net_id, network_type, nodes, links, relatedMint
```

Observed nested shapes:

```text
nodes[]: id, participant, holdings
links[]: source, target
```

The sample's `network_type` is `transfer`. The separate `insiders/networks` response exposes summary rows:

```text
id, size, activityType, totalAmount, numActiveAccounts
```

The full report's embedded `insiderNetworks[]` uses a similar but different observed shape:

```text
id, size, type, tokenAmount, activeAccounts
```

**Evidence limitation:** RugCheck's graph links contain only `source` and `target`. They do not include transaction signature, slot, timestamp, direction/amount per edge, transfer count, or published relationship methodology. The network summary contains an aggregate amount and account counts, but does not make each edge independently auditable. A link is therefore a provider-derived relationship lead, not proof of common control or beneficial ownership.

### Repository boundary

The [official GitHub organization record](https://api.github.com/orgs/rugcheck-xyz) and its [public-repository listing](https://api.github.com/orgs/rugcheck-xyz/repos?per_page=100&type=public) returned only a `.github` profile-repository entry during this check. No public API implementation or versioned model repository was available there to fill the Swagger schema or methodology gaps. Unofficial “RugCheck” wrappers/repositories are intentionally excluded.

## 3. What Bubblemaps adds, from its official Data API

Primary sources: [Bubblemaps product docs](https://docs.bubblemaps.io/introduction), [OpenAPI](https://docs.bubblemaps.io/openapi.json), [holder endpoint](https://docs.bubblemaps.io/data/api/tokens/top-holders), [map endpoint](https://docs.bubblemaps.io/data/api/tokens/map), [metrics endpoint](https://docs.bubblemaps.io/data/api/tokens/metrics), and [subgraph endpoint](https://docs.bubblemaps.io/data/api/relationships/subgraph).

Bubblemaps explicitly describes its Data API as exposing “holders, transfers, clusters” through REST. Its OpenAPI includes `solana` as a supported `chain` enum value.

### Factual/indexed holder data beyond RugCheck

`GET /v0/tokens/holders/{chain}/{token_address}` documents:

- base top **80** holders; `limit` enum supports **80, 250, or 500**;
- optional `timestamp` for a historical holder snapshot;
- optional `refresh` to bypass cache;
- optional `return_metadata`;
- an `X-Dt-Update` response header for update time, described by the prose docs;
- share values in `[0,1]` form.

Each `TokenHolderV0` has:

```text
address
holder_data: amount, rank, share
address_details (optional): label, degree, is_supernode, is_contract,
  is_cex, is_dex, is_paid_label, entity_id, inward_relations,
  outward_relations, first_activity_date
```

This is a **real factual-data addition relative to RugCheck's public contract**:

1. holder fields have an explicit OpenAPI schema;
2. coverage is configurable to 500 rather than the 20 rows observed from RugCheck;
3. historical timestamp mode is documented;
4. update metadata and refresh behavior are documented;
5. amount/rank/share are cleanly separated from labels and relationship-derived metadata.

Caveat: these are indexed provider snapshots, not canonical beneficial-owner records. Labels, entity IDs, and address classifications may be provider/community assertions.

### Factual transfer aggregates beyond RugCheck's bare links

`POST /v0/relationships/subgraph` takes `addresses[]` (2–1000) and optional `context_token_key {chain,address}`. It documents grouped transfer relationships:

```text
from_address, to_address, rel_type="GROUPED_TRANSFER"
data: total_value, total_transfers, first_date, last_date,
      token_key {chain,address}
```

The map endpoint returns the same `GroupedTransferV0` structure when relationships are requested. Bubblemaps says transfers are grouped by `(from_address, to_address, token_ref)` and that relationships between two high-volume “supernodes” are ignored.

Compared with RugCheck's observed `{source,target}` links, Bubblemaps supplies materially more factual relationship context: aggregate value, count, date range, and token identity. It still does not expose transaction signatures in this schema, so independently replaying every transfer requires another chain-data source.

### What is mainly clustering/inference

`GET /v0/tokens/map/{chain}/{token_address}` combines nodes, relationships, clusters, and metrics. A documented cluster has:

```text
share, amount, holder_count, holders[]
```

But cluster membership is not a raw holder fact. Bubblemaps documents that:

- “magic nodes” and “time nodes” are enabled by default and used in relationships, scores, and clusters;
- time nodes are temporal groupings through CEX/DEX/whitelisted contracts;
- CEXs, DEXs, contracts, and hypernodes can be hidden and are then excluded from relationships, score, and cluster computation;
- relationships between two supernodes are ignored.

`GET /v0/tokens/metrics/{chain}/{token_address}` documents `supply_stats`:

```text
cexs, dexs, contracts, fresh_wallets, top_10_adjusted, bundles
```

and `scores`:

```text
bubblemaps_score, gini_index, herfindahl_hirschman_index,
nakamoto_coefficient
```

The docs define `fresh_wallets` as wallets under 10 days old, `top_10_adjusted` as top 10 **entities after clustering** with CEX/DEX-style exclusions, and `bundles` as top 10 clusters with exclusions. Gini and HHI use clustered entities normalized to exclude CEX/DEX holdings; the Nakamoto coefficient is the minimum number of “independent entities” needed to reach 50% of supply.

Therefore:

- `address`, `amount`, `rank`, `share`, and grouped transfer totals/counts/dates are the closest thing to factual indexed observations.
- `cluster.share`, adjusted top-10, bundles, “independent entities,” Gini/HHI over clustered entities, and the Bubblemaps score are **derived outputs contingent on Bubblemaps' clustering and classification rules**.
- A cluster can show economically important coordinated distribution, but it does not by itself establish one controller, one legal owner, or collusion.

## 4. Direct comparison

| Capability | RugCheck | Bubblemaps | Assessment |
|---|---|---|---|
| Raw/indexed holder rows | Observed `topHolders` with 20 rows and `address, amount, decimals, pct, uiAmount, uiAmountString, owner, insider`; no Swagger 200 schema | Documented top 80/250/500 with `address` and `holder_data.{amount,rank,share}` | **Bubblemaps adds factual coverage and a stronger contract.** |
| Holder total | Observed `totalHolders`; undocumented | No equivalent total-holder field established in the reviewed schemas | RugCheck has the observed aggregate; no claim that Bubblemaps adds it. |
| Historical holder state | Not documented | `timestamp` mode documented | **Bubblemaps addition.** |
| Snapshot timing/refresh | RugCheck full report has no documented snapshot time; `refresh` is paid-key-only | `X-Dt-Update`, token-age-dependent cache, and `timestamp`/`refresh` are documented | **Bubblemaps has clearer temporal controls.** |
| Raw wallet links | Observed graph nodes and bare `{source,target}` links; no 200 schema | Documented grouped transfers with value/count/date range/token key | **Bubblemaps adds factual relationship context.** |
| Relationship/network summary | Observed network size, amount, and active-account count | Cluster amount/share/holder count and transfer subgraphs | Both derive network views; Bubblemaps is more schema-explicit. |
| Cluster-adjusted concentration | RugCheck exposes `insider`/insider networks but no documented adjusted concentration metrics | `top_10_adjusted`, `bundles`, clustered Gini/HHI/Nakamoto, score | **Main Bubblemaps differentiation, but inference-dependent.** |
| Visual map | RugCheck API data only in reviewed sources | Dedicated map/iFrame product | **Bubblemaps' clearest product differentiation.** |

## 5. Decision statement

If “factual holder concentration” means **address-level balances/shares and transfer summaries**, Bubblemaps does add more than RugCheck: a documented 80–500 holder list, historical snapshots, update/refresh controls, and grouped transfer values/counts/date ranges. This is not merely visualization.

If it means **proof that multiple wallets belong to one actor**, neither reviewed source establishes that fact. RugCheck's insider graph and Bubblemaps' clusters are analytical outputs. Bubblemaps' major extra value is making concentration across inferred connected entities visible and quantifiable; those cluster-adjusted metrics should be labeled as inference, not factual beneficial ownership.

## Primary source URLs

### RugCheck

- https://api.rugcheck.xyz/swagger/doc.json
- https://api.rugcheck.xyz/swagger/index.html
- https://api.rugcheck.xyz/v1/tokens/FZqdw6oSDCbHtKYxmhnfbi97SnyVy8jaYpdCoMrrjKa2/report
- https://api.rugcheck.xyz/v1/tokens/FZqdw6oSDCbHtKYxmhnfbi97SnyVy8jaYpdCoMrrjKa2/insiders/graph
- https://api.rugcheck.xyz/v1/tokens/FZqdw6oSDCbHtKYxmhnfbi97SnyVy8jaYpdCoMrrjKa2/insiders/networks
- https://api.github.com/orgs/rugcheck-xyz
- https://api.github.com/orgs/rugcheck-xyz/repos?per_page=100&type=public

### Bubblemaps

- https://docs.bubblemaps.io/introduction
- https://docs.bubblemaps.io/openapi.json
- https://docs.bubblemaps.io/data/api/tokens/top-holders
- https://docs.bubblemaps.io/data/api/tokens/map
- https://docs.bubblemaps.io/data/api/tokens/metrics
- https://docs.bubblemaps.io/data/api/relationships/subgraph
