# P-003 — Discovery feed boundary

- Status: complete
- Depends on: P-002

## Decision

Define a dependable, replaceable way to ingest the Pump.fun new-token stream for the Discord-alert MVP. This affects delivery latency, operating cost, source lock-in, and testability.

## Viable options

- Not applicable — synthesize/research directly. Use a managed documented WebSocket feed behind a normalized internal event adapter for the MVP; defer raw Solana program decoding unless live validation disproves the feed.

## Recommendation

Use a managed documented WebSocket feed behind a normalized adapter. It minimizes initial build scope while keeping the source replaceable.

## Confirmed decision

Use a managed documented Pump.fun WebSocket feed behind a normalized internal `new_token` event adapter. Require reconnect/backoff, mint-address deduplication, timestamped raw-payload retention, and metrics for receipt delay/drop rate. Recheck current API-key, pricing, rate-limit, redistribution, and uptime conditions before deployment; this is a deployment gate, not an assumed commitment.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- [P-003 evidence](../evidence/P-003-evidence.md)

## Effects

- Define a normalized `new_token` event, reconnection and deduplication behavior, raw-payload retention policy, and a live-observation validation before implementation is authorized.

## Complete when

The plan captures the adapter boundary and pre-deployment provider verification; no human product decision is needed unless the expected operating cost or coverage changes materially.