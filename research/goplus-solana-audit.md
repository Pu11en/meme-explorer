# GoPlus Solana API audit — 2026-08-26

## Verdict

GoPlus has a documented and live **no-key free lane**, but not a non-metered one. The owner support page publishes **30 calls/minute**, and the Node SDK explicitly says unauthenticated token-security calls return only the first requested token. Higher limits require an access token generated from an `app_key` and `app_secret`. No card, wallet, paid trial, usage credits, or CUs were needed for the successful read-only probes below.

## Solana coverage

### Token security

`GET https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=<mint>`; optional `Authorization: Bearer …`. The owner page labels it Beta. Owner docs and SDK expose: envelope `code`, `message`, `result` keyed by mint; token fields `metadata`, `total_supply`, `default_account_state`, `non_transferable`, `creators`, `transfer_fee`, `holders`, `trusted_token`, `metadata_mutable`, `mintable`, `freezable`, `closable`, `transfer_fee_upgradable`, `default_account_state_upgradable`, `balance_mutable_authority`, `transfer_hook`, `transfer_hook_upgradable`, `dex`, `lp_holders`. Nested authority objects use `status` and `authority` or `metadata_upgrade_authority`; authority/creator/hook entries use `address`, `malicious_address`; holder lock data use `is_locked`, `locked_detail[{amount,opt_time,end_time}]`; DEX entries expose `dex_name`, `type`, `id`, `tvl`, `lp_amount`, `fee_rate`, `burn_percent`, `price`, `open_time`, and `day|week|month.{volume,price_min,price_max}`. Transfer fees expose `current_fee_rate.{fee_rate,maximum_fee}` and `scheduled_fee_rate.{fee_rate,maximum_fee,epoch}`.

There is schema drift: the generated Node model says `none_transferable`, while docs and the live response use `non_transferable`; the live response also included `holder_count` and holder `account`, which are not in that generated result model. Consumers should tolerate missing/extra fields.

### Transaction simulation

`POST https://api.gopluslabs.io/pis/api/v1/solana/pre_execution` with JSON `{ "encoded_transaction": "<base64>" }`; optional bearer header. Response envelope contains `code`, `message`, and result fields `input`, `sender`, `error`, `logs[]`, `asset_changes`, `ownership_changes[]`, `allowance_upgrades[]`, `transaction_fee`, `risky_txn`, `risk_type[]`, `slot_height`, `risk_detail[]`. Asset changes contain `nft_changes`, `sol_changes`, `token_changes`; token/NFT changes use `mint`, `name`, `symbol`, `decimals`, `change_detail`; SOL changes use `address`, `from_address`, `lamport_changes`, `pre_lamports`, `post_lamports`, `risky_address`. Ownership changes expose `mint`, `name`, `symbol`, `decimals`, `owner_changed`, `pre_owner`, `post_owner`, `risky_post_owner`. Allowance upgrades expose token identity plus `new_allowances[{owner,spender,pre_amount,post_amount,allowance_change,risky_spender}]`.

An unauthenticated probe using GoPlus's expired SDK test fixture returned `code:1`, current `slot_height`, logs, fee, and simulation error without submitting a transaction.

### Malicious address

The generic endpoint is `GET /api/v1/address_security/{address}?chain_id=…`. Its owner response-detail page documents `data_source`, `honeypot_related_address`, `phishing_activities`, `blackmail_activities`, `stealing_attack`, `fake_kyc`, `malicious_mining_activities`, `darkweb_transactions`, `cybercrime`, `money_laundering`, `financial_crime`, `blacklist_doubt`, `contract_address`, `mixer`, `sanctioned`, `number_of_malicious_contracts_created`, `gas_abuse`, `reinit`, `fake_standard_interface`, and `fake_token`. A historical owner changelog says Solana (`chain_id=solana`) was added, but the current supported-chain table omits Solana and three safe Solana probes returned `code:5000, message:"system error"`. Therefore Solana malicious-address coverage is not currently verified usable.

### Locker and approval

There is no documented dedicated Solana locker endpoint. The current locker support table omits Solana. Token-security nevertheless embeds holder/LP lock indicators and lock intervals. The standalone approval-security and approval-management APIs are ERC/EVM-shaped and list EVM chains, not Solana. Solana's simulation endpoint supplies the only owner-documented Solana approval-like output (`allowance_upgrades`) plus ownership changes.

## Access, freshness, methodology, and terms

- Published global free limit: **30 calls/minute**. No rate-limit headers were observed, so client-side throttling is required.
- Access token: optional on the tested Solana token and simulation endpoints; higher limits require `app_key`, `app_secret`, `time`, and `sign=sha1(app_key + time + app_secret)`. Timestamp must be within ±1000 seconds; response includes `access_token` and `expires_in`.
- Freshness: GoPlus calls its APIs free, real-time, dynamic, and automated. Token responses have rolling DEX periods and `open_time` but no response `observed_at`, block, slot, cache age, or freshness SLA. Simulation returns `slot_height`. Malicious-address docs call the library timely but expose no per-record update timestamp; they identify GoPlus/SlowMist as example sources and say contract classification calls a third-party explorer and may need a second request after ~5 seconds.
- Methodology is only partially disclosed: owner pages describe risk semantics and a changelog mentions filtering third-party data to reduce false alarms; no full Solana scoring model, source coverage, false-positive/negative study, or update SLA is published.
- GoPlus markets the Security API as open and license-free. The owner SDK repositories are Apache-2.0, but that code license should not be assumed to license API data. No detailed API-specific ToS governing redistribution/retention was found linked from the cited reference pages.

## Distinct value versus PumpAPI and RugCheck

- **PumpAPI:** its owner FAQ says the real-time Data Stream and Historical Replay are completely free with no sign-up or API key; the FAQ imposes one stream connection per IP. Its value is low-latency event telemetry and historical replay across Pump.fun/PumpSwap/Raydium/Meteora, including `mintAuthority`, `freezeAuthority`, Token-2022 extensions, pool provenance, and burned liquidity. It is not a scored token/address security service or pre-execution risk simulator. Trading and utility actions are paid (0.25% trade fee or 10,000 lamports for listed actions), so they fail the user's free-lane rule.
- **RugCheck:** the owner Swagger exposes unauthenticated full and summary token reports. A safe probe returned rate headers `X-Rate-Limit-Limit: 15` and remaining count, but no window/reset; the spec documents 429. Public reports add a normalized score, named risks, creator/market/holder context, insider signals, verification, `rugged`, locker summaries, and `detectedAt`. Forced refresh is paid-key-only, and `/lockers` returned 401 saying it requires a paid FluxRPC plan. RugCheck is richer for cached aggregate rug scoring; GoPlus is distinct for no-key Solana transaction simulation and Token-2022 control surfaces, while PumpAPI is distinct for real-time raw flow.

## Safe probes

1. One unauthenticated GET for Wrapped SOL: `/api/v1/solana/token_security?contract_addresses=So11111111111111111111111111111111111111112`.
2. Auth-path-only simulation probe: POST `{ "encoded_transaction": "not-a-transaction" }` and expect a parameter error, not auth failure. Functional probe only with the expired transaction fixture in GoPlus's own SDK test; never use a live signed transaction or private key.
3. One malicious-address probe with a public program address and `chain_id=solana`; stop on the current system error rather than retrying.
4. Keep below 30 calls/minute, use one mint per unauthenticated token request, do not concurrency-test or enumerate addresses.

## Primary sources

- https://docs.gopluslabs.io/reference/solanatokensecurityusingget
- https://docs.gopluslabs.io/reference/response-detail-1
- https://docs.gopluslabs.io/reference/preruntxusingpost
- https://docs.gopluslabs.io/reference/addresscontractusingget_1
- https://docs.gopluslabs.io/reference/response-details-1
- https://docs.gopluslabs.io/reference/response-details-9
- https://docs.gopluslabs.io/changelog/malicious-address-api
- https://docs.gopluslabs.io/reference/approvalcontractusingget
- https://docs.gopluslabs.io/reference/supported-locker
- https://docs.gopluslabs.io/reference/support
- https://docs.gopluslabs.io/reference/getaccesstokenusingpost
- https://docs.gopluslabs.io/reference/api-overview
- https://github.com/GoPlusSecurity/goplus-sdk-node/blob/main/src/script/api.js
- https://github.com/GoPlusSecurity/goplus-sdk-node/blob/main/__tests__/SolanaTransactionSimulate.test.js
- https://api.rugcheck.xyz/swagger/doc.json
- https://pumpapi.io/FAQ
- https://pumpapi.io/fees
- https://pumpapi.io/stream
- https://pumpapi.io/tutorials/detect_scam_tokens
- https://pumpapi.io/tutorials/detect_scam_pools
- https://pumpapi.io/legal
