# P-012 — Free-tool capability gap ledger

**Rule:** a tool checks off only a distinct capability. Another launch feed does not count. “Verified” requires owner-documented access, repeated safe probes, stable-enough fields, measured failures/latency, legal/license review, and an explicit missing-data interpretation.

## Status vocabulary

- ✅ **Checked:** sufficiently verified for the local/manual MVP, with limitations preserved.
- 🧪 **Candidate:** technically promising; reliability verification incomplete.
- ❌ **Rejected:** paid/metered/funded, duplicate-only, unlicensed, broken, or not dependable enough.
- ⛔ **Not objectively knowable:** no tool can turn the claim into reliable fact.

## Capability ledger

| Priority | Capability needed | Best researched option | Final status | Evidence / limitation |
|---:|---|---|---|---|
| 0 | Live Pump/PumpSwap events: buys, sells, creates, transfers, migrations, pools, liquidity actions | PumpAPI live stream | ✅ Checked for local best-effort use | No SLA/completeness/license guarantee; raw local logging and gaps remain mandatory |
| 0 | Historical event replay/backfill | PumpAPI hourly replay | ✅ Checked as best-effort gap repair | Free archive structure and schemas verified; publication ranged from ~10 s to >7 h after hour end, some hours were 404/late, no checksums/SLA, and replay adds `localTimestamp` with legacy schema eras |
| 1 | Token safety facts: authorities, LP lock, named risks, insider graph | RugCheck anonymous report/summary | ❌ Rejected as reliable early facts | Five-token benchmark found 3/5 initial failures and one danger/LP-lock-0 report flipping after 120 s to no-risks/LP-lock-100; retain only timestamped provider opinion if shown at all |
| 1 | Current holder count/concentration provider snapshot | Jupiter Tokens v2 `holderCount` + `audit.topHoldersPercentage` | ❌ Excluded from merged stack; manual segregated option only | Technically strong: 10/10 fresh and later 50/50 batch indexed. But definitions/provenance are unpublished and Jupiter terms restrict combining/redistribution; do not integrate without written permission |
| 1 | Complete independently verifiable holder concentration | No reliable strict-free source | ❌ Not reliably solvable for free | Public RPC blocks/limits holder-heavy enumeration, RugCheck proved unstable, Jupiter lacks methodology/provenance and cannot legally join the merged dataset |
| 1 | Launch-signer history / prior local creates | Local PumpAPI `txSigner` index going forward | ✅ Checked from installation onward | `txSigner` present 50/50; five duplicate-signer groups appeared within 73 s. Jupiter `dev` matched `txSigner` 50/50, proving it duplicates attribution here. Record signer→signatures only, never human identity or rug label |
| 1 | Complete pre-install creator launch/rug history | No reliable strict-free source | ❌ Not reliably solvable for free | Full replay scan is enormous/incomplete and has no wallet query; provider labels lack methodology or proved unstable. Never call a wallet/person a rugger as fact |
| 1 | Migration and canonical PumpSwap pool identity | Local official-IDL/PDA verifier over finalized Solana RPC | ❌ Not reliably solvable continuously for free | Exact verification method was proved on sampled records, but Solana public RPC cannot support a reliable continuous recorder; PumpAPI migration remains a provider event with explicit unknown/finality state |
| 1 | Executable route and size-specific quote | Jupiter keyless quote | ❌ Rejected from strict-free core | Distinct quote data works, but `/swap/v2/order` is credit-classified and owner legal terms conflict with keyless production use; retain only as manual diagnostic if later approved |
| 1 | Indexed market price/liquidity/activity | DEX Screener pair/token API | ✅ Checked as optional delayed enrichment | Expanded 10-migration benchmark: exact pool 0/10 at 0 s, 1/10 by 30 s, 9/10 by 60 s, 10/10 by 120 s; all 40 requests returned 200. Adds market snapshots but has no SLA and is never migration truth |
| 2 | Durable OHLC/quote-volume candles | Deterministic local aggregation; GeckoTerminal optional cross-check | ✅ Checked locally; external source rejected as authority | 40,927 Pump-AMM trades had all required fields; two full local minutes were within ~0.3–1.2% of Gecko OHLC after delayed USD conversion, while volume differed ~2.3–2.4×. Store gap state; Gecko remains nullable/manual only |
| 2 | Metadata bytes and raw social-link claims | PumpAPI URI + hardened local HTTPS/IPFS fetcher | ✅ Checked as best-effort retrieval | Fresh sample: all 20 URIs reachable; 19 JSON and 1 direct PNG; all 9 mutable-HTTPS responses byte-stable after 60 s. Enforce DNS/redirect/size/time controls and preserve hashes/failures; no SLA or social-legitimacy claim |
| 2 | Canonical transaction confirmation/finality | Solana public RPC sampled verification | ❌ Not reliable as continuous free infrastructure | Sampled finalized verification works, but owner docs reject production use and probes observed method-specific 429/null/history limits; use only opportunistically with explicit unknown states |
| 2 | Approximate USD conversion | DEX Screener pinned WSOL/USDC pair | ✅ Checked as delayed venue reference | 12/12 probes succeeded; three snapshots over 56 s with ~25–30 s cache refresh. Use PumpAPI SOL-denominated value × this labeled venue price; never call it an oracle/executable quote or silently carry forward |
| 3 | Complete wallet funding graph | No strict-free reliable provider | ❌ Not reliably solved for free | Bubblemaps requires paid credits/API key; public RPC lacks dependable archive/enumeration; any local graph is bounded and incomplete |
| 3 | Wallet labels such as bot/insider/smart money | No reliable strict-free factual source | ⛔ Not objectively knowable | At most store provider heuristics with evidence/confidence; never factual identity |
| 3 | One person controlling multiple wallets | None | ⛔ Not objectively knowable | Can only infer patterns, not prove ownership |
| 3 | Genuine social/community quality | None | ⛔ Not objectively knowable | Raw links/activity are observable; legitimacy/quality is subjective and manipulable |

## Explicitly rejected foundations

- PumpPortal trade/account stream — funded wallet and metered fees.
- Helius/Birdeye strict-free use — quota/credit/CU metering violates current rule.
- Bitquery production stream — usage-priced.
- GoPlus Solana security — technically anonymous, but no sufficiently scoped API-output/data-use license and no freshness/SLA; reject from retained recorder data.
- Bubblemaps holder/cluster APIs — API key and paid credits required.
- Pyth SOL/USD — mandatory API key/trial/paid ongoing access effective 2026-08-26; no strict-free durable lane.
- DeFiLlama price history — undocumented anonymous quota, sparse new-Pump coverage, no per-point provenance, and restrictive production terms.
- `pump.fun.meter` package — checked-in dependency graph does not install.
- Unlicensed/all-rights-reserved Pump repositories — cannot be incorporated.
- Secondary launch-only feeds — do not fill a missing capability beyond PumpAPI.

## Research completion

All planned tracks were audited and classified: RugCheck safety/holders, Jupiter token/route data, DEX Screener market data, migration verification, PumpAPI replay, GeckoTerminal candles, metadata retrieval, public-RPC finality/history, wallet graphs and non-objective identity/social claims. No candidate row remains open.
