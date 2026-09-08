# Plan: Existing-Record Launch Screening Skill

**Status:** planning

## Continuation

- Mode: manual
- Latest boundary: On 2026-09-07 Drew set aside six-hour capture and requested planning a screening skill over the four saved recordings.
- Successor task: none
- Workspace: `/home/drewp/main-projects/wt-1546664272094953562`. This isolated branch is the current planning state. The original folder's planning files remain the old snapshot.
- Source data: `/home/drewp/main-projects/meme explorer/data`, read-only. The original folder has no Git metadata; source and old planning were snapshotted locally without adding the corpus to Git.

## Destination

A reusable skill accepts a declared batch of recordings and produces evidence-backed launch summaries and a reversible shortlist for later outcome checks.

## Success

- All four existing recordings form the first batch; their original timestamps and gaps remain explicit.
- Every observed mint is accounted for; launch-relative assessment requires an observed creation and adequate coverage.
- Each selection cites mint, source run, cutoff, rule version, evidence and missing evidence.
- Low activity, suspicious patterns and inadequate observation are distinct. Rules can change without changing source records.
- A reproducible report lets Drew review real examples before claiming a filter finds future runners.

## Boundaries

- In: batch identity, coverage inventory, raw-field recovery, early features, reversible screening, compact summaries, skill packaging and offline proof.
- Out: six-hour capture, new recordings, source deletion, automatic historical queries, trading and trained predictions.
- This first skill prepares later-query candidates; later outcomes stay separate from early features.
- Luna is a possible reviewer of compact summaries. Core computations and selections need no LLM call.

## Map

- Completed foundation: P-001–P-012 and E-001–E-006, retained as historical collector work.
- Set aside: [P-013](decisions/P-013-six-hour-pilot-retention.md).
- Current: [P-014 — Existing-record launch screening](decisions/P-014-existing-record-launch-screening.md).

## Confirmed decisions

- [P-014](decisions/P-014-existing-record-launch-screening.md): use all four existing recordings and design early-record screening before selectively investigating later outcomes.
- [P-013](decisions/P-013-six-hour-pilot-retention.md): six-hour capture is no longer the current destination.

## Execution

Provisional route: recover fields/coverage → compute early features → apply reviewable selection → package/test skill → review shortlist. Create new E-* tickets after the screening preference and output boundaries are settled. E-001–E-006 remain complete.

## Approval

- Visual review: not ready; shortlist breadth remains a human choice.
- Build handoff: not authorized for a finished implementation. Current artifacts are planning evidence.

## Now

- Current: P-014 — choose broad retention of plausible/uncertain launches or a strict early-activity shortlist.
- Next: settle observable rules against the measured examples, then finish the execution route for review.
