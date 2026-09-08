# Free token-metadata fetch pipeline audit

**Cutoff:** 2026-08-26 UTC. **Rule:** no card, funded wallet, usage credits/CUs, paid trial, or undocumented scraping. Primary/owner sources only. “Free” excludes hosted-service charges but not the operator’s hardware, bandwidth, and storage.

## Verdict

A verifier-first, strict-free pipeline is feasible for **integrity and safe failure**, but not for guaranteed production availability. Public Solana RPC, public IPFS gateways, and public AR.IO gateways are best-effort/no-SLA or operator-limited. The honest classification is **not reliably solvable for free** if “robust” means contractual availability. The strongest no-payment design is:

1. read the Metaplex account with Solana’s documented public JSON-RPC `getAccountInfo`;
2. derive and validate the metadata PDA, program owner, embedded mint, slot/commitment, update authority, and `isMutable`;
3. normalize only `ipfs://` and `ar://` (plus explicitly recognized gateway URL forms) into canonical identifiers;
4. retrieve IPFS through local Kubo and `@helia/verified-fetch`/trustless gateways, verifying every CID-linked block and the requested DAG traversal;
5. retrieve Arweave through Wayfinder from independently operated gateways, requiring L1 transaction signature/data-root verification or ANS-104 item verification;
6. cache exact verified bytes locally with SHA-256 and provenance;
7. quarantine ordinary HTTP(S), ArNS, IPNS/DNSLink, websites, and social links as mutable observations, not token identity.

## Documented endpoints

- **Solana account source:** `POST https://api.mainnet.solana.com` with [`getAccountInfo`](https://solana.com/docs/rpc/http/getaccountinfo). The owner [clusters page](https://solana.com/docs/references/clusters) documents this public endpoint, its rate limits, 403/429 behavior, and that public RPC is unsuitable for production.
- **Arweave/AR.IO:** `GET https://<gateway>/raw/<transaction-or-data-item-id>` for raw bytes; `GET https://<gateway>/<id>` for friendly/manifest-aware retrieval; and `GET https://<gateway>/tx/<transaction-id>` for L1 verification metadata. Sources: [AR.IO Fetch Data](https://docs.ar.io/build/access/fetch-data), [AR.IO data API](https://docs.ar.io/apis/ar-io-node/data), and [Arweave HTTP API](https://docs.arweave.org/developers/arweave-node-server/http-api).
- **IPFS trustless gateway:** `GET /ipfs/{cid}` with `Accept: application/vnd.ipld.raw` or `format=raw` for a block, and `Accept: application/vnd.ipld.car` plus the specified `dag-scope`/`entity-bytes` parameters for verifiable CAR retrieval. Source: [Trustless Gateway Specification](https://specs.ipfs.tech/http-gateways/trustless-gateway/).
- **Local Kubo:** the read gateway normally listens on loopback port 8080 and the admin RPC on loopback port 5001. Kubo’s official docs say never expose the RPC API publicly: [Kubo RPC API](https://docs.ipfs.tech/reference/kubo/rpc/), [command-line quick start](https://docs.ipfs.tech/how-to/command-line-quick-start/).
- **Metaplex DAS:** methods such as `getAsset` require a caller-supplied DAS-capable RPC endpoint; Metaplex does not provide a strict-free capacity entitlement merely by documenting the method. Use raw account reads under this audit’s rule: [DAS Get Asset](https://developers.metaplex.com/das-api/core-extension/methods/get-asset).

## Integrity and mutability

- **IPFS:** a CID is content-addressed. A verified fetch proves each returned block’s multihash and the DAG path rooted at the requested CID. It does not prove availability, pinning, truthfulness, authorization, or safety. `/ipns/` and DNSLink are mutable naming layers; retain the resolved CID and resolution time separately. Public gateway `404` means unavailable from that gateway at that time, not globally missing. Normative response semantics: [Path Gateway specification](https://specs.ipfs.tech/http-gateways/path-gateway/#response-status-codes).
- **Arweave L1:** the transaction signature commits to `data_root` and `data_size`; recompute the root/size from streamed bytes, verify signature/owner, and require the expected ID. **ANS-104 data items require item-level signature/payload verification**, not an L1-only check. Do not trust HTTP 200 or `X-AR-IO-Trusted` alone. Sources: [Wayfinder verification strategies](https://docs.ar.io/sdks/wayfinder/wayfinder-core/verification-strategies/), [client-side verification](https://docs.ar.io/learn/verification/client-side-verification).
- **Metaplex:** validate PDA derivation, account owner, embedded mint, and decoder version. Persist RPC URL, request ID, context slot, commitment, full account bytes/hash, update authority, and `isMutable`. An `isMutable=true` account can change its URI; an immutable account freezes the URI string but does not freeze bytes at an ordinary HTTPS origin. Metaplex’s update guide requires a mutable token for updates: [update metadata](https://developers.metaplex.com/tokens/update-token).
- **Creators/collections/socials:** a Metaplex creator `verified` flag or verified collection is an on-chain relation, not proof of a human identity, website, X/Telegram/Discord account, or legal authorization. A verified Arweave/IPFS JSON object proves only that the literal link string is present. Ordinary HTTPS resources and social accounts remain mutable.

## Availability, limits, and diversity

- Solana’s public endpoint publishes 100 requests/10 seconds/IP, 40 requests/10 seconds/IP for one RPC method, 40 concurrent connections, 40 connection attempts/10 seconds, and 100 MB/30 seconds; limits may change and 403/429 are documented. It is not a production SLA.
- IPFS Foundation public utilities are [best-effort](https://docs.ipfs.tech/concepts/public-utilities/). Owner guidance says public gateways have no SLA/support and shared rate limits that may throttle or block traffic: [self-hosted replacement guide](https://docs.ipfs.tech/how-to/replace-public-gateways-with-self-hosted-ipfs/). Local Kubo removes hosted quota but not retrieval, hardware, storage, or operating cost.
- AR.IO gateway operators choose policy. [x402 documentation](https://docs.ar.io/learn/gateways/x402-payments) explicitly permits a free rate-limit bucket followed by HTTP 402. A strict-free client must never pay: classify `402`, fail over, and stop/defer when no free gateway succeeds. No universal anonymous quota or uptime SLA was found.
- For AR.IO, discover registered gateways and require different operator identities/domains, not merely hostnames: [gateway registry](https://docs.ar.io/learn/gateways/gateway-registry/), [Wayfinder](https://github.com/ar-io/wayfinder).
- For IPFS, local Kubo is one independent retrieval path; add at least two conformant trustless gateways owned by different operators. `ipfs.io`, `dweb.link`, and related public domains must not automatically be counted as independent operators. Test conformance and operator ownership at deployment time.
- For Solana, the strict no-credit/no-key rule leaves the Solana-operated public endpoint without a documented free production-grade independent RPC quorum. This is the largest remaining trust/availability bottleneck.

## Security/SSRF requirements

1. Treat the token URI, redirect targets, JSON, media, and every nested URL as attacker input.
2. Parse CIDs and Arweave IDs with protocol libraries; never pass arbitrary hosts from metadata. Gateway origins come only from trusted configuration/registry policy.
3. Prefer raw/trustless endpoints and disable redirects. If redirects are needed, revalidate every hop and reject loopback, private, link-local, multicast, reserved, carrier-grade-NAT, and cloud-metadata ranges for IPv4 and IPv6; defend against DNS rebinding.
4. Never expose Kubo’s admin RPC to the Internet. Bind it to loopback/firewall it; expose only a deliberately configured read gateway if needed.
5. Use an isolated, credential-free worker; send no cookies, authorization headers, proxy secrets, wallet material, or cloud credentials.
6. Enforce connect/read/overall deadlines; request, redirect, header, compressed/decompressed byte, JSON depth/key/string, media pixel/frame, and concurrency caps. Stream and hash rather than buffering unbounded bodies.
7. Sniff content independently of `Content-Type`; never execute/render remote HTML, SVG, XML, or scriptable media in the application origin.
8. Do not crawl social links. Store literal values and, if explicitly probed, record a separate time-stamped mutable observation.
9. Preserve exact failure states: invalid URI, unsupported scheme, blocked SSRF, timeout, transport/TLS/DNS error, HTTP status, too large, invalid UTF-8/JSON, proof failure, and parsed.

General control source: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## License audit

- [`ipfs/kubo`](https://github.com/ipfs/kubo): dual Apache-2.0/MIT.
- [`ipfs/helia-verified-fetch`](https://github.com/ipfs/helia-verified-fetch): package declares Apache-2.0 OR MIT.
- [`ar-io/wayfinder`](https://github.com/ar-io/wayfinder): Apache-2.0.
- [`ArweaveTeam/arweave-js`](https://github.com/ArweaveTeam/arweave-js): MIT.
- [`ar-io/ar-io-node`](https://github.com/ar-io/ar-io-node): AGPL-3.0-or-later; network-copyleft review is required for modified hosted deployments.
- [`ArweaveTeam/arweave`](https://github.com/ArweaveTeam/arweave): GPL-2.0.
- [`@metaplex-foundation/mpl-token-metadata` JS client](https://github.com/metaplex-foundation/mpl-token-metadata/tree/main/clients/js): package declares Apache-2.0; the owner README describes JS/TS clients as MIT or Apache. The Rust/program code uses the separate custom [Metaplex NFT Open Source License](https://github.com/metaplex-foundation/mpl-token-metadata/blob/main/LICENSE), including competitive-product restrictions. Do not transfer one scope’s license to the other.
- [`anza-xyz/kit`](https://github.com/anza-xyz/kit): MIT.

Licenses grant software rights; they do not grant hosted bandwidth, an uptime SLA, or rights to third-party token content.

## Strict-free exclusions

Exclude all providers whose normal path requires API credits/CUs, a key tied to metering, a card, funded wallet, paid trial, payment adapter, or undocumented frontend route. In particular, do not substitute a metered DAS/RPC free tier for raw public RPC, and never enable AR.IO x402 payment. No HTML/social scraping is part of the pipeline.
