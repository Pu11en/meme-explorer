## Context

The repository is a dependency-light TypeScript package with immutable run datasets, normalized migrations and market snapshots, locally derived candles, a versioned analysis result contract, a cataloged ten-second buy-activity skill, and a self-contained comparison page. That ten-second result remains valid legacy reference material. The new workflow uses one fixed sixty-second window while preserving the current analyzer's separation of complete zero-buy observations from unobservable windows and its bounded model-facing receipts. See `proposal.md` for motivation and the five capability specs for required behavior.

Earlier project research deliberately declined to call any early variable predictive before a later outcome, decision cutoff, leakage policy, and out-of-sample comparison existed. The design must preserve that evidence boundary. Current Batch 001 may not contain 3 hours of follow-up evidence, so a useful system must represent censored and unavailable outcomes honestly instead of manufacturing labels.

## Goals / Non-Goals

**Goals:**

- Extend the existing artifact pipeline rather than create a second analysis system.
- Make every cohort, outcome label, statistic, and dashboard value traceable to versioned source artifacts.
- Allow capability workers to build against frozen contracts with one owner per file.
- Keep raw event processing local and receipts small enough for routine Discord sessions.
- Make data coverage and interpretation limits visible at the point of use.

**Non-Goals:**

- Execute trades, issue buy/sell recommendations, optimize a live alert threshold, or claim causal/predictive validity.
- Add wallet clustering, bot attribution, opaque scoring, or model-generated arithmetic.
- Treat DEX-indexed market cap as an executable price or provider absence as proof of failure.
- Backfill facts that cannot be supported by retained source evidence.
- Introduce a frontend framework, database, hosted service, or mandatory paid provider.

## Decisions

### 1. Use a staged, immutable artifact pipeline

The workflow will operate as:

```text
recorded runs -> 60-second feature result -> cohort/filter result
                            \-> outcome facts + profile result
cohort + outcome result -> trend result -> generated dashboard
catalog ---------------------------------> Skills tab + agent skills
```

New versioned contracts will cover filter definitions, cohort results, outcome facts, outcome profiles, outcome results, trend results, and dashboard manifests. Artifacts will live below `data/analysis/<batch-id>/` in capability-specific directories and include source IDs, formula versions, parameters, timestamps, hashes where practical, and complete rows plus bounded receipts. Existing `pump.analysis-result/1` files remain valid inputs.

A file-backed pipeline was chosen over a database because the current datasets and analysis outputs are already immutable, inspectable, portable, and testable. The dashboard consumes derived artifacts only; it never receives raw envelopes.

### 2. Use a typed filter expression instead of one command per threshold

A new deterministic feature pass will summarize `[creation, creation + 60 seconds)` as totals and exactly 60 one-second bars. The window is fixed rather than configurable: Drew selected 60 seconds only, so the workflow will not add 10-second or 30-second variants. Existing ten-second artifacts remain readable by their legacy page but are incompatible with new workflow cohorts and trend results.

A filter definition will contain a schema/version, stable ID, compatible input schemas, observation cutoff, and a normalized expression tree. The operator allowlist will include numeric/string equality, range, membership, presence, and explicit time-series shapes, composed with `all`, `any`, and `not`. A field registry will define type, unit, observation time, and compatible operators, preventing arbitrary property access or string-evaluated code.

The initial catalog will expose six approachable filters over that first minute: observable launches, minimum buy activity, buyer diversity, repeat-buyer concentration, launch activity shape, and new buyer arrival rate. Each is a parameterized definition over the same engine, which keeps the library reusable without duplicating arithmetic. Missing values fail ordinary predicates and receive a reason; only explicit missing/unobservable predicates select them.

### 3. Separate outcome facts, checks, and the selected success profile

Outcome facts are observations: time-stamped quote-denominated market cap, contemporaneous quote/USD references, reconciled migration events, price or executable-quote points, route checks, depth, liquidity, and coverage intervals. Outcome checks interpret those facts under a versioned profile. The per-check state is `passed`, `failed`, `censored`, or `unavailable`; only `passed` and `failed` enter an evaluated rate.

The initial default profile will be `market-cap-at-least-usd-30k-within-3h/v1`: pass when an accepted market-cap point reaches or exceeds $30,000 from creation through `creation + 3h`. Drew selected this absolute threshold and explicitly rejected migration as the success label. The label means only that the recorded market-cap path crossed that threshold; it is not a claim that a position could be entered or exited at that valuation.

One qualifying point is sufficient. The outcome row will separately retain `first_hit_at`, peak observed USD market cap and time, qualifying-point count, plus duration-above-threshold value and quality (`exact`, `estimated`, or `unavailable`) when the observation cadence supports it. None of those persistence fields changes the binary success result.

For SOL-quoted Pump observations, v1 will calculate `market_cap_usd = market_cap_quote × sol_usd` with lossless decimal arithmetic. The SOL/USD reference must be the latest retained observation at or before the market-cap point and no more than 60 seconds old. Direct provider-reported USD market cap is retained as supplementary evidence and is not mixed into this derived series. A missing or stale conversion marks that point unavailable. Each outcome result pins the market-cap formula, quote source, USD-reference source, and freshness rule.

Migration remains an independently reported factual outcome. Executable-return profiles require a declared decision-time baseline, quote notional, fee treatment, return threshold, and horizon. Durability profiles require a later horizon, route/depth requirements, and retention terms. Neither result replaces the $30,000 market-cap success definition.

Outcome evidence adapters will read retained trade/curve market-cap facts, time-aligned SOL/USD references, normalized migrations, derived price paths, market snapshots, and reliability records. Optional three-hour follow-up collection will reuse the existing safe-fetch/raw-first pattern: save the provider response, normalize it, and record provider time, chain time/slot when present, parser version, and coverage. A failed threshold result requires verified stream/snapshot coverage through the entire three-hour horizon; an early stop or overlapping gap produces censored, while an absent usable market-cap plane produces unavailable.

### 4. Enforce leakage with observation-time metadata

Every field exposed to filtering will declare when it became knowable relative to creation. The workflow's feature cutoff is fixed at 60 seconds and the overall success horizon remains three hours. A threshold hit from creation through 60 seconds still passes the overall success definition, but the trend engine marks that coin `already_successful_at_cutoff` and excludes it from prospective lift/rate denominators. The evaluator rejects any selected feature observed after the cutoff or any outcome fact after the declared horizon.

This explicit clock check was chosen over naming conventions such as `early_*`, which are easy to violate and impossible to audit mechanically. Tests will include a deliberately leaked field and require a hard failure.

### 5. Keep trend analysis descriptive and denominator-first

Trend results will show population definitions, overlap, total/evaluable/censored/unavailable counts, outcome pass rates, absolute difference, relative lift where defined, and deterministic 95% Wilson intervals. Fewer than 30 evaluable coins triggers a warning without hiding results. The engine will not produce “confidence,” “edge,” or causal labels.

Time-series comparison will align the 60 compatible one-second bars and expose per-interval, cumulative, and normalized shapes. Group aggregates will carry a contributing-row count for every interval; missing series are excluded, not zero-filled. Legacy ten-second or other formula/window versions fail closed rather than being stretched onto the first-minute series.

### 6. Evolve the comparison page into one six-tab static workbench

The existing self-contained page becomes the Coins interaction inside a generated dashboard with these tabs:

1. **Overview** — selected batch/profile, artifact lineage, headline counts, coverage, age, and warnings.
2. **Coins** — searchable table, terminal links, selected-line comparison across the first 60 seconds, metrics, outcomes, and exclusion reasons.
3. **Filters** — preset selection, typed parameters, rule composition, live preview, save/run, and cohort summary.
4. **Outcomes** — profile selector, status groups, coverage, and per-coin evidence.
5. **Trends** — cohort-versus-baseline rates, lift/intervals, shape comparison, overlap, and warnings.
6. **Skills** — catalog-backed cheat sheet and copyable natural-language invocations.

Shared state (batch, cohort, outcome profile, selected mints) will be encoded in a small browser state object and URL hash so tab navigation and refresh preserve context. The generated artifact embeds only bounded derived data needed for interaction. No request is made merely by opening it; explicit Pump.fun links are the only required network exits.

### 7. Generate the cheat sheet from the executable catalog

The catalog schema will be expanded so every metric, filter, outcome, trend, and dashboard skill carries its question, compatible inputs, parameters/defaults, outputs, required data planes, cost policy, versions, caveats, and example prompts. One generator produces the dashboard Skills tab and the project-local agent skill index. Contract tests reject missing fields and drift between catalog parameters, runtime parameters, and rendered guidance.

This avoids maintaining a hand-written cheat sheet that inevitably disagrees with the executable behavior.

### 8. Deliver the six-filter milestone before the remaining workbench

The immediate dependency path is data inventory and contracts -> first-minute analyzer -> six filter definitions -> catalog, direct commands, and a minimal comparison page -> correctness and scale evidence. The later outcome/trend/dashboard waves remain planned and do not block filter delivery. The implementation owner can complete this milestone sequentially; no worker dispatch is required or authorized by saving this plan. If a coordinated build is later requested, use the existing ownership boundaries below.

#### Six executable definitions

All six consume the same versioned 60-second feature result. `B` is deduplicated buy count and `U` is distinct identified buying wallets. Six 10-second buckets are display/shape aggregations of the 60 one-second bars, not separate feature windows. Thresholds below are initial test defaults, not calibrated signals; changing one saves a new definition version.

| Stable filter ID / name | Version 1 rule and initial parameters | Required oracle case |
|---|---|---|
| `observable-launches` / Complete First-Minute Coverage | Accept a recorded Pump launch with verified full `[0,60000ms)` coverage and readable timestamps/events. | Fully observed zero-buy launch passes; late launch or a stream gap does not. |
| `minimum-buy-activity` / Minimum Buy Activity | Complete coverage and `B >= min_buys`; default 10, integer >= 0. | Counts 9, 10, 11 exercise the boundary; zero matches only a threshold of zero. |
| `buyer-diversity` / Buyer Diversity | Complete coverage and buyer identities, `U >= min_unique_buyers`; default 5, integer >= 0. | Ten buys by one wallet gives U=1; five distinct wallets gives U=5. |
| `repeat-buyer-concentration` / Repeat-Buyer Concentration | Complete coverage/identities, `B > 0`, `(B-U)/B >= min_repeat_ratio`; default 0.5 in [0,1]. Compare without rounded intermediate values. | B=10,U=5 passes 0.5; B=10,U=6 fails. Zero buys is undefined, not concentrated. |
| `launch-activity-shape` / Buy Activity Shape | Complete coverage; mode `sustained` (default): every 10-second bucket >= `min_buys_per_bucket` (default 1). `opening-burst`: B>0 and first-20-second buys/B >= `min_opening_share` (default 0.7). `building`: first-20-second buys >=1 and last-20-second buys >= `growth_factor` (default 2, >=1) times first-20-second buys. Parameters are mode-specific and validated. | Hand-labeled sustained, front-loaded, building, flat and zero series, including exact threshold ties. Modes may overlap; report that honestly. |
| `new-buyer-arrival-rate` / New Buyer Arrival Rate | Complete coverage/identities; count each wallet once at its earliest qualifying source-time buy for this coin/run. `steady-new-buyers` preset requires each of six 10-second buckets >= `min_new_buyers_per_bucket` (default 1, integer >=1). Save both 60 one-second arrival counts and six bucket counts. | Repeated buys never add arrivals; 12,9,10,11,8,10 passes a threshold of 5, while 12,3,1,0,1,0 fails. This threshold of 5 is a test example, not the default. |

Distinct wallets do not imply distinct people. Repeat-buy ratio is the fraction of buys beyond each wallet's first buy, not the largest wallet's share. A missing wallet leaves known-wallet counts available as diagnostic lower bounds but makes all three identity-dependent filters ineligible. Other complete metrics can still be used. A whole-window gap makes every ordinary activity predicate unobservable. `not` must preserve unknown status rather than turn missing data into a match; explicit status selectors are the only way to select unknown rows.

Count source-time events, including creation-transaction buys with preserved instruction identities. Deduplicate live/replay observations by a canonical identity containing mint, transaction signature and instruction/event discriminator; do not merge separate buys merely because they share a signature. Missing stable identities must be reported as a quality limitation rather than silently inflating counts. Build the creation index before processing buys so out-of-order records and a buy appearing before its create envelope remain correct. For arrivals, take the minimum source time per wallet, irrespective of file order. Reject conflicting duplicate contents with a diagnostic. Preserve `(run_id,mint)` observation keys in cohort artifacts so overlapping runs are not silently collapsed.

#### Evidence gates and Batch 001 use

1. **Source readiness:** resolve all four run manifests plus raw files/blob references and reliability records from `analysis/batches/batch-001.json`; record absolute source path, sizes and content fingerprints. Existing profile source `/home/drewp/main-projects/meme explorer/data` is absent on this Mac (checked September 8). Local repo/Documents/Downloads filename search and Spotlight did not locate these recordings. A summary profile cannot substitute for raw data. Locate the original host or an archive using existing configuration; copy only if storage permits, otherwise run read-only analysis on the source host. Do not edit scheduled recorder jobs. Synthetic mechanics work can proceed while source access is resolved.
2. **Independent correctness:** make small human-readable event fixtures with explicit expected bars, buyers, arrivals, membership and exclusion reasons; the oracle must not call the production analyzer. Cover -1, 0, 9,999, 10,000, 59,999 and 60,000ms; repeats, multiple instructions, duplicates, live/replay overlap, shuffled order, missing creation/wallet/time, malformed events, gaps, late stops, complete zero activity and mixed venues. All exact integers/memberships/reasons must match; ratio threshold comparisons must not depend on display rounding.
3. **Real-data reconciliation:** process Batch 001 locally or on the verified source host. Reconcile all eligible Pump creation observations against the source; the older mixed-venue profile reports 48 Pump creations but is not an authoritative first-minute count. Independently reconstruct at least 10 deterministic mint/run samples (or every available observation if fewer), covering active, quiet, incomplete, and repeated buyers when present. Persist source event references and exact expected values outside model context. Missing real-data cases remain covered by explicitly synthetic fixtures. Require zero unexplained discrepancies, all six cohort membership checks against the feature rows, and `members + rejected + unobservable = input observations` with disjoint terminal categories; detailed reason counts may overlap.
4. **Repeatability and view:** run the same inputs and definition versions twice; feature content, sorted observation keys, memberships and exclusion reasons must match. Generation timestamps and execution IDs may differ; stable content hashes must not. Run all six filters against one cached feature result without rescanning raw records. Verify the minimal first-minute page shows correct counts, 60-second charts, six arrival buckets, exclusions and filter parameters; inspect one filter at a time. Keep the legacy ten-second page working.
5. **Scale readiness:** benchmark actual Batch 001, then stream a deterministic 2x replay (2,149,746 raw envelopes, a volume proxy for 60 minutes at the historical rate) and 4x replay (4,299,492, a stress proxy). Namespace synthetic mints/wallets/signatures/run IDs and shift timestamps/coverage consistently, retaining duplicates only in explicitly designated dedup tests. Never merely concatenate identical data that the engine removes as duplicates. In addition, generate at least 1,000 simultaneously active launches with known expected metrics to exercise wallet-state memory; scaling raw record count alone is insufficient. These are load fixtures, never extra market evidence. The measured target on the analysis Mac is <=15 minutes wall time for the 2x full pass plus all six filters, <=1 GiB peak RSS on all scale cases, <=60 seconds to rerun all filters from saved features, <=64 KiB per model-facing receipt with <=20 preview rows, and <=1 GiB additional temporary/derived disk. Report hardware, code commit, input bytes/counts, launch/wallet counts, time, peak RSS and disk deltas. Stream generated replay instead of duplicating multi-GiB datasets; spill bounded state to disk where needed and measure it. Retain at least the recorder's configured 15 GiB free-space reserve. Treat exceeded targets as failed readiness and fix/retest; do not silently raise them. These are acceptance targets, not measured results or an upper bound on live traffic.
6. **Hourly compatibility:** after each scheduled batch is finalized, resolve its own data root and generated batch manifest, check source compatibility and run the same versioned pipeline. The installed recorder lives under `/Users/drewp/Library/Application Support/MemeExplorer/scheduled-20260908`; jobs place each batch beneath their own `batches/<batch-id>` data root. Do not assume the Batch 001 root or fabricate run IDs. Recording lasts an hour but each coin contributes only its first minute. Coins launched in the last minute commonly have incomplete coverage and must remain unobservable. Analyze a finalized snapshot only; a still-running or unfinalized run waits. A finalized early-stopped run can be analyzed with its true coverage. Record each live batch as a separate smoke result; if its volume exceeds tested limits, mark that limitation instead of claiming scale coverage.

Before applying to today's batches, freeze v1 thresholds and content hashes selected with Batch 001; any later tuning creates v2 and retains v1 results. Validation here establishes arithmetic, reproducibility and operational capacity. It does not establish predictive performance. No three-hour outcomes are required for this milestone.

Readiness receipt: one row per filter containing definition/version, fixture pass state, Batch 001 pass state, sampled discrepancy count, benchmark artifact reference, catalog/CLI/view pass state and final `ready`, `failed`, or `blocked` with reason. Synthetic-only success is not real-data readiness. The two incoming batches get their own subsequent compatibility status rather than retroactively replacing Batch 001 evidence. At planning time every implementation/validation gate is pending.

### 9. Retain the later workbench build waves after approval

The integration owner first commits shared contracts and fixtures. Workers then receive the same commit and read shared files without modifying them.

**Foundation — integration owner, sequential:**

- Owns `src/analysis/contracts/**`, shared workflow fixtures, `src/analysis/index.ts`, root exports, `package.json`, OpenSpec task state, and final integration tests.
- Freezes artifact schemas, field registry shape, command interfaces, fixture IDs, and the approved plan digest before dispatch.

**Parallel wave 1 — three independent workers:**

- **Filters:** owns `src/analysis/filters/**` and `test/analysis-filters.test.mjs`.
- **Outcomes:** owns `src/analysis/outcomes/**` and `test/analysis-outcomes.test.mjs`.
- **Catalog and cheat sheet:** owns `src/analysis/catalog/**`, `analysis/catalog.json`, new `.agents/skills/` analysis entries, and `test/analysis-catalog.test.mjs`.

**Parallel wave 2 — starts after wave 1 integration:**

- **Trends:** owns `src/analysis/trends/**` and `test/analysis-trends.test.mjs`; consumes integrated cohort and outcome artifacts read-only.
- **Dashboard:** owns `src/analysis/dashboard/**`, the existing `src/analysis/comparison-page.ts`, comparison CLI/server files, and `test/analysis-dashboard.test.mjs`; consumes all contracts and fixture artifacts read-only.

The integration owner alone updates shared exports/scripts, merges in prerequisite order, runs combined checks, generates a Batch 001 dashboard, and updates task checkboxes. No file is concurrently owned by two workers.

## Risks / Trade-offs

- **[Some launches lack a complete first 60 seconds or Batch 001 lacks a full 3-hour evidence window]** → Mark feature windows unobservable and outcomes censored/unavailable; validate mechanics with recorded fixtures and never present fabricated rates.
- **[$30,000 market cap is not an executable-value guarantee]** → Label the profile everywhere, keep executable-return outcomes separate, and never describe the threshold crossing as realized profit or available exit liquidity.
- **[Sparse observations could miss a brief threshold crossing]** → Require declared three-hour coverage and sampling/stream quality; gaps or insufficient cadence produce censored rather than failed.
- **[Threshold exploration can overfit one batch]** → Persist every definition, show denominators/intervals, flag small samples, and reserve holdout/out-of-sample validation for a separately approved research phase.
- **[Overlapping cohorts make lift easy to misread]** → Report overlap and population definitions beside every comparison.
- **[Provider data changes or disappears]** → Preserve raw responses, parser versions, timestamps, and failure reasons; keep canonical and indexed evidence distinct.
- **[The self-contained dashboard grows too large]** → Embed derived summaries and selected row data only; retain full artifacts on disk and warn/cap before generation exceeds a declared size budget.
- **[Parallel workers drift from interfaces]** → Pin a committed foundation, make contracts read-only to workers, assign one owner per file, and integrate between dependency waves.

## Migration Plan

1. Complete the six-filter milestone in Decision 8 first, including source access, contracts, analyzer, filters, catalog/direct commands, minimal view and evidence gates. Release it independently; later steps are not prerequisites.
2. Add the sixty-second analyzer plus filter, outcome, and catalog outputs alongside the current ten-second analyzer; run legacy and new focused tests.
3. Integrate trend computation and generate the six-tab dashboard while preserving the current Pump.fun terminal behavior.
4. Run strict OpenSpec validation, type checks, the full repository suite, contract drift checks, and browser checks at desktop/mobile widths.
5. Generate the workflow for Batch 001 and verify that any insufficient outcome coverage is displayed as censored/unavailable.
6. Roll back by removing only new analysis artifacts/modules and restoring the existing comparison command; recorded runs and prior analysis results remain untouched.
