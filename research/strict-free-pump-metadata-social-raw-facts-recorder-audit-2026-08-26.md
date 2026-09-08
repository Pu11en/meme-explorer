# Strict-free local Pump metadata/social raw-facts recorder audit

**Observed cutoff:** `2026-08-26T12:01:06Z` UTC. Primary/owner sources and bounded anonymous probes only. “Free” below means no provider charge for the stated read path; the operator still pays for hardware, bandwidth, and storage. Probe results are point observations, not an SLA.

## Decision

**Accept the candidate only as a layered, replaceable local recorder:** Pump/PumpAPI launch capture → direct metadata-URI snapshot → direct Solana account read. Do not call all three outputs “new metadata.” Keep raw bytes and source-specific namespaces.

- **Launch baseline:** Pump `CreateEvent` already supplies `name`, `symbol`, `uri`, `mint`, bonding curve, user, creator, timestamp, reserves/supply, token program, mayhem/cashback state and quote mint. PumpAPI's free live stream also currently emits launch/trade facts including `name`, `symbol`, `uri`, mint, signer, token program/extensions and mint/freeze authorities. These are launch duplicates, not URI-fetch discoveries.
- **Direct URI value:** exact response bytes/hash and retrieval evidence; `description`, `image`, `showName`, `createdOn`, optional `twitter`, `telegram`, `website`, `video`, and arbitrary unknown keys. Pump's coins-v2 HTTP response can already include description/image/show-name/video, so only source-specific raw values, socials/unknown keys, and differences are safely “additional.” Never claim socials are universally absent from Pump HTTP merely because examples omit them.
- **On-chain value:** account owner and mint binding at a named slot/commitment; update authority; legacy Metaplex creators with `verified/share`, royalty basis points, mutability, sale/standard/collection/use/config fields; or Token-2022 metadata pointer, update authority, embedded mint, and arbitrary `additional_metadata`. `name`/`symbol`/`uri` remain reconciliation fields, not new launch facts.
- **Strict-free exclusion:** PumpAPI **Get Token Info is not eligible**. Its owner page charges **10,000 lamports** and requires either a `privateKey` described as the “Fee wallet” or an API key. Use free PumpAPI stream/first-party Pump events plus anonymous Solana RPC reads instead.

## 1. Duplicate boundary

Pump's official [`pump.json` IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json) defines `CreateEvent`; the current [`create_v2` contract](https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/COIN_CREATION.md) takes `name`, `symbol`, `uri`, `creator`, mayhem/cashback state and creates a Token-2022 mint whose metadata pointer is the mint. Therefore, do not report those fields as direct-fetch enrichment.

PumpAPI's owner [Data Stream](https://pumpapi.io/stream) is currently documented as free/no-key and sends all event classes over one WebSocket per client, with reconnect required. An anonymous create observed in this audit contained `signature`, block/time, mint/pool/signer, `name`, `symbol`, `uri`, token program/extensions, mint/freeze authorities and creator-fee address. Provider output is useful raw evidence but is not canonical chain proof or a stable schema promise.

Pump's owner-authored [metadata shape](https://github.com/pump-fun/pump-fun-skills/blob/main/create-coin/references/METADATA.md) is `name`, `symbol`, `description`, `image`, `showName`, `createdOn`, plus optional `twitter`, `telegram`, `website`, and `video`. Preserve absent vs explicit `null` vs empty string vs value for every key. Social URLs are creator assertions, not identity/control proof.

Pump's documented coins-v2 client/source is a separate baseline: [`coin-api.mjs`](https://github.com/pump-fun/pump-fun-skills/blob/main/create-coin/scripts/lib/coin-api.mjs) separates non-2xx, empty body and invalid JSON; the owner skill documents `coins-v2/{mint}` fields and warns not to trust its `token_program` over the mint account owner ([coin-fees skill](https://github.com/pump-fun/pump-fun-skills/blob/main/coin-fees/SKILL.md#get-coin-data-http)). Treat coins-v2 as a documented first-party API, not scraped Pump HTML.

## 2. Distinct on-chain evidence

For classic SPL tokens, derive the PDA using `metadata`, Token Metadata program ID and mint. Metaplex's [`Metadata` state](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/programs/token-metadata/program/src/state/metadata.rs) contains update authority, embedded mint, data, `primary_sale_happened`, `is_mutable`, edition nonce, token standard, collection, uses, collection details and programmable config. [`Data`](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/programs/token-metadata/program/src/state/data.rs) adds seller-fee basis points and optional creators; [`Creator`](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/programs/token-metadata/program/src/state/creator.rs) is address/verified/share. A verified creator is an on-chain flag, not human identity proof, and Pump's economic creator must remain a separate field.

For Token-2022, decode the mint extensions. The official SPL [`TokenMetadata`](https://github.com/solana-program/token-metadata/blob/main/interface/src/state.rs) contains update authority, embedded mint, name, symbol, URI and arbitrary key/value `additional_metadata`. Validate pointer target and embedded mint; do not treat PumpAPI's `{metadataPointer:{}, tokenMetadata:{}}` placeholders as decoded state.

Store RPC URL, method, request ID, context slot, commitment, account owner, lamports, executable/rent epoch when returned, full data bytes/hash, decoder version, and every decoded field. Solana [`getAccountInfo`](https://solana.com/docs/rpc/http/getaccountinfo) returns an account object or `null`; only that `null` is `onchain_account_missing`. Transport/RPC/decode/wrong-owner/mint-mismatch failures are not missing. A later read is not launch-time proof when metadata is mutable.

## 3. Exact retrieval/failure semantics

Use attempt states, never one nullable metadata object:

`not_attempted | invalid_uri | unsupported_scheme | blocked_ssrf | transport_error | timeout | aborted | http_response | too_large | invalid_utf8 | invalid_json | wrong_json_type | parsed`

For `http_response`, retain exact status, selected headers, redirect chain, bounded raw body/hash and endpoint. HTTP 404 is a completed response—not a fetch exception—and [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) does not make one origin/gateway's 404 proof of global absence. Parsed fields additionally need `absent | null | empty | value`.

### IPFS

The normative [Path Gateway response codes](https://specs.ipfs.tech/http-gateways/path-gateway/#response-status-codes) distinguish:

- `400`: malformed/unsupported request;
- `404`: missing/invalid DAG traversal **or content not retrievable from this gateway**;
- `410`: gateway refusal such as denylisting, not global nonexistence;
- `412`: cache-only/precondition path cannot satisfy the fetch;
- `429`: rate limit; honor `Retry-After`;
- `502`: known retrieval failure such as no providers;
- `504`: gateway retrieval timeout.

A streaming response can terminate after a missing child, so verify completeness. `gateway_404 != globally_missing`. Public gateways are explicitly best-effort, no SLA/support, with shared throttling ([IPFS owner guidance](https://docs.ipfs.tech/how-to/replace-public-gateways-with-self-hosted-ipfs/)). CID verification proves returned blocks/bytes, not current pinning or future availability.

### Arweave

Official [`arweave-js` transaction handling](https://github.com/ArweaveTeam/arweave-js/blob/master/src/common/transactions.ts) maps transaction GET `404 → TX_NOT_FOUND`, `410 → TX_FAILED`, and other non-200 → `TX_INVALID`; status calls return the exact non-200 status with `confirmed:null`; data retrieval tries chunks then gateway and can throw “data was not found.” These are client/endpoint semantics, not proof that every independent gateway or the network agrees. Preserve transaction/data-item ID, gateway, redirect chain, status/body and verification result separately. Retrieval is provider-fee-free; uploading is a different, paid/funded operation.

### Ordinary HTTP(S)

Treat every URL and redirect as attacker input. A timeout/DNS/TLS/socket error has no HTTP status. Keep `404` (not found at this origin now), `410` (origin asserts intentionally unavailable), `403/451` (blocked/refused), `429` (rate-limited), and `5xx` as distinct observations. Mutable HTTP bytes require a new immutable observation on every fetch; never overwrite an older hash.

## 4. Tool, locality, wallet and license audit

| Tool | Strict-free read verdict | Locality/network caveat | Ownership/license evidence |
|---|---|---|---|
| `@helia/verified-fetch` | **Yes for software; no trial/key/CU/wallet mechanism.** | Executes locally but default retrieval still uses peers, delegated routing and public/trustless gateways; not offline and not guaranteed free/unlimited. Self-hosting has operator costs. | `ipfs/helia-verified-fetch`; package is public and declares `Apache-2.0 OR MIT` in its [package.json](https://github.com/ipfs/helia-verified-fetch/blob/main/packages/verified-fetch/package.json); owner [README](https://github.com/ipfs/helia-verified-fetch/tree/main/packages/verified-fetch) documents verification and fetch-like status/throw behavior. |
| `@solana/kit` | **Yes as a local SDK.** Anonymous `getAccountInfo` needs no signer or funded wallet. | It supplies an RPC client, not free RPC capacity. Solana public endpoints are rate-limited and limits may change; 403/429 are documented ([clusters](https://solana.com/docs/references/clusters)). Transactions, unlike reads, need SOL. | `anza-xyz/kit`; package author `Solana Labs Maintainers`, MIT in [package.json](https://github.com/anza-xyz/kit/blob/main/packages/kit/package.json); root [MIT license](https://github.com/anza-xyz/kit/blob/main/LICENSE) is copyright 2023 Solana Labs, Inc. |
| `@metaplex-foundation/mpl-token-metadata` JS/TS | **Yes as local client/decoder software;** read helpers still require Umi RPC and no funded signer for reads. | Not directly plug-compatible with `@solana/kit`; use Umi or adapt raw bytes/types. | **Important scope distinction:** the JS package declares `Apache-2.0`, author `Metaplex Maintainers`, and public npm in [`clients/js/package.json`](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/clients/js/package.json); the owner [README license section](https://github.com/metaplex-foundation/mpl-token-metadata#license) says JS/TS clients are MIT or Apache. The Rust/Cargo programs and repository-root program code use the custom [Metaplex NFT Open Source License](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/LICENSE), including a competitive-product restriction. **Do not apply the Rust custom license to the declared JS package, and do not apply JS Apache-2.0 to Rust/program code.** |

Adversarial license note: the published JS package metadata points its `repository` to `mpl-candy-guard.git`, apparently inconsistent provenance metadata, and its npm tarball contains no license file while declaring `Apache-2.0`. The README and package declaration support Apache licensing of the JS client, but a compliance-sensitive adopter should pin the package/version, retain the declaration and obtain legal review rather than infer that the entire monorepo is Apache.

**PumpAPI Get Token Info rejection:** [owner docs](https://pumpapi.io/get-token-info) state a fixed 10,000-lamport charge; request body requires `privateKey` (“Fee wallet”) or API key. It fails strict-free/no-funded-wallet even though the PumpAPI live stream and replay are listed free on [fees](https://pumpapi.io/fees).

No reviewed read path requires undocumented Pump-page scraping. Do not add social-platform scraping: record literal social strings; optional anonymous HTTP probes are availability observations only.

## 5. Repeated anonymous probes

At `2026-08-26T11:59:41Z–11:59:42Z` from this runtime, without credentials or wallet:

1. PumpAPI WebSocket delivered a Token-2022 create after 10.066 s (6,914 mixed events observed): mint `BznPLKUpLRELsXPnLrw6h4bNSvwFnVWCSG9d49Yppump`, metadata URI `https://ipfs.io/ipfs/bafkreifokqmfklezstqjzabxbh4c7rvd3ceuazsbp5mrmkcv2bbobsbnga`.
2. Three direct URI GETs returned 200 JSON in 79–89 ms, 304 bytes, identical SHA-256 `ae5418552c9994e09c803709f82fc6a3d8894066417f59162855d042e0c82d30`. The body added `description`, `image`, `showName`, `createdOn`, and unknown `coin_community`; it contained no socials. One token does not establish field prevalence.
3. Three anonymous official Solana `getAccountInfo` calls returned HTTP 200/non-null at slot `441862174`, owner `TokenzQd...`, with identical 548-character base64 payloads. This proves momentary no-wallet reads, not unlimited production capacity.
4. Three `arweave.net/info` reads returned 200. A syntactically valid fake 43-character ID redirected then returned 404. This is gateway-local missing evidence only.
5. A supposed IPFS “missing” probe (`bafkqaaa`) returned 200 with a zero-byte body three times—demonstrating that guessed identifiers are invalid absence controls and that status alone is insufficient.

A separate anonymous owner-source probe at `2026-08-26T12:01:06Z` observed Pump `coins-v2/{mint}` return 200 without auth for a valid mint and structured 404 for invalid/missing identifiers; public Solana RPC returned a non-null Token-2022 account; a fake Arweave ID/status returned 404; and two public IPFS gateways returned 403 for one Pump CID. These outcomes are deliberately not generalized into uptime, completeness or permanent absence claims.

## Unsupported claims to reject

- “Everything is fully local/offline.” Retrieval and RPC are network operations unless the operator runs and syncs infrastructure.
- “Free SDK means free unlimited production service.” SDK licenses do not grant RPC/gateway capacity or an SLA.
- “PumpAPI Get Token Info is strict-free.” It charges 10,000 lamports and needs a fee wallet/API key.
- “Direct JSON name/symbol/URI are enrichment.” They duplicate launch/on-chain fields; differences are reconciliation evidence.
- “404 means globally absent from IPFS/Arweave.” It proves only that endpoint's response at that time.
- “CID/Arweave ID guarantees availability.” Integrity/object identity and availability are separate.
- “Verified creator/social URL proves a person or account owner.” Neither flag nor URL establishes off-chain identity/control.
- “Metaplex is simply Apache-2.0” or “all Metaplex code is custom-licensed.” License scope differs: declared Apache/MIT JS clients versus custom-licensed Rust/Cargo program code.
- “Current mutable account state existed at launch.” A current slot read is not historical reconstruction.
