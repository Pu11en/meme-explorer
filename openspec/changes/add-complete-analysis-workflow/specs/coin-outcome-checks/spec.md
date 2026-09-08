## Purpose

Attach later, time-bounded evidence to each coin so early cohorts can be evaluated against explicit definitions of migration, breakout, durability, and selected success.

## ADDED Requirements

### Requirement: Outcome checks use explicit profiles
The system SHALL evaluate coins against a named, versioned outcome profile that declares decision time, observation horizon, required data, thresholds, and pass logic. “Successful” SHALL mean passed under the selected profile and SHALL never be stored as an unqualified universal coin property.

#### Scenario: Change the success definition
- **WHEN** a user switches from a migration profile to a breakout profile
- **THEN** success labels and comparison summaries are recomputed under the new profile while the underlying outcome facts remain unchanged

### Requirement: Migration outcome is canonically time bounded
The system SHALL provide a default `migration-within-24h/v1` profile that passes only when a reconciled migration is observed at or before 24 hours after creation. A coin whose observation coverage ends before 24 hours without a migration SHALL be right-censored rather than failed.

#### Scenario: Recording ends before the horizon
- **WHEN** a coin has no migration event and verified coverage ends two hours after creation
- **THEN** its migration outcome is censored and it is excluded from the evaluated pass-rate denominator

### Requirement: Breakout and durability checks preserve their measurement terms
The system SHALL support configurable breakout checks based on a declared decision-time baseline, fixed notional, fees, maximum net executable return, and horizon, and durability checks based on a declared later horizon, route availability, executable depth, and value or liquidity retention. A check SHALL be unavailable when its required observations are absent.

#### Scenario: Price snapshots cannot support executable return
- **WHEN** a breakout profile requires executable quotes but only provider-reported market-cap snapshots exist
- **THEN** the check is unavailable with a missing-evidence reason rather than approximated from market cap

### Requirement: Outcome statuses distinguish all non-pass cases
Every check SHALL return exactly one of passed, failed, censored, or unavailable, with evidence references and reason codes. Failed SHALL mean the horizon was fully observed and the declared condition was not met.

#### Scenario: Fully observed non-migration
- **WHEN** verified coverage spans the full migration horizon and no reconciled migration occurred
- **THEN** the migration check is failed with the coverage interval and evidence lineage retained

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
