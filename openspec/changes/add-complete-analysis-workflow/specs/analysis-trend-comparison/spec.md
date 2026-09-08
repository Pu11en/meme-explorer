## Purpose

Show how early metric patterns and reusable cohorts relate to later outcomes without hiding coverage, small samples, overlapping groups, or uncertainty.

## ADDED Requirements

### Requirement: Trends compare explicit populations
The system SHALL compare one or more named cohorts with a declared baseline population and selected outcome profile. Each comparison SHALL report total rows, evaluable rows, passed rows, censored rows, unavailable rows, and overlap between cohorts.

#### Scenario: Compare a filter with all observable launches
- **WHEN** a user compares a buyer-diversity cohort to the observable-launch baseline
- **THEN** the result identifies both population definitions and reports their membership and outcome coverage

### Requirement: Outcome-rate comparisons include lift and uncertainty
For every evaluable cohort the system SHALL calculate pass rate, absolute difference from baseline, relative lift when defined, and a deterministic 95% Wilson interval. It SHALL show an explicit warning for fewer than 30 evaluable coins and SHALL NOT make a causal or predictive claim.

#### Scenario: Cohort has a small sample
- **WHEN** only twelve cohort coins have evaluable outcomes
- **THEN** the statistics remain visible with their denominator and interval plus a small-sample warning

### Requirement: Time-series shapes can be compared by group
The system SHALL compare compatible early time-series metrics for selected cohorts or outcome classes using aligned intervals and SHALL support per-interval, cumulative, and normalized views. Missing series SHALL be excluded with counts rather than filled with zeros.

#### Scenario: Compare successful and failed launch shapes
- **WHEN** the selected profile has both passed and failed coins with ten-second bars
- **THEN** the comparison shows the two aggregated shapes on the same time axis and reports the number contributing to each interval

### Requirement: Trend artifacts are reproducible
Each trend run SHALL save an immutable artifact containing source result IDs, cohort IDs, outcome result ID, population definitions, formulas, denominators, intervals, warnings, and series values in deterministic order.

#### Scenario: Repeat the same trend analysis
- **WHEN** the same versions, parameters, and source artifacts are analyzed twice
- **THEN** all comparison values and ordered groups are identical

### Requirement: Batch and cohort comparisons remain compatible
The system SHALL reject comparisons whose metric formulas, interval definitions, or outcome profiles are incompatible unless an explicit compatible transformation is selected.

#### Scenario: Compare differently defined windows
- **WHEN** one cohort uses ten-second activity and another uses an incompatible fifteen-second metric
- **THEN** the comparison identifies the incompatible definitions and does not silently place them on one series
