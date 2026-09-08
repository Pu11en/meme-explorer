# P-014 evidence — Existing-record launch screening

Measured 2026-09-07. Planning evidence only; no screening verdicts, later outcomes or investment recommendations.

## Reproducibility

Source: `/home/drewp/main-projects/meme explorer/data`, opened read-only.

[Probe](P-014-profile-corpus.py) pins the four run IDs, streams large files and writes only outside the source corpus. [Profile](P-014-corpus-profile.json) contains 96 launch summaries, run-level counters and SHA-256 fingerprints for 24 inputs. It checks selected launch/trade payload hashes/lengths, manifest counts and unchanged size/mtime during streaming. This is not a fresh full contract validation.

Run from the isolated worktree:
`python3 planning/evidence/P-014-profile-corpus.py --data-root '/home/drewp/main-projects/meme explorer/data' --output planning/evidence/P-014-corpus-profile.json`

The original folder had no Git metadata. Source and old planning were snapshotted in a local Git worktree; the corpus stays in place and outside Git.

## Inventory

| Run | Minutes | Recorded launches | With trades | No recorded trades | Under 60s observed |
|---|---:|---:|---:|---:|---:|
| 001 | 5 | 33 | 11 | 22 | 8 |
| 002 | 10 | 24 | 19 | 5 | 2 |
| 003 | 10 | 23 | 23 | 0 | 1 |
| 004 | 5 | 16 | 9 | 7 | 6 |
| Total | 30 | 96 | 62 | 34 | 17 |

Under-60s counts overlap other columns. Normalized events contain 6,376 unique mint addresses. Only 96 have recorded creation events; the other 6,280 lack observed launch context in this batch. Totals: 30,675 retained normalized trade rows for those launches, 1,074,873 raw rows and 3,111,046 normalized rows.

Creation venues: 48 Pump and 48 Meteora launchpad. Creation quote: 95 WSOL, one USDC. Trade frames also contain Pump AMM and Meteora DAMM v2. A Pump.fun plan title does not establish venue for every record.

## Recovery changes the route

All normalized launch creator fields are null. All 30,675 normalized trades lack pool token/quote reserves and user token balances. Yet every selected raw trade frame has `txSigner`, `tokensInPool`, `quoteInPool`, `postBalances` and `poolFeeRate`; Pump-specific virtual reserves appear where applicable.

Run 001 raw seq 15,541 contains launch signer and reserves. Seq 28,783 has a transaction signer distinct from its breakdown trader. Preserve those roles separately. The current normalizer expects different reserve aliases and omits `txSigner` from launch signer. Recover facts in an analysis layer; preserve the original tables.

Old normalized fields named `_raw` contain decimal quantities such as `quote_amount_raw: "0.019288883"`. The suffix does not justify dividing by 1e9. Confirm provider units and venue formulas.

## Reliability

Run 002 has a `disconnected:gap` row and a reconnect-scheduled row. Align the gap with each coin's cutoff before assigning inactivity; recorded duration alone is insufficient.

The corpus has metadata/DEX Screener failure rows and no normalized metadata or market files. Adapter enablement does not prove successful enrichment. Raw inline facts remain available. Repeated `untracked_mint` audit rows are not independent suspicious-coin observations.

## Bounded trial

Question: Can quiet, suspicious and insufficiently observed launches share one reject bucket?

Input: the pinned four recordings. Variants: 30/60/120 seconds from received creation time, counting only trades received within the window. These are diagnostic variants, not calibrated cutoffs.

| Window | Enough recorded duration | Zero trades within window | At least five reported traders |
|---|---:|---:|---:|
| 30s | 83 | 27 | 48 |
| 60s | 79 | 25 | 49 |
| 120s | 73 | 25 | 44 |

These duration counts do not yet account for gap intersection. Of 34 launches with no retained trade throughout their observed span, 24 have at least 60 seconds available; ten do not.

- Active case: run 002 Loopr, `5q2NPgX1VqaRsEkFFQXvE8bhxynr1hC2MvbGL2jpT2c7`: 2,038 trades, 241 reported traders, about 460s. Activity is observed; later success and independent ownership are unproved.
- Quiet case: run 001 USEFUL, `8G4rdVh6oLoe4ncvE48zqFz4mEVbd6Dwdhp7RJc6pump`: no retained trades in about 274s. This is “no activity observed,” not “never ran later.”
- Concentration case: run 003 ELEPHANT, `FGybqoRsRevfa6YxBB5MmbZnKbEtbTFRFoeAZkqcjups`: three trades, one reported trader, about 455s. Supports concentration, not fraud.
- Failure case: run 003 KIWI, `6SgDr8Axpi54zFcubeoWpV96uQkPrhxLr16J3zZXSzQd`: two buys in about 12.6s. A 60s inactivity test is unavailable, not failed.

Verdict: one reject bucket is inadequate. Keep independent coverage/activity/risk dimensions, reversible selection and an explicit shortlist preference. No rug/bundle/winner classifier was tested; no future outcome was fetched.

## Luna cost

The local model catalog exposes `gpt-5.6-luna`. On 2026-09-07 the [official model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna) lists standard API text rates of $0.20 per million input tokens and $1.20 per million output tokens. A hypothetical 100,000 input + 20,000 billed output tokens costs $0.044, before tools or additional billed tokens. Requests over 272,000 input tokens use higher rates. This API example is not a quote for Codex subscription usage or the whole skill.

Code should summarize the million-row input. Luna can optionally review compact evidence summaries. No paid model was invoked.

## Primary references

Accessed 2026-09-07:

- [Jito bundle documentation](https://docs.jito.wtf/lowlatencytxnsend/): bundles execute atomically in a slot. Inference: same-slot timing alone does not prove one bundle or malicious intent.
- [Solana getTransaction](https://solana.com/docs/rpc/http/gettransaction): confirmed transaction retrieval by signature can return null. This is a possible later recovery method, not guaranteed available history. No transaction lookup was made.

## Later outcomes

Early snapshots cannot establish a rally after collection stops. Freeze early selection before getting labels. Later work must define baseline/entry delay, threshold, horizon, sustained activity/liquidity and missing-history treatment. Observed prices alone do not prove realizable returns.

Checking only selected candidates cannot estimate missed winners. Preserve excluded and uncertain identities for a later, explicitly chosen audit; do not silently expand query scope.
