# P-004 — Data availability and latency inventory

- Status: complete
- Depends on: P-003

## Decision

Before choosing any screening variables, establish what Pump.fun data the MVP can actually obtain, how each field is obtained, and its observed delay from a new-token event. The result determines which variables can be shown in the Discord plugin and which must stay out of the MVP.

## Viable options

- Not applicable — research and measure directly. Build a field-and-latency inventory from the discovery stream, token metadata, and any permitted enrichment source before selecting rules or alert behavior.

## Recommendation

Treat data availability and observed timing as the MVP’s first deliverable. Use the fastest confirmed source as the primary event stream; label every field as event-time, enriched-later, unavailable, or untrusted.

## Confirmed decision

The user redirected the MVP: first determine which data variables are available, how they are retrieved, and how quickly they arrive. The product must be a DeepSeek Harness plugin, not a standalone Discord bot or dashboard.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- [P-003 evidence](../evidence/P-003-evidence.md) — documents the candidate Pump.fun WebSocket discovery feed and its pre-deployment caveat.
- [P-004 evidence](../evidence/P-004-evidence.md) — contains live event observations, field availability, metadata reliability, immediate Solana/RugCheck enrichment timing, DEX indexing delay, and early-trade access constraints.
- [P-005 provider capabilities](../evidence/P-005-provider-capabilities.md) — maps primary-source interfaces, access conditions, and timing categories.
- [P-005 signal candidates](../evidence/P-005-signal-candidates.md) — precisely defines candidate feature families and their manipulation/validation limits.

## Effects

- Replaces the former screening-posture question.
- No liquidity, holder, developer, or risk variable is assumed yet.
- The next plan step must catalogue source fields, permission/cost conditions, delivery delays, and plugin integration constraints, then run a bounded live measurement trial.

## Complete when

A source-by-source matrix identifies candidate variables, retrieval method, access requirements, expected/observed availability, and measured receipt/enrichment latency; the plugin boundary is also identified sufficiently to prototype the matrix inside this Harness.