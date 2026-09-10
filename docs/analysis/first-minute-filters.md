# First-minute batch filters

These six deterministic skills select coin observations from a saved batch. They do not train a model. Every metric uses `[creation, creation + 60 seconds)`; the six ten-second buckets summarize that same minute.

| Skill ID | Default rule |
| --- | --- |
| `observable-launches` | Fully observed first minute |
| `minimum-buy-activity` | At least 10 buys |
| `buyer-diversity` | At least 5 distinct buying wallets |
| `repeat-buyer-concentration` | At least half of buys occur after a wallet's first buy |
| `launch-activity-shape` | At least one buy in every ten-second bucket |
| `new-buyer-arrival-rate` | At least one new buying wallet in every ten-second bucket |

The shape skill also supports opening-burst (at least 70% of buys in the first 20 seconds) and building (last 20 seconds have at least twice the first 20 seconds' buys, with at least one opening buy). Parameters are configurable and type checked. Algorithm version and the saved definition hash jointly identify the exact rule and parameter configuration. A changed threshold gets a different definition hash; old artifacts remain intact.

## Run a batch

Build with `pnpm build`, then:

```sh
pnpm analysis:batch -- --data-root '/absolute/data/root' --batch '/absolute/batch.json' --output-root '/absolute/separate-output'
```

This produces one first-minute feature result, all six default cohorts, a comparison page, and a bounded receipt pointing to the full artifacts. Output must be outside the source data tree. On this iMac, use `/Users/drewp/.hermes/node/bin/corepack pnpm` if `pnpm` is not on PATH. The package's local pnpm shim is needed by nested package scripts; `corepack enable --install-directory node_modules/.bin pnpm` installs that shim without changing global tools.

Batch 001's stable source path and original file inventory are in `planning/evidence/batch-001-imac-import/`. The finalized validation evidence and installed runtime location are in `planning/evidence/six-filter-validation/`. The installed runtime uses Node core modules and is independent of a disposable worktree.

For today's scheduled recordings, each job has its own data root and `batch.json` below `/Users/drewp/Library/Application Support/MemeExplorer/scheduled-20260908/batches/<batch-id>/`. Analyze finalized `stopped` or `interrupted` manifests with actual stop times. A running, unflushed, or `error` run is rejected. A scheduled job's mere existence does not mean its recording succeeded. Check `job-status.json` first.

## Reuse the saved feature result

Changing a filter does not require rescanning raw recordings:

```sh
pnpm analysis:filters -- --result '/absolute/features.json' --all --output-root '/absolute/output'
pnpm analysis:filters -- --result '/absolute/features.json' --filter new-buyer-arrival-rate --parameters '{"min_new_buyers_per_bucket":5}' --output-root '/absolute/output'
pnpm analysis:filters -- --result '/absolute/features.json' --definition '/absolute/saved-definition.json' --output-root '/absolute/output'
```

The six default definition files are committed under `analysis/filters/`. Custom saved definitions support typed equality, numeric comparisons, ranges, membership, presence, ratios, shapes and `all`/`any`/`not`. Unknown values remain unknown under negation; explicit presence/status selectors can select missing observations. Expression fields come from the first-minute registry, so later outcome data cannot enter an early filter.

Generate a page from cached features, optionally including one customized cohort:

```sh
pnpm analysis:60s-page -- --result '/absolute/features.json' --cohort '/absolute/custom-cohort.json' --output '/absolute/site/index.html'
pnpm analysis:serve -- --page '/absolute/site/index.html' --port 4182
```

Choose an unused local port. The page shows one filter at a time, 50 table rows per page, up to eight selected chart traces, membership/exclusion counts, source lineage and rule parameters. It makes no network requests on load; coin links are explicit optional exits. The page limit is 16 MiB of derived data.

## Interpretation and evidence

- Each wallet contributes one arrival at its earliest qualifying source-time buy for that coin/run; repeat buys do not add arrivals. Different wallets need not mean different people.
- Incomplete windows are not zero. Identity-dependent metrics remain unavailable when a buy lacks a wallet; other observable metrics can still be used.
- Repeat concentration is `(buys - distinct buyers) / buys`. Zero buys makes this ratio undefined. It is not the largest wallet's share.
- Source manifests, raw files and reliability evidence are fingerprinted. NDJSON fingerprints use LF-terminated logical lines; the original handoff additionally preserves byte-level file checksums. Two streamed raw passes detect changed recording content.
- Canonical event identity includes coin/run, signature or provider event ID, and instruction/event discriminator (or breakdown position). Conflicting counted facts and missing identities are quality failures. Never deduplicate distinct instructions solely by transaction signature.
- Retained state is guarded at 100,000 launch observations and 500,000 in-window event identities per run. Larger inputs fail visibly rather than silently truncating. Tested hourly-volume capacity is documented in the benchmark evidence, not a guarantee for arbitrary traffic.
- Operational validation establishes counts, reproducibility and measured load capacity. It does not establish predictive value or profit.

`pnpm check` covers the legacy analyzer and new contracts/filter/CLI behavior. `pnpm analysis:catalog-check` detects drift among runtime definitions, committed defaults, the catalog, and generated skill files. `scripts/analysis/` contains independent recount, cohort-oracle, load, concurrency, browser and installation checks. Synthetic replay namespaces identities and is never counted as additional market evidence.
