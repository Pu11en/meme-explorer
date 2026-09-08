## Why

The recorded Pump.fun batch contains more than one million raw events, which is too large and error-prone to place in an LLM context. The project needs a reusable local analysis runtime that computes exact metrics deterministically while giving a low-cost Luna session only a compact, auditable result.

## What Changes

- Add a versioned analysis-skill catalog and shared run/result contracts.
- Add a deterministic `10-second-buy-activity` metric skill for Pump.fun creation and buy records.
- Distinguish complete observations, zero-buy observations, and unobservable first-ten-second windows.
- Save the complete ranked result locally and emit a bounded receipt suitable for a Luna session.
- Add a project-local Codex skill entrypoint so sessions can discover and run the analysis without loading raw data into model context.
- Produce and verify the first saved result for Collection Batch 001.

## Capabilities

### New Capabilities

- `analysis-skill-runtime`: Discover, execute, and audit deterministic analysis skills against named collection batches.
- `ten-second-buy-activity`: Measure and rank Pump.fun coins by buys in the first ten seconds after observed creation.

### Modified Capabilities

None.

## Impact

Adds analysis modules, a command-line entrypoint, project-local skill instructions, catalog metadata, tests, and generated results beneath the configured data root. Existing recording and normalized datasets remain unchanged.
