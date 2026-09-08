# P-006 — Collector only; analysis later

- Status: complete
- Depends on: P-005

## Decision

The MVP is a neutral collector only. It records complete machine-readable run datasets and does not decide what is a good buy, score tokens, detect trends or fire alerts. Separate future skills may analyze one or more saved run IDs, but those skills are outside this plan.

## Viable options

- Not applicable — the user explicitly chose manual interpretation for now.

## Recommendation

Build a neutral event recorder with durable raw and normalized run datasets. Preserve timing, provenance and failures, and postpone every analysis skill, signal formula and threshold.

## Confirmed decision

The current build establishes only the reusable collection layer. Its output is complete structured data keyed by run ID; later, separately planned skills may inspect individual runs, compare runs and search for trends.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- [Outcome observability matrix](../evidence/P-005-outcome-observability.md)
- [Primary-source signal report](../evidence/P-005-signal-candidates.md)

## Effects

- No analysis skill, automated outcome, variable role, threshold or score is in the MVP.
- Raw payloads and normalized machine-readable records are primary; session viewing is only an inspection convenience.
- Start with no paid data commitment; keep source adapters and the dataset contract replaceable/versioned so later skills do not depend on one provider.

## Complete when

The plan clearly separates neutral collection from all later analysis and treats recording completeness, timing, provenance and replayable datasets as the MVP’s value.