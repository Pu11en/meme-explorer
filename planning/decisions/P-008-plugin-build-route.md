# P-008 — Harness recorder build route

- Status: complete
- Depends on: P-007, P-010, P-012

## Decision

Turn the verified recording contract into a session-controlled DeepSeek Harness recorder with natural-language start/status/stop commands and durable reports that are read entirely inside the session.

## Viable options

- A. Harness process service with session-native commands and reports — dependable timed recording while the Host runs, with no browser UI.
- B. Browser dashboard plus backend service — richer scanning but conflicts with the requested session-only viewing flow.
- C. One long conversation turn — simplest conceptually, but fragile for dependable timed recording and durable run history.

## Recommendation

A — one stopped-by-default process-singleton Host service controlled and inspected through the initiating Harness session. The service owns dependable recording and storage; session commands are the only user-facing surface.

## Confirmed decision

- The observer is a DeepSeek Harness plugin, not a one-turn chat task. Exactly one run may be active per Host process; a second start request returns the current run and remaining time instead of opening another socket or duplicating data.
- Starting a run accepts exactly five or ten minutes, stated naturally in the session; there is no custom or open-ended run mode.
- The backend stores `startedAt` and optional `stopsAt`, owns the timer, and invokes the same orderly Stop path when the timer expires.
- Saying `stop the run` cancels the timer, closes the one PumpAPI socket, drains accepted writes, saves all partial data and marks the durable run `stopped early`; it never silently discards the run.
- Leaving the initiating conversation or working elsewhere does not stop a running observer while the Harness Host remains alive; the durable run remains retrievable even if automatic completion delivery to the original session is unavailable.
- If the Harness Host exits/restarts, the socket and timer cannot survive process death; durable data remains, the run is marked interrupted, and the observer returns to stopped.
- The timer applies to the complete recording run, not separately to each pair. In a ten-minute run, a pair launched at minute eight receives two minutes of data; live capture and tracking stop together at minute ten. No later outcome snapshots occur. Delayed replay may only repair missing events whose source time falls inside the original run window.
- There is no website, dashboard, settings page or browser client plugin. All control and viewing happen through messages in the Harness session.
- After confirming Start, the session stays quiet unless the user asks `status` or `show coins so far`; it never floods the conversation with automatic event or interval messages. At overall timer expiry, capture stops, the run is saved, and the initiating session automatically receives a compact run summary followed by a paginated list containing every captured coin. Full event/raw detail appears only when a specific coin is requested.
- Every on-demand run receives a durable automatic label such as `Run 001 — date/time — duration`. Session requests such as `show runs`, `show run 1`, and `show coin <mint or row number> from run 1` retrieve saved history.
- The primary output is a durable, versioned, machine-readable dataset keyed by run ID. The paginated session list and per-coin retrieval are inspection conveniences, not the analysis product; later separately planned skills can consume the dataset contract directly.

## Backend route

1. One Node-only host-plane Cordis plugin; no client plugin or Web artifact.
2. Process-singleton `PumpObserverService` state machine: `stopped → starting → running → stopping → stopped`, with failure finalized as `error` before returning to stopped.
3. Exactly one external PumpAPI WebSocket per Host process and at most one active run.
4. One cohesive model tool, `pump_observer`, with actions `start`, `status`, `stop`, `list_runs`, `get_run`, and `get_coin`; an optional `/pump` command maps the same service methods for deterministic direct use.
5. Ordered append-only raw/normalized/derived storage governed by the linked versioned run-dataset contract and an explicit bounded flush/durability boundary.
6. DSH `storageDomain` only for compact settings, current-run pointer and small summaries; never raw stream events.
7. One per-process token map governed by the single overall run timer; there is no timer or expiry queue per token.
8. Timer expiry finalizes durable storage, re-resolves the initiating Agent by session ID, and emits at most one bounded plugin notice using the shipped followup/inject pattern. Delivery failure never loses the run.
9. Restart opens prior durable data, marks a nonterminal run interrupted and exposes stopped; it never resurrects a socket/timer.
10. The plugin is enabled as a Host-plane patch row after its required services, not inside an agent preset.

## Session viewing route

- Natural language such as `start a five-minute run` invokes `pump_observer(start)`; `/pump start 5` is an optional deterministic shortcut.
- During recording, `status` returns remaining time, source/socket state, raw/event/coin counts and gap/error summary; `get_run` may return the current paginated coin catalog.
- Completion emits one bounded session notice only after the durability boundary passes. The model retrieves the paginated completed dataset through `get_run`; a stale/missing session does not affect storage.
- `list_runs` lists durable numbered runs; `get_run` reopens one run; `get_coin` retrieves normalized records or requested pages of raw events.
- Session results are bounded/paginated inspection output. The versioned dataset remains the authoritative complete output.

## Delegation

2026-08-26, in-session (free text, not the B shortcut): "just do what you recommend" — scope: remaining reversible display/run decisions. The user later replaced the display concept with session-only inspection and clarified that the collector dataset—not readability or analysis—is primary. This delegation is exhausted; P-009 was separately settled by the explicit collector-only direction. Build authorization remains outside all delegation.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: consumed

## Evidence

- [Plain recording contract](../evidence/P-007-recording-contract.md)
- [Update cadence and timing model](../evidence/P-008-update-cadence.md)
- [Ten-minute collection cadence](../evidence/P-009-ten-minute-collection-cadence.md)
- [DSH plugin start/stop architecture audit](../../research/dsh-plugin-start-stop-architecture-audit.md)
- [Session-native DSH adapter proof](../evidence/P-008-session-native-adapter.md)
- [Versioned run-dataset contract](../evidence/P-008-run-dataset-contract.md)

## Effects

- P-009 is complete: all enabled-source payloads are preserved raw and normalized into a versioned run dataset; no further field-pruning or display review is required.
- Execution tickets must prove one-socket ownership, overall timer/manual-stop convergence, durable append/reopen, persistent run history, session invocation/report contracts, pagination, completion delivery and restart behavior.
- The follow-up checkout audit proves the session-native boundary: one host-plane Node plugin, one cohesive model tool, optional `/pump` command, process-singleton service and bounded followup/inject completion notice. The earlier browser dashboard/SSE/RPC route is superseded.

## Complete when

The runtime lifetime, persisted event format, session/run schema, supported session invocation/report boundary, pagination behavior, vertical-slice package boundary and objective build/test tickets are explicit and reconciled with P-009.