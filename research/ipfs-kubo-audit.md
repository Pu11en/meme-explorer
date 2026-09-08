# IPFS trustless-gateway and local-Kubo token-metadata audit

**Evidence cutoff:** 2026-08-26 UTC  
**Probe time:** 2026-08-26T12:38:42Z UTC  
**Scope:** primary/owner specifications, documentation, repositories, APIs, and bounded anonymous endpoint probes only. “Free” means no provider charge/card/credit for the stated path; self-hosting still costs hardware, disk, power, bandwidth, and operations. A probe proves one response from one network at one time—not an SLA or contractual feature.

## Structured verdict

| Question | Finding | Decision |
|---|---|---|
| Can this be truly no-card/no-credit? | Yes at the software/service-account boundary: self-host Kubo; no provider account, API key, card, token, or wallet is involved. Infrastructure is not zero-cost. | **Use local Kubo as primary.** |
| Can public gateways make it robust? | Only as verified, opportunistic fallbacks. IPFS Foundation calls its public utilities best effort and not production critical-path infrastructure; no numeric entitlement or SLA is published. | **Never depend on one public gateway.** |
| Can ordinary gateway JSON be trusted? | A default deserialized response delegates CID/path validation to the gateway. CAR/raw responses are independently verifiable. | **Require CAR/raw and verify before JSON decode.** |
| Are `ipfs.io`, `dweb.link`, and `trustless-gateway.link` diverse? | No. IPFS Foundation documents one backend/cache/network-connection/rate-limit pool, technically operated by Waterworks Community. | **Count all three as one operator/backend.** |
| Does a CID guarantee availability? | No. A CID identifies bytes/DAG structure; it does not pin, replicate, preserve, or promise retrieval. | **Pin verified results locally; retain failure states.** |
| Are IPNS/DNSLink/social/HTTP links immutable? | No. IPNS and DNSLink are mutable naming layers; social and ordinary HTTP(S) links are mutable publisher assertions. | **Resolve/snapshot separately; key reproducibility by terminal CID.** |

## Recommended strict-free pipeline

1. **Preserve input:** store the exact issuer URI and source record before normalization.
2. **Classify:** accept explicit `ipfs://`, `/ipfs/`, `ipns://`/`/ipns/`, and separately governed HTTP(S). Never reinterpret an attacker-supplied hostname as a gateway.
3. **Resolve mutable names:** for IPNS/DNSLink, retain name, signed/DNS evidence when available, resolution time/TTL, and terminal `/ipfs/{CID}`. Re-resolution is a new observation.
4. **Retrieve immutable content:** local Kubo first; request CAR for a CID/path or a raw block for a directly addressed block. Use fixed, allowlisted HTTPS trustless endpoints only as fallbacks.
5. **Verify before decoding:** validate response media type; verify every block’s bytes against its CID and verify DAG links/path traversal from the requested root. A CAR parser alone is insufficient.
6. **Decode defensively:** bounded UnixFS/IPLD traversal, then bounded UTF-8/JSON parsing and token-metadata schema checks. Never execute HTML/SVG/scriptable content.
7. **Persist:** store terminal CID/path, CAR/raw evidence or exact verified entity bytes, SHA-256 snapshot hash, size, verifier version, gateway/operator, timing, and failure category. Pin/cache immutable successes locally.
8. **Fallback policy:** bounded retry/backoff, per-origin circuit breakers, and at least one genuinely independent backend. Do not fan out to Foundation sibling hostnames.

## 1. Documented HTTP gateway endpoints and response formats

### Normative request surface

Official gateway reference: <https://docs.ipfs.tech/reference/http/gateway/>  
Trustless specification: <https://specs.ipfs.tech/http-gateways/trustless-gateway/>  
Path-gateway specification: <https://specs.ipfs.tech/http-gateways/path-gateway/>

```text
GET /ipfs/{cid}[/{path}][?{params}]       immutable CID/path
GET /ipns/{name}[/{path}][?{params}]      mutable IPNS or DNSLink resolution
```

`format=` takes precedence over `Accept`; the documented values include `raw`, `car`, `tar`, `dag-json`, `dag-cbor`, `json`, `cbor`, and `ipns-record`.

| Mode | Request | Response | Integrity meaning |
|---|---|---|---|
| Deserialized | Default `GET /ipfs/{CID}/path` | Final entity, e.g. `application/json`, image, directory HTML | Client trusts gateway validation/deserialization. Useful only behind a trusted local boundary or as unverified observation. |
| Raw block | `?format=raw` plus `Accept: application/vnd.ipld.raw` | Opaque bytes for one directly requested block CID | Recompute the CID multihash over exact block bytes. Not arbitrary UnixFS path assembly. |
| CAR | `?format=car` plus `Accept: application/vnd.ipld.car;version=1` | Binary CAR stream containing blocks needed for root/path/scope verification | Verify every block CID and the traversal from requested root/path. |
| Signed IPNS record | `?format=ipns-record` plus `Accept: application/vnd.ipfs.ipns-record` on `/ipns/{name}` | Protobuf-serialized signed IPNS record | Verify signature/name/validity; record still points mutably to a content path. |

For CAR, `dag-scope=block|entity|all` controls returned scope (`all` is documented default); `entity-bytes=from:to` requests blocks needed for a verifiable file byte range. The specification may signal CAR parameters such as `version`, `order`, and `dups` in `Content-Type`; clients must not silently assume unsupported ordering/duplicate behavior. For a metadata JSON file under a UnixFS directory, use CAR/path verification, normally entity scope. For a `raw`-codec metadata CID, raw block retrieval is sufficient.

Concrete forms:

```text
GET http://127.0.0.1:8080/ipfs/{CID}/{path}?format=car&dag-scope=entity
Accept: application/vnd.ipld.car;version=1

GET https://trustless-gateway.link/ipfs/{CID}/{path}?format=car&dag-scope=entity
Accept: application/vnd.ipld.car;version=1

GET {fixed-allowlisted-origin}/ipfs/{raw-block-CID}?format=raw
Accept: application/vnd.ipld.raw
```

Path-gateway error semantics must remain distinct: `400` malformed/unsupported request; `404` missing/invalid traversal **or not retrievable from this gateway**; `410` operator refusal/denylist; `412` cache-only/precondition failure; `429` rate limit (honor `Retry-After`); `502` known retrieval/provider failure; `504` retrieval timeout. A streamed response can fail after headers, so verify completeness. `gateway_404 != globally_missing`.

## 2. CID integrity verification

Official content-addressing explanation: <https://docs.ipfs.tech/concepts/content-addressing/>.

A CID’s multihash is usually the hash of a **root block**, not a plain SHA-256 of final file bytes. Chunking, DAG layout, codec, CID version, and hash algorithm affect the CID; identical files can have different CIDs. Only a single `raw`-codec block has a multihash directly over the file/block bytes.

Required verification:

1. Parse CID and permit supported version, multicodec, multihash algorithm, and sane digest length.
2. For every raw/CAR block, hash the exact encoded block bytes with the CID-declared hash and require equality.
3. Decode only supported codecs after block verification.
4. Follow only verified links from the requested root CID and prove every requested path segment.
5. Require the requested entity/range to be complete; reject missing child blocks, unexpected roots, invalid links, trailing ambiguity, excessive DAG depth, or resource-limit breach.
6. Only then deserialize UnixFS and parse JSON.

Important implementation trap: the owner [`ipld/js-car`](https://github.com/ipld/js-car) repository warns that `@ipld/car` reading does not itself validate block data against paired CIDs; its [`verify-car.js`](https://github.com/ipld/js-car/blob/master/verify-car.js) example performs explicit verification. `CarReader` alone is not an integrity verifier.

Preferred maintained client: [`@helia/verified-fetch`](https://github.com/ipfs/helia-verified-fetch) is an IPFS-owned fetch-like client that verifies bytes retrieved over libp2p or HTTP trustless gateways and then deserializes client-side. The owner migration guide documents the defaults `https://delegated-ipfs.dev` for routing and `https://trustless-gateway.link` for trustless fallback, both replaceable: <https://docs.ipfs.tech/how-to/replace-public-gateways-with-self-hosted-ipfs/>.

Verification proves address/byte correspondence—not author identity, token legitimacy, JSON safety, MIME truth, copyright, legality, pinning, or future availability.

## 3. Local Kubo setup and hardening

Official install guide: <https://docs.ipfs.tech/install/command-line/>. At the cutoff it documents Kubo **v0.43.0**, official artifacts at <https://dist.ipfs.tech/#kubo>, and current release fallback at <https://github.com/ipfs/kubo/releases/latest>. Version-pinned config: <https://github.com/ipfs/kubo/blob/v0.43.0/docs/config.md>. Version-pinned gateway guide: <https://github.com/ipfs/kubo/blob/v0.43.0/docs/gateway.md>.

```sh
# Install the official v0.43.0 artifact for the OS; verify the downloaded release
ipfs --version

# Workstation
ipfs init

# Public-internet server only: disables LAN discovery/non-global peering
ipfs init --profile server

# Explicit reproducible import behavior for content you add
ipfs config profile apply unixfs-v1-2025

# Trustless-only gateway output; keep recursive retrieval for arbitrary token CIDs
ipfs config --json Gateway.DeserializedResponses false
ipfs daemon
```

Defaults from the official quick start (<https://docs.ipfs.tech/how-to/command-line-quick-start/>): admin RPC `127.0.0.1:5001`, gateway `127.0.0.1:8080`, swarm port `4001`. **Never expose RPC port 5001 publicly**; it is admin-level. Keep gateway/RPC loopback-only for an internal metadata worker. If remote RPC is unavoidable, use TLS, authentication, narrow `API.Authorizations`, firewalling, and owner guidance: <https://docs.ipfs.tech/how-to/kubo-rpc-tls-auth/>.

`Gateway.NoFetch=false` is required for a local node to retrieve arbitrary unknown token CIDs. `Gateway.NoFetch=true` serves only already-local/pinned content and returns 404 otherwise; use it only for a separate public host-only gateway or a post-fetch serving tier. For public exposure, also set per-host `DeserializedResponses:false`, configure content blocking, timeouts, `Gateway.MaxConcurrentRequests`, reverse-proxy rate limits, and preserve the original `Host` header: <https://github.com/ipfs/kubo/blob/v0.43.0/docs/gateway.md#running-in-production>.

Operational notes:

- Pin verified CIDs required for durable reuse (`ipfs pin add /ipfs/{CID}`); unpinned cached data can be garbage-collected.
- Enable/plan GC and cap repo growth; the install guide cites 6 GiB memory, 2 CPU cores, and storage dependent on retained data.
- Cold/obscure CID retrieval may be slower and can fail when no provider remains. Local Kubo controls the client and cache; it does not create remote availability.
- A public recursive gateway lets strangers trigger arbitrary CID lookup/download and bandwidth use. Do not expose the internal recursive endpoint.

## 4. Availability, rate limits, and no-card/no-credit constraints

| Operator/path | Owner evidence | Free/card/limit status | Trustless/status verdict |
|---|---|---|---|
| **Self-operated Kubo** `http://127.0.0.1:8080/ipfs/{cid}` | [Kubo gateway guide](https://github.com/ipfs/kubo/blob/v0.43.0/docs/gateway.md) | No account, API key, card, credit, wallet, or provider quota. Operator pays infrastructure. | Full gateway spec including CAR/raw. **Primary.** |
| **IPFS Foundation** `https://ipfs.io/ipfs/{cid}`, `https://{cid}.ipfs.dweb.link/`, `https://trustless-gateway.link/ipfs/{cid}` | [Public utilities](https://docs.ipfs.tech/concepts/public-utilities/) | Anonymous public utility; no card/signup path is documented. Best effort, no production critical path, may throttle/ban overuse; no numeric entitlement/SLA. | `trustless-gateway.link` is trustless-only; all three share one backend/cache/connections/rate limits. **One fallback, not three.** |
| **Foundation delegated routing** `https://delegated-ipfs.dev/routing/v1` | [Public utilities](https://docs.ipfs.tech/concepts/public-utilities/#delegated-routing) | Best-effort public endpoint; no numeric entitlement/SLA. | Returns provider multiaddresses, not metadata bytes; backed by [Someguy](https://github.com/ipfs/someguy), querying DHT/IPNI. |
| **Filebase public** `https://ipfs.filebase.io/ipfs/{cid}` | [What is IPFS?](https://filebase.com/docs/ipfs/concepts/what-is-ipfs), [gateway management](https://filebase.com/docs/ipfs/gateways/managing-dedicated-gateways) | Public endpoint is documented. A separate free account is explicitly “no credit card, no commitment”; current signup docs say 5 GB storage and 5 GB/month IPFS bandwidth and call it evaluation-only: <https://filebase.com/docs/get-started/sign-up>. Owner pricing/marketing pages have changed/conflicted, so do not infer a stable public-gateway quota/SLA. | Owner docs do not contractually promise trustless CAR/raw. Bounded probe accepted raw; treat as opportunistic, always verify. |
| **Pinata** public `https://gateway.pinata.cloud/ipfs/{cid}`; dedicated `{name}.mypinata.cloud/ipfs/{cid}` | [Dedicated gateways](https://docs.pinata.cloud/gateways/dedicated-ipfs-gateways), [limits](https://docs.pinata.cloud/account-management/limits), [pricing](https://pinata.cloud/pricing) | Free-plan API limit documented as 60 requests/minute; dedicated gateway retrieval currently says no instantaneous rate limit, but plan bandwidth/request quotas still apply. Owner sources reviewed do not explicitly prove no-card signup. Public gateway is testing, not robust entitlement. | No owner promise of CAR/raw support. Exclude from strict no-card core; verified best-effort only if separately qualified. |
| **Cloudflare legacy public** `cloudflare-ipfs.com` | [Migration guide](https://developers.cloudflare.com/web3/reference/migration-guide/) | Owner says legacy public hostname is being deprecated; replacement is an account/custom Web3 gateway with plan/usage constraints: <https://developers.cloudflare.com/web3/reference/limits/>. | **Do not use as public fallback.** |
| **w3s.link / Storacha legacy** `https://w3s.link/ipfs/{cid}` | [Owner legacy w3link page](https://old.web3.storage/products/w3link/) | Legacy page says “free for public use” but embeds a 2024 product sunset; current Storacha docs redirect to Fil One, whose owner pricing shows a 30-day no-card trial, not a perpetual free gateway: <https://www.fil.one/pricing>. | Current probe redirected into Foundation infrastructure. **Not independent diversity; do not certify current free entitlement.** |
| **Lighthouse** `https://gateway.lighthouse.storage/ipfs/{cid}` | [Retrieve file](https://docs.lighthouse.storage/how-to/retrieve-file), [pricing](https://www.lighthouse.storage/pricing) | Owner documents endpoint and a $0 storage tier, but reviewed sources do not establish no-card signup, general-public arbitrary-CID entitlement, numeric retrieval limits, or SLA. | Conflicting content-specific anonymous probe results (206 here; another bounded probe saw 402). **Not core fallback without qualification.** |

No reviewed provider offers a perpetual free public-gateway SLA. “Free SDK” and “free account” do not imply free unlimited retrieval. Availability must be represented as `available | blocked | rate_limited | timeout | gateway_failed | not_found_at_gateway | integrity_failed`, never one nullable metadata field.

## 5. Gateway/operator diversity

IPFS Foundation explicitly says `ipfs.io`, `dweb.link`, and `trustless-gateway.link` are different interfaces to the same server pool and rate limit. Technical operations are Waterworks Community on the Foundation’s behalf. Retrying sibling names wastes the same shared quota: <https://docs.ipfs.tech/concepts/public-utilities/>.

A defensible diversity ladder is:

1. **Local Kubo** — self-operated retrieval, DHT/libp2p, local verified cache/pins.
2. **Foundation trustless endpoint** — one external backend (`trustless-gateway.link`), bounded use.
3. **A separately operated endpoint** — e.g. Filebase public endpoint only as an unentitled, cryptographically verified opportunistic fallback; continuously qualify behavior and never infer SLA.
4. **Direct providers** — Kubo/Helia can retrieve from discovered peers rather than trusting a gateway; delegated routing is discovery, not byte integrity.

Cloudflare’s legacy public route and current `w3s.link` behavior do not add independent diversity. Pinata/Lighthouse may be independent operators, but current owner evidence does not satisfy every strict no-card, rate-entitlement, and trustless-format condition. Local Kubo is therefore the only strong no-card independently controlled primary.

## 6. Repository and license audit

Anonymous GitHub repository API observations on 2026-08-26 found the listed repositories unarchived; activity is maintenance evidence, not a support promise. GitHub may report `NOASSERTION` for dual-licensed repos, so rely on repository license files/package declarations.

| Repository | Role | License evidence |
|---|---|---|
| [`ipfs/kubo`](https://github.com/ipfs/kubo) | Full Go IPFS node/gateway | Dual Apache-2.0/MIT: [README license section](https://github.com/ipfs/kubo#license), [Apache](https://github.com/ipfs/kubo/blob/master/LICENSE-APACHE), [MIT](https://github.com/ipfs/kubo/blob/master/LICENSE-MIT). |
| [`ipfs/helia-verified-fetch`](https://github.com/ipfs/helia-verified-fetch) | Fetch-like verified IPFS retrieval | Package declares `Apache-2.0 OR MIT`: [package.json](https://github.com/ipfs/helia-verified-fetch/blob/main/package.json), [Apache](https://github.com/ipfs/helia-verified-fetch/blob/main/LICENSE-APACHE), [MIT](https://github.com/ipfs/helia-verified-fetch/blob/main/LICENSE-MIT). |
| [`ipld/js-car`](https://github.com/ipld/js-car) | CAR reader/writer; not sufficient verifier alone | Dual Apache-2.0/MIT: [Apache](https://github.com/ipld/js-car/blob/master/LICENSE-APACHE), [MIT](https://github.com/ipld/js-car/blob/master/LICENSE-MIT). |
| [`ipfs/rainbow`](https://github.com/ipfs/rainbow) | Smaller retrieve-only trustless gateway alternative | Dual MIT/Apache-2.0: [README](https://github.com/ipfs/rainbow#license), [Apache](https://github.com/ipfs/rainbow/blob/main/LICENSE-APACHE), [MIT](https://github.com/ipfs/rainbow/blob/main/LICENSE-MIT). |
| [`ipfs/someguy`](https://github.com/ipfs/someguy) | Self-hosted delegated routing | `Apache-2.0 OR MIT`: [LICENSE.md](https://github.com/ipfs/someguy/blob/main/LICENSE.md). |
| [`ipfs/gateway-conformance`](https://github.com/ipfs/gateway-conformance) | Gateway-spec conformance tests | Dual Apache-2.0/MIT: [README](https://github.com/ipfs/gateway-conformance#license). |
| [`ipfs/ipfs-check`](https://github.com/ipfs/ipfs-check) | Self-hostable provider/retrieval diagnostics | `Apache-2.0 OR MIT`: [LICENSE.md](https://github.com/ipfs/ipfs-check/blob/main/LICENSE.md). |
| [`Filebase/filebase-sdk`](https://github.com/Filebase/filebase-sdk) | Provider SDK, not gateway server source | MIT: [LICENSE](https://github.com/Filebase/filebase-sdk/blob/master/LICENSE); does **not** make hosted gateway infrastructure open source. |
| [`PinataCloud/pinata-web3`](https://github.com/PinataCloud/pinata-web3) | Provider SDK, not gateway server source | MIT: [LICENSE](https://github.com/PinataCloud/pinata-web3/blob/main/LICENSE); does **not** establish hosted gateway-server license. |

Pin exact versions/lockfiles. A permissive SDK license grants software rights, not hosted capacity, pricing, availability, or an SLA.

## 7. SSRF, abuse, and content-safety rules

Token metadata URIs, nested media URLs, HTTP redirects, IPNS/DNSLink records, and JSON fields are attacker-controlled. OWASP owner guidance recommends allowlisting where possible and disabling automatic redirects: <https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html>.

Required controls:

1. **Separate fetchers:** IPFS worker talks only to loopback Kubo and fixed allowlisted gateway origins. It never fetches a gateway hostname supplied by token metadata. Ordinary HTTP(S) uses a separate sandbox with no internal network/credential access.
2. **Canonical parsing:** validate CID/path structurally; reject userinfo, ambiguous encodings, backslashes, invalid UTF-8, path traversal, unsupported schemes/codecs/hash algorithms, and unbounded recursive names.
3. **Network target policy:** for ordinary HTTP(S), resolve A/AAAA; reject loopback, private, link-local, carrier-grade NAT, multicast, unspecified, reserved, and cloud-metadata/service addresses; pin validated IP for the connection to resist DNS rebinding.
4. **Redirect policy:** disable by default. If allowed, cap hops and fully revalidate scheme/host/DNS/IP at every hop; never forward credentials or sensitive headers cross-origin.
5. **Resource ceilings:** connect/read/overall deadlines; maximum headers, CAR bytes, blocks, DAG depth, decoded entity bytes, JSON depth/keys/string length, compressed expansion, image pixels/dimensions, and per-origin/global concurrency.
6. **No active rendering:** sniff bytes independently of claimed MIME. Never inline remote HTML, XML, SVG, PDF, or scriptable media; quarantine originals and serve sanitized inert derivatives from a separate origin with CSP and `nosniff`.
7. **Kubo boundary:** never expose RPC 5001. Keep the recursive gateway internal. A public recursive Kubo gateway is an attacker-controlled bandwidth/content-retrieval primitive even though it is not a generic HTTP proxy.
8. **Evidence:** retain URI, chosen gateway/operator, resolved IPs, redirect chain, response status/headers, verified root/path, bytes/hash/size, elapsed time, and exact failure reason.

## 8. Immutable versus mutable identifiers and links

Official IPNS explanation: <https://docs.ipfs.tech/concepts/ipns/>. Official DNSLink explanation: <https://docs.ipfs.tech/concepts/dnslink/>.

| Input retained | What can be claimed | What cannot be claimed |
|---|---|---|
| `/ipfs/{CID}/path` after full verification | Requested path resolved through a content-addressed immutable DAG to these exact verified bytes. | Pinning, future availability, authorship, truth, safety. |
| IPNS name/record | A valid signed mutable record for that name resolved to a path at time T, subject to validity/sequence rules. | Same target on a later resolution; human identity of key holder. |
| DNSLink name/TXT | DNS at time T published `dnslink=/ipfs/...` or another mutable path. | Permanent target or uninterrupted domain/DNS control; DNSLink may chain to IPNS/DNSLink. |
| Ordinary HTTP(S) metadata/media | These bytes/status were observed from this origin at time T; snapshot hash enables comparison. | Content-addressed immutability, future bytes, continued control/availability. |
| Website/X/Telegram/social link inside JSON | Exact issuer-provided string occurred in verified metadata bytes. | Account ownership, endorsement, identity, legitimacy, current destination, safety. |

IPNS is self-certifying for its signing key, but it is intentionally mutable; a key holder can publish a newer record. DNSLink is editable DNS. Social/HTTP links remain mutable even when the **JSON containing the string** is immutable under a CID. Store both facts: immutable containing bytes and mutable external target.

## 9. Bounded anonymous endpoint observations

At 2026-08-26T12:38Z, a 1 KiB range request for the IPFS-documented example CID used `?format=raw` and `Accept: application/vnd.ipld.raw`:

| Endpoint | Observation | Interpretation |
|---|---|---|
| `trustless-gateway.link` | HTTP 403 from this runtime | Point-in-time policy/rate edge failure; not global content absence. |
| `ipfs.io` | Redirected to `trustless-gateway.link`, then 403 | Confirms sibling routing in this request; not diversity. |
| `w3s.link` | Redirected to `trustless-gateway.link`, then 403 | No independent fallback in this observation. |
| `ipfs.filebase.io` | HTTP 206, `application/vnd.ipld.raw` | Raw response worked once; owner docs do not promise it as stable trustless entitlement. |
| `gateway.lighthouse.storage` | HTTP 206, `application/vnd.ipld.raw` | Worked for this CID once; other content-specific probes can differ. |
| `gateway.pinata.cloud` | HTTP 206, `application/vnd.ipld.raw` | Worked once after ~5.5 s; public/testing endpoint has no reviewed robust entitlement. |

The range was intentionally incomplete and was **not** a complete block-integrity proof. These observations qualify routing/format behavior only and must not override owner terms or documentation.

## Final acceptance criteria

A production implementation passes this audit only when:

- no API key, provider credit, card, wallet, or paid request path is required for the core pipeline;
- local Kubo is primary and loopback-only; public gateways are bounded fallbacks;
- CAR/raw blocks and root/path are independently verified before metadata parsing;
- Foundation sibling hostnames count as one backend;
- immutable CID observations are separate from mutable IPNS/DNSLink/HTTP/social observations;
- SSRF, redirect, decompression, DAG/JSON/media, timeout, and concurrency limits fail closed;
- successful immutable results are cached/pinned locally, while availability failures remain explicit;
- monitoring detects fallback convergence, format downgrades, rate limits, integrity failures, and provider-policy changes;
- Kubo/client versions and repository licenses are pinned and re-audited on upgrade.

**Residual boundary:** this design can be no-provider-fee and cryptographically robust, but no primary source supports “free forever,” “always available,” or a public-gateway SLA. Integrity and availability remain separate properties.
