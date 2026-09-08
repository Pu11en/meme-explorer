# P-013 — Six-hour pilot retention

- Status: superseded by user direction on 2026-09-07
- Depends on: P-009, P-013 uses the completed E-006 collector proof

## Decision

Choose how one continuous six-hour data-capture pilot retains enough whole-market context and full tracked-coin evidence for later exploratory skill design without repeating the five-minute run's unsustainable byte rate.

## Viable options

- A. Adaptive evidence tiers — Recommended; retain full detail for newly launched/tracked coins and important transitions, compact one-second whole-market telemetry, plus a 5% random full-detail control sample. Best balance, but retention rules must be proved not to erase quiet buildup.
- B. Full fidelity, compressed — Preserve every raw and normalized record for the one pilot, compressed and partitioned. Maximum future flexibility, but likely around 10–15 GiB for six hours if full-run compression resembles the measured sample and substantially more if it does not.
- C. Tracked launches only — Keep full detail only for coins launched during the six-hour block and discard unrelated whole-market raw traffic after compact counters. Smallest corpus, but weakens market-regime and matched-control analysis.

## Recommendation

A — Adaptive evidence tiers, with immutable full-detail tracked-coin timelines, progressive-resolution context, and a random ordinary-period control sample. This cuts repetitive whole-market volume while preserving evidence needed to detect selection bias.

## Confirmed decision

On 2026-09-07 Drew explicitly set aside six-hour capture and requested a screening skill over existing recordings. Continue at [P-014](P-014-existing-record-launch-screening.md). The remaining text is historical and does not authorize collection.

The user selected one continuous six-hour pilot only, followed by a stop in collection work while that block is explored for candidate analysis skills. Analysis, psychology labels, model selection and further collection are separate future work. The retention tier remains unconfirmed.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: consumed

## Evidence

- [Measured pilot storage evidence](../evidence/P-013-six-hour-storage-evidence.md)

## Effects

- Extend the existing single-socket runtime with one explicit six-hour pilot mode; do not create arbitrary or recurring schedules.
- Add queryable progress: elapsed/remaining time, durable sequence, record counts, bytes retained, launch count, current retention tier and reliability/gap state.
- Separate the capture cutoff from analysis: the six-hour output is a frozen corpus, and no model runs during collection.
- After retention is confirmed, create execution tickets for retention profiling, six-hour runtime/storage, proof fixtures and the real pilot.

## Complete when

One retention option is explicitly confirmed, the six-hour capture/progress/stop boundaries are unambiguous, and PLAN.md, PLAN-VIEW.md and NEXT.md agree on the route.
