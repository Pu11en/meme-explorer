"""Read-only planning probe, not the production screening skill.

Pins the four existing runs, streams large files, and writes only the requested
evidence output outside the source corpus. No network or model calls.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime
from hashlib import sha256
import json
from pathlib import Path

RUNS = [
    "run-0001-20260901T090521.931Z",
    "run-0002-20260902T213813.900Z",
    "run-0003-20260904T012430.686Z",
    "run-0004-20260904T025702.891Z",
]


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data_root, output = args.data_root.resolve(), args.output.resolve()
    if output == data_root or data_root in output.parents:
        raise SystemExit("Evidence output must be outside the source corpus")
    fingerprints = []

    def records(path):
        before = path.stat()
        digest, count = sha256(), 0
        with path.open("rb") as handle:
            for line in handle:
                digest.update(line)
                if line.strip():
                    count += 1
                    yield json.loads(line)
        after = path.stat()
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise RuntimeError(f"Input changed during scan: {path}")
        fingerprints.append({"path": str(path.relative_to(data_root)),
                             "bytes": after.st_size, "records": count,
                             "sha256": digest.hexdigest()})

    summaries, profiles, all_mints = [], [], set()
    for run_id in RUNS:
        root = data_root / "runs" / run_id
        manifest_bytes = (root / "manifest.json").read_bytes()
        manifest = json.loads(manifest_bytes)
        fingerprints.append({"path": str((root / "manifest.json").relative_to(data_root)),
                             "bytes": len(manifest_bytes), "sha256": sha256(manifest_bytes).hexdigest()})
        tokens = {r["mint"]: r for r in records(root / "normalized/tokens.ndjson")}
        groups, seen, missing = defaultdict(list), set(), Counter()
        duplicates = 0
        for row in records(root / "normalized/trades.ndjson"):
            key = row["event_key"]
            if key in seen:
                duplicates += 1
                continue
            seen.add(key)
            groups[row["mint"]].append(row)
            for field in ["price_quote", "quote_amount_raw", "token_amount_raw", "signing_wallet",
                          "pool_quote_reserve_raw", "pool_token_reserve_raw", "user_token_balance_raw"]:
                if row.get(field) is None:
                    missing[field] += 1
        run_mints, quotes, reliability = set(), Counter(), Counter()
        for row in records(root / "normalized/events.ndjson"):
            if row.get("mint"):
                run_mints.add(row["mint"])
            if row.get("quote_mint"):
                quotes[row["quote_mint"]] += 1
        for row in records(root / "normalized/reliability.ndjson"):
            reliability[row["kind"] + ":" + row["status"]] += 1
        all_mints.update(run_mints)
        creation_seqs = {t["raw_seq"]: mint for mint, t in tokens.items()}
        trade_seqs = {r["raw_seq"] for trades in groups.values() for r in trades}
        launch_facts, raw_fields, raw_pools, verified = {}, Counter(), Counter(), 0
        raw_count = 0
        for raw in records(root / "raw/pumpapi-live.ndjson"):
            raw_count += 1
            seq = raw["seq"]
            if seq not in creation_seqs and seq not in trade_seqs:
                continue
            payload = raw.get("payload_raw")
            if not isinstance(payload, str):
                raise RuntimeError("Selected frame has no inline payload; extend planning probe")
            encoded = payload.encode("utf-8")
            if sha256(encoded).hexdigest() != raw["sha256"] or len(encoded) != raw["byte_len"]:
                raise RuntimeError(f"Selected raw payload integrity mismatch: {run_id}/{seq}")
            verified += 1
            obj = json.loads(payload, parse_float=str, parse_int=str)
            if seq in creation_seqs:
                fields = ["pool", "poolId", "quoteMint", "txSigner", "creatorFeeAddress", "initialBuy",
                          "quoteAmount", "tokensInPool", "quoteInPool", "vTokensInBondingCurve",
                          "vQuoteInBondingCurve", "mintAuthority", "freezeAuthority", "poolFeeRate",
                          "lockedLiquidityAfterMigration", "mayhemMode", "cashbackEnabled"]
                launch_facts[creation_seqs[seq]] = {
                    "raw_seq": seq, "payload_sha256": raw["sha256"],
                    "provider_fields": {k: obj[k] for k in fields if k in obj},
                }
            if seq in trade_seqs:
                raw_pools[obj.get("pool", "unknown")] += 1
                for field in ["txSigner", "tokensInPool", "quoteInPool", "postBalances",
                              "vTokensInBondingCurve", "vQuoteInBondingCurve", "poolFeeRate"]:
                    if obj.get(field) is not None:
                        raw_fields[field] += 1
        assert raw_count == manifest["counts"]["raw_records"]
        assert len(tokens) == manifest["counts"]["tokens"]
        assert set(launch_facts) == set(tokens)
        end = min(timestamp(manifest["stops_at"]), timestamp(manifest["stopped_at"]))
        run_profiles = []
        for mint, token in tokens.items():
            start = timestamp(token["first_seen_at"])
            trades = sorted(groups.get(mint, []), key=lambda r: (r["received_at"], r["raw_seq"], r.get("breakdown_index", 0)))
            profile = {
                "run_id": run_id, "mint": mint, "symbol": token["symbol"],
                "first_seen_at": token["first_seen_at"], "observed_s": round(end - start, 3),
                "recorded_trades": len(trades), "buys": sum(r["side"] == "buy" for r in trades),
                "sells": sum(r["side"] == "sell" for r in trades),
                "distinct_reported_traders": len({r["signing_wallet"] for r in trades if r.get("signing_wallet")}),
                "normalized_creator_missing": token.get("creator") is None,
                "launch": launch_facts[mint], "windows": {},
            }
            for seconds in [30, 60, 120]:
                early = [r for r in trades if start <= timestamp(r["received_at"]) < start + seconds]
                profile["windows"][str(seconds)] = {
                    "duration_observed": end >= start + seconds,
                    "recorded_trades": len(early),
                    "buys": sum(r["side"] == "buy" for r in early),
                    "sells": sum(r["side"] == "sell" for r in early),
                    "distinct_reported_traders": len({r["signing_wallet"] for r in early if r.get("signing_wallet")}),
                }
            run_profiles.append(profile)
        profiles.extend(run_profiles)
        summaries.append({
            "run_id": run_id, "duration_ms": manifest["duration_ms"], "started_at": manifest["started_at"],
            "stopped_at": manifest["stopped_at"], "manifest_counts": manifest["counts"],
            "unique_event_mints": len(run_mints), "mints_without_recorded_creation_in_run": len(run_mints - set(tokens)),
            "unique_trade_rows": len(seen), "duplicate_trade_rows": duplicates,
            "trade_mints": len(groups), "missing_normalized_trade_fields": dict(missing),
            "no_recorded_trades": sum(p["recorded_trades"] == 0 for p in run_profiles),
            "observed_under_60s": sum(p["observed_s"] < 60 for p in run_profiles),
            "creation_venues": dict(Counter(p["launch"]["provider_fields"].get("pool", "unknown") for p in run_profiles)),
            "event_quote_mints": dict(quotes), "reliability_row_counts": dict(reliability),
            "selected_raw_payloads_verified": verified, "trade_raw_frames": len(trade_seqs),
            "raw_trade_field_presence": dict(raw_fields), "raw_trade_venues": dict(raw_pools),
        })
        print(json.dumps(summaries[-1]), flush=True)
    totals = {
        "runs": len(summaries), "recorded_minutes": sum(r["duration_ms"] for r in summaries) / 60000,
        "raw_records": sum(r["manifest_counts"]["raw_records"] for r in summaries),
        "normalized_records": sum(r["manifest_counts"]["normalized_records"] for r in summaries),
        "unique_event_mints": len(all_mints), "unique_launch_mints": len({p["mint"] for p in profiles}),
        "launches_with_recorded_trades": sum(p["recorded_trades"] > 0 for p in profiles),
        "launches_without_recorded_trades": sum(p["recorded_trades"] == 0 for p in profiles),
        "launches_observed_under_60s": sum(p["observed_s"] < 60 for p in profiles),
        "quiet_launches_with_60s_duration": sum(p["recorded_trades"] == 0 and p["observed_s"] >= 60 for p in profiles),
        "trade_rows": sum(r["unique_trade_rows"] for r in summaries),
        "creation_venues": dict(Counter(p["launch"]["provider_fields"].get("pool", "unknown") for p in profiles)),
    }
    result = {"purpose": "planning-only coverage and field-availability probe; no screening verdicts",
              "source_data_root": str(data_root), "totals": totals, "runs": summaries,
              "profiles": profiles, "input_fingerprints": fingerprints,
              "limitations": ["Duration observed does not prove a gap-free window.",
                              "No outside-window outcome, bundle membership, or profitable execution is established.",
                              "Raw payload hashes checked for launch/trade-linked frames only."]}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print("TOTALS", json.dumps(totals), flush=True)


if __name__ == "__main__":
    main()
