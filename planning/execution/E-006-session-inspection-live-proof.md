# E-006 — Session inspection and live proof

- Status: complete
- Outcome: The linked plugin works in the existing DSH Web session: natural language controls one real timed run, completion is delivered safely, and saved machine-readable data is retrievable by run/coin without a website.
- Depends on: P-001, P-008, E-005

## Context

- [Session-native adapter proof](../evidence/P-008-session-native-adapter.md)
- [Harness recorder build route](../decisions/P-008-plugin-build-route.md)
- [Versioned run-dataset contract](../evidence/P-008-run-dataset-contract.md)

## In scope

- Finish `pump_observer` action outputs and optional `/pump` mapping for start/status/stop/list-runs/get-run/get-coin.
- Add bounded pagination and raw-event page retrieval; never dump an unbounded dataset into model context.
- Integrate one bounded timer-expiry notice with live/busy/stale Agent handling and durable fallback.
- Package as a local DSH bundle and link it into the existing Web profile using the supported plugin mechanism; rebuild only the Node package and restart the existing DSH Host rather than starting a replacement server.
- Run the full automated suite, then perform one safe five-minute live collection and inspect its saved contract.

## Out of scope

- Website/dashboard/client plugin, trend analysis, scoring, post-run outcomes, trading, paid data and automatic start.

## Constraints

- The run starts only from an explicit user/session request.
- Exactly one active run and one PumpAPI socket.
- Completion output occurs only after durable finalization; notification failure cannot lose the run.
- Existing GUI remains `http://127.0.0.1:3080`; Node changes require restart of that Host.

## Proof

- Build/typecheck/unit/integration/contract tests pass after the final mutation.
- Installed profile exposes exactly one `pump_observer` model tool and optional `/pump`, with no `dsh.client` or new Web artifact.
- Five-minute live run reaches timer expiry, captures every observed pair/event best effort, finalizes one run ID and validates every emitted record against `contract.json`.
- `status`, second-Start rejection, manual early-Stop fixture, run pagination, coin retrieval, raw retrieval, restart/interrupted recovery and stale-session completion fallback all pass.
- Secret scan and dependency/license audit pass before handoff.

## Automated and packaging evidence

- Durable `PumpObserverRuntime` wires `RunStore`, the real PumpAPI recorder and in-window enrichment behind the one `pump_observer` tool.
- Session inspection bounds run pages at 20, coin/detail pages at 20 and raw pages at 10; inline raw payloads are session-truncated while durable bytes remain intact.
- Runtime restart persistence, coin retrieval, raw retrieval, unknown-stream rejection, interrupted recovery and idle/busy/stale notice boundaries are covered.
- Full build/typecheck/unit/integration/contract suite passes 29/29 tests, including the production Zstandard replay boundary.
- `dsh-pump-observer` is linked into the existing `web` profile; package dry-run contains only Host-plane artifacts.
- Production audit reports no known vulnerabilities; no production packages/licenses are added beyond DSH/Cordis peers. Secret scan found no real credentials (only fixture paths, documentation words, lockfile integrity hashes and public research identifiers).
- Real PumpAPI preflight opened `wss://stream.pumpapi.io/` and received a 1,566-byte frame; the GUI at `http://127.0.0.1:3080` still returns HTTP 200.
- Direct live proof `run-0001-20260901T090521.931Z` reached timer expiry on the one overall five-minute timer and finalized durably with 210,305 raw records, 577,396 normalized records and 33 observed mints.
- Full-tree validation passed for all 210,305 raw and 577,396 normalized records; coin pages returned 20 then 13 of 33 mints with correct `has_more` states.
- Streaming live inspection returned 5 matching records for one mint and exactly 10 of 210,305 raw records with `has_more: true`, without loading the entire NDJSON file into session memory.
- The existing Host was restarted in place. This GUI exposed the linked `pump_observer` tool, returned stopped status, listed the persisted run, retrieved 20/1,463 matching coin records with `has_more: true`, and returned exactly 10/210,305 raw records with `has_more: true`.

## If blocked or disproven

- Return to P-008 if the current Web profile cannot resolve/link the Node bundle or the session notice boundary differs from the audited checkout. Provider outage alone records a failed/gapped live run and does not reopen architecture.

## Human review

- In the existing session, say `start a 5-minute run`; verify the start confirmation, optional `status`, one completion notice, every captured coin in paginated retrieval, one `get_coin` detail and `list_runs` persistence after a Host restart.

## Next eligible ticket

- Plan complete.
