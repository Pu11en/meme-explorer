## Why

Meme Explorer can compute one reliable early-buy metric and render one comparison page, but it cannot yet reuse filters, attach later outcomes, test which early patterns separate successful coins, or navigate the analysis as one coherent workflow. This change turns the proven single-skill foundation into an auditable analysis workbench while preserving the rule that an observed metric is not a validated trading signal.

## What Changes

- Add a deterministic first-60-second feature result with 60 one-second bars, then add versioned, composable filter skills that create reproducible cohorts from it without loading raw events into model context.
- Add a censor-aware default success check for reaching at least $30,000 USD market cap within three hours, plus separate migration, executable-return, and durable-market outcomes.
- Add trend comparison across cohorts, batches, and outcome classes, including sample size, coverage, outcome rate, lift, uncertainty, and early time-series shapes.
- Replace the single-purpose comparison surface with a self-contained tabbed dashboard for overview, coins, filters, outcomes, trends, and skill guidance.
- Generate a concise skill cheat sheet from the same versioned catalog used by the runtime, with natural-language examples, parameters, outputs, data requirements, and caveats.
- Keep complete, incomplete, unavailable, and right-censored observations separate throughout the workflow; never coerce missing outcomes to failure or unobservable metrics to zero.

## Capabilities

### New Capabilities

- `reusable-analysis-filters`: Compute the fixed first-60-second feature table and define, save, compose, execute, and audit deterministic filters over its rows.
- `coin-outcome-checks`: Evaluate the $30,000-within-three-hours success profile without temporal leakage and attach separate migration, executable-return, and durability outcomes.
- `analysis-trend-comparison`: Compare cohorts and outcome classes using transparent descriptive statistics, coverage, uncertainty, and time-series shapes.
- `analysis-workflow-dashboard`: Navigate the end-to-end analysis through linked overview, coin, filter, outcome, trend, and skills tabs.
- `analysis-skill-cheat-sheet`: Discover available analysis skills and their safe usage from catalog-backed human and agent guidance.

### Modified Capabilities

None. The existing analysis runtime and buy-activity page remain compatible inputs; this change adds a broader workflow around them.

## Impact

Adds analysis contracts and modules, catalog entries, commands, tests, dashboard generation, and documentation. It reads existing immutable run and analysis artifacts and writes new versioned cohort, outcome, comparison, and dashboard artifacts under the configured data root. No existing recorded data is rewritten, no live trading or recommendation behavior is added, and no external service is required merely to open a generated dashboard.
