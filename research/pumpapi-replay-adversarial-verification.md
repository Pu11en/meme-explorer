# PumpAPI replay adversarial verification

**Audited:** 2026-08-26 11:30–11:54 UTC  
**Decision:** Candidate only for best-effort closed-hour backfill. It is not a local live recorder, an independent data source, a completeness guarantee, or a licensed redistributable archive.

## Corrections that matter

- **Distinct value over PumpAPI live:** Historical Replay adds only eventual access to prior closed-hour copies and the replay-only `localTimestamp` receipt field. It does not establish a distinct event universe or independent corroboration because PumpAPI says it archives its own Data Stream. [Replay](https://pumpapi.io/historical-replay) · [Stream](https://pumpapi.io/stream)
- **Current access:** PumpAPI currently lists Data Stream and Historical Replay as FREE and says no signup/API key is required. That is a current zero-provider-fee access claim, not a permanent entitlement, SLA, or redistribution license. [Fees](https://pumpapi.io/fees) · [FAQ](https://pumpapi.io/FAQ) · [Terms](https://pumpapi.io/legal)
- **Fresh census:** A browser-user-agent request at 11:54 UTC returned 3,130 objects and 1,217,634,993,299 compressed bytes, from `2026/04/18/00` through `2026/08/26/10`. `2026/05/09/19` remained absent.
- **Repeated probe semantics:** Three bounded rounds produced the same result: Python-urllib user agent got 403 for listing, existing object, and missing object; browser-like user agent got 200 for listing and existing-object HEAD, and 404 for the missing object. Thus 403 is access/client-policy failure, while 404 alone is ambiguous: it can mean pre-start, not yet published, permanently missing, or invalid/future key. PumpAPI's `ALLOW_GAPS` examples define client behavior, not a server guarantee that every 404 is a permanent historical gap. [Replay](https://pumpapi.io/historical-replay)
- **HEAD is not integrity:** Existing-object HEAD returned 200 with `application/x-ndjson`, no content length, and no body. This proves route reachability only. A downloader must not reject that observed MIME merely because the body is zstd-compressed, and must validate a complete GET separately.
- **Completeness/reliability:** One historical hour is demonstrably absent; upload metadata has a multi-hour tail; no owner SLA, checksum, manifest, sequence, cursor, ordering, duplicate, finality, correction, or retention contract was found. [Replay listing](https://replay.pumpapi.io/2026/) · [Terms](https://pumpapi.io/legal)
- **Schema:** Replay is not literally schema-identical to live because the owner documents replay-only `localTimestamp`; bounded evidence also found legacy `txType` versus current `action`. No version/compatibility policy or exact transition boundary is published. [Replay](https://pumpapi.io/historical-replay) · [Stream](https://pumpapi.io/stream)
- **Terms:** PumpAPI supplies the service “as is” and “as available,” disclaims accuracy/availability and outage/error liability, and may change, suspend, or discontinue it. The reviewed terms contain no explicit archive-data redistribution grant. [Terms](https://pumpapi.io/legal)

## Strict-free alternative screen

- `Solana-Trading-Lab/replayer-rust` is only a PumpAPI downloader/filter. It adds no independent data and lacks committed license texts/CI at the pinned audit revision.
- `Solana-Trading-Lab/pump.fun.meter` is not an acceptable recorder: its current package does not install, it has no tests/CI, and its folder-open custom-registry task is a supply-chain risk. Trading paths also require wallet funds/fees.
- `shaurya35/solana-realtime-indexer` is a real MIT local capture/replay implementation, but only records from adoption onward; restart resume and reorg handling are not implemented, and live acquisition depends on external RPC/gRPC credentials/services. It is not a strict-free historical substitute.
- `rpcpool/yellowstone-grpc` is validator-side AGPL infrastructure with a bounded recent-slot replay buffer, not a hosted durable archive.
- `rpcpool/yellowstone-faithful` / Old Faithful is the strongest independent raw-Solana archive escape hatch found: owner docs currently call its archive free to use and the code ships AGPL-3.0. It is RFC-stage, raw-chain rather than PumpAPI-derived, operationally heavy, and requires Pump/PumpSwap decoding; it is not a schema-compatible turnkey replacement. [Repository](https://github.com/rpcpool/yellowstone-faithful) · [Sourcing data](https://docs.old-faithful.net/running-old-faithful/sourcing-data)

## Repeated acceptance probes

1. Poll listing metadata after every UTC hour for at least 30 days; distinguish open, grace, delayed, listed, later removed/mutated, and unresolved 404 states.
2. Repeat with the actual downloader user agent; record 403/404/429/5xx, redirects, timeouts, retry headers, content type, and body-size behavior.
3. Capture a full live hour, then compare its closed-hour replay by signature plus event discriminator after normalizing only documented replay differences. Report both directions, duplicates, payload conflicts, and finalized-chain reconciliation.
4. Fully download a small stratified set under hard budgets; verify listing byte count, zstd integrity, JSONL validity, hour bounds, duplicate records, decompression ratio, and local SHA-256; refetch later to test mutation.
5. Exercise atomic temp-file commit and recovery from truncation, disk exhaustion, parser exceptions, malformed JSON, decompression bombs, and process restart.
