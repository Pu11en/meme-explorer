# P-001 — MVP alert surface

- Status: complete
- Depends on: none

## Decision

Choose how the MVP delivers a newly detected Solana memecoin pair after initial safety and liquidity screening. This determines the user-visible product, what needs to be built first, and how we prove useful real-time monitoring.

## Viable options

- A. Telegram alert feed — deliver a compact alert with pair, liquidity, age, holder/dev risk cues, and links; fastest path to actionable monitoring, but limited exploration.
- B. Web dashboard — provide a live ranked feed and pair detail page; richer inspection, but more UI and hosting work.
- C. API/webhook — emit normalized new-pair events for another system; most composable, but not a standalone trader experience.

## Recommendation

A — a Telegram alert feed makes the MVP useful the soonest and keeps the first proof focused on detection quality and latency.

## Confirmed decision

The first surface is the initiating DeepSeek Harness session. The user starts an on-demand run in natural language and views the run summary, complete coin list and requested coin details in that session. No Discord feed, website or dashboard belongs in the MVP.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- No external evidence needed.

## Effects

- Define session-native start/status/stop/list/show behavior, durable run storage, compact report pagination and an end-to-end live-test plan.

## Complete when

The alert surface is selected, the intended recipient can be named, and the plan map, view, and next-action index agree.