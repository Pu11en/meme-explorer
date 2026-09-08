# Pump token metadata fetching: owner-source findings

**Observed cutoff:** runtime clock `2026-08-26T11:36:42Z`. This records when the sources/probes were observed; it is **not** a claim of real-world freshness if that runtime date is ahead of the reader. Primary/owner sources and bounded no-key reads only.

## Decision

Build a two-stage, replayable pipeline:

1. read and retain canonical on-chain account bytes plus slot/commitment;
2. fetch the literal on-chain URI in a sandboxed worker, retain response bytes and a local SHA-256, then parse a bounded view.

Never replace issuer strings with normalized or redirected values. Keep `uri_raw`, raw JSON bytes, and parsed `website_raw` / `twitter_raw` / `telegram_raw` / `video_raw`; store any normalized URL, redirect target, validation result, and retrieval gateway in separate fields. These links are self-asserted metadata, not proof of ownership or identity.

## 1. What Pump puts on chain

Pin Pump's owner-published schema rather than mutable `main`. The observed `pump-fun/pump-public-docs` pin is [`9c82f61cb711b044a17f770ab8ce9f9bdf78f333`](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333), committed `2026-07-15T18:22:27Z`:

- The legacy `create(user, name, symbol, uri, creator)` creates classic SPL-token metadata through the Metaplex Token Metadata program; Pump says `creator` is inserted into the Metaplex creators array. See the pinned [Pump README](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md#L159-L169) and [`create` accounts/args in the IDL](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json).
- Current `create_v2` creates a Token-2022 mint, sets its Metadata Pointer to the mint, and accepts on-chain `name`, `symbol`, `uri`, and `creator`. Published maxima are **32 characters**, **13 characters**, and **200 characters** respectively. See Pump's pinned [coin-creation contract](https://github.com/pump-fun/pump-public-docs/blob/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/instructions/COIN_CREATION.md).
- Pump's owner-authored metadata guidance (observed pin [`c8aaa6a8fb766b2765d2663744515bbf88d04380`](https://github.com/pump-fun/pump-fun-skills/tree/c8aaa6a8fb766b2765d2663744515bbf88d04380), committed `2026-04-23T16:28:52Z`) documents JSON fields `name`, `symbol`, `description`, `image`, `showName`, `createdOn`, and optional `twitter`, `telegram`, `website`, `video`. It describes JSON as usually IPFS-hosted but permits HTTPS. See [METADATA.md](https://github.com/pump-fun/pump-fun-skills/blob/c8aaa6a8fb766b2765d2663744515bbf88d04380/create-coin/references/METADATA.md).

### Read algorithm

1. Fetch the mint with Solana `getAccountInfo` or batch with `getMultipleAccounts`, recording endpoint, context slot, commitment, owner, lamports, and raw bytes. Solana documents `dataSlice` and ordered batch results in [`getMultipleAccounts`](https://solana.com/docs/rpc/http/getmultipleaccounts); do not slice until the mint variant/extension layout is known.
2. Branch on the actual mint owner:
   - **Classic SPL Token:** derive Metaplex metadata PDA from `['metadata', Token Metadata program id, mint]`; require account owner `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`, discriminator/type, and embedded mint match. Metaplex's source defines the [PDA seeds and `Metadata` state](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/programs/token-metadata/program/src/state/metadata.rs), including `update_authority`, `data`, and `is_mutable`.
   - **Token-2022:** decode the Metadata Pointer, verify the pointed metadata belongs to this mint, then decode the Token Metadata TLV. Pump `create_v2` says the pointer is the mint, but generic Token-2022 assets need not use that location. The SPL interface's [`TokenMetadata` state](https://github.com/solana-program/token-metadata/blob/main/interface/src/state.rs) contains `update_authority`, `mint`, `name`, `symbol`, `uri`, and arbitrary key/value `additional_metadata`; Solana's owner docs show the [Metadata Pointer and Token Metadata extensions](https://solana.com/docs/tokens/extensions/metadata).
3. Retain raw account bytes. Decode trailing padding/NULs for a display view only; never make the cleaned value the sole retained evidence.

**Mutability caveat:** an IPFS/Arweave URI may identify immutable content, but the on-chain URI can still be changed whenever the relevant metadata state has a live update authority and permits updates. Conversely, an immutable on-chain record can point to mutable HTTP/IPNS/ArNS content. Read `is_mutable`/`update_authority` (legacy) or Token-2022 `update_authority`; do not infer immutability from the mint suffix, Pump UI, or URI scheme. Metaplex documents that updating requires the update authority and a mutable token in [Update Fungible Token Metadata](https://developers.metaplex.com/tokens/update-token).

## 2. Storage semantics and gateway availability

| URI/content form | Integrity and mutability | Retrieval rule |
|---|---|---|
| `ipfs://<CID>/path` or `/ipfs/<CID>/path` | CID-addressed roots are immutable; a changed file produces a different CID. `ipns://`, `/ipns/`, and DNSLink are mutable names. Sources: IPFS [content addressing](https://docs.ipfs.tech/concepts/content-addressing/), [immutability](https://docs.ipfs.tech/concepts/immutability/), and [IPNS](https://docs.ipfs.tech/concepts/ipns/). | Parse/validate the CID, preserve the path, and try independently operated gateways or a local node. Prefer subdomain gateways where browser-origin isolation matters; see [gateway best practices](https://docs.ipfs.tech/how-to/gateway-best-practices/). Public gateways are explicitly best-effort, with no SLA/support and shared throttling: [IPFS warning](https://docs.ipfs.tech/how-to/replace-public-gateways-with-self-hosted-ipfs/). |
| `ar://<tx-or-data-item-id>/path` or a raw Arweave gateway ID | A fixed transaction/data-item ID is stable; a manifest under a fixed ID maps paths to fixed IDs. ArNS is a mutable pointer and must not be labeled immutable. Sources: AR.IO [fetch data](https://docs.ar.io/build/access/fetch-data), [manifests](https://docs.ar.io/build/upload/manifests), and [ArNS](https://docs.ar.io/learn/arns). | Use multiple AR.IO/Arweave gateways and preserve the requested ID/path. For exact stored bytes, use the raw-data form documented by AR.IO rather than silently resolving a manifest path. Gateway success is availability evidence, not an SLA. |
| `https://...` | Mutable unless an independently trusted digest/version contract exists. A URL containing a hash-looking segment is not proof by itself. | Fetch as an untrusted snapshot. Store final bytes, SHA-256, redirect chain, headers, time, and source URL. Never overwrite the raw issuer URL with the final redirect target. |
| `http://...` | Mutable and transport-tamperable. | Prefer refusal. If historical coverage requires it, isolate the worker, mark `insecure_transport`, never send credentials/cookies, and do not promote the result to trusted display without additional controls. |

A local SHA-256 is an excellent snapshot identity but is not automatically protocol verification: an IPFS CID can cover a chunked DAG rather than equal `sha256(response_body)`, and Arweave transaction/data verification involves the protocol's signed transaction/data-root proofs. A trustless IPFS client can verify CAR/block data as specified by the [Trustless Gateway Specification](https://specs.ipfs.tech/http-gateways/trustless-gateway/); ordinary gateway HTTP bytes are only observed bytes unless independently verified.

**No-key probes at the cutoff:** `GET https://arweave.net/info` returned HTTP 200 (`application/json`, 291 bytes). A bounded 12-second `ipfs.io` request and 10-second `dweb.link`/`w3s.link` attempts for one CID timed out; `dweb.link` and `w3s.link` first redirected to the same subdomain host. This proves only those observations for that CID/time and also shows that multiple hostnames may share infrastructure; it does not prove CID absence, gateway-wide outage, or independent diversity.

## 3. Fetch security contract

Treat metadata URI, redirects, JSON links, and media URLs as attacker input.

- Allow only explicit schemes (`https`, mapped `ipfs`, mapped `ar`; optionally quarantined `http`). Reject credentials in URLs, noncanonical/ambiguous host syntax, fragments for server retrieval, and every other scheme (`file`, `data`, `ftp`, `gopher`, etc.).
- Resolve every hostname and reject all loopback, private, link-local, carrier-grade NAT, multicast, unspecified, documentation, and cloud-instance-metadata destinations for both IPv4 and IPv6. Validate **every** returned address, pin/connect to a validated address while preserving the HTTPS host/SNI, and repeat on every redirect to prevent DNS rebinding/TOCTOU.
- Disable automatic redirects; follow at most a small fixed count after full revalidation. Do not forward cookies, `Authorization`, proxy credentials, or arbitrary issuer-supplied headers across origins.
- Enforce connection, headers, idle-body, and total deadlines; decompressed-byte ceilings; low compression-ratio ceilings; and concurrency/per-origin budgets. Abort the stream as soon as a limit is crossed.
- Run in a network-restricted process/container with no access to internal services. URL checks alone are not a complete SSRF boundary.

OWASP's [SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) recommends strict allowlisting where possible and disabling redirect following; its [Node.js SSRF guidance](https://owasp.org/www-community/pages/controls/SSRF_Prevention_in_Nodejs) specifically warns about DNS rebinding and weak blacklist/regex defenses. Node exposes literal-IP classification through [`net.isIP`](https://nodejs.org/api/net.html#netisipinput), but that alone does not classify address ranges or pin DNS.

Media remains hostile after retrieval. Do not trust `Content-Type` or extensions; sniff a bounded prefix, reject format mismatches, decode with resource limits, and never inline untrusted HTML/SVG. Serve quarantined media from a cookieless separate origin with restrictive CSP/nosniff, or rasterize it. OWASP's [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) calls for allowlisted extensions/types, signature checks, renamed storage, size limits, and storage outside the webroot.

## 4. Retries, validation, and preservation

### Suggested implementation policy (local guardrails, not Pump limits)

- Metadata JSON: maximum 1 MiB decompressed; UTF-8 only; JSON root object; depth <= 20; <= 2,000 members; reject/flag duplicate keys; no trailing data. RFC 8259 requires exchanged JSON to be UTF-8 and notes that duplicate names are not interoperable: [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html).
- Media: configure a product limit (for example 20 MiB compressed and decompressed) and dimension/pixel/frame-duration limits. The value is a product policy, **not** a Pump, Metaplex, IPFS, or Arweave guarantee.
- Keep `raw_body`, `sha256`, `content_length_seen`, declared and sniffed MIME, fetched-at time, status, redirect chain, and truncation/error reason. Parse into a separate typed view.
- For `website`, `twitter`, `telegram`, and `video`, preserve the exact parsed string and raw JSON bytes even when invalid. Add separate `normalized_url`, `safe_to_link`, `resolved_url`, and `resolution_error` fields. Never rewrite handles, strip query strings, or substitute redirect targets in the evidence field.
- Reject duplicate security-sensitive fields in the parsed view (rather than accepting parser-dependent first/last wins), while retaining bytes and marking the document invalid/ambiguous.

For read-only GETs, use bounded exponential backoff with jitter and a maximum elapsed budget. Retry transient network failures and selected `408`, `429`, `500`, `502`, `503`, `504`; honor a bounded `Retry-After` (defined by [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), with 429 in [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html)). Do not retry deterministic parser/schema/size failures against the same bytes. For content-addressed content, try another genuinely independent gateway after timeout/5xx/429/ambiguous 404, compare bytes/hashes, and cache successful bytes by immutable ID. A 404 from one gateway is not proof of global IPFS/Arweave absence.

Recommended terminal states: `onchain_missing`, `unsupported_metadata_variant`, `uri_missing`, `uri_invalid`, `blocked_ssrf`, `fetch_timeout`, `fetch_http_error`, `too_large`, `invalid_utf8`, `invalid_json`, `ambiguous_json`, `media_invalid`, and `ok`. Missing and failed are never the same.

## 5. Dependencies

This repository currently contains planning/research documents only; no package manifest or implementation exists, so **add no dependency now**.

If implementation begins:

- use platform URL/HTTP/crypto primitives plus an audited network policy wrapper;
- use the maintained IPFS-owner library [`multiformats`](https://github.com/multiformats/js-multiformats) only if CID parsing is needed. The observed npm release was `14.0.5`; the repository/npm metadata identifies Apache-2.0 licensing. Pin an exact version and verify its license in the lockfile at adoption time;
- prefer the Apache-2.0 SPL [`solana-program/token-metadata`](https://github.com/solana-program/token-metadata) interface for Token-2022 decoding. Review any Metaplex client dependency separately: the current `mpl-token-metadata` repository describes an “Apache-style Metaplex NFT Open Source License,” so do not assume it satisfies a strict OSI/permissive-only policy merely from the phrase “Apache-style.” Local decoding from the pinned public state contract may be safer for a small read-only surface.

No library removes the need for egress isolation, DNS/IP checks, redirect revalidation, byte limits, raw-byte retention, and protocol-specific integrity verification.

## Exact caveats

1. Pump's published IDL/docs describe the owner-declared interface, not cryptographic proof that deployed bytes match a GitHub commit. Validate account owner/discriminator/mint and retain raw bytes.
2. Legacy Pump metadata and `create_v2` Token-2022 metadata are different layouts; one decoder is insufficient.
3. Pump's 200-character URI and 32/13-character current creation limits are on-chain creation constraints, not off-chain JSON/media size guarantees. Legacy Metaplex constants differ (notably its source defines `MAX_URI_LENGTH = 200` and `MAX_SYMBOL_LENGTH = 10`).
4. `is_mutable = false` protects the on-chain Metaplex record, not mutable content behind HTTP/IPNS/ArNS. A CID/transaction ID protects identified content, not continued pinning/gateway availability.
5. Social/website values are arbitrary creator-supplied strings. Safe syntax or a successful fetch does not verify account ownership, project identity, or benign content.
6. Gateway hostnames are not necessarily independent infrastructure. Record gateway/operator and test diversity; public availability has no end-to-end SLA.
7. Probe results are momentary and no-key only. They must not be converted into uptime, completeness, retention, or future-access claims.
