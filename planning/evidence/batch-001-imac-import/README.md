# Batch 001 installed on the iMac

Verified September 8, 2026. The data-access blocker is resolved. This is import validation, not six-filter correctness or scale validation.

- Source release: https://github.com/Pu11en/meme-explorer/releases/tag/batch-001-imac-v1
- Pinned handoff commit: `5a0c4c4c0a270556f01d8f24ccb5c9082775a066`
- Stable data root: `/Users/drewp/Library/Application Support/MemeExplorer/imports/batch-001-imac-v1/verified/data`
- Downloads retained at: `/Users/drewp/Library/Application Support/MemeExplorer/imports/batch-001-imac-v1/download`
- Batch selection: repository `analysis/batches/batch-001.json`; its SHA-256 matches the handoff inventory.

The authenticated release inventory matches the pinned Git commit. The compressed archive matches the user-supplied SHA-256 `7e39232f64cc23b08b96a274759b8a40287fb3e54740b5f3731a2756c7a966ca`. Extraction admitted only the 58 regular files declared in the inventory, checked sizes and streaming hashes, and then independently rehashed all installed files from disk. All passed: 3,916,097,642 extracted bytes. Every run is stopped, has matching latest/durable raw sequence values, and its recounted raw and normalized nonempty NDJSON lines match its manifest. See `verification.json` and `inventory.json` for exact measurements and file hashes.

The data lives outside disposable Git worktrees. It includes four recordings and seven existing ten-second analysis results. Those results are imported reference artifacts, not newly executed first-minute tests. Keep new analyzer output in a separate analysis-output directory to preserve this verified handoff unchanged. Zstandard was installed locally for decompression. About 35.27 GiB free remained after verification; the scheduled recorder installation was not changed.

Next: reconcile current source venue/coverage metadata, then implement and validate the six filters using the existing OpenSpec milestone. Do not infer first-minute counts from the older mixed-venue corpus profile or the legacy ten-second summary.
