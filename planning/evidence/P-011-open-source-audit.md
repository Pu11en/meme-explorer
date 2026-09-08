# P-011 — Open-source reuse audit

**Inspected:** 2026-08-26 UTC

Repositories were shallow-cloned and inspected for current commit, license, manifests, test files, and basic buildability. Repository popularity was checked separately during the earlier reuse scan.

| Repository | Commit inspected | License found | Tests detected | Build/reuse verdict |
|---|---|---|---:|---|
| `Solana-Trading-Lab/pump.fun.meter` | `63b823d74397df8787e853f4570bb262ca92f3e3` | MIT | 0 | Useful source reference, but not a drop-in package. First `npm ci` failed because `.npmrc` requires an unset `${REGISTRY}`. Retrying with npmjs failed because the lock requested unavailable `ioredis-typed@^1.0.128`. |
| `Solana-Trading-Lab/replayer-rust` | `06b8f062213b8d18e4c8261281f8b1c2c3c1fd05` | None detected | 0 | Do not copy without permission/license clarification. Conceptually useful as a replay-downloader reference only. |
| `streamingfast/substreams-solana-pump-fun` | `9fc2f297111ef3d2a8bde4a2f82cb2a2bf9ec818` | None detected | 0 | Do not copy without permission/license clarification. Decoder architecture reference only. |
| `nirholas/pump-fun-sdk` | `9527f261baaee2b31c9e480fe95fa5118d15bebc` | All rights reserved | 139 | Broad codebase but legally unusable for incorporation without permission. Do not copy. |

## Earlier candidates rejected

- `boluwatifee4/pump.fun-Token-tracker`: conceptually close, but no detected license, `.env` committed, minimal adoption, and old code path.
- `vicentszr/pump-tracker`: no detected repository license and no adoption at inspection time.
- `CodeMuscle/solbeam`: no detected license/adoption and advertised screenshots still marked “coming soon.”
- `open-pump/openpump-api`: search result existed, but the repository API returned 404 during inspection; not a stable reuse candidate.

## Reuse conclusion

No audited repository is both trustworthy and directly reusable as the complete recorder foundation.

The safe reuse boundary is the **documented free PumpAPI service**, not an open-source package. Implement a small local adapter using standard WebSocket and file/database primitives, while borrowing no code from unlicensed/all-rights-reserved repositories. MIT `pump.fun.meter` may inform design, but its checked-in dependency state must not be imported wholesale.
