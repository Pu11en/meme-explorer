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
The catalog SHALL include reusable definitions for observable launches, minimum activity, buyer diversity, repeat-buyer concentration, first-sixty-second activity shape, and new buyer arrival rate. These definitions SHALL be described as cohort selectors rather than validated signals.

#### Scenario: Discover a buyer-diversity filter
- **WHEN** an agent searches the analysis catalog for launches with several distinct buyers
- **THEN** it can find the relevant filter, view its parameters, and run it without reading raw events into model context

### Requirement: Cohort artifacts are complete and auditable
Each filter run SHALL save an immutable cohort artifact with normalized rules, source lineage, member mint IDs, input count, member count, exclusion counts by reason, missing-data counts, and a bounded receipt pointing to the full result.

#### Scenario: Run a filter on a large result
- **WHEN** the result exceeds the receipt preview limit
- **THEN** the full cohort remains saved locally while model-facing output contains only summary counts and a bounded preview

### Requirement: New buyer arrival rate counts earliest buys once
The system SHALL produce 60 one-second arrival counts and six nonoverlapping ten-second arrival buckets over the fixed first minute. It SHALL assign each identified wallet to its earliest qualifying source-time buy for the coin/run, independent of record order, after canonical event deduplication. It SHALL offer a versioned steady-new-buyers filter requiring each bucket to meet a positive integer minimum, default 1. Missing buyer identities SHALL make identity-dependent filters unobservable rather than exact.

#### Scenario: Wallet buys repeatedly and records arrive out of order
- **WHEN** one wallet buys at 12 seconds and 4 seconds with the 12-second record read first
- **THEN** it contributes exactly one arrival to second 4 and bucket 0, and none to bucket 1

#### Scenario: Exact bucket and window boundaries
- **WHEN** distinct wallets first buy at 9,999, 10,000, 59,999 and 60,000 milliseconds
- **THEN** their arrivals count in buckets 0, 1 and 5 respectively, and the last buy is excluded

### Requirement: Initial definitions have reproducible formulas
The system SHALL implement the six stable filter IDs, formulas, parameter domains, defaults and metric-quality rules in design Decision 8. Repeat concentration SHALL mean `(buys - unique_buyers) / buys` for positive buy counts with complete identities. Shape predicates SHALL use explicit six-bucket formulas rather than model judgments. All ordinary predicates SHALL preserve unknown values through negation. Artifacts SHALL identify observations by run and mint and SHALL partition input observations into members, rejected and unobservable without double counting.

#### Scenario: Negate an unknown buyer count
- **WHEN** buyer identity data is incomplete and a diversity rule is negated
- **THEN** the observation remains unobservable and does not become a member

### Requirement: Batch readiness is evidence backed
The six-filter milestone SHALL run independently of outcome/trend/full-dashboard implementation. Readiness SHALL require independent fixture oracles, verified Batch 001 source replay and sampled recounts, deterministic reruns, working catalog/commands/minimal view, and the measured 2x, 4x and high-concurrency load gates and budgets in design Decision 8. Results SHALL distinguish pending, passed, failed and source-blocked checks; synthetic tests SHALL NOT substitute for real-data validation or predictive evidence.

#### Scenario: Original Batch 001 files cannot be read
- **WHEN** only its saved profile and manifest are available
- **THEN** real-data validation remains blocked, even if all synthetic checks pass

#### Scenario: One-hour batch ends during a coin's first minute
- **WHEN** a finalized recording stops 35 seconds after a coin's creation
- **THEN** that coin's feature window is unobservable and all ordinary first-minute activity filters exclude it with a coverage reason

#### Scenario: Benchmark breaches its memory budget
- **WHEN** a scale case exceeds the specified 1 GiB peak RSS target
- **THEN** readiness fails with recorded measurements until corrected and retested
