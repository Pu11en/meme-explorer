## Purpose

Let users turn a fixed first-60-second launch analysis into named, repeatable coin cohorts whose rules, inputs, exclusions, and data quality can be inspected and rerun.

## ADDED Requirements

### Requirement: Workflow features use one fixed sixty-second window
The system SHALL calculate the workflow's early features from the half-open interval `[creation, creation + 60,000 milliseconds)` and SHALL produce 60 one-second bars. An event exactly 60,000 milliseconds after creation SHALL be excluded. A launch whose complete sixty-second interval was not observed SHALL be unobservable rather than zero, and the workflow SHALL NOT substitute legacy ten-second or new thirty-second feature windows.

#### Scenario: Sixty-second boundary events
- **WHEN** activity occurs 59,999 milliseconds and 60,000 milliseconds after creation
- **THEN** the first event is included in the sixty-second result and the second is excluded

### Requirement: Filter definitions are versioned and reusable
The system SHALL represent each filter as a named, versioned definition containing its source schema, field predicates, composition logic, missing-value policy, and human description. Definitions SHALL be executable from both a direct command and a natural-language skill invocation.

#### Scenario: Reuse a saved filter on another batch
- **WHEN** a user applies the same compatible filter definition to two collection batches
- **THEN** both cohort artifacts identify the exact filter version and their respective source result IDs

### Requirement: Filters compose deterministically
The system SHALL support typed comparison, range, membership, presence, and time-series-shape predicates combined with explicit all, any, and not operators. Repeated execution against byte-identical inputs SHALL produce the same ordered membership and exclusion reasons.

#### Scenario: Combine activity and diversity rules
- **WHEN** a filter requires a minimum buy count and a minimum unique-buyer count
- **THEN** only rows satisfying both typed predicates are members and every rejected row records which predicate failed

### Requirement: Missing and unobservable values remain explicit
The system SHALL NOT treat an unobservable metric as zero or allow a missing value to satisfy a normal comparison. A filter MAY explicitly select missing or unobservable states, and the output SHALL count those selections separately.

#### Scenario: Filter for zero buys
- **WHEN** a user selects complete zero-buy launches
- **THEN** a complete row with zero buys matches while an unobservable row does not

### Requirement: Initial filter library covers common analysis questions
The catalog SHALL include reusable definitions for observable launches, minimum activity, buyer diversity, repeat-buyer concentration, and first-sixty-second activity shape. These definitions SHALL be described as cohort selectors rather than validated signals.

#### Scenario: Discover a buyer-diversity filter
- **WHEN** an agent searches the analysis catalog for launches with several distinct buyers
- **THEN** it can find the relevant filter, view its parameters, and run it without reading raw events into model context

### Requirement: Cohort artifacts are complete and auditable
Each filter run SHALL save an immutable cohort artifact with normalized rules, source lineage, member mint IDs, input count, member count, exclusion counts by reason, missing-data counts, and a bounded receipt pointing to the full result.

#### Scenario: Run a filter on a large result
- **WHEN** the result exceeds the receipt preview limit
- **THEN** the full cohort remains saved locally while model-facing output contains only summary counts and a bounded preview
