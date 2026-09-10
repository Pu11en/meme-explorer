# Six-filter validation on the iMac

The six deterministic first-minute filters use Batch 001 as a test corpus, with no model training. Defaults are frozen under `analysis/filters/`; usage is in `docs/analysis/first-minute-filters.md`. The comparison page is served locally at http://localhost:4182.

## What was measured

| Case | Raw records | Observations | Elapsed | Peak RSS | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Original Batch 001 | 1,074,873 | 592 | 5m 10s | 139 MiB | Passed |
| 2× streamed replay | 2,149,746 | 1,184 | 11m 14s | 153 MiB | Passed |
| 4× streamed replay | 4,299,492 | 2,368 | 15m 32s | 171 MiB | Passed |
| 1,000 overlapping launches | 61,000 | 1,000 | 1.28s | 114 MiB | Passed |

The 2× and 4× cases namespace all replicated identities and compare every resulting observation against the original. They test volume, not independent market evidence. Batch 001 contains approximately 30 recorded minutes across four runs; synthetic volume is not a completed live one-hour recording. All measured budgets passed, including the 15-minute 2× limit, 1 GiB RSS, 60-second cached filtering, 64 KiB receipts, 1 GiB derived/temp storage and 15 GiB free-space reserve.

An independent Python source recount reconstructed ten stratified observations with zero discrepancies. A separate Python evaluator checked all 3,552 default membership decisions. The stricter new-buyer setting (five new wallets per ten-second bucket) was independently checked across all 592 observations and selects 13; the default selects 32. Desktop and mobile browser checks passed, with no page errors or external requests on load.

## Default results

| Filter | Matches |
| --- | ---: |
| Complete First-Minute Coverage | 531 |
| Minimum Buy Activity | 201 |
| Buyer Diversity | 227 |
| Repeat-Buyer Concentration | 132 |
| Buy Activity Shape — sustained | 76 |
| New Buyer Arrival Rate | 32 |

There are 61 incomplete first-minute windows, preserved as unobservable. The coverage selector explicitly rejects those windows. Repeat concentration is also undefined for 24 complete zero-buy observations. These are overlapping filter cohorts, not six disjoint populations.

## Provenance and reproducibility

The import receipt separately verifies every original file byte checksum. Source feature hash is `af7e8e94755db9b0bb0823f66c367e335ff677c0a12fc01808e6ee2d10d176f1`. Full features, cohorts, screenshots and pages remain under `/Users/drewp/Library/Application Support/MemeExplorer/analysis-six-filters`.

Benchmark `commit` fields identify the pre-implementation base commit, not a claim that its tree contains this implementation. The load reports record the candidate runtime source hashes. After the 4× run started, a regression fix made unreadable events lacking source time invalidate coverage regardless of their receipt time. That fail-closed error path is covered by the final tests; the independent reader successfully parsed the entire real corpus, so the valid-data workload is unchanged. The final installed-runtime replay receipt and semantic hash comparison record the separate check against the original data after that fix. Do not interpret the candidate benchmark hashes as the final runtime hashes.

`runtime-installation.json` identifies the installed runtime and verified file count; its runtime directory contains a complete file-hash manifest. It runs independently of this worktree. `checks.txt` records 48 passing tests. Catalog generation drift check and strict OpenSpec validation also passed.

## Live hourly compatibility remains pending

The 8 a.m. recording stopped after about 24 minutes with a recorder temporary-file stat race and an `error` manifest. Its partial data is preserved; this analyzer rejects it as an unsuccessful recording. The 1 p.m. recording had not started at the recorded compatibility check. Neither has passed a finalized live-hour smoke test. See `hourly-compatibility.json`; OpenSpec task 0.14 remains open. Recorder repair is a separate scope awaiting the user's answer.

Operational correctness and measured capacity are validated. Predictive value and later outcome analysis are not established by these checks.
