## 1. Approved foundation — integration owner

- [ ] 1.1 After explicit user approval, record the approval reference, reviewed-plan digest, base commit, worker ownership, dependencies, and acceptance commands in the coordinator manifest; verify every worker is pinned to the same committed foundation before dispatch.
- [ ] 1.2 Define versioned filter, cohort, outcome-fact, outcome-profile, outcome-result, trend-result, receipt, and dashboard-manifest contracts under `src/analysis/contracts/**`; verify contract tests accept canonical fixtures and reject invalid status, lineage, and version combinations.
- [ ] 1.3 Define the typed field registry with units, operators, observation-time metadata, and compatibility rules; verify tests reject unsupported operators, invalid value types, and post-cutoff fields.
- [ ] 1.4 Create shared workflow fixtures for complete, zero, unobservable, migrated, failed, censored, unavailable, overlapping, and deliberately leaked cases; verify all fixtures load without touching raw event files.
- [ ] 1.5 Commit the foundation and mark shared contracts, fixtures, root exports, scripts, and OpenSpec task state read-only to capability workers; verify `git status` is clean and the pinned commit is available to every worker branch.

## 2. Parallel wave 1A — reusable filters worker

- [ ] 2.1 Implement the typed filter expression evaluator in `src/analysis/filters/**`, including all/any/not composition, comparison/range/membership/presence/shape predicates, deterministic ordering, and explicit missing-value behavior; verify `test/analysis-filters.test.mjs` covers composition, zero versus unobservable, and repeat execution.
- [ ] 2.2 Implement the five initial parameterized cohort definitions—observable launches, minimum activity, buyer diversity, repeat-buyer concentration, and launch activity shape—and verify their parameters compile through the shared field registry.
- [ ] 2.3 Save immutable cohort results and bounded receipts with member IDs, source lineage, normalized rules, failed-predicate reasons, and exclusion/missing counts; verify a large fixture keeps full membership on disk while receipt previews remain bounded.
- [ ] 2.4 Add a capability-local filter command without editing root scripts or exports; verify it reruns the same definition on two compatible fixture batches and rejects an incompatible source schema.

## 3. Parallel wave 1B — outcome checks worker

- [ ] 3.1 Implement outcome-fact extraction and coverage calculation in `src/analysis/outcomes/**` from retained migrations, derived price/trade paths, market snapshots, and reliability facts; verify canonical and indexed evidence remain distinguishable.
- [ ] 3.2 Implement `migration-within-24h/v1` with passed, failed, censored, and unavailable states; verify events on the horizon boundary pass, full-coverage non-events fail, and short coverage is censored outside the denominator.
- [ ] 3.3 Implement configurable breakout and durability profile evaluators with declared decision baselines, notionals, fees, thresholds, horizons, routes/depth, and retention requirements; verify missing executable evidence returns unavailable instead of using market-cap proxies.
- [ ] 3.4 Enforce feature and outcome clocks; verify the deliberately leaked fixture fails with the offending field and observation time while valid ten-second features pass.
- [ ] 3.5 Save immutable outcome results and bounded receipts with profile, evidence references, timestamps, coverage, provider/commitment/parser provenance, and reasons; verify repeat execution is deterministic.

## 4. Parallel wave 1C — catalog and cheat-sheet worker

- [ ] 4.1 Expand `analysis/catalog.json` and its validator through `src/analysis/catalog/**` to cover metric, filter, outcome, trend, and dashboard skills with questions, inputs, parameters/defaults, outputs, data requirements, cost policy, versions, caveats, and prompt examples; verify incomplete or duplicate entries fail validation.
- [ ] 4.2 Generate the human cheat-sheet model and project-local agent skill entries from the validated catalog; verify filter, outcome, trend, and dashboard examples are copyable and no raw-record workflow is suggested.
- [ ] 4.3 Compute per-batch runnable/unavailable states from declared prerequisites; verify a batch without executable quotes marks breakout unavailable with specific missing-data reasons.
- [ ] 4.4 Add catalog/runtime/guidance drift checks in `test/analysis-catalog.test.mjs`; verify a changed parameter default fails until all generated contracts agree.

## 5. Wave 1 integration — integration owner

- [ ] 5.1 Review and merge filters, outcomes, then catalog/cheat-sheet commits while preserving the foundation contracts and one-owner-per-file rule; verify each worker commit contains only its assigned paths.
- [ ] 5.2 Wire Wave 1 exports and commands only after merges; verify the legacy ten-second analyzer and comparison-page tests still pass together with all Wave 1 tests.
- [ ] 5.3 Produce committed cohort, outcome, and catalog fixtures for Wave 2 and verify their schema versions and IDs match the frozen contracts before dispatching dependent workers.

## 6. Parallel wave 2A — trend comparison worker

- [ ] 6.1 Implement explicit baseline/cohort population accounting in `src/analysis/trends/**`, including total, evaluable, passed, censored, unavailable, and overlap counts; verify overlapping cohorts and excluded outcomes preserve correct denominators.
- [ ] 6.2 Implement pass rate, absolute difference, relative lift, deterministic 95% Wilson interval, and the under-30 warning; verify zero-denominator cases remain undefined with reasons and no causal/predictive labels are emitted.
- [ ] 6.3 Implement compatible time-series aggregation for per-interval, cumulative, and normalized shapes with contributing counts; verify missing series are excluded rather than zero-filled and incompatible windows fail closed.
- [ ] 6.4 Save deterministic trend artifacts and bounded receipts with population definitions, formulas, source IDs, warnings, and series values; verify repeated fixture analysis is byte-stable apart from declared generation metadata.

## 7. Parallel wave 2B — dashboard worker

- [ ] 7.1 Evolve the existing comparison generator into a self-contained dashboard shell under `src/analysis/dashboard/**` with Overview, Coins, Filters, Outcomes, Trends, and Skills tabs; verify keyboard tab navigation and URL-hash state preserve batch, cohort, profile, and coin selection.
- [ ] 7.2 Build Overview and Coins views with lineage, coverage/age warnings, search/sort/multi-select, line modes, metric and outcome state, exclusion reasons, and Pump.fun terminal links; verify existing comparison behaviors remain covered.
- [ ] 7.3 Build Filters and Outcomes views with typed parameter controls, composition preview, immutable save/run handoff, status groups, and per-coin evidence; verify UI previews never mutate embedded source results.
- [ ] 7.4 Build Trends and Skills views with denominators, lift/intervals, time-series shapes, overlap, small-sample warnings, availability, caveats, and copyable prompts; verify every displayed value resolves to an embedded derived artifact or catalog entry.
- [ ] 7.5 Keep the page offline and raw-data-free, enforce the declared size budget, and verify desktop/mobile layouts, keyboard access, visible focus, readable warnings, and no network request on page load.

## 8. Final integration and delivery — integration owner

- [ ] 8.1 Review and merge trend and dashboard commits, then update only integration-owned exports, root scripts, and shared workflow wiring; verify the complete metric-to-cohort-to-outcome-to-trend-to-dashboard path runs from one command sequence.
- [ ] 8.2 Run type checking, the full repository test suite, focused contract/drift tests, strict OpenSpec validation, and browser verification; record exact commands and results in the integration evidence.
- [ ] 8.3 Generate the Batch 001 dashboard and verify real insufficient follow-up appears as censored/unavailable, complete zero-buy rows remain distinct, every mint retains a terminal link, and no unsupported success rate is shown.
- [ ] 8.4 Commit all integrated artifacts, update task checkboxes only from verified evidence, preserve prior plans/results, and hand back worker links plus one concrete local URL or command for user testing.
