# Adversarial verification: strict-free Solana holder concentration (2026-08-26)

## Verdict

`not-reliably-solvable-free`. SevenLabs Carbon 1.0.0 is a recent MIT-licensed indexing framework component, not a turnkey holder database. For an ordinary transparent SPL Token or Token-2022 mint, custom code can sometimes obtain a finalized, mint-filtered `getProgramAccounts` snapshot from Solana's documented public endpoint and calculate **on-chain token-account-authority concentration**. This does not prove reliable production operation, beneficial/economic ownership, or exact concentration for confidential Token-2022 balances.

The original exclusivity claim ("the only maintained permissive-license candidate") is not established by the reviewed evidence and should be removed.

## Strict-free probe

A no-key POST to `https://api.mainnet.solana.com` on 2026-08-26 returned HTTP 200 for `getHealth`. A finalized, `withContext` legacy-token `getProgramAccounts` request with a mint memcmp and data-size filter also returned HTTP 200, context slot `441870035`, and `x-ratelimit-tier: free`, without an account, card, key, wallet, SOL, credits/CUs, or trial. The GPA response advertised a method limit of 10, showing that live per-method limits can be lower than generic published limits and must not be treated as an SLA.

The deliberately all-zero mint probe returned seven all-zero, uninitialized 165-byte token accounts. Therefore mint filtering alone is insufficient: aggregation must reject malformed/uninitialized records and include only `Initialized`/`Frozen` token-account states under an explicit frozen-balance policy.

Official sources: [clusters/public endpoints](https://solana.com/docs/references/clusters), [`getProgramAccounts`](https://solana.com/docs/rpc/http/getprogramaccounts).

## Carbon evidence and corrections

- Repository HEAD was [`af70b199b39e60a1a33306e5411f8040374f8d9a`](https://github.com/sevenlabs-hq/carbon/commit/af70b199b39e60a1a33306e5411f8040374f8d9a), dated 2026-07-21. The `v1.0.0` tag resolves to `cdffa3342fd3a0527ab42c9228bb9e4244eb7de8`, dated 2026-06-04. crates.io lists 1.0.0 for `carbon-core`, `carbon-token-2022-decoder`, and `carbon-rpc-gpa-datasource`.
- Carbon itself has a complete [MIT license](https://github.com/sevenlabs-hq/carbon/blob/af70b199b39e60a1a33306e5411f8040374f8d9a/LICENSE), and the workspace manifest declares MIT. This does not substitute for a transitive dependency license audit.
- The [GPA datasource](https://github.com/sevenlabs-hq/carbon/blob/af70b199b39e60a1a33306e5411f8040374f8d9a/datasources/rpc-gpa-datasource/src/lib.rs) forces base64 and response context and accepts caller filters/commitment, but defaults to `confirmed`; strict snapshots must explicitly select `finalized`.
- The [Token-2022 decoder](https://github.com/sevenlabs-hq/carbon/blob/af70b199b39e60a1a33306e5411f8040374f8d9a/decoders/token-2022-decoder/src/accounts/mod.rs) uses `StateWithExtensions`, checks program ownership, and has five base-account tests. No extension-specific tests were found.
- The configured [CI workflow](https://github.com/sevenlabs-hq/carbon/blob/af70b199b39e60a1a33306e5411f8040374f8d9a/.github/workflows/check.yml) contains `cargo test --all-targets --all-features`, but its push filter names `master` and `ci` while the default branch is `main`; workflow source is not evidence that HEAD passed. Cargo was unavailable locally, so no independent test passed.
- The [program-subscribe datasource](https://github.com/sevenlabs-hq/carbon/blob/af70b199b39e60a1a33306e5411f8040374f8d9a/datasources/rpc-program-subscribe-datasource/src/lib.rs) reconnects but has no replay and breaks/reconnects on `try_send` backpressure. The generated [Postgres upsert](https://github.com/sevenlabs-hq/carbon/blob/af70b199b39e60a1a33306e5411f8040374f8d9a/decoders/token-2022-decoder/src/accounts/postgres/token_row.rs) has no newer-slot guard. Reliability is therefore unverified without custom reconciliation, deletion handling, and slot ordering.

## Correctness boundary

- Aggregate initialized/frozen token accounts by the token account's authority `owner`, summing raw base amounts. Do not group by token-account address or delegate.
- This measures on-chain authority concentration, not beneficial ownership: exchanges, custodians, bridges, vaults, and program-controlled accounts can pool many users.
- Token-2022 transfer-fee withheld values are separate from the recipient's base amount in the [official implementation](https://github.com/solana-program/token-2022/blob/main/program/src/processor.rs#L540-L556); report them separately because they are controlled by fee-withdraw authority.
- Confidential Transfer available/pending values are encrypted; exact public-data concentration is impossible without decryption material. Return opaque/unsupported rather than a fabricated value ([official confidential balances](https://www.solana-program.com/docs/confidential-balances)).
- Event-only reconstruction is insufficient; use authoritative finalized snapshot reconciliation.

## Alternatives checked

- Yellowstone gRPC is active but its plugin/server defaults to AGPL-3.0-only; Apache-2.0 covers only listed client/example/protobuf directories ([LICENSING.md](https://github.com/rpcpool/yellowstone-grpc/blob/master/LICENSING.md)). It is transport, not a holder database.
- The Anza PostgreSQL plugin manifest declares Apache-2.0 but the repository has no root license text, pins Agave 2.3.6, and was last committed 2025-08-18. Its README calls it illustrative and reports validator/database machines sized at GCP `n2-standard-64` and `n2-highmem-32` for all-account throughput ([repository](https://github.com/anza-xyz/agave-geyser-plugin-postgres)).
- The Solana Labs PostgreSQL plugin declares Apache-2.0 in Cargo but was last committed 2023-11-10 and pins Solana 1.17.3 ([repository](https://github.com/solana-labs/solana-accountsdb-plugin-postgres)).

No PumpAPI endpoint, dataset, account credit, paid trial, undocumented endpoint, or scraping path is used. The public-RPC path uses documented JSON-RPC only; request-rate counters exist, but there is no account-linked billing/CU balance in the tested path.
