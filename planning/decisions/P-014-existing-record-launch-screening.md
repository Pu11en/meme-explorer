# P-014 — Existing-record launch screening

- Status: current
- Depends on: completed collector E-001–E-006 and measured corpus evidence

## Decision

Define a first skill that narrows later investigation using early recorded evidence. The first ready human choice is shortlist breadth.

## Viable options

- A. Keep plausible and uncertain launches — Recommended; fewer premature exclusions, more potential later checks.
- B. Keep only strong early launches — Smaller follow-up list, but slow starters may be missed. Missing evidence still cannot become proof of a bad launch.

Example: one recorded KIWI mint has two buys and only 12.6 seconds of observation. It cannot receive the same inactivity verdict as a coin observed for several minutes without a trade.

## Recommendation

A — Start with a broad, reversible shortlist. Preserve quiet and uncertain comparison groups so later, explicitly chosen checks can reveal false negatives. The skill itself makes no extra outcome queries for controls.

## Confirmed decision

- Drew explicitly set aside the six-hour capture plan and requested work over all existing records.
- The first input is four recordings totaling 30 recorded minutes: one analysis batch, not one continuous session.
- Desired sequence: screen early records → selectively investigate later outcomes → learn what distinguishes outliers.
- The current task shapes the build and skill behavior. “Bad,” “ran afterward” and “normal trader could have got in” are not yet operationally validated labels.
- GPT-5.6 Luna is the candidate model implied by the user's Luna question; its final role remains a proposal.
- Shortlist breadth is unconfirmed. The optional A/B question has no recorded answer; silence is not a selection.

## Delegation

None. Technical mechanics below are proposals derived from evidence, not blanket delegation of product tradeoffs or build approval.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Proposed skill behavior

Working name: `meme-launch-screen`; not installed or built.

1. Accept a data root and explicit run IDs or time selection. Save a batch manifest with intervals, file hashes and rule version. First use selects all four saved recordings.
2. Inventory every observed mint. Coins without an observed creation stay visible as missing launch context. Preserve venue, currency and gaps; do not pretend separate recordings form a continuous timeline.
3. Recover useful raw facts into a versioned analysis layer: venue, quote mint, transaction signer, reserves, fees and provider authority facts. Preserve raw references and provider semantics. A launch signer is not automatically the beneficial creator.
4. Compute early-window features using only records received by each declared decision cutoff. Compare 30/60/120-second windows in planning; the default remains provisional. Short duration, missing start, disconnection and missing fields are separate coverage reasons.
5. Compute activity, distinct reported traders, buy/sell flow, concentration, repetition, price path and reserves with code and exact decimal units. Separate venue formulas and currencies. Old field names ending in `_raw` are not proof of integer base units.
6. Keep coverage, activity, risk evidence and follow-up priority as separate dimensions. The human report can group coins as candidate, low activity, suspicious/review, and insufficient evidence. Risk flags may overlap activity; a single “good coin” score must not hide that.
7. Save reversible selections with reason codes. Interpret “delete bad coins” as exclusion from the working selection during rule development. Physical source deletion is outside this plan.
8. Export a compact candidate list and later-query requirements. Freeze early features/selection before obtaining future labels. Current risk scores, future wallet links and later prices must not leak into early features.
9. Package deterministic helpers with a focused skill and schema reference. Luna may explain bounded summaries, check inconsistencies or suggest hypotheses. Arithmetic and selection remain reproducible without it. Names, metadata and retrieved text are untrusted data.

## Label and evidence limits

- Bundle-like timing/concentration is a warning proxy, not proof of bundle membership, fraud or common control.
- Some observed sells do not establish executable entry/exit at a particular position size, delay, fee or slippage.
- Price/reserve collapse alone does not establish a rug; migration must be distinguished from a drain.
- Later-runner labels require a baseline, decision delay, return threshold, horizon, activity/liquidity condition and missing-history treatment. Resolve those in the later outcome stage; the first screen leaves future outcomes unknown.
- Checking only shortlisted coins cannot establish how many winners the filter missed. Preserve identities/reasons so a later control audit remains possible.
- This small batch can expose implementation errors and useful hypotheses; it cannot validate general predictive performance.

## Evidence

- [Measured inventory, trial and official references](../evidence/P-014-screening-evidence.md)
- [Machine-readable profile](../evidence/P-014-corpus-profile.json)
- [Stable user brief](../evidence/inputs/P-014-user-brief.txt)

## Effects

- Set P-013 aside; leave collection unchanged.
- After the preference and rules settle, create new E-* tickets for raw-field/coverage recovery, deterministic screening, then skill packaging and proof. Preserve historical completed tickets.
- Review the first screen before expanding into history acquisition or model training.
- This is a proposed route; no production skill, historical lookup or paid model call has been performed.

## Complete when

Shortlist breadth is explicit; measurable rules distinguish inactivity from missing evidence; output and later-query boundaries are clear; proof/failure cases support session-sized execution tickets; and PLAN/NEXT/PLAN-VIEW agree. Final build approval follows the concrete route.
