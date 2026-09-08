## Context

The recorder already stores versioned Pump.fun tokens, trades, reliability facts, and run manifests. Batch 001 contains four completed runs and 1,074,873 raw envelopes, so model-driven record counting would be both expensive and unreliable. See `proposal.md` and `specs/analysis-skill-runtime/spec.md`.

## Goals / Non-Goals

**Goals:**
- Stream raw Pump.fun envelopes with bounded memory and lossless provider-number parsing.
- Save deterministic, versioned full results and a small Luna-facing receipt.
- Establish reusable batch, catalog, result, and observability contracts.

**Non-Goals:**
- Dashboard implementation, outcome prediction, bundle classification, or external enrichment.
- Treating an early-buy metric as a validated trading signal.

## Decisions

1. **Compute locally, summarize with Luna.** A local TypeScript analyzer performs all counting and exact decimal aggregation. The agent receives the command, receipt, and selected pages only. Directly prompting over raw records was rejected because it spends model context and makes arithmetic nondeterministic.
2. **Use raw Pump.fun events as the historical authority.** The analyzer treats `raw/pumpapi-live.ndjson` as authoritative because older normalized files omit some creation frames. It uses normalized reliability facts only for recorded disconnect stalls.
3. **Use half-open time windows.** Ten-second activity is `[creation, creation + 10,000 ms)` and bars are `[n seconds, n+1 seconds)`. This removes boundary ambiguity.
4. **Save immutable versioned outputs.** Results live below the configured data root under `analysis/<batch>/<skill>/<result-id>/`; every result records formula version, parameters, input run IDs, and creation time.
5. **Bound the model receipt.** The default and maximum preview is 20 rows. The receipt points to the complete NDJSON result for pagination. This is the enforceable context-control boundary; subscription billing remains external.
6. **Represent uncertainty explicitly.** A missing creation timestamp, a run ending before the window, or a known stream gap produces an unobservable row with reasons. It never becomes a zero.
7. **Provide results to a browser presentation.** Structured JSON and NDJSON remain internal inputs for downstream skills. The current browser surface is defined by the comparison-page change; PDF, Markdown, and CSV are not human-facing deliverables.

## Risks / Trade-offs

- **[A gap may lack an explicit recovery marker]** → Close a recorded disconnect at the first subsequent retained token/trade receipt and preserve the inferred boundary in result quality metadata.
- **[Provider timestamps can be malformed]** → Mark the affected coin unobservable and retain the reason.
- **[A later normalizer changes facts]** → Pin the analyzer formula version and source dataset version in every result.

## Migration Plan

This is additive. Build and test the analyzer, run it against Batch 001, and retain the existing recorder and raw datasets unchanged. Rollback removes generated analysis outputs and the new analysis module without altering run data.
