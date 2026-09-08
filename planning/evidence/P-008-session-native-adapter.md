# P-008 — Session-native DSH adapter proof

**Checkout:** `/home/drewp/main-projects/deepseek-harness-src`  
**Audited revision:** `b150a551b`  
**Conclusion:** A Node-only host-plane Cordis plugin can own the recorder, expose it through the Harness session and notify the initiating session at timer expiry without any client plugin or website.

## Supported architecture

1. One host-plane Cordis plugin provides a process-singleton `PumpObserverService`.
2. One model tool named `pump_observer` accepts an `action` (`start | status | stop | list_runs | get_run | get_coin`) and action-specific arguments. A single cohesive tool is preferred over many always-visible tools.
3. An optional `/pump` human command maps the same actions directly for zero-token command use in the Web session.
4. The service owns exactly one PumpAPI socket, the one overall timer, append-only storage and run history. Tool/command calls invoke service methods; they do not own runtime lifetime.
5. Timer expiry re-resolves the initiating live Agent by session ID and delivers one bounded plugin notice. A missing/stale Agent never loses the run; `list_runs/get_run` retrieves it later.

## Direct source evidence

### Session command

- Command definitions and registration: `packages/interaction/commands/src/index.ts:54-69,270-277,328-396`.
- A handler receives the exact live `invocation.agent` and raw input: `packages/interaction/commands/src/index.ts:34-51`.
- Command output is rendered by the UI and does not enter model history: `packages/interaction/commands/src/types.ts:26-34` and `packages/interaction/commands/README.md:15,23-31`.
- Commands are available in the Web composition but not headless/ACP; the model tool is therefore the portable session contract.

### Model tool

- `ctx.tools.register(defineTool(...))`: `packages/core/tools/README.md:20-27,67-91`.
- Tool execution receives `exec.agent`, demonstrated by plan mode: `packages/plan/plan-mode/src/index.ts:342-430` (notably `:358-360`).
- Tool definitions support bounded execution and normal model-visible results; the recorder tool should start/inspect the service and return promptly rather than block for the whole run.

### Process-singleton service

- Cordis service/plugin lifecycle, injection and effect ownership: `vendor/cordis/README.md:33-67`, `vendor/cordis/src/reflect.ts:277-304`, `vendor/cordis/src/registry.ts:176,300`, and `vendor/cordis/src/fiber.ts:415-418`.
- Register command/tool adapters conditionally so the plugin tolerates a composition without one registry; plan mode is the shipped composition example: `packages/plan/plan-mode/src/index.ts:261,295,342`.

### Completion delivery

- Agent `followup`, `inject`, `steer` and general send surface: `packages/core/agent/src/runtime-types.ts:117-143`.
- Plugin-notice message construction: `packages/llm/llm/src/message.ts:192-199`.
- Shipped asynchronous completion pattern, including live-agent ownership, bounded wake behavior and fallback injection: `packages/jobs/tool-jobs/src/index.ts:260-300`.
- Timer expiry must re-resolve the Agent from the initiating session ID; retained Agent references become stale after disposal/resume. If unavailable, skip automatic delivery and preserve retrieval.

### Storage boundary

- `storageDomain` provides validated durable compact state: `packages/storage/storage-domain/README.md`.
- The mounted JSON backend rewrites an entire unit on each write and is unsuitable for the raw stream: `packages/storage/storage-json/README.md:5-12` and `packages/bundle/web-app/cordis.patch.yml:51-62`.
- Raw/normalized/derived NDJSON and blobs therefore live in a plugin-owned append-only directory under the Harness storage root. `storageDomain` holds only settings/current pointer/small summaries.

### Composition boundary

- The plugin row belongs on the Host plane (`$DSH_HOME/cordis.patch.yml` or the profile patch), not inside an agent preset. Process-singleton registries are explicitly Host-plane in `packages/bundle/web-app/cordis.patch.yml:297-445`.
- Package resolution uses the profile directory as `baseUrl`: `apps/cli/src/profile-boot.ts:49-51,98-103,142-171`.
- A Node-only plugin needs no `dsh.client` manifest or Web artifact.

## Minimal session contract

### Model tool: `pump_observer`

- `start`: requires `duration_minutes` equal to `5` or `10`; returns run ID/label/start/end. Rejects when a run is already active and returns that run's status.
- `status`: returns state, remaining time, socket/source status, event count, coin count and gap/error summary.
- `stop`: orderly early stop; returns the finalized partial run label/counts.
- `list_runs`: paginated durable run catalog.
- `get_run`: paginated run summary and coin list.
- `get_coin`: one coin's normalized records or a requested raw-event page.

The optional `/pump` command accepts the same verbs. It is a convenience, not a required dependency of the dataset or model workflow.

## Completion notification policy

- One timer-expiry notification maximum per run.
- The notice contains run ID/label, terminal status, coin/event counts, gap/error count and an instruction to retrieve the first page through `pump_observer get_run`.
- Prefer one wakeup (`followup`) when the initiating Agent is idle and still live; otherwise inject quietly for its next step.
- Never retain an Agent object beyond the invocation. Persist the initiating session ID and re-resolve it at completion.
- If delivery is impossible, the run remains complete and visible through `list_runs`; delivery failure is a reliability record, not run-data loss.

## Lifecycle limits

- Socket/timer do not survive Host death. On restart, preserve files, mark a nonterminal run interrupted and expose stopped.
- Completion wakeup spends a model turn. The one-notice-per-run policy prevents notification storms.
- Natural-language use depends on the model selecting the `pump_observer` tool; `/pump` is the deterministic direct fallback in the Web GUI.

## Objective proof

1. A composition test mounts only Host/plugin/tools (no client plugin) and observes one `pump_observer` schema.
2. Natural-language fixture calls `start`, receives immediately, and service remains running after the turn settles.
3. `/pump start 5` and tool `start(duration_minutes:5)` call the same service method.
4. A second start returns the current run without opening a second socket.
5. Fake timer expiry finalizes storage before emitting one plugin notice.
6. Live initiating Agent receives a followup; busy Agent receives queued injection; absent/stale Agent causes no throw and the run remains retrievable.
7. `status`, `stop`, `list_runs`, `get_run`, and `get_coin` return bounded/paginated results.
8. Host restart marks a running manifest interrupted and never resumes the socket/timer.
9. No `dsh.client`, browser SSE, browser RPC or Web bundle is present.
