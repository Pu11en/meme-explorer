# P-005 — Outcome observability

- Status: complete
- Depends on: P-004

## Decision

Identify exactly how fast breakout, curve completion/migration, and durable-market behavior can be observed before choosing any of them as an alert outcome.

## Viable options

- Not applicable — research and map the raw facts, tools, access requirements, clocks, and limitations for all three outcomes.

## Recommendation

Instrument all three outcome timelines in a measurement-only Harness MVP. Do not select a primary outcome or label a token a buy until the required data paths have been measured.

## Confirmed decision

The current phase is tools and exact data, not choosing an outcome. Fast breakout requires Pump trade/curve observations and executable-price calculations; migration uses explicit Pump curve state and completion/migration events. The MVP records these only when they occur inside the overall five- or ten-minute run. Durable-market behavior and other post-run outcome checks are researched but excluded from the MVP; the user will judge later performance separately.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- [Outcome observability matrix](../evidence/P-005-outcome-observability.md)
- [Full primary-source signal report](../evidence/P-005-signal-candidates.md)
- [Candidate variable catalog](../evidence/P-005-signal-variable-catalog.md)
- [Provider capability matrix](../evidence/P-005-provider-capabilities.md)

## Effects

- Fast-breakout measurement is blocked from the no-key MVP unless the plugin obtains a keyed PumpPortal trade stream or decodes Pump events from an RPC stream.
- Migration can be tracked with free provider triggers plus canonical chain reconciliation.
- Durable-market tracking after the overall timer ends is excluded from the MVP.
- The first Harness MVP collects and displays only facts observed inside the run, without a buy label.

## Complete when

Each outcome has an exact raw-data list, tool path, access/timing condition, and failure interpretation without selecting a threshold or declaring predictive value.