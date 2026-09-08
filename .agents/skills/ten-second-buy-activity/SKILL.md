---
name: ten-second-buy-activity
description: Measure or rank Pump.fun coins by buy activity during the first ten seconds after creation for a named collection batch.
---

# Ten-second buy activity

Run the deterministic analyzer; raw or normalized event records do not belong in model context.

1. Resolve the requested collection batch JSON under `analysis/batches/`.
2. Build the project if `lib/analysis/cli.js` is absent or older than its TypeScript source.
3. Run `pnpm analyze:10s-buys -- --data-root <data-root> --batch <batch-json> --preview <1-20>`.
4. Parse the single JSON receipt printed to stdout. Present its summary and requested preview rows, and retain the full-result paths for pagination or downstream skills.
5. In Discord, attach `report_path` so the user can read the ranked table directly, and attach `csv_path` when they may want every row. Never rely on a local path alone as the deliverable.

The analyzer defines the window as `[creation, creation + 10 seconds)`. Report `unobservable` separately from a complete zero-buy observation. Call the result a metric until a validation skill demonstrates an association with an outcome.

Use GPT-5.6 Luna with low reasoning when a separate worker is needed. Keep model-facing input at or below 8,000 tokens and output at or below 2,000 tokens. Paginate the saved rows file when a request would exceed either ceiling.
