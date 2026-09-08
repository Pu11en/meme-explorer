# P-007 — Recording contract

- Status: complete
- Depends on: P-006

## Decision

Specify the facts the MVP must record for every token so later, separately planned analysis skills can consume trustworthy and comparable run datasets.

## Viable options

- Not applicable — derive the minimum recording contract from verified data availability and preserve raw payloads for fields not yet understood.

## Recommendation

Record a token timeline in five plain sections: launch, early activity, creator/ownership context, migration, and market state whose event time falls before the overall timer ends. Every fact includes when it was observed, where it came from, and whether retrieval failed. No scheduled post-run outcome checks belong in the MVP; delayed replay may only repair gaps for events that occurred inside the original run window.

## Confirmed decision

No metric is currently treated as good or bad. All recorded measurements are neutral observations for manual comparison.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- [Plain recording contract](../evidence/P-007-recording-contract.md)
- [Primary-source signal report and raw schema](../evidence/P-005-signal-candidates.md)
- [Observed availability and latency](../evidence/P-004-evidence.md)

## Effects

- Defines the versioned run-dataset model, session inspection contract, replay/import format, and completeness checks for the Harness collector.

## Complete when

The required facts, timestamps, failure states, raw-payload policy, and token timeline are clear enough to create build tickets without deciding signal quality.