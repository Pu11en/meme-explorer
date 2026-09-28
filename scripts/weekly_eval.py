#!/usr/bin/env python3
"""
Weekly evaluator — the deterministic, ungameable scorer for the self-improving
loop. NO LLM. Answers one question with real numbers:

    "Over the last 7 days, did the wallets on our watchlist actually launch
     coins that were more profitable than a random launch?"

It reads the finished findings (analysis/batch-*-findings/migrators.json) and the
live ledger read-only, compares the REALISTIC return (bought ~30s in, sold at
window end — pipeline's hold_gain_pct) of watchlist-wallet coins vs everyone
else, and writes:
  - analysis/weekly-scorecard.json  (machine baseline; the loop's frozen score)
  - analysis/weekly-report.md       (human-readable; ask a session about it)

Design notes (from the loop's safety review):
  * Robust stats: reports median + hit-rate + a bootstrap 95% CI, not just mean
    (realistic returns are heavy-tailed; one runner would dominate a mean).
  * Minimum sample size: below MIN_SAMPLES the verdict is "insufficient data"
    and the self-improve loop must treat that as "do nothing".
  * Read-only: never writes pipeline data or the ledger; safe to run anytime.

Usage:
  /usr/bin/python3 scripts/weekly_eval.py [--days 7] [--quiet]
Exit 0 always (evaluation is not a gate); the scorecard carries the verdict.
"""
import json
import glob
import random
import statistics
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO          = Path(__file__).parent.parent.resolve()
FINDINGS_DIR  = REPO / "analysis"
SCORECARD     = FINDINGS_DIR / "weekly-scorecard.json"
REPORT        = FINDINGS_DIR / "weekly-report.md"
LEDGER        = FINDINGS_DIR / "dev-ledger.json"

MIN_SAMPLES   = 30      # need at least this many watchlist coin-observations for a verdict
PROFIT_PCT    = 0.0     # a coin "made money" if realistic return > this
BOOTSTRAP_N   = 2000
SEED          = 12345   # deterministic CI run-to-run


def now_utc():
    return datetime.now(timezone.utc)


def _bootstrap_ci(values, stat=statistics.median, iters=BOOTSTRAP_N):
    """95% bootstrap CI for a statistic. Deterministic (seeded)."""
    if len(values) < 2:
        return (None, None)
    rng = random.Random(SEED)
    n = len(values)
    samples = []
    for _ in range(iters):
        resample = [values[rng.randrange(n)] for _ in range(n)]
        samples.append(stat(resample))
    samples.sort()
    lo = samples[int(0.025 * iters)]
    hi = samples[int(0.975 * iters)]
    return (round(lo, 2), round(hi, 2))


def _load_recent_migrators(days):
    """All migrator records from findings whose window is within `days`. Falls
    back to file mtime when a record has no parseable launch time."""
    cutoff = now_utc() - timedelta(days=days)
    out = []
    for f in sorted(glob.glob(str(FINDINGS_DIR / "batch-*-findings" / "migrators.json"))):
        p = Path(f)
        try:
            mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
        except Exception:
            mtime = now_utc()
        if mtime < cutoff:
            continue
        try:
            for m in json.load(open(f)):
                out.append(m)
        except Exception:
            continue
    return out


def _returns(migrators, watchlist_only):
    """Realistic returns (hold_gain_pct) for migrators, split by watchlist membership.
    Only coins that actually carry a realistic return count (tradable + new schema)."""
    vals = []
    for m in migrators:
        g = m.get("hold_gain_pct")
        if g is None:
            continue
        is_wl = bool(m.get("watchlist_hit"))
        if is_wl == watchlist_only:
            vals.append(g)
    return vals


def evaluate(days=7):
    migrators = _load_recent_migrators(days)
    total_with_return = sum(1 for m in migrators if m.get("hold_gain_pct") is not None)

    wl = _returns(migrators, watchlist_only=True)
    base = _returns(migrators, watchlist_only=False)

    def summary(vals):
        if not vals:
            return {"n": 0}
        return {
            "n": len(vals),
            "median_pct": round(statistics.median(vals), 2),
            "mean_pct": round(statistics.mean(vals), 2),
            "win_rate_pct": round(100 * sum(1 for v in vals if v > PROFIT_PCT) / len(vals), 1),
            "median_ci95": _bootstrap_ci(vals),
        }

    wl_s, base_s = summary(wl), summary(base)

    # Verdict: watchlist beats baseline only if we have enough samples AND the
    # watchlist median CI lower bound clears the baseline median. Otherwise the
    # honest answer is "not enough data" — which the loop treats as do-nothing.
    verdict = "insufficient_data"
    edge_pct = None
    if wl_s["n"] >= MIN_SAMPLES and base_s.get("n", 0) >= MIN_SAMPLES:
        wl_lo = wl_s["median_ci95"][0]
        base_med = base_s["median_pct"]
        edge_pct = round(wl_s["median_pct"] - base_med, 2)
        if wl_lo is not None and wl_lo > base_med:
            verdict = "watchlist_beats_baseline"
        elif wl_s["median_pct"] < base_med:
            verdict = "watchlist_worse_than_baseline"
        else:
            verdict = "no_significant_edge"

    ledger_devs = 0
    try:
        ledger_devs = len(json.load(open(LEDGER)).get("devs", {}))
    except Exception:
        pass

    return {
        "generated_at": now_utc().isoformat(),
        "window_days": days,
        "migrators_seen": len(migrators),
        "migrators_with_return_data": total_with_return,
        "min_samples_required": MIN_SAMPLES,
        "watchlist": wl_s,
        "baseline": base_s,
        "edge_pct": edge_pct,               # watchlist median minus baseline median
        "verdict": verdict,
        "ledger_devs_tracked": ledger_devs,
        # The single number the self-improve gate compares run-to-run. Only
        # meaningful once verdict != insufficient_data.
        "score": (wl_s.get("median_pct") if verdict != "insufficient_data" else None),
    }


def write_report(sc):
    v = sc["verdict"]
    headline = {
        "insufficient_data": "⏳ Not enough data yet — keep letting it run.",
        "watchlist_beats_baseline": "✅ The watchlist wallets ARE beating random launches.",
        "watchlist_worse_than_baseline": "❌ The watchlist is doing WORSE than random — the finder needs work.",
        "no_significant_edge": "➖ No clear edge yet — watchlist ≈ random so far.",
    }.get(v, v)
    wl, base = sc["watchlist"], sc["baseline"]
    lines = [
        f"# Weekly Watchlist Report",
        f"_generated {sc['generated_at']} · trailing {sc['window_days']} days_",
        "",
        f"## {headline}",
        "",
        f"- Migrating coins seen: **{sc['migrators_seen']}** "
        f"({sc['migrators_with_return_data']} with realistic-return data)",
        f"- Wallets tracked in ledger: **{sc['ledger_devs_tracked']}**",
        "",
        "| | Watchlist wallets | Everyone else (baseline) |",
        "|---|---|---|",
        f"| coins measured | {wl.get('n',0)} | {base.get('n',0)} |",
        f"| median realistic return | {wl.get('median_pct','–')}% | {base.get('median_pct','–')}% |",
        f"| win rate (return>0) | {wl.get('win_rate_pct','–')}% | {base.get('win_rate_pct','–')}% |",
        f"| median 95% CI | {wl.get('median_ci95','–')} | {base.get('median_ci95','–')} |",
        "",
    ]
    if v == "insufficient_data":
        lines.append(
            f"> Need ≥{sc['min_samples_required']} watchlist coins with return data before a verdict. "
            f"Have {wl.get('n',0)}. This is expected in the first weeks — organic winners are rare. "
            "Nothing is wrong; the loop is correctly waiting.")
    else:
        edge = sc.get("edge_pct")
        lines.append(f"> Edge (watchlist median − baseline median): **{edge:+}%**." if edge is not None else "")
    lines.append("")
    lines.append("_Realistic return = bought ~30s after launch, sold at the end of the 180s "
                 "observation window. It is not best-case; it can be negative._")
    REPORT.write_text("\n".join(lines))


def main():
    days = 7
    if "--days" in sys.argv:
        try:
            days = int(sys.argv[sys.argv.index("--days") + 1])
        except Exception:
            pass
    sc = evaluate(days)
    with open(SCORECARD, "w") as f:
        json.dump(sc, f, indent=2)
    write_report(sc)
    if "--quiet" not in sys.argv:
        print(f"verdict={sc['verdict']} score={sc['score']} "
              f"watchlist_n={sc['watchlist'].get('n',0)} baseline_n={sc['baseline'].get('n',0)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
