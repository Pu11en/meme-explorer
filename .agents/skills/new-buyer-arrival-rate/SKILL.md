---
name: new-buyer-arrival-rate
description: "Select steady new buyers: each ten-second segment of the first minute meets a new-wallet minimum. Use for filtering a named Meme Explorer collection batch."
---

# New Buyer Arrival Rate

Use the deterministic first-minute analyzer and saved filter definitions. This is cohort analysis; no model training is involved.

Resolve the batch manifest and its absolute data root. For this iMac's Batch 001, read `planning/evidence/batch-001-imac-import/README.md`; keep new output outside the imported data tree. Build with `pnpm build` if needed. If pnpm is not on PATH, this iMac has `/Users/drewp/.hermes/node/bin/corepack pnpm`.

Generate the compatible feature result once:
`pnpm analyze:60s -- --data-root <absolute-data-root> --batch <absolute-batch-json> --output-root <absolute-output>`

Run this skill against the saved feature result:
`pnpm analysis:filters -- --result <absolute-feature-result> --filter new-buyer-arrival-rate --output-root <absolute-output>`

Default parameters: `{"min_new_buyers_per_bucket":1}`. Use `--parameters '<JSON overrides>'` for a requested threshold; save the resulting definition hash and parameters.

The feature window is fixed at [creation, creation + 60 seconds). Ten-second buckets only summarize that same minute. Keep missing data unobservable, preserve source and definition versions, and report members/rejected/unobservable counts. Read bounded receipts, not raw events, into model context. Complete results stay on disk.

Generate the human view with `pnpm analysis:60s-page -- --result <absolute-feature-result> --output <absolute-page>`; it compares all six default definitions. For a custom threshold, pass `--cohort <absolute-cohort-result>` to include its saved definition and membership in the view. Serve with `pnpm analysis:serve -- --page <absolute-page> --port <available-port>`.

Check `planning/evidence/six-filter-validation/` for validation evidence when available. Distinct wallets are not necessarily distinct people; operational validation does not establish predictive value.
