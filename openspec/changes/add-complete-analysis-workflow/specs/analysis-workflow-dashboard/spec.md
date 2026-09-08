## Purpose

Provide one local browser workbench where a user can move from dataset quality to coin exploration, cohort filters, later outcomes, trend evidence, and skill guidance.

## ADDED Requirements

### Requirement: Dashboard exposes six linked analysis tabs
The dashboard SHALL provide Overview, Coins, Filters, Outcomes, Trends, and Skills tabs. The active batch, selected cohort, selected outcome profile, and selected coins SHALL remain consistent when the user changes tabs.

#### Scenario: Move from filter to trends
- **WHEN** a user selects a cohort in Filters and opens Trends
- **THEN** that cohort is already selected for comparison against the current baseline

### Requirement: Overview makes scope and quality visible
The Overview tab SHALL show source batches and runs, the fixed sixty-second feature window, artifact versions, coin counts, observability, outcome coverage, already-successful-at-cutoff counts, current success profile, data-age information, and prominent warnings before showing headline comparisons.

#### Scenario: Outcomes are mostly censored
- **WHEN** fewer than half of coins have an evaluable selected outcome
- **THEN** the coverage warning is visible beside the summary rather than hidden in a detail panel

### Requirement: Coins support inspection and handoff
The Coins tab SHALL provide searchable, sortable rows, multi-select comparison, metric and outcome status, exclusion reasons, sixty-second launch-shape inspection, and a direct Pump.fun terminal link for every mint.

#### Scenario: Inspect an excluded coin
- **WHEN** a user opens a coin that did not enter the selected cohort
- **THEN** the dashboard shows the failed filter predicates and any missing or unobservable values

### Requirement: Filters and outcomes are operable without editing files
The Filters tab SHALL let the user choose catalog filters, set typed parameters, compose rules, preview counts, and save a named definition. The Outcomes tab SHALL let the user select a profile and inspect passed, failed, censored, and unavailable groups with evidence details.

#### Scenario: Preview a stricter filter
- **WHEN** a user raises a minimum-activity parameter
- **THEN** the preview updates membership and exclusion counts without modifying the source analysis result

### Requirement: Trends reveal denominators and uncertainty
The Trends tab SHALL show outcome-rate comparisons, lift, uncertainty intervals, time-series shapes, overlap, coverage, and small-sample warnings for selected cohorts and outcome classes.

#### Scenario: Hover a comparison value
- **WHEN** a user inspects a rate or lift value
- **THEN** the dashboard reveals its numerator, denominator, baseline, formula version, and warning state

### Requirement: Dashboard is a portable generated artifact
The dashboard SHALL be generated from saved derived artifacts, SHALL NOT embed raw event envelopes, and SHALL work as a self-contained local page without network access except for explicit external coin links. It SHALL remain usable at desktop and mobile widths and with keyboard navigation.

#### Scenario: Open the saved dashboard offline
- **WHEN** the dashboard artifact is opened without a network connection
- **THEN** every tab and analysis interaction works while external terminal links remain optional
