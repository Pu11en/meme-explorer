## Purpose

Attach later, time-bounded evidence to each coin so early cohorts can be evaluated against a $30,000 USD market-cap success definition and separate migration, executable-return, and durability outcomes.

## ADDED Requirements

### Requirement: Outcome checks use explicit profiles
The system SHALL evaluate coins against a named, versioned outcome profile that declares decision time, observation horizon, required data, thresholds, and pass logic. “Successful” SHALL mean passed under the selected profile and SHALL never be stored as an unqualified universal coin property.

#### Scenario: Inspect the active success definition
- **WHEN** a user views a success label or comparison summary
- **THEN** the system identifies the exact profile, USD threshold, three-hour horizon, and evidence version that produced it

### Requirement: Market-cap success is time bounded and unit explicit
The system SHALL provide a default `market-cap-at-least-usd-30k-within-3h/v1` profile that passes when an accepted, timestamped USD market-cap observation is at least 30,000 at or before three hours after creation. All observations in one result SHALL use the profile's declared formula and price-reference rules. A coin whose verified coverage ends before three hours without a qualifying observation SHALL be right-censored rather than failed.

#### Scenario: Recording ends before the horizon
- **WHEN** a coin has not reached $30,000 and verified market-cap coverage ends two hours after creation
- **THEN** its success outcome is censored and it is excluded from the evaluated pass-rate denominator

### Requirement: Migration remains a separate informational outcome
The system SHALL retain reconciled completion and migration facts but SHALL NOT use migration by itself to set the default success status.

#### Scenario: Coin migrates without accepted threshold evidence
- **WHEN** a migration is observed but no accepted market-cap observation establishes the $30,000 threshold
- **THEN** migration is shown separately and the success check remains censored or unavailable according to its market-cap coverage

### Requirement: Executable-return and durability checks preserve their measurement terms
The system SHALL support configurable executable-return checks based on a declared decision-time baseline, fixed notional, fees, maximum net executable return, and horizon, and durability checks based on a declared later horizon, route availability, executable depth, and value or liquidity retention. These checks SHALL remain separate from the $30,000 market-cap profile and SHALL be unavailable when their required observations are absent.

#### Scenario: Price snapshots cannot support executable return
- **WHEN** a breakout profile requires executable quotes but only provider-reported market-cap snapshots exist
- **THEN** the check is unavailable with a missing-evidence reason rather than approximated from market cap

### Requirement: Outcome statuses distinguish all non-pass cases
Every check SHALL return exactly one of passed, failed, censored, or unavailable, with evidence references and reason codes. Failed SHALL mean the horizon was fully observed and the declared condition was not met.

#### Scenario: Fully observed market cap remains below threshold
- **WHEN** verified market-cap coverage spans the full three-hour horizon and every accepted observation is below $30,000
- **THEN** the success check is failed with its highest observed value, timestamp, coverage interval, and evidence lineage retained

### Requirement: Feature and outcome clocks prevent temporal leakage
Every comparison SHALL record a feature cutoff and outcome window. The system SHALL reject a run when a filter input contains observations after the declared decision time or when an outcome fact predates the permitted outcome window.

#### Scenario: Later price enters an early filter
- **WHEN** a ten-second decision cohort includes a field observed one minute after creation
- **THEN** outcome evaluation stops with a temporal-leakage error identifying the field and observation time

### Requirement: Outcome artifacts preserve provenance
Each outcome run SHALL save immutable per-coin checks, selected profile, source snapshots or event references, provider and commitment metadata, parser versions, coverage intervals, reconciliation state, and a bounded receipt.

#### Scenario: Revisit an outcome decision
- **WHEN** a user opens a coin's outcome detail
- **THEN** they can see the exact profile, facts, timestamps, coverage, and reasons that produced its status
