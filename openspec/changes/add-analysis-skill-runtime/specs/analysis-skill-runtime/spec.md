## Purpose

Provide reproducible, low-model-cost analysis skills that turn selected Pump.fun run datasets into versioned metric tables and compact session receipts.

## ADDED Requirements

### Requirement: Collection batches identify immutable run inputs
The system SHALL accept a named collection batch containing one or more existing Pump.fun run IDs and SHALL record those run IDs in every saved analysis result.

#### Scenario: Analyze four recorded runs
- **WHEN** a user runs an analysis for Batch 001 containing four run IDs
- **THEN** the saved result identifies Batch 001 and all four source run IDs

### Requirement: Ten-second buy activity uses coin-relative time
The system SHALL count buy trades whose source timestamp is at or after coin creation and strictly before ten seconds after creation, and SHALL produce ten one-second count bars.

#### Scenario: Boundary trades
- **WHEN** buys occur at 0 milliseconds, 9,999 milliseconds, and 10,000 milliseconds after creation
- **THEN** the first two buys are counted and the 10,000-millisecond buy is excluded

### Requirement: Results preserve observation quality
The system SHALL distinguish complete observations, zero-buy complete observations, and observations made incomplete by a run boundary or recorded stream gap.

#### Scenario: Run ends before the window closes
- **WHEN** a coin creation occurs fewer than ten seconds before the recorded run ends
- **THEN** the coin is marked unobservable rather than assigned zero buys

### Requirement: Ranking is deterministic
The system SHALL rank observable coins by buy count, then unique buyers, then exact quote volume, using a stable mint-address tie breaker.

#### Scenario: Repeated execution
- **WHEN** the same skill version and collection batch are analyzed twice
- **THEN** the ordered metric rows and values are identical

### Requirement: Model-facing output is compact
The system SHALL save the complete result locally and emit a compact receipt containing summary counts, quality information, a bounded top-row preview, and the full result path.

#### Scenario: Large batch analysis
- **WHEN** the batch contains more coins than the preview limit
- **THEN** the session receives only the bounded preview while the complete table remains available locally

### Requirement: Analysis skills are discoverable
The system SHALL maintain a catalog entry describing each skill's question, inputs, outputs, parameters, cost policy, version, and natural-language invocation examples.

#### Scenario: Find the early-buy skill
- **WHEN** an agent searches the catalog for early buying activity
- **THEN** it can identify and invoke the ten-second buy activity skill without reading raw data into model context
