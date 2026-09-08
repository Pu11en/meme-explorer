# P-002 — First launch sources

- Status: complete
- Depends on: P-001

## Decision

Choose which Solana launch venues define a “new pair” for the Discord-alert MVP. This determines coverage, ingestion complexity, and the speed/reliability of the initial live test.

## Viable options

- A. Pump.fun and Raydium — cover the dominant launch-to-tradable path while keeping source logic focused; may miss pairs appearing first elsewhere.
- B. Pump.fun only — fastest and most focused launch feed; excludes direct Raydium and other-venue launches.
- C. Broad Solana venues from day one — include Pump.fun, Raydium, Orca, Meteora, and Jupiter-routable new pools; broader coverage, but more false positives and integration work.

## Recommendation

A — Pump.fun plus Raydium captures the most useful initial path without overextending the MVP.

## Confirmed decision

Pump.fun only — prioritize the narrowest first launch feed for the fastest MVP. Chosen by the user as option B.

## Delegation

None.

## Interaction state

- Recommended-key streak: 0
- Option-B shortcut: not ready

## Evidence

- No external evidence needed.

## Effects

- The selected venues constrain data-source research, normalized event fields, deduplication, and the live-test corpus.

## Complete when

The initial launch venues are selected and the plan can define one discovery event per source without reopening coverage scope.