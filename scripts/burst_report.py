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
    avg_sustain = sum(c["sustain10"] for c in organic) / len(organic) if organic else 0
    return f"""**⚡ 10 BURST** — {label}
*Should I keep watching at 10 seconds?*
Watch if: **≥25 buys in first 10s + sustain ratio ≥ 0.3**
Sustain = buys in 5-10s ÷ buys in 0-5s. Bundles front-dump and crater (ratio <0.1). Organic stays flat or builds.

```
Catches:      {len(passing)}/{len(organic)} organic migrators
Avg sustain:  {avg_sustain:.2f} across organic coins
{fp_line(all_coins, signal10, label)}
```"""

def section_30(organic, all_coins, label):
    passing = [c for c in organic if signal30(c)]
    avg_sustain = sum(c["sustain30"] for c in organic) / len(organic) if organic else 0
    return f"""**⏱ 30 BURST** — {label}
*Still worth watching at 30 seconds?*
Watch if: **≥50 buys in first 30s + sustain ratio ≥ 0.4**
Sustain = buys in 15-30s ÷ buys in 0-15s. By 30s organic keeps pulling buyers in. Bundles have peaked and are fading.

```
Catches:      {len(passing)}/{len(organic)} organic migrators
Avg sustain:  {avg_sustain:.2f} across organic coins
{fp_line(all_coins, signal30, label)}
```"""

def section_60(organic, all_coins, label):
    passing = [c for c in organic if signal60(c)]
    avg_uniq = sum(c["uniq60"] for c in organic) / len(organic) if organic else 0
    return f"""**🟢 60 BURST** — {label}
*High confidence at 60 seconds — act on it.*
Watch if: **≥60 unique buyers in first 60s + same-slot buys <5**
Unique wallets can't be faked. 60 distinct buyers in one minute = real organic discovery across multiple communities.

```
Catches:      {len(passing)}/{len(organic)} organic migrators
Avg unique:   {avg_uniq:.0f} buyers across organic coins
{fp_line(all_coins, signal60, label)}
```"""

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
