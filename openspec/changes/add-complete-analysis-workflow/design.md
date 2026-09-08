## Context

The repository is a dependency-light TypeScript package with immutable run datasets, normalized migrations and market snapshots, locally derived candles, a versioned analysis result contract, a cataloged ten-second buy-activity skill, and a self-contained comparison page. The current analyzer correctly separates complete zero-buy observations from unobservable windows and bounds model-facing receipts. See `proposal.md` for motivation and the five capability specs for required behavior.

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
recorded runs -> metric result -> cohort/filter result
                            \-> outcome facts + profile result
cohort + outcome result -> trend result -> generated dashboard
catalog ---------------------------------> Skills tab + agent skills
```

New versioned contracts will cover filter definitions, cohort results, outcome facts, outcome profiles, outcome results, trend results, and dashboard manifests. Artifacts will live below `data/analysis/<batch-id>/` in capability-specific directories and include source IDs, formula versions, parameters, timestamps, hashes where practical, and complete rows plus bounded receipts. Existing `pump.analysis-result/1` files remain valid inputs.

A file-backed pipeline was chosen over a database because the current datasets and analysis outputs are already immutable, inspectable, portable, and testable. The dashboard consumes derived artifacts only; it never receives raw envelopes.

### 2. Use a typed filter expression instead of one command per threshold

A filter definition will contain a schema/version, stable ID, compatible input schemas, observation cutoff, and a normalized expression tree. The operator allowlist will include numeric/string equality, range, membership, presence, and explicit time-series shapes, composed with `all`, `any`, and `not`. A field registry will define type, unit, observation time, and compatible operators, preventing arbitrary property access or string-evaluated code.

The initial catalog will expose five approachable filters: observable launches, minimum buy activity, buyer diversity, repeat-buyer concentration, and launch activity shape. Each is a parameterized definition over the same engine, which keeps the library reusable without duplicating arithmetic. Missing values fail ordinary predicates and receive a reason; only explicit missing/unobservable predicates select them.

### 3. Separate outcome facts, checks, and the selected success profile

Outcome facts are observations: time-stamped quote-denominated market cap, contemporaneous quote/USD references, reconciled migration events, price or executable-quote points, route checks, depth, liquidity, and coverage intervals. Outcome checks interpret those facts under a versioned profile. The per-check state is `passed`, `failed`, `censored`, or `unavailable`; only `passed` and `failed` enter an evaluated rate.

The initial default profile will be `market-cap-at-least-usd-30k-within-3h/v1`: pass when an accepted market-cap point reaches or exceeds $30,000 from creation through `creation + 3h`. Drew selected this absolute threshold and explicitly rejected migration as the success label. The label means only that the recorded market-cap path crossed that threshold; it is not a claim that a position could be entered or exited at that valuation.

One qualifying point is sufficient. The outcome row will separately retain `first_hit_at`, peak observed USD market cap and time, qualifying-point count, plus duration-above-threshold value and quality (`exact`, `estimated`, or `unavailable`) when the observation cadence supports it. None of those persistence fields changes the binary success result.

For SOL-quoted Pump observations, v1 will calculate `market_cap_usd = market_cap_quote × sol_usd` with lossless decimal arithmetic. The SOL/USD reference must be the latest retained observation at or before the market-cap point and no more than 60 seconds old. Direct provider-reported USD market cap is retained as supplementary evidence and is not mixed into this derived series. A missing or stale conversion marks that point unavailable. Each outcome result pins the market-cap formula, quote source, USD-reference source, and freshness rule.

Migration remains an independently reported factual outcome. Executable-return profiles require a declared decision-time baseline, quote notional, fee treatment, return threshold, and horizon. Durability profiles require a later horizon, route/depth requirements, and retention terms. Neither result replaces the $30,000 market-cap success definition.

Outcome evidence adapters will read retained trade/curve market-cap facts, time-aligned SOL/USD references, normalized migrations, derived price paths, market snapshots, and reliability records. Optional three-hour follow-up collection will reuse the existing safe-fetch/raw-first pattern: save the provider response, normalize it, and record provider time, chain time/slot when present, parser version, and coverage. A failed threshold result requires verified stream/snapshot coverage through the entire three-hour horizon; an early stop or overlapping gap produces censored, while an absent usable market-cap plane produces unavailable.

### 4. Enforce leakage with observation-time metadata

Every field exposed to filtering will declare when it became knowable relative to creation. A cohort has a feature cutoff; an outcome profile has a later evaluation window. The evaluator rejects a comparison if any selected feature was observed after the cutoff or if an outcome fact falls outside the declared window.

This explicit clock check was chosen over naming conventions such as `early_*`, which are easy to violate and impossible to audit mechanically. Tests will include a deliberately leaked field and require a hard failure.

### 5. Keep trend analysis descriptive and denominator-first

Trend results will show population definitions, overlap, total/evaluable/censored/unavailable counts, outcome pass rates, absolute difference, relative lift where defined, and deterministic 95% Wilson intervals. Fewer than 30 evaluable coins triggers a warning without hiding results. The engine will not produce “confidence,” “edge,” or causal labels.

Time-series comparison will align compatible bars and expose per-interval, cumulative, and normalized shapes. Group aggregates will carry a contributing-row count for every interval; missing series are excluded, not zero-filled. Incompatible formula/window versions fail closed unless a separately versioned transformation is declared.

### 6. Evolve the comparison page into one six-tab static workbench

The existing self-contained page becomes the Coins interaction inside a generated dashboard with these tabs:

1. **Overview** — selected batch/profile, artifact lineage, headline counts, coverage, age, and warnings.
2. **Coins** — searchable table, terminal links, selected-line comparison, metrics, outcomes, and exclusion reasons.
3. **Filters** — preset selection, typed parameters, rule composition, live preview, save/run, and cohort summary.
4. **Outcomes** — profile selector, status groups, coverage, and per-coin evidence.
5. **Trends** — cohort-versus-baseline rates, lift/intervals, shape comparison, overlap, and warnings.
6. **Skills** — catalog-backed cheat sheet and copyable natural-language invocations.

Shared state (batch, cohort, outcome profile, selected mints) will be encoded in a small browser state object and URL hash so tab navigation and refresh preserve context. The generated artifact embeds only bounded derived data needed for interaction. No request is made merely by opening it; explicit Pump.fun links are the only required network exits.

### 7. Generate the cheat sheet from the executable catalog

The catalog schema will be expanded so every metric, filter, outcome, trend, and dashboard skill carries its question, compatible inputs, parameters/defaults, outputs, required data planes, cost policy, versions, caveats, and example prompts. One generator produces the dashboard Skills tab and the project-local agent skill index. Contract tests reject missing fields and drift between catalog parameters, runtime parameters, and rendered guidance.

This avoids maintaining a hand-written cheat sheet that inevitably disagrees with the executable behavior.

### 8. Use two parallel build waves after approval

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

- **[Batch 001 lacks a full 3-hour evidence window]** → Show censored/unavailable outcomes and validate mechanics with recorded fixtures; never present a fabricated success rate.
- **[$30,000 market cap is not an executable-value guarantee]** → Label the profile everywhere, keep executable-return outcomes separate, and never describe the threshold crossing as realized profit or available exit liquidity.
- **[Sparse observations could miss a brief threshold crossing]** → Require declared three-hour coverage and sampling/stream quality; gaps or insufficient cadence produce censored rather than failed.
- **[Threshold exploration can overfit one batch]** → Persist every definition, show denominators/intervals, flag small samples, and reserve holdout/out-of-sample validation for a separately approved research phase.
- **[Overlapping cohorts make lift easy to misread]** → Report overlap and population definitions beside every comparison.
- **[Provider data changes or disappears]** → Preserve raw responses, parser versions, timestamps, and failure reasons; keep canonical and indexed evidence distinct.
- **[The self-contained dashboard grows too large]** → Embed derived summaries and selected row data only; retain full artifacts on disk and warn/cap before generation exceeds a declared size budget.
- **[Parallel workers drift from interfaces]** → Pin a committed foundation, make contracts read-only to workers, assign one owner per file, and integrate between dependency waves.

## Migration Plan

1. Add and verify the shared contracts, field registry, fixtures, and compatibility readers without changing existing results.
2. Add filter, outcome, and catalog outputs alongside the current analyzer; run legacy and new focused tests.
3. Integrate trend computation and generate the six-tab dashboard while preserving the current Pump.fun terminal behavior.
4. Run strict OpenSpec validation, type checks, the full repository suite, contract drift checks, and browser checks at desktop/mobile widths.
5. Generate the workflow for Batch 001 and verify that any insufficient outcome coverage is displayed as censored/unavailable.
6. Roll back by removing only new analysis artifacts/modules and restoring the existing comparison command; recorded runs and prior analysis results remain untouched.
