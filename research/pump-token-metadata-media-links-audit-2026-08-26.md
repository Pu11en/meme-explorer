# Pump token metadata/media/raw-link retrieval audit

**Evidence cutoff:** 2026-08-26 UTC  
**Scope:** strict-free, no-key retrieval for Pump token metadata JSON/media; preservation of raw website/social links. Primary/owner documentation, repository evidence, and bounded anonymous probes only. A probe proves point-in-time reachability, not completeness, permanence, safety, or an SLA.

## Structured verdict

| Capability | Best strict-free path | Status | Hard boundary |
|---|---|---|---|
| Discover metadata URI | Preserve the URI in the raw PumpAPI/PumpPortal create payload; reconcile the mint and Pump event with official Pump IDL/on-chain transaction | **Usable** | Provider schema/delivery is not contractual; a URI is an issuer claim, not content availability |
| Read Metaplex state | Read the mint's Token Metadata PDA through Solana RPC at a named slot/commitment; retain raw account bytes plus decoded `uri`, update authority, creators and `isMutable` | **Usable, best effort** | Public Solana RPC is rate-limited and not for production; Token-2022 metadata/extensions need separate decoding |
| Fetch Arweave JSON/media | Direct gateway GET by transaction/data-item ID, with AR.IO gateway fallback and local byte hashing | **Usable, best effort** | Network persistence is not an SLA for one gateway; strong verification requires checking the transaction/data-item proof chain, not trusting HTTP alone |
| Fetch IPFS JSON/media | Normalize `ipfs://CID/path`; try bounded independent gateways; for strong integrity use a trustless gateway/CAR verification; always hash returned bytes | **Usable, best effort** | Public gateways explicitly have no SLA/support and shared throttling; ordinary deserialized HTTP bytes do not by themselves prove the CID DAG/path |
| Fetch arbitrary HTTP(S) JSON/media | Sandboxed backend fetcher only; HTTPS preferred, strict SSRF/redirect/DNS/size/time/MIME controls; snapshot/hash every response | **Candidate only** | URL and bytes are mutable; origin compromise, redirects, expiry and equivocation cannot be excluded |
| Record website/X/Telegram links | Store exact JSON strings and JSON path; do **not** auto-fetch them | **Usable** | Presence, domain/name match, redirects or account display do not validate ownership, identity, legitimacy or safety |
| Production reliability | Local raw retention, explicit failure states, gateway diversity, retries/circuit breakers and later reconciliation | **Required** | No reviewed free gateway/public RPC supplies a relevant end-to-end SLA or completeness guarantee |

## Repository evidence

- The repository is planning/research-only; no package/config or metadata fetcher exists to audit or reuse. [`planning/PLAN.md`](../planning/PLAN.md) selects replaceable free sources, raw logging and visible gaps.
- The recording contract already requires the raw metadata link; description/image/website/X/Telegram/unknown fields; authority/mutability when available; and distinct `missing`, `blocked`, `rate_limited`, `not_yet_indexed` and `failed` states: [`planning/evidence/P-007-recording-contract.md`](../planning/evidence/P-007-recording-contract.md).
- A 2026-08-26 ten-create sample fetched metadata directly for **2/10**, received gateway HTTP **403 for 7/10**, and had one unusable URI. One Arweave JSON response arrived in 143 ms and contained description/image/website/twitter/telegram. This is observed availability only; the sample did not preserve the exact URIs or response bytes in the evidence note, so its content cannot now be independently rehashed: [`planning/evidence/P-004-evidence.md`](../planning/evidence/P-004-evidence.md).
- The existing independent audit correctly separates free Arweave reads from paid uploads and records public IPFS gateways as best effort: [`research/free-metadata-social-wallet-audit.md`](free-metadata-social-wallet-audit.md).

## Primary-source facts

### Pump and Metaplex state

1. Official Pump artifacts expose `CreateEvent.uri` and the token program in the Pump IDL; they are protocol schemas, not a hosted metadata service: [Pump public docs](https://github.com/pump-fun/pump-public-docs), [Pump IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json).
2. Metaplex Token Metadata keeps the on-chain name, symbol, URI, update authority, creators and mutability state; the URI points to separate off-chain JSON. Updating requires the update authority while the account remains mutable: [Token Metadata overview](https://www.metaplex.com/docs/smart-contracts/token-metadata), [update token metadata](https://developers.metaplex.com/tokens/update-token).
3. `isMutable=false` constrains future Token Metadata account updates; it does **not** freeze bytes at an ordinary HTTP URL. Conversely, an IPFS CID or confirmed Arweave transaction/data-item identifier is content-addressed/immutable context even if the on-chain account remains mutable. Record these as separate facts.
4. Token-2022 supports metadata-related extensions and must not be assumed to use only the legacy Token Metadata PDA: [Solana token extensions](https://solana.com/docs/tokens/extensions).
5. Solana's public endpoints are rate-limited, may change limits without notice, and are not intended for production: [clusters/public RPC](https://solana.com/docs/references/clusters).
6. No reviewed official Pump/Metaplex schema makes `website`, `twitter`/`x`, or `telegram` mandatory Token Metadata JSON fields. The repository observed them only in some successful issuer JSON documents; retain them as arbitrary self-asserted fields, with missingness separate from fetch failure.

### Arweave, IPFS and HTTP mutability

1. Arweave/AR.IO owner docs support direct gateway retrieval by transaction/data-item ID and describe multiple gateways. AR.IO warns that `arweave.net` is only one access point and should not be assumed permanently available: [fetch data](https://docs.ar.io/build/access/fetch-data), [gateway architecture](https://docs.ar.io/learn/gateways/), [arweave.net warning](https://ar.io/articles/arweave-dot-net/).
2. For strong Arweave integrity, verify the transaction/data-item signature/proof chain; an HTTP 200 from a gateway alone is reachability, not cryptographic verification: [AR.IO verification](https://docs.ar.io/learn/verification).
3. IPFS CIDs are content identifiers, while IPNS and ordinary HTTP URLs are mutable naming layers: [CID/content addressing](https://docs.ipfs.tech/concepts/content-addressing/), [IPFS gateways](https://docs.ipfs.tech/concepts/ipfs-gateway/).
4. IPFS explicitly labels public gateways a shared best-effort public good with no SLA/support and shared rate limits: [replace public gateways](https://docs.ipfs.tech/how-to/replace-public-gateways-with-self-hosted-ipfs/).
5. A trustless gateway can return CAR/raw blocks that a client verifies against the requested CID/path. Hashing a gateway's decoded file bytes with SHA-256 is still useful for snapshot identity, but that digest need not equal a UnixFS CID because the CID may identify a DAG with chunking/codecs: [trustless gateway specification](https://specs.ipfs.tech/http-gateways/trustless-gateway/), [HTTP gateway CAR behavior](https://docs.ipfs.tech/reference/http/gateway/).
6. Ordinary `https://` and `http://` resources are mutable. Preserve the original URL and separately store each observed redirect target, response time and response-byte hash; never replace the raw issuer string with a normalized/final URL.

| Identifier retained | Immutable statement justified | Not justified |
|---|---|---|
| Raw HTTP(S) URL | Only “this exact string was published/observed at time T” | Stable bytes, continued control, future reachability |
| SHA-256 of fetched bytes | Exact bytes can later be compared with this snapshot | Where to retrieve them, publisher identity, CID/Arweave proof |
| IPFS CID/path | Content-addressed DAG/path when client verifies returned blocks/path | Pinning or gateway availability; plain gateway HTTP alone is not full verification |
| Confirmed Arweave transaction/data-item ID | Stable network object identity when proof chain is verified | Availability of any one HTTP gateway or truth/safety of its payload |
| Metaplex `isMutable=false` | The Token Metadata account's governed fields cannot be updated through that mechanism | Immutability of mutable off-chain HTTP bytes already named by `uri` |

## Safe no-key probes on 2026-08-26

| Probe | Result | What it proves / does not prove |
|---|---|---|
| `HEAD https://arweave.net/info` | HTTP 200 | The gateway edge was reachable; no Pump object, persistence, or proof chain was validated |
| First 4 KiB of the IPFS-documented example CID `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi` through `ipfs.io` | HTTP 206, `image/jpeg`, SHA-256 prefix snapshot `c46c6b318de7c2b69c13049b74a1310c4bbfdedd7afcdf09d49254a1c19f6ae9` | One documented CID was retrievable at that instant; only a 4 KiB range was hashed, not the full asset or CAR |
| Same CID through `dweb.link` | HTTP 403 | Gateway-specific failure; it does not prove the CID is unavailable |
| `cloudflare-ipfs.com` DNS | Resolution failed in this environment | A named fallback can be unusable from one network; it does not prove global outage |

The probes demonstrate why `gateway_failure != content_absent` and why gateway diversity must be recorded, not hidden.

## Required fetch and recording contract

### Preserve before fetching

For every launch, append:

- `mint`, source/provider, full untouched create payload, transaction/signature, receipt time;
- `metadata_uri_raw` exactly as received, its JSON path/source field and UTF-8 validity;
- chain reconciliation: slot, commitment, raw Token Metadata account bytes/hash, parser/schema version, decoded URI, update authority, creators, `isMutable`, token program and Token-2022 extension state;
- never merge conflicting provider URI, on-chain URI and fetched JSON into one field.

### One immutable observation per attempt

Store:

- attempt ID/time, requested raw URI, normalized scheme/CID/Arweave ID, selected gateway/origin;
- resolved public IP(s), redirect chain, status, selected safe headers, elapsed time and retry ordinal;
- `available | missing | blocked | rate_limited | timeout | invalid_uri | unsafe_target | too_large | bad_mime | parse_failed | gateway_failed`;
- exact raw JSON bytes when within policy, byte length, SHA-256, detected MIME/charset and parser error;
- media URI raw string, media fetch attempt, SHA-256/size/dimensions/detected MIME; serve only a separately sanitized/cached rendition;
- raw `website`, `twitter`/`x`, `telegram`, and unknown keys as values plus original JSON paths. Do not rewrite handles into URLs without a separate derived field.

A later fetch is a new observation. For mutable HTTP, differing hashes are expected evidence, not an overwrite. For the same CID/Arweave ID, differing verified content is an integrity alarm; differing gateway wrappers/errors are not necessarily content differences.

## Security boundary

The metadata URI and all nested URLs are attacker-controlled. OWASP recommends allowlisting where possible and disabling automatic redirects because redirects can bypass input validation: [SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

Required controls:

1. Backend-only isolated fetch worker with no cloud metadata/service-network reachability and no ambient credentials, cookies, proxy credentials or `Authorization` forwarding.
2. Accept only explicit `ipfs`, Arweave-ID and `https` forms by default. Disable plain HTTP unless separately approved; reject `file:`, `data:`, `ftp:`, `gopher:`, `javascript:` and ambiguous/userinfo URLs.
3. Parse canonically; reject encoded/decimal/octal/hex IP tricks and IPv4-mapped IPv6. Resolve A/AAAA; reject loopback, private, link-local, carrier-grade NAT, multicast, unspecified, reserved and cloud-metadata destinations. Pin the validated destination for the connection to resist DNS rebinding.
4. Disable redirects by default. If required, cap them (for example 3) and repeat full scheme/host/DNS/IP validation for every hop; never forward sensitive headers cross-origin.
5. Enforce connect/read/overall deadlines, maximum headers, decompressed-byte streaming limits, JSON depth/key/string limits and media pixel/dimension limits. Abort before buffering excess bytes.
6. Sniff bytes independently of `Content-Type`. Never render remote SVG/HTML/XML or scriptable media inline; quarantine originals and serve an inert sanitized raster/download from a separate origin with restrictive CSP and `nosniff`.
7. Do not crawl or preview website/social links automatically. UI links must be visibly external and opened without opener/referrer authority.

## Retry and gateway policy

This is a bounded implementation policy, not a provider guarantee:

1. One immediate attempt, then at most two delayed retries with exponential backoff and full jitter; honor a bounded `Retry-After` for 429/503.
2. Retry timeout, transient DNS/connect errors, 408, 425, 429 and 5xx. Do not repeatedly retry malformed URI, unsafe target, oversized body, bad MIME, 400/401 or deterministic parser failure.
3. Treat 403/404 on a content-addressed gateway as gateway-specific: try the next independently operated gateway once. A 404 on a just-created mutable origin may get one delayed retry and must remain `not_yet_available`, not `missing`.
4. Use per-origin concurrency/rate limits, circuit breakers and cached successful immutable content. Never let metadata enrichment block launch recording.
5. Re-fetch mutable HTTP on an explicit schedule only; immutable CID/Arweave objects need no routine refetch after strong verification, though gateway health may be sampled separately.

## Libraries/tools decision

No new package is necessary for the current planning-only repository: a backend runtime's standards-based HTTP client, streaming byte limits and SHA-256 are sufficient for the first fetcher; a separate RPC client is needed only when implementation starts.

If strong client-side IPFS verification becomes necessary, use official **`@helia/verified-fetch`** rather than adding more ordinary gateway wrappers. It is designed to fetch and verify CIDs through trustless gateways, is dual MIT/Apache-2.0, and its owner repository was unarchived with a 2026-08-26 push in the anonymous check: [owner repository](https://github.com/ipfs/helia-verified-fetch), [IPFS migration recommendation](https://github.com/ipfs/ipfs-docs/blob/main/docs/how-to/replace-public-gateways-with-self-hosted-ipfs.md). A local **Kubo** node/gateway is the maintained dual-MIT/Apache alternative when operational independence/pinning justifies running IPFS infrastructure: [Kubo](https://github.com/ipfs/kubo). Neither creates an availability SLA; content must be discoverable/pinned somewhere.

If implementation requires a maintained permissively licensed Solana RPC client, prefer Anza's **`@solana/kit`** (owner-maintained JavaScript SDK, MIT) or the maintenance v1 **`@solana/web3.js`** (MIT): [Anza Kit](https://github.com/anza-xyz/kit), [Solana web3.js](https://github.com/solana-foundation/solana-web3.js). Anonymous owner-repository API checks on 2026-08-26 reported both unarchived, with last pushes on 2026-08-26 and 2026-08-25 respectively; this is maintenance evidence, not a future-support promise. Pin an exact version and lockfile, and contract-test RPC responses.

Do **not** currently certify `@metaplex-foundation/mpl-token-metadata` as a clearly permissive dependency without legal review: its package manifest declares `Apache-2.0`, but the owner repository root `LICENSE` is the custom **Metaplex NFT Open Source License**, not unmodified Apache-2.0: [repository](https://github.com/metaplex-foundation/mpl-token-metadata), [root license](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/LICENSE). The package is maintained, but that license conflict fails this audit's “clearly permissive” requirement. Preserve raw account bytes and defer the decoder choice rather than copying generated code under ambiguous terms.

## What cannot be validated

- No free source establishes that every Pump launch URI or every referenced object was observed, pinned or permanently retrievable.
- HTTP 200, a valid CID/Arweave ID, matching JSON name/symbol, or a social/domain link does not prove issuer identity, ownership, legitimacy, originality, copyright, malware safety or predictive quality.
- Metaplex `verified` creator state, update authority and mutability are on-chain assertions/permissions, not proof of the human behind an address or control of a linked website/social account.
- A normal IPFS gateway response is not strong end-to-end CID verification unless blocks/path are verified; an Arweave gateway response is not strong proof-chain verification unless the client performs it.
- Public RPC/gateway probes do not validate SLA, retention, global availability, censorship resistance, future access, rate entitlement or completeness.
- `404`/`403`/timeout cannot distinguish never-uploaded, not-yet-propagated, unpinned, gateway-blocked, rate-limited, regionally filtered or permanently lost content without independent evidence.
- The repository's earlier 10-token sample cannot be reproduced or content-hash validated because exact sampled URIs/raw bytes were not retained in the cited evidence note.
