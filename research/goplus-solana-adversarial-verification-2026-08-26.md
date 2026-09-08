# GoPlus Solana strict-free adversarial verification — 2026-08-26

## Corrected verdict

**Rejected under the requested policy.** GoPlus exposes a documented, live, unauthenticated Solana token-security endpoint and a documented unauthenticated transaction-simulation path. The owner support page calls the API free and caps it at 30 calls/minute. However, the strict policy also says to reject missing licenses. GoPlus's product page calls the Security API “open” and “license-free,” but the reviewed owner material does not provide operative API-data terms covering returned-data retention, redistribution, attribution, or downstream commercial use. The Apache-2.0 SDK license applies to SDK code, not automatically to API output. Therefore operational no-key access is verified, but the candidate cannot be marked verified under the user's full acceptance rule.

## Primary evidence

- Owner support page: “GoPlus Security API is free” and rate limit is 30 calls/minute: https://docs.gopluslabs.io/reference/support
- Owner token endpoint documentation: `GET https://api.gopluslabs.io/api/v1/solana/token_security`: https://docs.gopluslabs.io/reference/solanatokensecurityusingget
- Owner simulation documentation: `POST https://api.gopluslabs.io/pis/api/v1/solana/pre_execution` with `encoded_transaction`: https://docs.gopluslabs.io/reference/preruntxusingpost
- Official generated SDK uses those exact paths and passes `Authorization` as an option rather than a required generated authentication scheme:
  - https://github.com/GoPlusSecurity/goplus-sdk-node/blob/main/src/gen/api/TokenSecurityAPIForSolanaBetaApi.js
  - https://github.com/GoPlusSecurity/goplus-sdk-node/blob/main/src/gen/api/TransactionSimulationForSolanaApi.js
- Official wrapper comments that without Authorization only the first requested token is returned: https://github.com/GoPlusSecurity/goplus-sdk-node/blob/main/src/script/api.js
- Owner marketing page calls the service “open” and “license-free”: https://www.gopluslabs.io/en/security-api
- Official SDK code is Apache-2.0: https://github.com/GoPlusSecurity/goplus-sdk-node/blob/main/LICENSE

## Safe no-key probes performed

1. One unauthenticated WSOL token request returned HTTP 200 and `{code:1,message:"ok"}` with token-control and DEX data. No account, key, token, card, wallet, trial, credits, or CUs were supplied. No rate-limit headers were present.
2. One unauthenticated simulation auth-path probe posted `{"encoded_transaction":"not-a-transaction"}`. It returned HTTP 200 with `{code:5006,message:"Param error!",result:null}`, not 401/403.
3. One unauthenticated functional probe reused only the expired encoded transaction published in GoPlus's official `SolanaTransactionSimulate.test.js`. It returned HTTP 200, `code:1`, `message:"ok"`, `slot_height:441868797`, and the documented result families. The simulation reported an error for the stale transaction and did not submit it. This verifies current no-key simulation output, not accuracy, freshness, or reliability.

## Policy findings

- **No-key lane:** verified operational for the two documented paths.
- **Non-metered/unlimited:** not verified; owner publishes 30 calls/minute.
- **Hidden account credits/CUs or paid trial:** none were needed by the probes, but this is evidence only for the probed public lane, not a perpetual service guarantee.
- **Reliability/freshness:** not verified. “Real-time,” “dynamic,” “automated,” and “reliable” are owner marketing descriptions, not an SLA or independently demonstrated reliability. Token output exposes no observation timestamp, cache age, or freshness guarantee; simulation returns a slot height.
- **License:** insufficient for the requested strict rule. “License-free” is a marketing statement, not detailed API-output terms. Do not infer data rights from the SDK's Apache-2.0 license.
- **PumpAPI duplication:** GoPlus's distinct operational value is interpreted token-control data and pre-execution simulation; this is different from PumpAPI stream/replay telemetry. Distinctness does not cure the licensing disqualification.
- **Solana malicious-address, standalone locker, and standalone approval APIs:** not part of the verified capability. Do not broaden the claim beyond the two documented paths.

## Safe retest

Use one WSOL GET and one malformed-transaction POST at most, stay below 30 calls/minute, never submit a current signed transaction/private key, and do not retry-loop or enumerate addresses. Reconsider the rejection only if GoPlus publishes binding API-data terms or a clear owner grant covering the intended storage and redistribution use.
