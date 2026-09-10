#!/usr/bin/env python3
"""
Burst Report — on-demand signal analysis for Discord (slate format).

Usage:
  python3 burst_report.py              # all batches
  python3 burst_report.py batch-003    # single batch
  python3 burst_report.py batch-002 batch-003  # multiple

Output: 10 Burst / 30 Burst / 60 Burst sections, Discord-ready (no embeds).

Signal definitions
──────────────────
10 Burst  — Volume floor (≥25 buys in 0-10s) + Sustain ratio (5-10s / 0-5s ≥ 0.3)
30 Burst  — Volume floor (≥50 buys in 0-30s) + Sustain ratio (15-30s / 0-15s ≥ 0.4)
60 Burst  — Unique buyers ≥ 60 + same-slot < 5
"""
import json, sys
from pathlib import Path

ANALYSIS = Path(__file__).parent.parent / "analysis"

# ── fraud filter ────────────────────────────────────────────────────────────
def classify(c):
    w60 = c.get("w60", {})
    if w60.get("same_slot_buys", 0) >= 5:  return "bundle"
    if w60.get("top_wallet_pct", 0) >= 40: return "bundle"
    if w60.get("unique_buyers", 0) <= 6 and c.get("sniper_ratio_60", 0) >= 80: return "controlled"
    return "organic"

# ── load ────────────────────────────────────────────────────────────────────
def enrich(c, bid):
    bars = c.get("bars_3min", [])
    c["_batch"]    = bid
    c["_verdict"]  = c.get("verdict") or classify(c)
    c["b_0_5"]     = sum(bars[0:5])
    c["b_5_10"]    = sum(bars[5:10])
    c["b_0_10"]    = sum(bars[0:10])
    c["sustain10"] = round(c["b_5_10"] / c["b_0_5"], 2) if c["b_0_5"] > 0 else 0
    c["b_0_15"]    = sum(bars[0:15])
    c["b_15_30"]   = sum(bars[15:30])
    c["b_0_30"]    = sum(bars[0:30])
    c["sustain30"] = round(c["b_15_30"] / c["b_0_15"], 2) if c["b_0_15"] > 0 else 0
    w60 = c.get("w60", {})
    c["uniq60"]    = w60.get("unique_buyers", 0)
    c["slot60"]    = w60.get("same_slot_buys", 0)
    return c

def load_batches(batch_ids):
    migrators = []
    all_coins  = []   # populated only when all-coins-bars.json exists
    has_full_data = True

    for bid in batch_ids:
        findings = ANALYSIS / f"{bid}-findings"
        mig_path  = findings / "all-migrators.json"
        bars_path = findings / "all-coins-bars.json"

        if not mig_path.exists():
            print(f"[warn] {bid} not found, skipping")
            continue

        with open(mig_path) as f:
            for c in json.load(f):
                if c.get("migrated"):
                    enriched = enrich(c, bid)
                    if enriched["_verdict"] == "organic":
                        migrators.append(enriched)

        if bars_path.exists():
            with open(bars_path) as f:
                for c in json.load(f):
                    all_coins.append(enrich(c, bid))
        else:
            has_full_data = False

    return migrators, all_coins, has_full_data

def fmt(sec):
    if sec is None: return "—"
    return f"{int(sec)//60}m {int(sec)%60:02d}s"

def signal10(c):
    return c["b_0_10"] >= 25 and c["sustain10"] >= 0.3

def signal30(c):
    return c["b_0_30"] >= 50 and c["sustain30"] >= 0.4

def signal60(c):
    return c["uniq60"] >= 60 and c["slot60"] < 5

# ── sections ────────────────────────────────────────────────────────────────
def fp_line(all_coins, signal_fn, label):
    if not all_coins:
        return f"False positive rate: *not yet available — needs batch-004+ data*"
    non_mig = [c for c in all_coins if not c.get("migrated")]
    fp = sum(1 for c in non_mig if signal_fn(c))
    return f"False positives: **{fp}/{len(non_mig)}** non-migrating coins also fired ({fp/len(non_mig)*100:.1f}%)"

def section_10(organic, all_coins, label):
    passing = [c for c in organic if signal10(c)]
    rows = sorted(organic, key=lambda c: c.get("migration_sec") or 9999)
    table = "\n".join(
        f"  {c.get('name','?'):<18} 0-5s={c['b_0_5']:>3} 5-10s={c['b_5_10']:>3}  sustain={c['sustain10']:.2f}  {'✓' if signal10(c) else '✗'}  {fmt(c.get('migration_sec'))}"
        for c in rows
    )
    return f"""**⚡ 10 BURST** — {label}
*Volume floor (≥25 buys in 0-10s) + Sustain ratio (5-10s ÷ 0-5s ≥ 0.3). Bundles front-dump and crater; organic stays flat or builds.*

```
Coin               0-5s  5-10s  Sustain  Pass  Migrated
────────────────────────────────────────────────────────
{table}
```
Signal fires: **{len(passing)}/{len(organic)}** organic migrators · {fp_line(all_coins, signal10, label)}"""

def section_30(organic, all_coins, label):
    passing = [c for c in organic if signal30(c)]
    rows = sorted(organic, key=lambda c: c.get("migration_sec") or 9999)
    table = "\n".join(
        f"  {c.get('name','?'):<18} 0-15s={c['b_0_15']:>3} 15-30s={c['b_15_30']:>3}  sustain={c['sustain30']:.2f}  {'✓' if signal30(c) else '✗'}  {fmt(c.get('migration_sec'))}"
        for c in rows
    )
    return f"""**⏱ 30 BURST** — {label}
*Volume floor (≥50 buys in 0-30s) + Sustain ratio (15-30s ÷ 0-15s ≥ 0.4). By 30s organic coins are still pulling in new buyers; bundles have already peaked.*

```
Coin               0-15s  15-30s  Sustain  Pass  Migrated
──────────────────────────────────────────────────────────
{table}
```
Signal fires: **{len(passing)}/{len(organic)}** organic migrators · {fp_line(all_coins, signal30, label)}"""

def section_60(organic, all_coins, label):
    passing = [c for c in organic if signal60(c)]
    rows = sorted(organic, key=lambda c: c.get("migration_sec") or 9999)
    table = "\n".join(
        f"  {c.get('name','?'):<18} uniq={c['uniq60']:>4}  slot={c['slot60']:>2}  {'✓' if signal60(c) else '✗'}  {fmt(c.get('migration_sec'))}"
        for c in rows
    )
    links = "\n".join(
        f"  {c.get('name','?')} → <https://pump.fun/coin/{c['mint']}>"
        for c in rows if signal60(c)
    )
    return f"""**🟢 60 BURST** — {label}
*Unique buyers ≥60 + same-slot buys <5. Raw buy count inflatable by bots; unique wallets are not. 60 distinct wallets in one minute = real organic discovery.*

```
Coin               Unique  Slot  Pass  Migrated
────────────────────────────────────────────────
{table}
```
Signal fires: **{len(passing)}/{len(organic)}** organic migrators · {fp_line(all_coins, signal60, label)}

{links}"""

# ── main ────────────────────────────────────────────────────────────────────
def available_batches():
    return sorted(p.parent.name.replace("-findings", "") for p in ANALYSIS.glob("batch-*-findings/all-migrators.json"))

def main():
    args = sys.argv[1:]
    if not args or args[0] == "all":
        batch_ids = available_batches()
        label = "all batches"
    else:
        batch_ids = args
        label = " + ".join(batch_ids)

    organic, all_coins, has_full = load_batches(batch_ids)
    if not organic:
        print("No data found.")
        return

    print(f"{'─'*54}")
    print(f"BURST REPORT · {label}")
    print(f"{len(organic)} organic migrators" + (f" · full coin data available" if has_full else " · ⚠ no all-coins-bars.json yet (batch-004+ will have it)"))
    print(f"{'─'*54}")
    print()
    print(section_10(organic, all_coins, label))
    print()
    print(section_30(organic, all_coins, label))
    print()
    print(section_60(organic, all_coins, label))

if __name__ == "__main__":
    main()
