## 0. Immediate six-filter milestone — implement before later workbench waves

This section is the first delivery path for the September 8 hourly batches. It fulfills the filter-related parts of sections 1, 2 and 4; once verified, link evidence and mark corresponding tasks rather than implementing them twice. Remaining outcomes, trends, and full dashboard tasks are deferred beyond this milestone. All checks below are pending; saving this plan does not launch a build.

- [ ] 0.1 Locate Batch 001's four original runs or verified archive; save absolute source roots, file sizes/hashes, venue inventory and actual coverage. Verify every manifest/raw/blob/reliability input is readable; if absent, record blocked real-data validation and continue only independent fixture work.
- [ ] 0.2 Freeze v1 feature/filter/cohort/receipt contracts and six stable IDs from design Decision 8, including observation keys, null behavior, exact formulas, parameter domains and 60-second cutoff; validate canonical and invalid fixtures. Reuse these contracts in later section 1 work.
- [ ] 0.3 Create an independent expected-results fixture suite with the time boundaries, shuffled records, creation buys, instruction identities, duplicates/conflicts, incomplete coverage, missing identities, zero buys and mixed venues from the design; verify expected values by explicit counts independent of production helpers.
- [ ] 0.4 Implement streaming first-minute extraction with a creation index, deduplication, 60 buy bars, per-wallet earliest buy, six arrival buckets and metric-specific quality; pass the independent oracle and memory-state fixtures, with no raw records in model receipts.
- [ ] 0.5 Implement Complete First-Minute Coverage and Minimum Buy Activity; verify zero/incomplete separation and exact threshold membership against the oracle.
- [ ] 0.6 Implement Buyer Diversity and Repeat-Buyer Concentration; verify repeated-wallet cases, undefined zero-buy ratio, missing-wallet exclusions and exact ratio boundary checks.
- [ ] 0.7 Implement sustained/opening-burst/building Buy Activity Shape and New Buyer Arrival Rate with the steady-new-buyers preset; verify explicit series, shuffled first buys, 10-second boundaries, repeated buys and threshold cases.
- [ ] 0.8 Implement typed composition including unknown-preserving not, immutable source lineage, disjoint member/rejected/unobservable counts and bounded receipts; verify reruns produce identical semantic content hashes and invalid inputs fail with reasons.
- [ ] 0.9 Add six executable catalog entries and generated project skill guidance, wire first-minute extraction and cached all-six filtering commands; verify prompt examples resolve to those IDs, parameter defaults agree, and filtering a saved feature result performs no raw-file reads. Proposed command contract: `pnpm analyze:60s -- --data-root <absolute-root> --batch <absolute-batch-json> --output-root <absolute-output>` then `pnpm analysis:filters -- --result <absolute-feature-result> --all --output-root <absolute-output>`; these commands do not exist yet and must be implemented and tested here.
- [ ] 0.10 Add the minimal saved-result comparison view for one filter at a time with 60-second buy charts, new-buyer buckets, parameters and exclusions; verify counts against cohort files and inspect desktop/mobile layout and selection behavior. Preserve the existing ten-second view; full six-tab dashboard remains later work.
- [ ] 0.11 Run all six on verified Batch 001 inputs and independently recount at least 10 deterministic observations or all if fewer; save source references, expected/actual values and zero unexplained discrepancies, plus all-row cohort/feature consistency and disjoint population counts. Missing sources block this gate.
- [ ] 0.12 Benchmark actual, 2x and 4x streamed replay plus the 1,000-overlapping-launch fixture; save bytes, envelopes, launch/wallet counts, wall time, peak RSS, receipt sizes, temp/derived disk and free-space evidence. Meet all numerical budgets in design Decision 8, or fix/retest and report failed readiness. Run heavy benchmarks sequentially and avoid competing with scheduled capture when storage or load would breach its reserve.
- [ ] 0.13 Run `pnpm check`, new filter/catalog/CLI/view checks and `openspec validate add-complete-analysis-workflow --strict`; save a six-row readiness receipt with evidence references, freeze v1 definitions, and commit/push implementation only after required gates pass. Report a blocker rather than a passing state when real Batch 001 evidence is unavailable.
- [ ] 0.14 After each September 8 hourly batch is finalized, verify its own data root/manifest and run frozen v1 extraction and all six filters; preserve last-minute incomplete windows, record actual size versus benchmark coverage and save a separate compatibility receipt. No changes to live scheduler/recorder are needed for this analysis task.

## 1. Approved foundation — integration owner

- [ ] 1.1 After explicit user approval, record the approval reference, reviewed-plan digest, base commit, worker ownership, dependencies, and acceptance commands in the coordinator manifest; verify every worker is pinned to the same committed foundation before dispatch.
- [ ] 1.2 Define the fixed sixty-second feature schema plus versioned filter, cohort, outcome-fact, outcome-profile, outcome-result, trend-result, receipt, and dashboard-manifest contracts under `src/analysis/contracts/**`; verify contract tests accept canonical fixtures and reject invalid window, status, lineage, and version combinations.
- [ ] 1.3 Define the typed field registry with units, operators, observation-time metadata, and compatibility rules; verify tests reject unsupported operators, invalid value types, and post-cutoff fields.
- [ ] 1.4 Create shared sixty-second workflow fixtures for complete, zero, unobservable, already-successful-at-cutoff, later $30,000 threshold-crossing, below-threshold, migrated, censored, unavailable, overlapping, and deliberately leaked cases; verify all fixtures load without touching raw event files.
- [ ] 1.5 Commit the foundation and mark shared contracts, fixtures, root exports, scripts, and OpenSpec task state read-only to capability workers; verify `git status` is clean and the pinned commit is available to every worker branch.

## 2. Parallel wave 1A — sixty-second features and reusable filters worker

- [ ] 2.1 Implement the deterministic first-sixty-second feature analyzer in `src/analysis/filters/**` with `[0, 60,000ms)` boundaries, 60 one-second bars, exact totals, and observability; verify `test/analysis-filters.test.mjs` includes 59,999ms, excludes 60,000ms, and distinguishes complete zero from an incomplete minute.
- [ ] 2.2 Implement the typed filter expression evaluator, including all/any/not composition, comparison/range/membership/presence/shape predicates, deterministic ordering, and explicit missing-value behavior; verify composition, zero versus unobservable, repeat execution, and rejection of legacy ten-second inputs.
- [ ] 2.3 Implement the six initial parameterized first-minute cohort definitions—observable launches, minimum activity, buyer diversity, repeat-buyer concentration, launch activity shape, and new buyer arrival rate—and verify their parameters compile through the shared field registry.
- [ ] 2.4 Save immutable cohort results and bounded receipts with member IDs, source lineage, normalized rules, failed-predicate reasons, and exclusion/missing counts; verify a large fixture keeps full membership on disk while receipt previews remain bounded.
- [ ] 2.5 Add capability-local sixty-second analysis and filter commands without editing root scripts or exports; verify the same definition reruns on two compatible fixture batches and rejects any non-sixty-second source schema.

## 3. Parallel wave 1B — outcome checks worker

- [ ] 3.1 Implement outcome-fact extraction and coverage calculation in `src/analysis/outcomes/**` from retained trade/curve market-cap facts, time-aligned SOL/USD references, migrations, derived price paths, market snapshots, and reliability facts; verify quote-derived USD market cap, provider-reported market cap, and migration evidence remain distinguishable.
- [ ] 3.2 Implement `market-cap-at-least-usd-30k-within-3h/v1` using lossless `market_cap_quote × sol_usd`, the latest nonfuture SOL/USD reference no more than 60 seconds old, and passed/failed/censored/unavailable states; verify $29,999.99 fails, one $30,000 point passes even if the next point is lower, the three-hour boundary is included, stale conversion is unavailable, and short/gapped coverage is censored.
- [ ] 3.3 Implement separate migration, configurable executable-return, and durability outcome evaluators with their own evidence terms; verify migration alone never sets success and missing executable evidence is unavailable instead of inferred from market cap.
- [ ] 3.4 Enforce the sixty-second feature cutoff and three-hour outcome horizon; verify a 61-second feature fails with its observation time, valid first-minute features pass, and a coin reaching $30,000 during the first minute is marked already successful at cutoff for forward comparisons.
- [ ] 3.5 Save immutable outcome results and bounded receipts with profile, evidence references, timestamps, coverage, provider/commitment/parser provenance, reasons, first hit, peak, qualifying-point count, and duration-above-threshold value/quality; verify persistence metrics never alter pass state and repeat execution is deterministic.

## 4. Parallel wave 1C — catalog and cheat-sheet worker

- [ ] 4.1 Expand `analysis/catalog.json` and its validator through `src/analysis/catalog/**` to cover metric, filter, outcome, trend, and dashboard skills with questions, inputs, parameters/defaults, outputs, data requirements, cost policy, versions, caveats, and prompt examples; verify incomplete or duplicate entries fail validation.
- [ ] 4.2 Generate the human cheat-sheet model and project-local agent skill entries from the validated catalog; verify filter, outcome, trend, and dashboard examples are copyable and no raw-record workflow is suggested.
- [ ] 4.3 Compute per-batch runnable/unavailable states from declared prerequisites; verify a batch without a valid three-hour market-cap plane marks the success check unavailable and a batch without executable quotes marks executable-return analysis unavailable with specific reasons.
- [ ] 4.4 Add catalog/runtime/guidance drift checks in `test/analysis-catalog.test.mjs`; verify a changed parameter default fails until all generated contracts agree.

## 5. Wave 1 integration — integration owner

- [ ] 5.1 Review and merge filters, outcomes, then catalog/cheat-sheet commits while preserving the foundation contracts and one-owner-per-file rule; verify each worker commit contains only its assigned paths.
- [ ] 5.2 Wire Wave 1 exports and commands only after merges; verify the legacy ten-second analyzer and comparison-page tests still pass together with all Wave 1 tests.
- [ ] 5.3 Produce committed cohort, outcome, and catalog fixtures for Wave 2 and verify their schema versions and IDs match the frozen contracts before dispatching dependent workers.

## 6. Parallel wave 2A — trend comparison worker

- [ ] 6.1 Implement explicit baseline/cohort population accounting in `src/analysis/trends/**`, including total, evaluable, passed, already-successful-at-cutoff, censored, unavailable, and overlap counts; verify first-minute successes are excluded only from prospective denominators and overlapping cohorts preserve correct counts.
- [ ] 6.2 Implement pass rate, absolute difference, relative lift, deterministic 95% Wilson interval, and the under-30 warning; verify zero-denominator cases remain undefined with reasons and no causal/predictive labels are emitted.
- [ ] 6.3 Implement time-series aggregation across exactly 60 one-second bars for per-interval, cumulative, and normalized shapes with contributing counts; verify missing series are excluded rather than zero-filled and legacy ten-second or other windows fail closed.
- [ ] 6.4 Save deterministic trend artifacts and bounded receipts with population definitions, formulas, source IDs, warnings, and series values; verify repeated fixture analysis is byte-stable apart from declared generation metadata.

## 7. Parallel wave 2B — dashboard worker

- [ ] 7.1 Evolve the existing comparison generator into a self-contained dashboard shell under `src/analysis/dashboard/**` with Overview, Coins, Filters, Outcomes, Trends, and Skills tabs; verify keyboard tab navigation and URL-hash state preserve batch, cohort, profile, and coin selection.
- [ ] 7.2 Build Overview and Coins views with the fixed sixty-second window, lineage, coverage/age warnings, search/sort/multi-select, 60-point line modes, metric and outcome state, exclusion reasons, and Pump.fun terminal links; verify existing comparison behaviors remain covered.
- [ ] 7.3 Build Filters and Outcomes views with typed parameter controls, composition preview, immutable save/run handoff, status groups, and per-coin evidence; verify UI previews never mutate embedded source results.
- [ ] 7.4 Build Trends and Skills views with denominators, lift/intervals, time-series shapes, overlap, small-sample warnings, availability, caveats, and copyable prompts; verify every displayed value resolves to an embedded derived artifact or catalog entry.
- [ ] 7.5 Keep the page offline and raw-data-free, enforce the declared size budget, and verify desktop/mobile layouts, keyboard access, visible focus, readable warnings, and no network request on page load.

## 8. Final integration and delivery — integration owner

- [ ] 8.1 Review and merge trend and dashboard commits, then update only integration-owned exports, root scripts, and shared workflow wiring; verify the complete metric-to-cohort-to-outcome-to-trend-to-dashboard path runs from one command sequence.
- [ ] 8.2 Run type checking, the full repository test suite, focused contract/drift tests, strict OpenSpec validation, and browser verification; record exact commands and results in the integration evidence.
- [ ] 8.3 Generate the Batch 001 dashboard and verify incomplete first-minute features are unobservable, insufficient three-hour market-cap follow-up is censored/unavailable, complete zero-buy rows remain distinct, early threshold hits are separated for prospective trends, migration remains informational, and every mint retains a terminal link.
- [ ] 8.4 Commit all integrated artifacts, update task checkboxes only from verified evidence, preserve prior plans/results, and hand back worker links plus one concrete local URL or command for user testing.
