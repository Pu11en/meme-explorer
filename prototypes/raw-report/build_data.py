#!/usr/bin/env python3
"""Build a compact, offline report preview from the retained raw/normalized corpus.

The source corpus is intentionally outside this worktree and is read only.  This
script uses normalized event keys as the membership boundary, then reads raw
payloads (losslessly) for launch metadata, exact trade quantities, prices and
evidence references.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


DEFAULT_DATA_ROOT = Path("/home/drewp/main-projects/meme explorer/data")
SO = "So11111111111111111111111111111111111111112"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
QUOTE_LABELS = {SO: "SOL", USDC: "USDC", USDT: "USDT"}


def first(obj: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = obj.get(key)
        if value is not None:
            return value
    return None


def text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return str(value)
    return str(value)


def canonical_action(value: Any) -> str:
    raw = text(value) or "unknown"
    compact = "".join(c for c in raw.lower() if c.isalnum())
    mapping = {
        "create": "create",
        "createtoken": "create",
        "buy": "buy",
        "sell": "sell",
        "transfer": "transfer",
        "migrate": "migrate",
        "migration": "migrate",
        "complete": "complete",
        "createpool": "create_pool",
        "poolcreate": "create_pool",
        "add": "add_liquidity",
        "addliquidity": "add_liquidity",
        "remove": "remove_liquidity",
        "removeliquidity": "remove_liquidity",
    }
    if compact in mapping:
        return mapping[compact]
    if "creatorfee" in compact or "claimfee" in compact:
        return "creator_fee_claim"
    return raw


def iso_from_value(value: Any) -> str | None:
    if value is None:
        return None
    raw = text(value)
    if raw is None:
        return None
    try:
        numeric = float(raw)
    except ValueError:
        numeric = math.nan
    if math.isfinite(numeric):
        milliseconds = numeric * 1000 if abs(numeric) < 10_000_000_000 else numeric
        return datetime.fromtimestamp(milliseconds / 1000, tz=timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def dec(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def decimal_string(value: Decimal) -> str:
    if not value:
        return "0"
    return format(value, "f")


def float_or_none(value: Any) -> float | None:
    number = dec(value)
    if number is None:
        return None
    result = float(number)
    return result if math.isfinite(result) else None


def trader_value(record: dict[str, Any]) -> Any:
    """Reported trader identity, kept separate from the transaction signer."""
    return first(record, ("trader", "user", "signer"))


def json_line(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def iter_lines(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def breakdowns(root: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("events", "breakdown", "breakdowns", "actions"):
        value = root.get(key)
        if not isinstance(value, list) or not value:
            continue
        nested = [item for item in value if isinstance(item, dict)]
        if nested:
            return [{**root, **item, key: None} for item in nested]
    return [root]


def event_key(signature: str | None, seq: Any, index: int, action: str) -> str:
    return f"{signature}:{index}:{action}" if signature else f"{seq}:{index}:{action}"


def source_time(record: dict[str, Any]) -> str | None:
    return iso_from_value(first(record, ("timestamp", "time", "blockTime", "block_time", "createdAt", "created_at")))


def new_coin(mint: str) -> dict[str, Any]:
    return {
        "id": mint,
        "mint": mint,
        "name": None,
        "symbol": None,
        "origin": "unknown",
        "launch_at": None,
        "launch_run_id": None,
        "runs": {},
        "event_counts": Counter(),
        "volumes": {},
        "series_trades": defaultdict(list),
        "evidence_candidates": [],
        "raw_evidence_candidates": [],
    }


def run_coin(coin: dict[str, Any], run_id: str) -> dict[str, Any]:
    runs = coin["runs"]
    if run_id not in runs:
        runs[run_id] = {
            "run_id": run_id,
            "first_seen": None,
            "last_seen": None,
            "event_count": 0,
            "buy_count": 0,
            "sell_count": 0,
            "_first_dt": None,
            "_last_dt": None,
        }
    return runs[run_id]


def update_window(row: dict[str, Any], when: str | None) -> None:
    observed = dt(when)
    if observed is None:
        return
    if row["_first_dt"] is None or observed < row["_first_dt"]:
        row["_first_dt"] = observed
        row["first_seen"] = when
    if row["_last_dt"] is None or observed > row["_last_dt"]:
        row["_last_dt"] = observed
        row["last_seen"] = when


def add_candidate(coin: dict[str, Any], candidate: dict[str, Any]) -> None:
    if len(coin["evidence_candidates"]) < 8:
        coin["evidence_candidates"].append(candidate)


def add_raw_candidate(coin: dict[str, Any], candidate: dict[str, Any]) -> None:
    if len(coin["raw_evidence_candidates"]) < 8:
        coin["raw_evidence_candidates"].append(candidate)


def compact_evidence(candidate: dict[str, Any]) -> dict[str, Any]:
    # The source_ref already identifies the immutable raw/normalized location;
    # omit the repeated 87-character signature and null placeholders so the
    # embedded preview remains reasonably small.
    preserve_nulls = {
        "market_cap_quote",
        "pool_token_reserve",
        "pool_quote_reserve",
        "fee_rate",
        "tx_signer",
        "trader",
        "pool",
    }
    result = {key: value for key, value in candidate.items() if value is not None and key not in ("signature", "price_currency")}
    for key in preserve_nulls:
        result.setdefault(key, None)
    return result


def pump_fun_creation(root: dict[str, Any]) -> bool:
    return canonical_action(first(root, ("action", "txType", "tx_type", "type"))) == "create" and text(root.get("pool")) == "pump"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("data.json"))
    args = parser.parse_args()
    data_root: Path = args.data_root
    runs_root = data_root / "runs"
    run_dirs = sorted(runs_root.glob("*/"), key=lambda path: json_line(path / "manifest.json")["sequence"])
    manifests = [json_line(path / "manifest.json") for path in run_dirs]
    by_run = {manifest["run_id"]: manifest for manifest in manifests}

    # Establish the only allowed universe from explicit Pump.fun creation
    # evidence. A mint suffix or later trade venue is never used as proof.
    pump_mints: set[str] = set()
    for run_dir in run_dirs:
        for envelope in iter_lines(run_dir / "raw" / "pumpapi-live.ndjson"):
            payload_raw = envelope.get("payload_raw")
            if not isinstance(payload_raw, str):
                continue
            try:
                root = json.loads(payload_raw)
            except json.JSONDecodeError:
                continue
            if not isinstance(root, dict) or not pump_fun_creation(root):
                continue
            mint = text(first(root, ("mint", "tokenAddress", "token_address")))
            if mint is not None:
                pump_mints.add(mint)

    coins: dict[str, dict[str, Any]] = {}
    event_membership: set[tuple[str, str]] = set()
    event_quotes: dict[tuple[str, str], str | None] = {}
    normalized_event_count = 0
    duplicate_event_count = 0
    action_totals = Counter()

    for run_dir in run_dirs:
        run_id = run_dir.name
        event_path = run_dir / "normalized" / "events.ndjson"
        for event in iter_lines(event_path):
            action = text(event.get("action")) or "unknown"
            key = text(event.get("event_key"))
            if key is None:
                continue
            mint = text(event.get("mint"))
            if mint is None or mint not in pump_mints:
                continue
            normalized_event_count += 1
            membership = (run_id, key)
            if membership in event_membership:
                duplicate_event_count += 1
                continue
            event_membership.add(membership)
            event_quotes[membership] = text(event.get("quote_mint"))
            action_totals[action] += 1
            coin = coins.setdefault(mint, new_coin(mint))
            row = run_coin(coin, run_id)
            when = text(event.get("source_at")) or text(event.get("received_at"))
            update_window(row, when)
            row["event_count"] += 1
            if action == "buy":
                row["buy_count"] += 1
            elif action == "sell":
                row["sell_count"] += 1
            coin["event_counts"][action] += 1
            add_candidate(
                coin,
                {
                    "run_id": run_id,
                    "seq": event.get("raw_seq"),
                    "time": when,
                    "action": action,
                    "trader": None,
                    "signature": event.get("signature"),
                    "quote": event.get("quote_mint"),
                    "price": None,
                    "price_currency": event.get("quote_mint"),
                    "source_ref": f"runs/{run_id}/normalized/events.ndjson#raw_seq={event.get('raw_seq')}",
                },
            )

    # Token rows are a convenient fallback; raw create frames below override
    # them when their fields are present.
    token_rows = 0
    for run_dir in run_dirs:
        for token in iter_lines(run_dir / "normalized" / "tokens.ndjson"):
            mint = text(token.get("mint"))
            if mint is None or mint not in pump_mints:
                continue
            token_rows += 1
            coin = coins.setdefault(mint, new_coin(mint))
            if coin["name"] is None and token.get("name") is not None:
                coin["name"] = token.get("name")
            if coin["symbol"] is None and token.get("symbol") is not None:
                coin["symbol"] = token.get("symbol")

    reliability = {}
    for run_dir, manifest in zip(run_dirs, manifests):
        counts = Counter()
        reliability_path = run_dir / "normalized" / "reliability.ndjson"
        for row in iter_lines(reliability_path):
            counts[f"{row.get('kind', 'unknown')}:{row.get('status', 'unknown')}"] += 1
        reliability[manifest["run_id"]] = dict(sorted(counts.items()))

    raw_trade_seen: set[tuple[str, str]] = set()
    raw_records = 0
    raw_bytes = 0
    raw_trade_frames = 0
    raw_trade_quantity_rows = 0
    launch_rows = 0
    raw_records_by_run = Counter()
    for run_dir in run_dirs:
        run_id = run_dir.name
        raw_path = run_dir / "raw" / "pumpapi-live.ndjson"
        for envelope in iter_lines(raw_path):
            payload_raw = envelope.get("payload_raw")
            if not isinstance(payload_raw, str):
                continue
            try:
                # parse_float/parse_int=str is deliberate: quantities are
                # preserved exactly before Decimal aggregation.
                root = json.loads(payload_raw, parse_float=str, parse_int=str)
            except json.JSONDecodeError:
                continue
            if not isinstance(root, dict):
                continue
            root_mint = text(first(root, ("mint", "tokenAddress", "token_address")))
            if root_mint not in pump_mints:
                continue
            raw_records += 1
            raw_bytes += int(envelope.get("byte_len") or 0)
            raw_records_by_run[run_id] += 1
            signature = text(first(root, ("signature", "txSignature", "transactionSignature"))) or text(envelope.get("event_id"))
            if pump_fun_creation(root) and root_mint is not None:
                launch_rows += 1
                when = source_time(root) or text(envelope.get("source_at"))
                coin = coins.setdefault(root_mint, new_coin(root_mint))
                if coin["launch_at"] is None or (when and (dt(coin["launch_at"]) is None or dt(when) < dt(coin["launch_at"]))):
                    coin["launch_at"] = when
                    coin["launch_run_id"] = run_id
                coin["origin"] = "pump"
                if root.get("name") is not None:
                    coin["name"] = root.get("name")
                if root.get("symbol") is not None:
                    coin["symbol"] = root.get("symbol")
                add_raw_candidate(
                    coin,
                    {
                        "run_id": run_id,
                        "seq": envelope.get("seq"),
                        "time": when,
                        "action": "create",
                        "trader": trader_value(root),
                        "tx_signer": first(root, ("txSigner",)),
                        "signature": signature,
                        "quote": first(root, ("quoteMint", "quote_mint")),
                        "price": text(root.get("price")),
                        "price_currency": first(root, ("quoteMint", "quote_mint")),
                        "market_cap_quote": text(first(root, ("marketCapQuote", "market_cap_quote", "marketCapSol"))),
                        "pool_token_reserve": text(first(root, ("tokensInPool", "poolTokenAmount", "pool_token_amount", "tokenReserves"))),
                        "pool_quote_reserve": text(first(root, ("quoteInPool", "poolQuoteAmount", "pool_quote_amount", "solReserves"))),
                        "fee_rate": text(first(root, ("poolFeeRate", "feeRate", "fee_rate"))),
                        "pool": "pump",
                        "source_ref": f"runs/{run_id}/raw/pumpapi-live.ndjson#seq={envelope.get('seq')}",
                    },
                )
            for index, record in enumerate(breakdowns(root)):
                action = canonical_action(first(record, ("action", "txType", "tx_type", "type")))
                key = event_key(signature, envelope.get("seq"), index, action)
                membership = (run_id, key)
                mint = text(first(record, ("mint", "tokenAddress", "token_address")))
                when = source_time(record) or text(envelope.get("source_at"))
                if mint in pump_mints and action not in ("create", "buy", "sell"):
                    # Keep a raw evidence row for non-trade market events too;
                    # the detail inspector should never silently substitute a
                    # normalized placeholder when the payload was retained.
                    coin = coins.setdefault(mint, new_coin(mint))
                    add_raw_candidate(
                        coin,
                        {
                            "run_id": run_id,
                            "seq": envelope.get("seq"),
                            "time": when,
                            "action": action,
                            "trader": trader_value(record),
                            "tx_signer": first(record, ("txSigner",)),
                            "signature": signature,
                            "quote": first(record, ("quoteMint", "quote_mint")),
                            "price": text(record.get("price")),
                            "price_currency": first(record, ("quoteMint", "quote_mint")),
                            "market_cap_quote": text(first(record, ("marketCapQuote", "market_cap_quote", "marketCapSol"))),
                            "pool_token_reserve": text(first(record, ("tokensInPool", "poolTokenAmount", "pool_token_amount", "tokenReserves"))),
                            "pool_quote_reserve": text(first(record, ("quoteInPool", "poolQuoteAmount", "pool_quote_amount", "solReserves"))),
                            "fee_rate": text(first(record, ("poolFeeRate", "feeRate", "fee_rate"))),
                            "pool": text(record.get("pool")),
                            "source_ref": f"runs/{run_id}/raw/pumpapi-live.ndjson#seq={envelope.get('seq')}",
                        },
                    )
                if action not in ("buy", "sell") or membership not in event_membership or mint not in pump_mints:
                    continue
                if membership in raw_trade_seen:
                    continue
                raw_trade_seen.add(membership)
                raw_trade_frames += 1
                quote = text(first(record, ("quoteMint", "quote_mint"))) or event_quotes.get(membership)
                quote_amount = dec(first(record, ("quoteAmount", "quote_amount", "solAmount", "baseAmount")))
                token_amount = dec(first(record, ("tokenAmount", "token_amount", "amount")))
                price = dec(record.get("price"))
                coin = coins.setdefault(mint, new_coin(mint))
                if quote not in coin["volumes"]:
                    coin["volumes"][quote] = {"buy": Decimal(0), "sell": Decimal(0), "buy_events": 0, "sell_events": 0, "buy_unavailable": 0, "sell_unavailable": 0}
                volume = coin["volumes"][quote]
                side = "buy" if action == "buy" else "sell"
                volume[f"{side}_events"] += 1
                if quote_amount is None:
                    volume[f"{side}_unavailable"] += 1
                else:
                    volume[side] += quote_amount
                    raw_trade_quantity_rows += 1
                coin["series_trades"][run_id].append({"time": when, "action": action, "quote": quote, "amount": quote_amount, "price": price})
                add_raw_candidate(
                    coin,
                    {
                        "run_id": run_id,
                        "seq": envelope.get("seq"),
                        "time": when,
                        "action": action,
                        "trader": trader_value(record),
                        "tx_signer": first(record, ("txSigner",)),
                        "signature": signature,
                        "quote": quote,
                        "price": text(record.get("price")),
                        "price_currency": quote,
                        "market_cap_quote": text(first(record, ("marketCapQuote", "market_cap_quote", "marketCapSol"))),
                        "pool_token_reserve": text(first(record, ("tokensInPool", "poolTokenAmount", "pool_token_amount", "tokenReserves"))),
                        "pool_quote_reserve": text(first(record, ("quoteInPool", "poolQuoteAmount", "pool_quote_amount", "solReserves"))),
                        "fee_rate": text(first(record, ("poolFeeRate", "feeRate", "fee_rate"))),
                        "pool": text(record.get("pool")),
                        "token_amount": text(first(record, ("tokenAmount", "token_amount", "amount"))),
                        "quote_amount": text(first(record, ("quoteAmount", "quote_amount", "solAmount", "baseAmount"))),
                        "source_ref": f"runs/{run_id}/raw/pumpapi-live.ndjson#seq={envelope.get('seq')}",
                    },
                )

    def output_series(coin: dict[str, Any], run_id: str, row: dict[str, Any], row_first: datetime | None) -> list[dict[str, Any]]:
        observations = coin["series_trades"].get(run_id, [])
        if not observations:
            return []
        use_creation = bool(coin["launch_at"] and coin["launch_run_id"] == run_id)
        anchor = dt(coin["launch_at"]) if use_creation else row_first
        if anchor is None:
            return []
        run_end = dt(by_run[run_id]["stopped_at"])
        anchor_mode = "since_creation" if use_creation else "since_first_observed"
        by_quote: dict[str | None, list[dict[str, Any]]] = defaultdict(list)
        for observation in observations:
            by_quote[observation["quote"]].append(observation)
        result = []
        for quote, items in sorted(by_quote.items(), key=lambda pair: str(pair[0])):
            timed = []
            for item in items:
                observed = dt(item["time"])
                if observed is None:
                    continue
                seconds = max(0.0, (observed - anchor).total_seconds())
                timed.append((seconds, item))
            if not timed:
                continue
            max_seconds = max(seconds for seconds, _ in timed)
            width = max(1, math.ceil((max_seconds + 1) / 12))
            bins: dict[int, dict[str, Any]] = {}
            for seconds, item in timed:
                bucket = min(11, int(seconds // width))
                point = bins.setdefault(bucket, {"t": bucket * width, "buy": 0.0, "sell": 0.0, "price": None})
                if item["amount"] is not None:
                    point[item["action"]] += float(item["amount"])
                if item["price"] is not None:
                    point["price"] = float(item["price"])
            result.append({
                "run_id": run_id,
                "quote": quote,
                "anchor": anchor.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                "anchor_mode": anchor_mode,
                "window_end": run_end.isoformat(timespec="milliseconds").replace("+00:00", "Z") if run_end else None,
                "bin_width_seconds": width,
                "points": [bins[index] for index in sorted(bins)],
            })
        return result

    output_coins = []
    for mint in sorted(coins):
        coin = coins[mint]
        rows = []
        first_seen: datetime | None = None
        last_seen: datetime | None = None
        series = []
        for run_id in sorted(coin["runs"], key=lambda item: by_run[item]["sequence"]):
            row = coin["runs"][run_id]
            row_first, row_last = row["_first_dt"], row["_last_dt"]
            if row_first is not None and (first_seen is None or row_first < first_seen):
                first_seen = row_first
            if row_last is not None and (last_seen is None or row_last > last_seen):
                last_seen = row_last
            use_creation = bool(coin["launch_at"] and coin["launch_run_id"] == run_id)
            anchor = dt(coin["launch_at"]) if use_creation else row_first
            row["coverage_mode"] = "since_creation" if use_creation else "since_first_observed"
            row["coverage_seconds"] = round(max(0.0, (row_last - anchor).total_seconds()), 3) if row_last and anchor else None
            run_end = dt(by_run[run_id]["stopped_at"])
            row["available_seconds"] = round(max(0.0, (run_end - anchor).total_seconds()), 3) if run_end and anchor else None
            row["trade_observation"] = "trades_recorded" if row["buy_count"] + row["sell_count"] else "no_trades_recorded"
            row.pop("_first_dt")
            row.pop("_last_dt")
            rows.append(row)
            series.extend(output_series(coin, run_id, row, row_first))
        volumes = []
        for quote, value in sorted(coin["volumes"].items(), key=lambda pair: str(pair[0])):
            volumes.append({
                "quote": quote,
                "buy": decimal_string(value["buy"]),
                "sell": decimal_string(value["sell"]),
                "buy_events": value["buy_events"],
                "sell_events": value["sell_events"],
                "buy_unavailable": value["buy_unavailable"],
                "sell_unavailable": value["sell_unavailable"],
            })
        candidates = sorted(
            coin["raw_evidence_candidates"] or coin["evidence_candidates"],
            key=lambda item: (0 if item["action"] in ("create", "buy", "sell") else 1, item.get("time") or "", item.get("seq") or 0),
        )
        evidence = [compact_evidence(candidate) for candidate in candidates[:3]]
        output_coins.append({
            "id": mint,
            "mint": mint,
            "name": coin["name"],
            "symbol": coin["symbol"],
            "origin": coin["origin"],
            "launch_at": coin["launch_at"],
            "launch_run_id": coin["launch_run_id"],
            "first_seen": first_seen.isoformat(timespec="milliseconds").replace("+00:00", "Z") if first_seen else None,
            "last_seen": last_seen.isoformat(timespec="milliseconds").replace("+00:00", "Z") if last_seen else None,
            "events": {"count": sum(coin["event_counts"].values()), "buy": coin["event_counts"]["buy"], "sell": coin["event_counts"]["sell"]},
            "runs": rows,
            "volumes": volumes,
            "series": series,
            "evidence": evidence,
        })

    normalized_records_by_run = Counter()
    for run_dir in run_dirs:
        for path in (run_dir / "normalized").glob("*.ndjson"):
            if path.name == "reliability.ndjson":
                continue
            for record in iter_lines(path):
                if text(record.get("mint")) in pump_mints:
                    normalized_records_by_run[run_dir.name] += 1
    total_bytes = raw_bytes
    total_raw = raw_records
    total_normalized = sum(normalized_records_by_run.values())
    launch_mints = {coin["mint"] for coin in output_coins if coin["launch_at"] is not None}
    output = {
        "schema": "meme.raw-report-preview/1",
        "meta": {
            "source_root": str(data_root),
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "bytes_total": total_bytes,
            "bytes_total_gib": round(total_bytes / (1024 ** 3), 2),
            "raw_records": total_raw,
            "normalized_records": total_normalized,
            "normalized_event_rows": normalized_event_count,
            "deduped_event_rows": len(event_membership),
            "duplicate_event_rows_skipped": duplicate_event_count,
            "unique_event_mints": len(coins),
            "launch_mints": len(launch_mints),
            "raw_trade_frames_matched": raw_trade_frames,
            "raw_trade_quantity_rows": raw_trade_quantity_rows,
            "trade_quantity_coverage": "exact_raw_payload_decimal_when_field_present",
            "quotes": [{"mint": mint, "label": QUOTE_LABELS.get(mint, "unknown")} for mint in sorted({quote for coin in output_coins for quote in (item["quote"] for item in coin["volumes"])}, key=lambda value: str(value))],
            "runs": [
                {
                    "run_id": manifest["run_id"],
                    "started_at": manifest["started_at"],
                    "stopped_at": manifest["stopped_at"],
                    "duration_ms": manifest["duration_ms"],
                    "status": manifest["status"],
                    "stop_reason": manifest["stop_reason"],
                    "raw_records": raw_records_by_run[manifest["run_id"]],
                    "normalized_records": normalized_records_by_run[manifest["run_id"]],
                    "reliability_records": manifest["counts"]["reliability_records"],
                    "reliability_gaps": reliability[manifest["run_id"]],
                }
                for manifest in manifests
            ],
            "limitations": [
                "Raw and normalized observation windows do not prove gap-free delivery.",
                "Only mints with an explicit raw creation pool of pump are included; suffixes and later trade venues are not used to infer launch origin.",
                "No outside-window outcome, bundle membership, or profitable execution is established.",
                "Chart buy/sell values are bounded floating-point samples; exact totals remain Decimal strings in volumes.",
                "Coins with no recorded trades retain explicit no_trades_recorded state; this is not proof of no activity outside the capture.",
            ],
        },
        "coins": output_coins,
    }

    assert len(manifests) == 4, len(manifests)
    assert len(output_coins) == len(pump_mints) == 592, (len(output_coins), len(pump_mints))
    assert launch_mints == pump_mints, (len(launch_mints), len(pump_mints))
    assert all(coin["origin"] == "pump" for coin in output_coins)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        json.dump(output, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
    print(json.dumps({"output": str(args.output), "bytes": args.output.stat().st_size, "coins": len(output_coins), "launch_mints": len(launch_mints), "raw_records": total_raw, "normalized_records": total_normalized, "raw_trade_frames_matched": raw_trade_frames}, separators=(",", ":")))


if __name__ == "__main__":
    main()
