# E-001 — Host plugin and session vertical slice

- Status: complete
- Outcome: A buildable Node-only DSH bundle package exposes one process-singleton fake recorder through the single `pump_observer` model tool and optional `/pump` command, with no browser/client plugin.
- Depends on: P-001, P-008

## Context

- [Session-native adapter proof](../evidence/P-008-session-native-adapter.md)
- [Harness recorder build route](../decisions/P-008-plugin-build-route.md)

## In scope

- Create the local package manifest, TypeScript/build/test configuration, `cordis.patch.yml` bundle layer and Node plugin entry in this project.
- Declare only official DSH/Cordis package dependencies required by the Host service, tools, commands, agent notices and compact storage metadata.
- Implement a process-singleton fake `PumpObserverService` with the confirmed state machine, one-active-run guard, fake clock and five/ten-minute validation.
- Register one cohesive `pump_observer` tool with action dispatch; optionally register `/pump` when `commands` exists.
- Prove one bounded completion notice by re-resolving the initiating session's Agent; preserve retrievability when delivery is unavailable.

## Out of scope

- PumpAPI/network access, durable raw event files, real dataset schemas, enrichment, analysis, client code or Web UI.
- Installing/enabling the package in the user's live Web profile.

## Constraints

- Node/Host plane only; no `dsh.client`, browser RPC/SSE or settings/dashboard contribution.
- Service owns runtime lifetime; tool/command calls return promptly and never own the timer.
- Exactly one visible model tool; do not split every action into a separate tool.

## Proof

- Package build/typecheck/test pass.
- Cordis composition test sees one singleton service, one `pump_observer` schema and zero client artifacts.
- Tool and command call the same service methods; invalid/custom duration and second active run are rejected deterministically.
- Fake timer finalizes before one notice; live/busy/missing-Agent cases follow the documented wake/inject/fallback behavior.

## Completion evidence

- `pnpm run check` passes TypeScript typecheck/build and 11 Node tests.
- Composition proof registers exactly one `pump_observer` tool and optional `/pump` command against one service.
- Fake-clock tests prove five-minute expiry, manual partial Stop, one-active-run rejection, interrupted disposal and idle/busy/missing-session completion delivery.
- Package proof confirms a Node-only DSH bundle with no client contribution and no non-DSH runtime dependency.

## If blocked or disproven

- Return to P-008 only if the current checkout cannot load a linked Host-plane bundle or cannot register the proven tool/command/notice APIs.

## Human review

- None; unit/composition proof only.

## Next eligible ticket

- E-002 — Durable run-dataset storage.
