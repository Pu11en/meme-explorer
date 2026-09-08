# P-010 — Reuse existing tools

- Status: complete
- Depends on: P-004

## Decision

Decide whether the recorder should use the verified PumpAPI live/replay service and audited open-source modules instead of building Pump event collection from scratch.

## Viable options

- A. Reuse PumpAPI plus audited `pump.fun.meter` modules — richest working stream and replay path; keeps our code focused on Harness storage/viewing, with provider dependency.
- B. Reuse only the free PumpPortal creation adapter — simplest and already tested, but lacks live trade history needed for trends.
- C. Build canonical Pump/Solana decoding ourselves — maximum control, but unnecessary complexity for the first manual-observation MVP.

## Recommendation

A — use the working PumpAPI stream/replay and selectively reuse MIT toolkit modules after an audit. Keep the adapter replaceable and save raw events so the backend can change later.

## Confirmed decision

Reuse only the free PumpAPI live stream and free historical replay as the base. Build a small replaceable adapter and local raw log. Do not use `pump.fun.meter` as a package because two install attempts failed; do not copy unlicensed/all-rights-reserved alternatives. No paid API, funded wallet, metered stream, or paid enrichment belongs in the MVP.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- [Reuse candidate audit](../evidence/P-010-reuse-candidates.md)
- [Deep free-only reliability dossier](../evidence/P-011-free-data-reliability-dossier.md)

## Effects

- Pauses one-by-one metric review until the base stream’s actual fields are accepted.
- Shrinks implementation to a Harness wrapper, local event store, replay, and timeline UI.

## Complete when

The reuse foundation is selected and its access/license/audit constraints are recorded.