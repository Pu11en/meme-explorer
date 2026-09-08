# Strict-free Pump metadata/social recorder — adversarial verification

**Evidence cutoff:** 2026-08-26 UTC  
**Scope:** Synthesis of the three existing repository audits and their cited owner sources; no broad new research.

## Verdict

A local raw-facts recorder is a **strict-free candidate**, not a completeness or reliability guarantee, if it combines the free PumpAPI live/replay feed with direct chain/RPC reads and sandboxed retrieval of the published metadata URI. PumpAPI remains replaceable and untrusted: its owner terms provide no SLA, completeness, retention, finality, or stable-schema promise, and an observed replay hour was absent. Preserve every input and every failed attempt rather than collapsing them into a “token metadata” row ([PumpAPI stream](https://pumpapi.io/stream), [replay](https://pumpapi.io/historical-replay), [terms](https://pumpapi.io/legal)).

**Price boundary correction:** PumpAPI **Get Token Info costs 10,000 lamports per request** and is therefore excluded from this strict-free design. “Data Stream — FREE” and free Historical Replay do not make every PumpAPI endpoint free ([PumpAPI fees](https://pumpapi.io/fees), [FAQ](https://pumpapi.io/FAQ)).

## What is duplicate versus genuinely additional

| Source/read | Duplicate launch facts already commonly present in the free PumpAPI create/stream payload | Distinct evidence beyond that free stream |
|---|---|---|
| PumpAPI replay | Substantially repeats provider launch/trade facts; it is backfill, not independent truth. Replay also has schema differences such as `localTimestamp` and observed `txType` versus live `action`. | Provider-receipt history useful for local gap repair, but not chain completeness or finality. |
| Direct Pump/chain read | `mint`, `name`, `symbol`, `uri`, token-program and some authority/extension fields may duplicate stream fields. | Raw account bytes and hash, RPC context slot/commitment, actual account owner, discriminator/layout validation, embedded-mint match, legacy Metaplex `is_mutable`/creators/update authority, or Token-2022 Metadata Pointer/TLV and arbitrary `additional_metadata`. These make the record independently replayable and detect provider disagreement ([Pump IDL/docs](https://github.com/pump-fun/pump-public-docs), [Metaplex state](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/programs/token-metadata/program/src/state/metadata.rs), [Token-2022 metadata](https://github.com/solana-program/token-metadata/blob/main/interface/src/state.rs)). |
| Metadata-URI fetch | JSON `name`, `symbol`, and sometimes image/URI-like values may duplicate launch data. Never merge conflicts. | Exact response bytes/hash plus issuer-supplied `description`, `image`, `video`, `website`, `twitter`/`x`, `telegram`, unknown keys, redirects, MIME and retrieval evidence. These are self-asserted raw facts—not proof of ownership, identity, safety, or legitimacy ([Pump metadata guidance](https://github.com/pump-fun/pump-fun-skills/blob/c8aaa6a8fb766b2765d2663744515bbf88d04380/create-coin/references/METADATA.md)). |

The recorder should retain provider URI, decoded on-chain URI, fetched JSON, and normalized/derived views as separate fields. A match is corroboration; a mismatch is evidence, not something to resolve by overwrite.

## Exact missing/failure semantics

Record one immutable observation per stage and never equate absence with retrieval failure:

- **Feed:** `event_observed`; `stream_disconnected`; `suspected_gap`; `replay_hour_missing`; `duplicate_event`. No event observed does not prove no launch occurred.
- **Chain:** `onchain_ok`; `onchain_missing_at_slot`; `rpc_rate_limited`; `rpc_timeout`; `rpc_failed`; `unsupported_metadata_variant`; `account_validation_failed`. Preserve endpoint, slot, commitment and raw bytes when available.
- **URI:** `uri_missing` means the validated on-chain/provider record contains no URI; `uri_invalid` means a string exists but cannot be safely parsed; `blocked_ssrf`/`unsafe_target` is a policy refusal—not content absence.
- **Fetch:** distinguish `fetch_timeout`, `rate_limited`, `gateway_failed`, `fetch_http_error(status)`, `too_large`, and `bad_mime`. A gateway 403/404/timeout does **not** prove IPFS/Arweave content absence; a just-created origin 404 may be `not_yet_available`.
- **Document:** `invalid_utf8`, `invalid_json`, `ambiguous_json` (for duplicate security-sensitive keys), or `ok`. Retain bounded raw bytes and parser error.
- **Social field:** `field_absent` only after a document parsed successfully and the key was absent; otherwise inherit document/fetch failure. If present, retain the exact value/path even when empty or malformed, with separate `value_invalid`/normalization fields.

Retries are new observations. Mutable HTTP returning a new hash is a new version; differing strongly verified bytes for one CID/Arweave ID is an integrity alarm. Public RPC and public gateways remain rate-limited/best-effort and supply no production SLA ([Solana public RPC](https://solana.com/docs/references/clusters), [IPFS gateway warning](https://docs.ipfs.tech/how-to/replace-public-gateways-with-self-hosted-ipfs/), [AR.IO retrieval](https://docs.ar.io/build/access/fetch-data)).

## Dependency/license correction

Do **not** apply the repository root’s custom license indiscriminately to the npm client. The Metaplex repository’s license notice separates implementations: **Rust/Cargo code uses the custom Metaplex NFT Open Source License, while JavaScript/TypeScript clients are Apache-2.0** ([repository/license notice](https://github.com/metaplex-foundation/mpl-token-metadata#license), [JS client](https://github.com/metaplex-foundation/mpl-token-metadata/tree/main/clients/js)). Thus `@metaplex-foundation/mpl-token-metadata` is not disqualified merely by the custom root license. Still, the planning-only repository needs no dependency now; verify the exact published package/version and its included license at adoption, pin it, and retain raw account bytes regardless.

## Acceptance boundary

Accept only with one locally fanned-out PumpAPI connection, reconnect and signature dedupe, gap detection/replay mirroring, tolerant live/replay adapters, direct-chain reconciliation, raw byte/event retention, and sandboxed bounded URI fetching. Reject claims of complete discovery, permanent metadata/media availability, verified social ownership, immutable ordinary HTTP content, or zero operational cost. “Strict-free” means no provider/API fee in the selected path—not free bandwidth, RPC capacity, storage, or compute.
