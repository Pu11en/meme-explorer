## Purpose

Give humans and agents a compact, trustworthy guide to every available analysis, filter, outcome, trend, and dashboard skill from one versioned source of truth.

## ADDED Requirements

### Requirement: Cheat sheet is generated from the runtime catalog
The system SHALL generate the Skills-tab cheat sheet and agent-facing skill index from the same validated catalog entries used for execution. A catalog entry SHALL include question answered, natural-language invocations, inputs, parameters and defaults, outputs, data requirements, cost policy, version, and caveats.

#### Scenario: Change a skill parameter
- **WHEN** a cataloged parameter or default changes
- **THEN** validation fails until the runtime contract and generated guidance agree

### Requirement: Guidance distinguishes runnable and unavailable skills
The cheat sheet SHALL indicate whether each skill is runnable for the active batch and SHALL list missing prerequisites when it is unavailable.

#### Scenario: Executable-return data is absent
- **WHEN** the active batch lacks executable price observations
- **THEN** the executable-return outcome entry is marked unavailable and identifies the missing data instead of offering a misleading run action

### Requirement: Examples support natural conversation
Every skill SHALL provide concise copyable examples for common user questions, including filtering launches, checking a selected outcome, comparing a cohort with baseline, and opening the dashboard.

#### Scenario: Ask which filter performed better
- **WHEN** a user consults trend-comparison examples
- **THEN** they can copy an invocation that names a cohort, baseline, outcome profile, and batch

### Requirement: Caveats accompany interpretation
The cheat sheet SHALL display data-quality, manipulation, causality, and “metric versus validated signal” caveats beside the relevant skill rather than only in a global disclaimer.

#### Scenario: View an early-activity filter
- **WHEN** a user opens its guidance
- **THEN** the entry identifies the fixed first-60-second window and states that high activity can be manipulated and is not evidence of predictive value by itself
