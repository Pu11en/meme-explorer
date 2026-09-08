# Arweave gateway audit: strict-free token-metadata byte fetching

**Evidence cutoff:** 2026-08-26 UTC  
**Scope:** read-only retrieval of token metadata bytes by an Arweave transaction or ANS-104 data-item ID. Only official protocol/project documentation, owner repositories, and official security guidance are used. “Free” means no provider payment, card, funded wallet, credits, or paid trial for the stated request path; it does not mean unlimited capacity or zero self-hosting cost.

## Executive verdict

A **truly free, anonymous, best-effort** read pipeline is viable: accept a validated Arweave ID, request raw bytes from an independently selected AR.IO gateway, cryptographically verify those bytes, cache them by ID and local digest, and fail over to another operator without ever invoking payment. It is **not** a free guaranteed service: operators choose policy, public capacity has no reviewed SLA, and AR.IO explicitly supports free rate-limit buckets followed by HTTP `402 Payment Required`. Therefore `402`, `429`, gateway `404`, timeout, and verification failure must remain distinct observations; none proves global absence.

| Question | Finding |
|---|---|
| Anonymous byte read | **Yes, best effort.** Official fetch examples use ordinary unauthenticated `GET`; no card, API key, account, wallet, credits, or trial appears in the base retrieval contract: [AR.IO Fetch Data](https://docs.ar.io/build/access/fetch-data), [AR.IO data API](https://docs.ar.io/apis/ar-io-node/data). |
| Strict-free forever/unlimited | **No documented guarantee.** Operators can meter a free bucket and answer `402` when it is exhausted; payment is optional, not part of a strict-free client: [x402 Payments](https://docs.ar.io/learn/gateways/x402-payments). |
| Integrity from HTTP 200 alone | **No.** Verify the L1 transaction data root and signature, or the ANS-104 data-item signature/payload commitment: [verification strategies](https://docs.ar.io/sdks/wayfinder/wayfinder-core/verification-strategies/), [client-side verification](https://docs.ar.io/learn/verification/client-side-verification). |
| Gateway diversity | **Yes, architecturally.** AR.IO says anyone may run a gateway and operators are independent; discover registered gateways rather than treating `arweave.net` as the network: [gateways](https://docs.ar.io/learn/gateways/), [gateway registry](https://docs.ar.io/learn/gateways/gateway-registry/). |
| Immutable social/website links | **No.** The verified Arweave object freezes the literal JSON bytes, including link strings; the web/X/Telegram resources those strings name remain mutable and independently controlled. |

## 1. Documented retrieval endpoints

Use a configured gateway origin, not an attacker-supplied origin.

| Endpoint | Purpose | Exact-byte caveat |
|---|---|---|
| `GET https://<gateway>/<transaction-or-data-item-id>` | Friendly transaction/data-item retrieval; gateways resolve bundled items and manifests: [Fetch Data](https://docs.ar.io/build/access/fetch-data). | May apply content type, manifest/path handling, redirects, and browser sandbox behavior. Do not assume it is the most literal byte endpoint. |
| `GET https://<gateway>/raw/<transaction-or-data-item-id>` | Raw transaction or data-item payload bytes: [AR.IO data API](https://docs.ar.io/apis/ar-io-node/data), [Fetch Data — Raw Data Endpoint](https://docs.ar.io/build/access/fetch-data/#raw-data-endpoint). | Preferred input to verification and local hashing. Record status, headers, gateway, redirect chain, length, and exact response bytes. |
| `GET https://<gateway>/tx/<transaction-id>` | L1 transaction metadata needed by the transaction verifier: [Wayfinder verification strategies](https://docs.ar.io/sdks/wayfinder/wayfinder-core/verification-strategies/). | Metadata is evidence used to verify the payload; do not substitute gateway trust headers for local cryptographic verification. |
| Arweave node HTTP API | Lower-level transaction/status/chunk interfaces: [Arweave HTTP API](https://docs.arweave.org/developers/arweave-node-server/http-api). | Useful as an independent source, but a core node is not a complete indexed bundled-data-item gateway. |

The official docs use `https://arweave.net/<id>` and other gateway examples without authentication. That demonstrates a no-login request shape, **not** an entitlement or SLA. Keep the gateway base URL in trusted configuration and append only a canonical validated ID.

## 2. Integrity: what must actually be verified

### L1 Arweave transaction

An Arweave transaction ID identifies a signed transaction; its signature commits to transaction fields including `data_root` and `data_size`. The protocol HTTP API documents transaction signing over these fields: [Arweave HTTP API](https://docs.arweave.org/developers/arweave-node-server/http-api). A strong client must:

1. obtain transaction metadata;
2. stream the candidate bytes and recompute the Arweave data root;
3. require the computed root and size to match the signed transaction fields;
4. verify the transaction signature against its owner; and
5. require the expected transaction ID.

Wayfinder documents exactly this L1 strategy—fetch `/tx/<id>`, compute the data root from the served stream, and verify the Arweave signature: [Verification Strategies](https://docs.ar.io/sdks/wayfinder/wayfinder-core/verification-strategies/). Arweave JS is the official lower-level client: [repository](https://github.com/ArweaveTeam/arweave-js), [transaction implementation](https://github.com/ArweaveTeam/arweave-js/blob/master/src/common/transactions.ts).

### ANS-104 bundled data item

A data-item ID is not an L1 transaction ID. Verify the ANS-104 data-item signature and its payload commitment/size using the expected data-item ID. Wayfinder exposes a separate data-item verification strategy rather than pretending the L1 transaction check is sufficient: [Verification Strategies](https://docs.ar.io/sdks/wayfinder/wayfinder-core/verification-strategies/). Preserve the reported root transaction ID and root path as provenance, but require item-level verification for the requested object.

### Headers are useful claims, not end-to-end proof

AR.IO gateways emit verification/trust metadata such as `X-AR-IO-Data-Id`, `X-AR-IO-Root-Transaction-Id`, digest/verification information, and `X-AR-IO-Trusted`: [Verification & Trust Headers](https://docs.ar.io/build/run-a-gateway/manage/verification-headers). `Trusted` means the **operator** configured the upstream as trusted; it is not the caller’s cryptographic verification. Record headers, but make local signature/root verification the acceptance gate.

After successful protocol verification, also store a conventional local digest such as SHA-256 for exact snapshot comparison. That digest is an application index; it does not replace Arweave’s transaction/data-item proof.

## 3. Availability, rate limits, and strict-free qualification

- AR.IO’s x402 design explicitly starts with **“Free Tier Access”** using normal rate-limit buckets; after exhaustion a gateway may return `402 Payment Required`: [x402 Payments](https://docs.ar.io/learn/gateways/x402-payments). A strict-free client must never sign/pay, provision USDC, or silently switch to paid service—record `payment_required` and fail over or defer.
- Rate limits and payment policy are operator-specific. The reviewed owner docs do not promise a universal anonymous quota, fixed limit, uptime SLA, permanent operation, or retention by any one gateway.
- `429` means that endpoint rate-limited this client. `402` means that operator offered paid continuation. `404`, timeout, DNS/TLS failure, `403`, and `5xx` are also gateway-local observations, not proof that the Arweave object does not exist.
- Self-hosting `ar-io-node` removes dependency on a public operator’s quota but still costs hardware, bandwidth, storage, and administration. Registering an operator in the AR.IO network involves operator stake: [Gateway Registry](https://docs.ar.io/learn/gateways/gateway-registry/). It is therefore not literally zero-cost infrastructure even though the software is open source.
- Uploading is out of scope and generally funded; free anonymous **reads** do not imply free permanent writes.

**Strict-free policy:** use only the anonymous bucket; set no payment wallet/credentials; do not install the x402 payment adapter; bound retries; honor `Retry-After`; cache successfully verified immutable objects; and degrade visibly when all selected gateways fail.

## 4. Gateway/operator diversity

`arweave.net` is one gateway, not the Arweave network. AR.IO’s architecture says gateways are independently operated and anyone may run one: [AR.IO Gateways](https://docs.ar.io/learn/gateways/). The on-chain registry contains gateway/operator records used for discovery: [Gateway Registry](https://docs.ar.io/learn/gateways/gateway-registry/); AR.IO also exposes its live owner portal at [gateways.ar.io](https://gateways.ar.io/). Wayfinder is the owner-supported routing and verification client for selecting among gateways: [Wayfinder repository](https://github.com/ar-io/wayfinder), [data-retrieval strategies](https://docs.ar.io/sdks/wayfinder/wayfinder-core/data-retrieval-strategies/).

Minimum production policy:

1. discover candidates from the registry through at least two independently configured discovery paths;
2. select at least two **different operator identities/domains**, not merely two hostnames behind one operator;
3. avoid permanent reliance on a single bootstrap/trusted gateway;
4. keep per-operator health, latency, `402/429`, bad-proof, and timeout statistics;
5. fetch from a second operator on transport/policy failure, and on any proof mismatch quarantine the bytes and compare independent responses;
6. cache only after successful local verification.

Diversity improves availability and detects equivocation; it does not itself prove bytes. Cryptographic verification remains mandatory.

## 5. Repository and license audit

| Repository | Role | Owner-declared license | Practical consequence |
|---|---|---|---|
| [`ArweaveTeam/arweave-js`](https://github.com/ArweaveTeam/arweave-js) | Official JS/TS protocol/gateway client | **MIT**: [package manifest](https://github.com/ArweaveTeam/arweave-js/blob/master/package.json), [license](https://github.com/ArweaveTeam/arweave-js/blob/master/LICENSE.md) | Permissive client option; pin a reviewed version. Its default retrieval behavior is not by itself a multi-operator availability guarantee. |
| [`ar-io/wayfinder`](https://github.com/ar-io/wayfinder) | Multi-gateway routing and client-side verification | **Apache-2.0**: [license](https://github.com/ar-io/wayfinder/blob/main/LICENSE), [manifest](https://github.com/ar-io/wayfinder/blob/main/package.json) | Best fit for decentralized retrieval plus protocol-aware verification. Keep payment adapters out of a strict-free build. |
| [`ar-io/ar-io-sdk`](https://github.com/ar-io/ar-io-sdk) | Registry/network SDK and gateway discovery | **Apache-2.0**: [license](https://github.com/ar-io/ar-io-sdk/blob/main/LICENSE.md), [manifest](https://github.com/ar-io/ar-io-sdk/blob/main/package.json) | Permissive discovery/control-plane client; network participation requirements are separate from software licensing. |
| [`ar-io/ar-io-node`](https://github.com/ar-io/ar-io-node) | Reference scalable gateway server | **AGPL-3.0-or-later**: [license](https://github.com/ar-io/ar-io-node/blob/develop/LICENSE), [manifest](https://github.com/ar-io/ar-io-node/blob/develop/package.json) | Network-copyleft obligations matter when modifying/deploying it; obtain compliance review before embedding or offering a modified service. |
| [`ArweaveTeam/arweave`](https://github.com/ArweaveTeam/arweave) | Official Erlang Arweave protocol/node implementation | **GPL-2.0**: [license](https://github.com/ArweaveTeam/arweave/blob/master/LICENSE.md), [README](https://github.com/ArweaveTeam/arweave/blob/master/README.md) | Core-node software is copyleft and operationally much heavier than a metadata fetch client. |

License labels describe software rights, not free hosted bandwidth, an SLA, or a waiver of third-party content rights.

## 6. SSRF and hostile-content requirements

Token metadata URIs and every nested field are attacker-controlled. For the Arweave byte stage, the safest design is **not a general URL fetcher**:

1. accept only a canonical Arweave transaction/data-item ID (base64url form, exact expected length/alphabet); reject schemes, slashes, dots, userinfo, percent escapes, query, fragment, Unicode host tricks, and whitespace;
2. choose the gateway origin from an operator allowlist/registry policy under server control; construct with a URL API, never string-interpolate an arbitrary origin;
3. use `/raw/<id>` and disable redirects, or validate every redirect hop against the same scheme/host/IP policy; AR.IO documents sandbox-subdomain redirects for browser security on friendly routes: [Fetch Data](https://docs.ar.io/build/access/fetch-data);
4. resolve and reject loopback, private, link-local, multicast, reserved, carrier-grade-NAT, and cloud-metadata destinations; pin the validated address for the connection and protect against DNS rebinding;
5. run in an isolated worker with no ambient credentials or internal-network access; never forward cookies, `Authorization`, proxy credentials, or wallet material;
6. enforce connect/read/overall deadlines, redirect count, compressed and decompressed byte caps, header limits, JSON depth/string/key limits, and media pixel limits while streaming;
7. sniff content independently of `Content-Type`; never execute/render remote HTML, SVG, XML, or scriptable media in the application origin.

OWASP’s official SSRF guidance recommends allowlisting when possible and disabling automatic redirects because redirects can bypass validation: [SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

Do **not** automatically fetch `website`, `twitter`/`x`, `telegram`, Discord, or arbitrary nested `image`/`animation_url` values in the same worker. If nested media must be fetched, route it through a separate general hostile-URL service with the full DNS/IP/redirect controls above.

## 7. Immutable bytes versus mutable pointers

| Recorded value | What can be claimed after verification | What cannot be claimed |
|---|---|---|
| Verified Arweave L1 transaction ID + bytes | These exact payload bytes satisfy the signed transaction’s data-root/size commitment. | Any one gateway will remain available; the payload is truthful, safe, or authorized. |
| Verified ANS-104 data-item ID + bytes | These exact item bytes satisfy the item’s signature/payload commitment. | The item is an L1 transaction; every gateway indexes it; future availability. |
| SHA-256 of accepted bytes | Exact local snapshot identity and later equality test. | Arweave inclusion/signature or remote availability. |
| Literal website/X/Telegram URL inside verified JSON | That exact string was immutably present in the verified JSON. | The target page/account is immutable, controlled by the token issuer, safe, live, or unchanged. |
| Ordinary `https://` metadata/media pointer | Only the pointer string and each time-stamped fetched snapshot/hash are evidence. | Stable content, non-equivocation, ownership, or permanence. |
| ArNS name | A convenient mutable name-resolution observation at a time: [AR.IO ArNS](https://docs.ar.io/learn/arns). | That future resolution is immutable. Retain the resolved transaction/data-item ID and resolution time separately. |
| Path inside a **verified immutable manifest transaction** | The verified manifest freezes its path-to-ID mapping; the mapped object can then be verified by its own ID: [AR.IO manifests](https://docs.ar.io/build/upload/manifests). | An ArNS name that currently points to that manifest is frozen, or that one gateway will keep serving the path. |

Never overwrite the raw metadata JSON or its raw link strings with normalized/final URLs. Store redirects and resolved IDs as separate observations.

## 8. Recommended strict-free pipeline

1. **Input:** preserve the original token `uri`; parse only recognized Arweave gateway URL forms and extract a canonical ID. Do not follow arbitrary HTTP pointers in this stage.
2. **Discover:** obtain healthy registered gateways, then select distinct operators. Keep two bootstrap sources and a static emergency set.
3. **Fetch:** `GET /raw/<id>` anonymously with no credentials/payment adapter; stream to bounded storage and SHA-256.
4. **Verify:** classify L1 transaction versus ANS-104 item; run the matching Wayfinder/protocol verifier; require ID, signature, size, and payload/data-root checks.
5. **Fail over:** on timeout, `402`, `429`, `403`, gateway `404`, `5xx`, or malformed response, record the event and try one other independent operator with jittered bounded backoff. Do not convert endpoint failure to global absence.
6. **Accept/cache:** only verified bytes enter the immutable cache keyed by type + Arweave ID; retain local digest, proof result, transaction/item provenance, gateway/operator, headers, times, and exact bytes.
7. **Parse safely:** parse bounded UTF-8 JSON without execution. Preserve every raw field and separate parse errors from transport/proof failures.
8. **Do not crawl socials:** render literal social/website links only as untrusted external links; any later availability probe is a separate mutable observation.

## Bottom line

Use **Wayfinder (Apache-2.0) + anonymous `/raw/<id>` requests + local protocol verification + independently operated gateway fallback**. This satisfies “no card/wallet/credits/paid trial” for the normal read path while free capacity exists. It cannot honestly be called unlimited or SLA-backed: strict-free operation must stop/fail over on `402/429`, and durable availability requires operator diversity, verified caching, or self-hosted infrastructure with real operating cost.
