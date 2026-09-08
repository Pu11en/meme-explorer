# Audit — free Solana chain / RPC paths

- Audited: 2026-08-26 UTC
- Evidence policy: Solana/Solana Foundation documentation and owner-controlled source only; live probes are labeled observations, not guarantees.
- Draft scope checked: the native Solana RPC claims in `research/pump-solana-variables-draft.md` and `planning/evidence/P-005-provider-capabilities.md`.

## Audit disposition

The core native-RPC statements in the drafts are mostly supported: public no-key endpoints exist; the published limits match owner docs; commitment/reorg cautions are sound; `logsSubscribe.mentions` is single-address; `blockSubscribe` is unstable/flag-dependent; and `getTokenLargestAccounts` is top-20 token accounts. No core protocol claim required wholesale rejection. The corrections below mainly prevent observed public availability from being promoted into an archive, replay, production, or SLA promise.

## Corrected claims

1. **A public, no-key mainnet JSON-RPC path exists today, but it is shared development infrastructure, not a production service.** Solana currently documents `https://api.mainnet.solana.com`; Devnet and Testnet have corresponding public endpoints. The owner explicitly says public endpoints are not intended for production, limits may change without notice, and high-traffic sites may be blocked. The published mainnet limits are 100 requests/10 s/IP, 40 requests/10 s/IP for one RPC method, 40 concurrent connections/IP, 40 new connections/10 s/IP, and 100 MB/30 s. [Clusters and Public RPC Endpoints](https://solana.com/docs/references/clusters)

2. **“Free/no-key” describes observed access, not an SLA, entitlement, completeness promise, or permanent price.** Owner docs say the endpoints are available to users/developers and rate-limited, while also warning that the listed limits may not be current. They publish no uptime, latency, replay, retention, or completeness SLA on that page. [Clusters and Public RPC Endpoints](https://solana.com/docs/references/clusters)

3. **Commitment is a state-selection/finality floor, not a provider delivery guarantee.** `processed` is the node's newest processed view and can roll back; `confirmed` is directly voted on by more than two-thirds of active stake; `finalized` is the strongest state recognized with maximum lockout. Methods/subscriptions that accept commitment typically default to `finalized` when omitted, but callers should set and record it explicitly. [RPC overview / commitment](https://solana.com/docs/rpc)

4. **Native WebSocket PubSub is a live trigger, not a historical feed.** A keyless WSS subscription was observed working at `wss://api.mainnet.solana.com`, but owner docs provide subscription/notification methods—not a replay cursor or delivery SLA. Reconnect gaps therefore require HTTP/indexed backfill. `logsSubscribe` with `mentions` accepts exactly one address. [`logsSubscribe`](https://solana.com/docs/rpc/websocket/logssubscribe)

5. **For Pump activity, `logsSubscribe({mentions:[PUMP_PROGRAM_ID]})` is the relevant native transaction-log trigger.** `programSubscribe(PUMP_PROGRAM_ID)` instead follows changes to accounts returned in the program-account model; it is not a general “transactions invoking this program” stream. [`logsSubscribe`](https://solana.com/docs/rpc/websocket/logssubscribe), [`programSubscribe`](https://solana.com/docs/rpc/websocket/programsubscribe), [`getProgramAccounts`](https://solana.com/docs/rpc/http/getprogramaccounts)

6. **Do not present `blockSubscribe` as a universally available stable free path.** Solana labels it unstable; the validator must be started with `--rpc-pubsub-enable-block-subscription` (and the transaction-history flag), and it supports confirmed/finalized rather than processed commitment. [`blockSubscribe`](https://solana.com/docs/rpc/websocket/blocksubscribe)

7. **Native transaction history is queryable but not guaranteed complete or archival.** `getSignaturesForAddress` returns newest-first signatures and supports only 1–1,000 per call, so full traversal requires `before` pagination. `getTransaction` returns a confirmed transaction or `null` if not found at the requested commitment. `getFirstAvailableBlock` reports the lowest confirmed block still in that particular node's ledger; it does not promise every transaction is retrievable or establish future retention. [`getSignaturesForAddress`](https://solana.com/docs/rpc/http/getsignaturesforaddress), [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction), [`getFirstAvailableBlock`](https://solana.com/docs/rpc/http/getfirstavailableblock)

8. **Token calls are useful primitives, not a complete holder/identity index.** `getTokenSupply` returns the mint's point-in-time supply. `getTokenLargestAccounts` returns exactly the 20 largest **token accounts**, not the 20 largest people or beneficial owners. `getTokenAccountsByOwner` returns token accounts for one declared on-chain owner filtered by a mint or token program. A full mint-wide distribution generally requires scanning/indexing token-program accounts and handling both the legacy Token Program and Token-2022; token-account owner still does not equal human/beneficial owner. [`getTokenSupply`](https://solana.com/docs/rpc/http/gettokensupply), [`getTokenLargestAccounts`](https://solana.com/docs/rpc/http/gettokenlargestaccounts), [`getTokenAccountsByOwner`](https://solana.com/docs/rpc/http/gettokenaccountsbyowner), [`getProgramAccounts`](https://solana.com/docs/rpc/http/getprogramaccounts)

9. **Preserve exact token amounts as strings/base units.** Official RPC schemas expose `amount`/`uiAmountString`; `uiAmount` is a floating-point field and is deprecated in favor of `uiAmountString`. Do not use it for exact accounting. [`getTokenSupply`](https://solana.com/docs/rpc/http/gettokensupply), [`getTokenLargestAccounts`](https://solana.com/docs/rpc/http/gettokenlargestaccounts)

10. **Use the currently documented mainnet hostname in examples.** `https://api.mainnet.solana.com` is the owner-documented mainnet endpoint. `https://api.mainnet-beta.solana.com` also responded in this audit, but that is observed compatibility, not the hostname currently listed on the cluster page. [Clusters and Public RPC Endpoints](https://solana.com/docs/references/clusters)

## Rejected or narrowed draft-style claims

| Claim | Verdict | Replacement |
|---|---|---|
| “The free public RPC is suitable for production.” | **Reject.** | It is no-key shared infrastructure explicitly not intended for production; no SLA is published. |
| “The published limits are guaranteed.” | **Reject.** | They are owner-published current guidance and explicitly subject to change. |
| “Public RPC gives full Solana history.” | **Reject.** | Recent and some old history may be observed; availability is node-specific and `getTransaction` can return `null`. Use an archival/indexed service or your own retained data when completeness matters. |
| “`finalized` means an RPC response cannot be missing, delayed, or later unavailable.” | **Reject.** | Finalized describes cluster commitment, not node retention, indexing, uptime, or response delivery. |
| “A WebSocket subscription is durable/replayable.” | **Reject.** | Native PubSub is a live subscription interface with no documented cursor/replay SLA; reconnect and backfill. |
| “`programSubscribe` streams all calls to Pump.” | **Reject.** | Use `logsSubscribe.mentions` for transaction logs; use `programSubscribe` for matching program-owned account state changes. |
| “One `logsSubscribe.mentions` filter can include many programs/accounts.” | **Reject.** | The official method currently supports exactly one mentioned address. |
| “`getTokenLargestAccounts` gives the top 20 holders.” | **Reject.** | It gives token accounts; owner aggregation and protocol-vault exclusions are separate derivations, and beneficial ownership remains unknown. |
| “`getTokenAccountsByOwner` discovers all holders of a mint.” | **Reject.** | It answers the inverse query for one owner. Mint-wide enumeration needs a scan/index and can be expensive or throttled. |
| “A successful probe proves ongoing free availability/SLA.” | **Reject.** | It proves only that one request worked from one location at one time. |

## Safe no-key probes and observed results

Observed from one client on **2026-08-26T07:39Z**; these are not benchmarks or promises.

- Both `https://api.mainnet.solana.com` and the compatibility hostname `https://api.mainnet-beta.solana.com` returned HTTP 200 for `getHealth`, `getVersion`, `getFirstAvailableBlock`, and finalized `getSlot`.
- Devnet and Testnet public endpoints also returned HTTP 200 for those four calls.
- On documented mainnet, finalized USDC `getTokenSupply` returned HTTP 200; `getTokenAccountsByOwner` returned HTTP 200; a one-item `getSignaturesForAddress` followed by `getTransaction` returned a transaction successfully.
- A deliberately invalid signature returned HTTP 200 with JSON-RPC `result:null`, matching the method contract.
- One `getTokenLargestAccounts` request returned HTTP 429, “Too many requests for a specific RPC call.” This demonstrates possible throttling from shared infrastructure; it does **not** show that the method is always unavailable.
- WSS `accountSubscribe` opened without a key, acknowledged a subscription, and acknowledged unsubscribe. A confirmed `logsSubscribe` filtered to the official Pump program likewise acknowledged subscribe/unsubscribe without a key.
- Mainnet `getFirstAvailableBlock` returned `0` in this observation; Devnet/Testnet returned later slots. This is only the responding node's reported ledger floor at that moment, not proof of complete archival transaction retrieval.

### HTTP smoke test

```bash
RPC=https://api.mainnet.solana.com
curl -sS "$RPC" -H 'content-type: application/json' --data \
'{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

curl -sS "$RPC" -H 'content-type: application/json' --data \
'{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[{"commitment":"finalized"}]}'

# USDC mint; exact result is time-dependent.
curl -sS "$RPC" -H 'content-type: application/json' --data \
'{"jsonrpc":"2.0","id":1,"method":"getTokenSupply","params":["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",{"commitment":"finalized"}]}'
```

### WebSocket acknowledgement test (Node with built-in `WebSocket`)

```bash
node - <<'JS'
const ws = new WebSocket('wss://api.mainnet.solana.com');
const timer = setTimeout(() => ws.close(), 8000);
ws.onopen = () => ws.send(JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'accountSubscribe',
  params: ['11111111111111111111111111111111',
           { encoding: 'base64', commitment: 'confirmed' }]
}));
ws.onmessage = ({data}) => {
  const msg = JSON.parse(data);
  console.log(msg);
  if (msg.id === 1 && msg.result) ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 2, method: 'accountUnsubscribe', params: [msg.result]
  }));
  if (msg.id === 2) { clearTimeout(timer); ws.close(); }
};
JS
```

## Implementation conclusion

The defensible zero-key MVP path is: use native WSS as a best-effort early trigger, retain slot/signature/commitment/local receipt time, decode against owner-published Pump IDLs, reconcile with finalized HTTP reads, paginate history explicitly, and persist raw events because the public service offers no production, retention, replay, or completeness SLA. Treat 429s, `null`, disconnects, and pruned/unavailable history as distinct missingness states.
