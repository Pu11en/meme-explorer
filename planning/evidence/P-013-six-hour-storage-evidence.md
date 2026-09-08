# P-013 evidence — Six-hour storage budget

- Accessed: 2026-09-01
- Source: local validated run `run-0001-20260901T090521.931Z`
- Decision affected: P-013 retention tier

## Observed five-minute corpus

- Run duration: 300,000 ms
- Dataset size: approximately 701 MiB (733,828,745 bytes at the data-root level)
- Raw layer: approximately 391 MiB
- Normalized layer: approximately 310 MiB
- Raw records: 210,305
- Normalized records: 577,396
- Newly observed mints: 33
- Tracked trades: 2,477 (1,305 buys; 1,172 sells)
- Reliability rows: 205,643, of which 204,687 are repeated `untracked_mint` audit rows rather than independent psychology observations

## Compression trial

- Input: first 10,000 lines of `raw/pumpapi-live.ndjson`
- Input bytes: 19,983,681
- gzip bytes: 3,866,467
- Observed ratio: 5.17x
- Limitation: this is a raw-layer sample, not a complete six-hour corpus or normalized-layer benchmark.

## Linear capacity estimate

At the observed byte rate, before retention changes:

- Six hours: approximately 50 GiB
- Twenty-four hours: approximately 200 GiB
- Current filesystem free space: approximately 798 GiB

Actual market throughput varies, so these are capacity estimates rather than guarantees.

## Decision impact

- Full-fidelity six-hour capture is feasible for one pilot but wasteful at the current normalized reliability-row rate.
- Compression alone may reduce the pilot toward roughly 10–15 GiB, but complete-corpus profiling must prove this before relying on it.
- Adaptive retention can remove repeated unrelated-market normalization while preserving raw evidence around tracked launches, transitions and a random control sample.
- Irreversible deletion must not occur until replay against the five-minute corpus measures retained trigger/control coverage.
