# P-012 — PumpAPI capability checklist

**Audited:** 2026-08-26 from owner sitemap, fees, FAQ, stream/replay docs and direct probes.

## Free capabilities accepted

| Capability | Owner fee | Verification | Status |
|---|---:|---|---|
| Live Data Stream | FREE | No-key connection repeatedly worked; actions observed for create, buy, sell, transfer, migrate, createPool, add, remove and creator-fee claims | ✅ Core best-effort stream |
| Historical Replay | FREE | Anonymous hourly archive listing/download, publication timing, schema eras and missing-hour behavior audited | ✅ Best-effort backfill only; never guaranteed |

## PumpAPI capabilities excluded by the free-only rule

| Operation | Owner-listed fee | Disposition |
|---|---:|---|
| Trade (buy/sell execution) | 0.25% of trade volume | Excluded; recorder does not trade |
| Create token | 10,000 lamports | Excluded |
| Claim cashback | 10,000 lamports | Excluded |
| Initiate migration | 10,000 lamports | Excluded |
| Wrap SOL | 10,000 lamports | Excluded |
| Get Token Info | 10,000 lamports | Excluded; do not mistake for a free data endpoint |
| Get Balances | 10,000 lamports | Excluded; wallet balances must come from stream snapshots or another approved source |
| Burn tokens | 10,000 lamports | Excluded |
| Transfer | 10,000 lamports | Excluded |

## Owner-documented surface

The current sitemap lists: actions, burn, claim cashback, create token, FAQ, fees, get balances, get token info, historical replay, Jito bundles, legal, migrate, partners, stream, trade API, transfer, scam-pool/token tutorials, wrap SOL and the home page.

Only **Data Stream** and **Historical Replay** are owner-listed as free. The FAQ also says these require no signup/API key. No other PumpAPI operation should be added to the strict-free recorder.

## Remaining limitations

- The provider’s statements about speed, event completeness, program-update handling and landing rate are marketing/owner claims, not independent guarantees.
- One live connection per IP is enforced; a second simultaneous local benchmark was closed with WebSocket code 1008 and “please keep only one websocket connection.”
- Replay has missing-hour and schema-era evidence, no checksum/manifest, and delayed publication.
- Terms provide as-is/as-available access and no clear retained-data/redistribution grant.

## Sources

- [Fees](https://pumpapi.io/fees)
- [FAQ](https://pumpapi.io/FAQ)
- [Live stream](https://pumpapi.io/stream)
- [Historical replay](https://pumpapi.io/historical-replay)
- [Legal](https://pumpapi.io/legal)
- [Sitemap](https://pumpapi.io/sitemap.xml)
