# PumpAPI hourly replay as a distinct backfill capability

**Point-in-time audit:** 2026-08-26, with the principal listing probe at 11:30 UTC  
**Scope:** PumpAPI owner documentation, owner-operated API/archive endpoints, PumpAPI terms, and owner repositories/docs for alternatives. No secondary source is used as authority.  
**Question:** Whether PumpAPI Historical Replay is a distinct, usable hourly backfill lane—not whether the live WebSocket is generally useful.

## Executive finding

**PumpAPI Historical Replay is a real, distinct, currently anonymous hourly backfill capability, but only for completed UTC hours and only on a best-effort basis.** It is not an immediate reconnect buffer, a gap-free archive, an SLA, or a licensed redistributable dataset.

At 2026-08-26 11:30 UTC, the no-key owner listing reported **3,130** compressed hourly objects totaling **1,217,634,993,299 bytes** (1.218 TB decimal; about 1.107 TiB), from `2026/04/18/00.jsonl.zst` through `2026/08/26/10.jsonl.zst`. Exactly one expected key in that closed-hour interval was absent: `2026/05/09/19.jsonl.zst`, which also returned HTTP 404. Most files appeared quickly after the hour closed, but the observed worst delay was more than seven hours. Thus replay can repair many older live gaps but cannot guarantee recovery, and it cannot repair a current-hour disconnect until that hour is closed and published.

The owner currently labels Historical Replay **FREE**, and the FAQ says PumpAPI works without signup or an API key. That establishes the current access price and credential posture, not permanence, redistribution rights, completeness, or operational guarantees. [Fees](https://pumpapi.io/fees) · [FAQ](https://pumpapi.io/FAQ) · [Terms](https://pumpapi.io/legal)

## Evidence standard and probe restraint

- Documentation claims are labeled as such; endpoint observations are point-in-time facts only.
- Listing requests were bounded and small. The year listing was **278,644 bytes**.
- Object presence and missing-object checks used `HEAD` where possible.
- **Probe incident:** one attempted `Range: bytes=0-63` request was not safe because the archive server ignored the Range header, returned HTTP 200, and transferred the full **482,224,992-byte** `2026/08/26/06` object. The temporary object was deleted and no further archive-object GETs were made. This is itself evidence that callers must not rely on byte ranges to control transfer size.
- No bulk archive corpus was downloaded, retained, or checksummed.

## Date/cutoff discipline

The runtime clock and owner/CDN headers were already on **2026-08-26**, so the target date was not wholly in the future. The audit was nevertheless conducted at about 11:30 UTC, while the UTC day was still open. Only `/00`–`/10` existed then; `/11`–`/23`, the final daily byte count, and any later same-day deletion, replacement, gap, or delayed publication were still future/unknown and are not projected in this report. All findings are therefore “observed by 2026-08-26 11:30 UTC,” not an end-of-day claim.

The official machine-readable documentation snapshot is also available at [PumpAPI full docs for language models](https://pumpapi.io/llms-full.txt).

## 1. Archive contract and listings

PumpAPI says that, starting **2026-04-18**, it saves everything emitted by its Data Stream every hour into zstandard-compressed JSON Lines at:

```text
https://replay.pumpapi.io/YEAR/MONTH/DAY/HOUR.jsonl.zst
```

It documents browser-readable year, month, and day prefixes and supplies replay examples in Python, JavaScript, Rust, and Go. Each decompressed line is one JSON event. [Historical Replay](https://pumpapi.io/historical-replay)

The owner listing endpoint currently returns JSON shaped as:

```json
{
  "files": [{"key": "2026/04/18/00.jsonl.zst", "size": 353992862, "uploaded": "2026-04-18T01:00:21.785Z"}],
  "total_files": 3130,
  "total_size": 1217634993299
}
```

Exact owner endpoints:

- [2026 year listing](https://replay.pumpapi.io/2026/)
- [Example day listing](https://replay.pumpapi.io/2026/08/26/)
- [First listed day](https://replay.pumpapi.io/2026/04/18/)
- [Known missing object](https://replay.pumpapi.io/2026/05/09/19.jsonl.zst)

### Listing census at 2026-08-26 11:30 UTC

| Measure | Observation |
|---|---:|
| Objects | 3,130 |
| First key | `2026/04/18/00.jsonl.zst` |
| Latest key | `2026/08/26/10.jsonl.zst` |
| Total compressed bytes | 1,217,634,993,299 |
| Duplicate keys | 0 |
| Missing expected closed hours | 1: `2026/05/09/19` |
| Smallest file | 222,625,226 bytes |
| Median file | 379,408,276 bytes |
| Mean file | 389,020,765 bytes (rounded) |
| Largest file | 642,195,388 bytes |

PumpAPI's documentation estimates approximately **400 MB compressed per hour**, **2 GB decompressed in memory**, and about one second to decompress an hour. The listing confirms the compressed estimate as an order of magnitude, not a cap. [Historical Replay](https://pumpapi.io/historical-replay)

**Retention finding:** the first advertised hour remained listed about 130 days after launch, but PumpAPI publishes no minimum retention period, deletion policy, durability commitment, or archival SLA. The observed oldest key is not a promised retention floor. [Historical Replay](https://pumpapi.io/historical-replay) · [Terms](https://pumpapi.io/legal)

## 2. Hour naming and publication delay

### The documentation example is internally inconsistent

The replay page says a file is named after the UTC hour it covers, but then says events from `00:00` to `01:00` live in `/01.jsonl.zst`. The listing and a bounded launch-day sample instead support **start-hour naming**:

- `/2026/04/18/00.jsonl.zst` was uploaded at `01:00:21.785Z`.
- Its sampled first replay receipt time was `2026-04-18T00:00:00.276Z`.
- `/01` begins with 01:xx receipt-time events.

Operationally, treat `/HH` as covering provider receipt times in `[HH:00, HH+1:00)`, but contract-test this assumption because the owner page's prose/example conflict remains. [Historical Replay](https://pumpapi.io/historical-replay) · [00 object](https://replay.pumpapi.io/2026/04/18/00.jsonl.zst) · [01 object](https://replay.pumpapi.io/2026/04/18/01.jsonl.zst)

### Observed upload lag after hour end

The listing's `uploaded` value minus the end of the key's start hour produced:

| Lag metric | Observed value |
|---|---:|
| Minimum | 10.293 s |
| Median | 26.071 s |
| 95th percentile | 59.420 s |
| Maximum | 25,933.931 s (7 h 12 m 13.931 s) |
| Over 60 s | 154 files |
| Over 120 s | 24 files |
| At least 300 s | 11 files |

The maximum was `2026/08/12/06`, uploaded at `2026-08-12T14:12:13.931Z`. Four consecutive Aug. 12 hours (`06`–`09`) were uploaded together around 14:12, consistent with delayed publication or backfill. The current audit day's `/00`–`/10` files were much more regular, appearing 21–39 seconds after close.

**Interpretation:** typical publication was under a minute, but consumers must not encode that as an SLA or hard timeout. A closed hour may be delayed for hours, and a missing hour may remain absent.

## 3. Missing hours and completeness

From the first key through the latest completed key, 3,131 hourly positions were possible and 3,130 existed. The sole absent key was:

```text
https://replay.pumpapi.io/2026/05/09/19.jsonl.zst  -> HTTP 404
```

The [2026-05-09 day listing](https://replay.pumpapi.io/2026/05/09/) contained 23 objects and skipped directly from `/18` to `/20`. Empty owner listings at [the 2025 prefix](https://replay.pumpapi.io/2025/) and [2026-04-17](https://replay.pumpapi.io/2026/04/17/) are consistent with the documented 2026-04-18 start.

This directly disproves a literal, observed interpretation of “save everything ... every hour.” The phrase is an owner product claim, not evidence of gap-free delivery. There is no owner-published gap manifest, correction log, completeness metric, or repair promise. [Historical Replay](https://pumpapi.io/historical-replay) · [missing object](https://replay.pumpapi.io/2026/05/09/19.jsonl.zst)

A production downloader should distinguish at least:

1. hour not closed yet;
2. closed but within a publication grace period;
3. delayed publication;
4. confirmed 404/missing;
5. transport/server failure;
6. downloaded but locally invalid/corrupt.

Do not silently treat a 404 as an empty hour.

## 4. Schema eras and compatibility

PumpAPI does not publish a versioned replay schema, schema registry, changelog, compatibility policy, or exact migration boundary. Only two practical families could be established without bulk sampling:

| Era/family | Evidence | Handling |
|---|---|---|
| Launch/legacy replay | A bounded launch-day sample used `txType`; legacy amount/reserve naming included SOL-specific fields. Replay also included `localTimestamp`. | Accept legacy aliases and preserve raw JSON. Exact first/last hour of this family is unknown. |
| Current documented live family | Current stream examples use `action`, `quoteAmount`, `quoteInPool`, `marketCapQuote`, and `quoteMint`, supporting non-SOL quote assets and multiple pool families. | Treat fields as event-specific and optional; allow unknown additions. [Data Stream](https://pumpapi.io/stream) |

The replay page says archives are the “exact same format” as live, but later states that replay has an extra `localTimestamp` that **does not exist** live. Literal schema identity is therefore false even in the owner documentation. `localTimestamp` is described as the time PumpAPI's replay server in Frankfurt received the transaction, while event `timestamp` is a different field. [Historical Replay](https://pumpapi.io/historical-replay)

Unknowns that remain:

- exact hour at which `txType` changed to `action`;
- whether an hour can contain mixed schema families;
- field type/nullability guarantees;
- whether old files are ever rewritten into a newer schema;
- ordering guarantees inside a file;
- duplicate semantics, rollback/finality semantics, and whether every live event class is archived without loss.

## 5. Checksums and object-transfer behavior

The owner year listing exposes only `key`, `size`, and `uploaded`. Sampled object `HEAD` responses exposed no `Content-Length`, `ETag`, `Last-Modified`, `Digest`, checksum field, or `Accept-Ranges`. Plausible owner-hosted sidecars `https://replay.pumpapi.io/2026/08/26/10.jsonl.zst.sha256`, `https://replay.pumpapi.io/2026/08/26/checksums.txt`, and `https://replay.pumpapi.io/2026/checksums.txt` each returned 404. No checksum manifest or signing key was found in PumpAPI owner documentation.

Consequences:

- Listing `size` is currently the only owner-exposed byte-count expectation.
- A client can compute a local SHA-256 after download, but without an owner-published digest that detects local changes only; it does not authenticate the archive.
- Validate zstd decoding, JSONL framing, expected byte count, hour boundaries, and record-level required identifiers before committing an hour.
- Write to a temporary path, fsync if durability matters, then atomically rename; retain provenance (`URL`, listing `uploaded`, expected size, fetch time, local hash, parser version).

### Range/resume warning

A request for bytes `0-63` on [the 2026-08-26 06 object](https://replay.pumpapi.io/2026/08/26/06.jsonl.zst) returned **HTTP 200**, not 206, with `Content-Length: 482224992`, and transferred the whole object. Therefore:

- do not use Range as a “tiny probe” against replay objects;
- do not assume resumable downloads;
- use listing metadata and `HEAD` for presence probes;
- budget every object GET as a full transfer unless PumpAPI later documents and demonstrates range support.

## 6. Live/replay overlap: what backfill can and cannot repair

The live endpoint is `wss://stream.pumpapi.io/`. Owner docs say it sends all event classes, requires one reused connection, and may disconnect; automatic reconnect is required. There is no documented live cursor, resume token, sequence number, replay-on-connect, exactly-once guarantee, ordering guarantee, or finality contract. [Data Stream](https://pumpapi.io/stream) · [FAQ](https://pumpapi.io/FAQ)

Replay is therefore a **separate eventual backfill plane**:

- **Current-hour gap:** not immediately repairable from hourly replay. Wait until the hour closes and appears, normally tens of seconds later but occasionally hours later.
- **Closed-hour gap:** potentially repairable if the object exists.
- **Known missing hour:** not repairable through PumpAPI replay at the audited endpoint.
- **Overlap:** expected when a client records live events and later ingests the corresponding hour. Deduplicate rather than append blindly.

Owner examples include `signature`, `action`, `pool`/`poolId`, `block`, and `timestamp`, but PumpAPI does not define a canonical event ID. A conservative dedupe key should begin with transaction signature and include event discriminator/pool/mint when one transaction can yield multiple logical records; preserve collisions for review rather than dropping data silently. Use replay-only `localTimestamp` for provider receipt-hour placement, not as proof of chain execution time or finality. [Data Stream](https://pumpapi.io/stream) · [Historical Replay](https://pumpapi.io/historical-replay)

Recommended hour state machine:

```text
LIVE_OPEN -> HOUR_CLOSED_WAITING -> LISTED -> DOWNLOADING -> VALIDATED -> MERGED
                                  -> DELAYED
                                  -> MISSING_CONFIRMED
```

Reconcile important records to finalized Solana data independently; PumpAPI's Terms disclaim accuracy and availability. [Terms](https://pumpapi.io/legal)

## 7. Official downloader options

The replay page provides owner-authored “last N hours” examples for:

- **Python:** `aiohttp`, `zstandard`, optional `orjson`;
- **JavaScript:** `fetch`, `@oneidentity/zstd-js`;
- **Rust:** `reqwest`, `zstd`, `chrono`, `tokio`, `serde_json`;
- **Go:** `net/http`, `klauspost/compress/zstd`.

All four examples calculate completed UTC hours, recognize 404, and expose an `ALLOW_GAPS` choice. However, the published examples buffer each compressed object fully (`read`, `arrayBuffer`, `bytes`, or `io.ReadAll`), and several also materialize the decompressed content. They are examples, not production downloaders. The owner docs do not provide an official CLI, resumable downloader, concurrency/rate limit, retry/backoff policy, cache format, checksum verification, or retention mirror. [Historical Replay](https://pumpapi.io/historical-replay)

A separate author-owned project, [`Solana-Trading-Lab/replayer-rust`](https://github.com/Solana-Trading-Lab/replayer-rust), is PumpAPI-specific and stream-decompresses archives into bounded-window token tapes. Its manifest declares `MIT OR Apache-2.0`, but the repository has no license text, no CI, and no independent data source; it remains a PumpAPI downloader, not an archive alternative. Treat the license declaration cautiously. [Pinned README](https://raw.githubusercontent.com/Solana-Trading-Lab/replayer-rust/06b8f062213b8d18e4c8261281f8b1c2c3c1fd05/README.md) · [Pinned Cargo manifest](https://raw.githubusercontent.com/Solana-Trading-Lab/replayer-rust/06b8f062213b8d18e4c8261281f8b1c2c3c1fd05/Cargo.toml)

## 8. Access, retention, and legal terms

PumpAPI's owner pages establish:

- Historical Replay is currently listed as **FREE**. [Fees](https://pumpapi.io/fees)
- PumpAPI says no account, signup, or API key is required. [FAQ](https://pumpapi.io/FAQ)
- Terms were last updated **2025-12-27** and apply by accessing or using the service. [Terms](https://pumpapi.io/legal)
- Users are responsible for legal/regulatory and sanctions compliance.
- Service is “as is” and “as available,” including no warranty of accuracy or availability.
- PumpAPI disclaims liability for bugs, outages, and errors and may modify, suspend, or discontinue the service at any time without liability.
- PumpAPI says it is not affiliated with pump.fun, Raydium, PumpSwap, or other third-party protocols.

No official PumpAPI source repository is linked from the reviewed owner site, full-docs text, or documentation. The GitHub links present there are dependencies/examples rather than PumpAPI server source, so the server implementation and any source-code license are unknown.

Not found in the reviewed owner terms/docs:

- an archive-data copyright or database license;
- an explicit right to retain indefinitely, redistribute, resell, sublicense, or publish a mirror;
- a bulk-download allowance or rate-limit contract;
- a minimum retention period;
- an uptime, completeness, durability, support, or recovery SLA;
- a promise that “FREE” will remain free.

Accordingly, anonymous zero-price access is **not** a data-redistribution license. Obtain written clarification from `hello@pumpapi.io` before redistributing or commercializing a retained corpus. This is a risk finding, not legal advice. [Terms](https://pumpapi.io/legal)

## 9. Safe no-key probes

These probes reveal availability/listing metadata without intentionally fetching archive bodies:

```bash
# Documentation and listing reachability
curl -sSIL https://pumpapi.io/historical-replay
curl -sSIL https://replay.pumpapi.io/2026/08/26/

# Existing/missing object presence only
curl -sSIL https://replay.pumpapi.io/2026/08/26/10.jsonl.zst
curl -sSIL https://replay.pumpapi.io/2026/05/09/19.jsonl.zst

# Tiny listing, hard-capped locally; inspect keys/sizes/upload times
curl -fsS --max-time 20 --max-filesize 1000000 \
  https://replay.pumpapi.io/2026/08/26/
```

Do **not** probe an object with `Range`; it was ignored in this audit. Do not use `curl -O`, `wget`, or an example replay script unless a full hundreds-of-megabytes transfer is intended and budgeted.

## 10. Licensed, buildable, free independent alternative

### Yellowstone Old Faithful / `faithful-cli`

The strongest owner-sourced independent alternative found is Triton One's [Yellowstone Old Faithful](https://github.com/rpcpool/yellowstone-faithful), pinned here at [`a69a0d2`](https://github.com/rpcpool/yellowstone-faithful/commit/a69a0d2e189006608e3b73b7659a957b00b3567e).

Why it qualifies at the **software/archive-access** level:

- The owner describes it as a self-hostable, decentralized Solana history archive intended to replace the Bigtable dependency for historical access. `faithful-cli` can read local copies, `old-faithful.net`, or Filecoin and serve `getBlock`, `getTransaction`, `getSignaturesForAddress`, `getBlockTime`, and `getBlocks`. [Pinned README](https://raw.githubusercontent.com/rpcpool/yellowstone-faithful/a69a0d2e189006608e3b73b7659a957b00b3567e/README.md)
- It ships the full **GNU AGPL-3.0** license. Modified network deployments must account for AGPL source-availability obligations. [Pinned LICENSE](https://raw.githubusercontent.com/rpcpool/yellowstone-faithful/a69a0d2e189006608e3b73b7659a957b00b3567e/LICENSE)
- Its Makefile's default `compile` target runs `go build ... -o ./bin/faithful-cli .`; the build recipe is owner-published, though this audit did not compile it. [Pinned Makefile](https://raw.githubusercontent.com/rpcpool/yellowstone-faithful/a69a0d2e189006608e3b73b7659a957b00b3567e/Makefile) · [Pinned `go.mod`](https://raw.githubusercontent.com/rpcpool/yellowstone-faithful/a69a0d2e189006608e3b73b7659a957b00b3567e/go.mod)
- Triton's owner docs say its complete OF1 copy is **currently completely free to use**. [Sourcing Data](https://docs.old-faithful.net/running-old-faithful/sourcing-data) · [OF1 files](https://docs.old-faithful.net/references/of1-files)

Why it is not a drop-in PumpAPI replacement:

- It archives raw Solana history by epoch, not PumpAPI-derived hourly JSONL.
- A consumer must map block times to UTC hours, select Pump/PumpSwap program transactions, and decode events against owner-published program interfaces.
- The owner README explicitly calls the project **RFC-stage, not intended for production**, with possible breaking changes.
- Epoch data/indexes can be large, and no explicit dataset redistribution license was found in the reviewed archive-access docs. “Completely free to use” is a current access statement, not necessarily a copyright/database license or permanent price guarantee.

**Verdict:** Old Faithful is a licensed, buildable, independently operated free-access replay/archive foundation, but adopting it requires a Pump-specific decoder and hourly export layer. It is valuable as an escape hatch for PumpAPI missing hours and provider independence, not as a schema-compatible replacement.

## 11. Production decision

Use PumpAPI hourly replay only if all of these are acceptable:

1. Backfill is eventual at hour granularity, not immediate reconnect replay.
2. One observed historical hour is unrecoverable from PumpAPI itself.
3. Full-object transfers are hundreds of MB and not safely range-resumable.
4. Schemas are unversioned and have at least legacy/current naming families.
5. No owner checksum, retention promise, completeness SLA, or redistribution grant exists.
6. The application persists raw JSON, records provenance/local hashes, tolerates aliases/additions, and deduplicates live/replay overlap.
7. A provider-independent recovery path—such as Old Faithful plus Pump/PumpSwap decoding—exists for critical records.

**Bottom line:** accept PumpAPI replay as a useful, zero-listed-price **best-effort hourly backfill input**, not as the sole canonical archive or a legally cleared dataset for redistribution.
