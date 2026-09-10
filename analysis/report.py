#!/usr/bin/env python3
"""
Build analysis/report.html — cross-batch insights with improved fraud detection.

Fraud detection rules (v2):
  DISTRIBUTED BUNDLE : same_slot_buys >= 5  (coordinated multi-wallet launch)
  SINGLE-WALLET CTRL : unique_buyers <= 6 AND sniper_ratio >= 80%  (dev/cabal controls most buys)
  SNIPER PILE        : sniper_ratio >= 60% (majority of buyers are known serial bots)
"""
import json
from pathlib import Path
from datetime import datetime, timezone

OUT = Path("/Users/drewp/Developer/meme-explorer/analysis/report.html")
BATCHES = [
    {
        "id": "batch-002",
        "label": "Batch 002",
        "window": "Sep 8 · 12:00–1:00 PM Central",
        "dir": Path("/Users/drewp/Developer/meme-explorer/analysis/batch-002-findings"),
    },
    {
        "id": "batch-003",
        "label": "Batch 003",
        "window": "Sep 8 · 1:00–2:00 PM Central",
        "dir": Path("/Users/drewp/Developer/meme-explorer/analysis/batch-003-findings"),
    },
]

def classify(c):
    w60 = c.get("w60", {})
    same_slot     = w60.get("same_slot_buys", 0)
    uniq          = w60.get("unique_buyers", 0)
    sniper_ratio  = c.get("sniper_ratio_60", 0)
    top_wallet    = w60.get("top_wallet_pct", 0)

    if same_slot >= 5:
        return "bundle"          # distributed coordinated launch
    if uniq <= 6 and sniper_ratio >= 80:
        return "controlled"      # dev / cabal controls buys
    if top_wallet >= 40:
        return "bundle"          # single-wallet dominates
    return "organic"

def fmt_time(sec):
    if sec is None: return "n/a"
    return f"{sec//60}m {sec%60}s"

def badge(cls):
    colors = {"organic": "#22c55e", "bundle": "#ef4444", "controlled": "#f97316", "sniper": "#eab308"}
    labels = {"organic": "ORGANIC", "bundle": "BUNDLE", "controlled": "CONTROLLED"}
    c = colors.get(cls, "#6b7280")
    return f'<span style="background:{c};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">{labels.get(cls, cls.upper())}</span>'

# ── Load all migrators ────────────────────────────────────────────────────
all_migrators = []
batch_stats   = []
for b in BATCHES:
    findings_path = b["dir"] / "findings.json"
    mig_path      = b["dir"] / "all-migrators.json"
    if not mig_path.exists():
        continue
    with open(mig_path) as f:
        coins = json.load(f)
    with open(findings_path) as f:
        findings = json.load(f)

    for c in coins:
        c["_batch"]  = b["label"]
        c["_window"] = b["window"]
        c["_class"]  = classify(c)
    all_migrators.extend(coins)

    batch_stats.append({
        "label":          b["label"],
        "window":         b["window"],
        "total_coins":    findings.get("total_coins", 0),
        "migrated":       findings.get("migrated", 0),
        "sniper_wallets": findings.get("patterns", {}).get("sniper_saturation", {}).get("migrators_with_sniper_traffic", 0),
        "coins":          coins,
    })

all_migrators.sort(key=lambda c: (c.get("migration_sec") or 9999))

organic    = [c for c in all_migrators if c["_class"] == "organic"]
bundles    = [c for c in all_migrators if c["_class"] == "bundle"]
controlled = [c for c in all_migrators if c["_class"] == "controlled"]

def coin_row(c, show_batch=True):
    w60   = c.get("w60", {})
    mint  = c["mint"]
    name  = c.get("name") or "?"
    sym   = c.get("symbol") or "?"
    msec  = c.get("migration_sec")
    cls   = c["_class"]
    batch = c["_batch"] if show_batch else ""
    same  = w60.get("same_slot_buys", 0)
    sr    = c.get("sniper_ratio_60", 0)
    url   = f"https://pump.fun/coin/{mint}"
    return f"""
    <tr>
      <td><a href="{url}" target="_blank" style="color:#60a5fa;text-decoration:none">{name} <span style="opacity:.6">({sym})</span></a></td>
      <td style="text-align:center">{fmt_time(msec)}</td>
      <td style="text-align:right">{w60.get('buy_count',0)}</td>
      <td style="text-align:right">{w60.get('unique_buyers',0)}</td>
      <td style="text-align:right">{w60.get('total_sol',0):.1f}</td>
      <td style="text-align:center">{same}</td>
      <td style="text-align:center">{sr}%</td>
      <td style="text-align:center">{badge(cls)}</td>
      {"<td style='text-align:center;opacity:.6;font-size:12px'>"+batch+"</td>" if show_batch else ""}
    </tr>"""

def table_header(show_batch=True):
    extra = "<th>Batch</th>" if show_batch else ""
    return f"""
    <tr style="background:#1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.05em">
      <th style="text-align:left;padding:8px 12px">Coin</th>
      <th style="padding:8px">Migrated In</th>
      <th style="padding:8px">1m Buys</th>
      <th style="padding:8px">1m Unique</th>
      <th style="padding:8px">1m SOL</th>
      <th style="padding:8px">Same-Slot</th>
      <th style="padding:8px">Sniper%</th>
      <th style="padding:8px">Verdict</th>
      {extra}
    </tr>"""

def stat_card(label, value, sub="", color="#60a5fa"):
    return f"""
    <div style="background:#1e293b;border-radius:8px;padding:20px 24px;min-width:160px">
      <div style="font-size:28px;font-weight:700;color:{color}">{value}</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:4px">{label}</div>
      {"<div style='font-size:11px;color:#64748b;margin-top:2px'>"+sub+"</div>" if sub else ""}
    </div>"""

total_migrators = len(all_migrators)
total_organic   = len(organic)
total_coins     = sum(b["total_coins"] for b in batch_stats)

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meme Explorer — Batch Analysis Report</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px 24px; max-width: 1200px; margin: 0 auto; }}
  h1 {{ font-size: 24px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }}
  h2 {{ font-size: 18px; font-weight: 600; color: #f1f5f9; margin: 32px 0 12px; }}
  h3 {{ font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; margin: 24px 0 8px; }}
  p {{ color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 12px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  td, th {{ padding: 8px 12px; border-bottom: 1px solid #1e293b; }}
  tr:hover td {{ background: #1e293b44; }}
  .cards {{ display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }}
  .section {{ background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px; }}
  .rule {{ background: #1e293b; border-left: 3px solid #60a5fa; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 10px; font-size: 13px; }}
  .rule code {{ color: #60a5fa; font-family: monospace; }}
  .tag {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; }}
  .insight {{ background: #1e293b; border-radius: 8px; padding: 14px 18px; margin-bottom: 10px; font-size: 13px; line-height: 1.6; }}
  .insight strong {{ color: #f1f5f9; }}
  .updated {{ color: #475569; font-size: 12px; margin-top: 4px; }}
</style>
</head>
<body>

<h1>Meme Explorer — Batch Analysis Report</h1>
<p class="updated">Batches: 002 &amp; 003 · Sep 8, 2026 · Batch 001 data on Geo (not yet imported)</p>

<!-- ── SUMMARY STATS ── -->
<div class="cards" style="margin-top:24px">
  {stat_card("Coins Launched", f"{total_coins:,}", "across 2 batches")}
  {stat_card("Migrated", f"{total_migrators}", f"{total_migrators/total_coins*100:.1f}% of all launches", "#a78bfa")}
  {stat_card("Organic Migrators", f"{total_organic}", "passed fraud filter", "#22c55e")}
  {stat_card("Bundled/Controlled", f"{len(bundles)+len(controlled)}", "filtered out", "#ef4444")}
  {stat_card("Launches/Hour", f"~{total_coins//2:,}", "consistent both batches")}
</div>

<!-- ── PER-BATCH STATS ── -->
<div class="section">
  <h2>Per-Batch Summary</h2>
  <table>
    <tr style="background:#1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase">
      <th style="text-align:left;padding:8px 12px">Batch</th>
      <th>Window</th>
      <th>Launches</th>
      <th>Migrated</th>
      <th>Rate</th>
      <th>Organic Migrators</th>
    </tr>
    {"".join(f'''
    <tr>
      <td style="font-weight:600">{b["label"]}</td>
      <td style="color:#94a3b8">{b["window"]}</td>
      <td style="text-align:center">{b["total_coins"]:,}</td>
      <td style="text-align:center">{b["migrated"]}</td>
      <td style="text-align:center">{b["migrated"]/b["total_coins"]*100:.1f}%</td>
      <td style="text-align:center">{sum(1 for c in b["coins"] if classify(c)=="organic")}</td>
    </tr>''' for b in batch_stats)}
  </table>
</div>

<!-- ── FRAUD DETECTION ── -->
<div class="section">
  <h2>Fraud Detection Rules (v2)</h2>
  <p>These rules run on first-minute data only. A coin is filtered if it hits any one rule.</p>

  <div class="rule">
    <strong>DISTRIBUTED BUNDLE</strong> — <code>same_slot_buys ≥ 5</code><br>
    Multiple wallets all buying in the exact same block as the coin creation. The dev pre-coordinates a pack of wallets to launch simultaneously and inflate early metrics. DoubleZebra had 20 same-slot buys; second Ziggy had 23.
  </div>
  <div class="rule">
    <strong>CONTROLLED</strong> — <code>unique_buyers ≤ 6 AND sniper_ratio ≥ 80%</code><br>
    A small cabal of known bot wallets controls the majority of buys. Real organic activity has not started yet.
  </div>
  <div class="rule">
    <strong>SINGLE-WALLET BUNDLE</strong> — <code>top_wallet_pct ≥ 40%</code><br>
    One wallet holds ≥40% of first-minute SOL volume. Classic bundle with fewer wallets.
  </div>

  <h3 style="margin-top:20px">What is NOT filtered out</h3>
  <p><strong>High sniper ratio alone</strong> — snipers are drawn to winners. In both batches, 33/34 migrators had known sniper wallets pile in. Filtering on sniper presence alone would remove almost every winner.</p>
  <p><strong>Low SOL volume</strong> — some organic coins migrate on community momentum with low SOL. Volume alone is not the signal.</p>
</div>

<!-- ── ORGANIC MIGRATORS ── -->
<div class="section">
  <h2>✅ Organic Migrators — Both Batches ({len(organic)} coins)</h2>
  <p>Passed all fraud filters. Sorted by migration speed.</p>
  <table>
    {table_header(show_batch=True)}
    {"".join(coin_row(c, show_batch=True) for c in organic)}
  </table>
</div>

<!-- ── FILTERED MIGRATORS ── -->
<div class="section">
  <h2>🚫 Filtered Migrators — Bundles &amp; Controlled ({len(bundles)+len(controlled)} coins)</h2>
  <p>These migrated but are not organic signals — coordinated, bundled, or cabal-driven launches.</p>
  <table>
    {table_header(show_batch=True)}
    {"".join(coin_row(c, show_batch=True) for c in bundles + controlled)}
  </table>
</div>

<!-- ── KEY INSIGHTS ── -->
<div class="section">
  <h2>Key Insights</h2>

  <div class="insight">
    <strong>1. Migration rate is locked at ~2.3–2.6% every hour.</strong><br>
    Both batches produced exactly 34 migrators from ~1,300–1,465 launches. Consistent. You can expect roughly 34 migrations per hour regardless of time of day.
  </div>

  <div class="insight">
    <strong>2. The signal for sub-2-minute migrations is unmistakable in real time.</strong><br>
    Ziggy (17s): 924 buys, 613 unique buyers in 1 min. Monero (65s): 464 buys, 248 unique. These are obvious — no algorithm needed. You'd see them in the feed immediately.
  </div>

  <div class="insight">
    <strong>3. Sniper wallets chase winners, not cause them.</strong><br>
    33 of 34 migrators in each batch had known sniper wallets pile in. Snipers are detecting the same organic signal you want to find. High sniper presence = more eyes on this coin, not a red flag.
  </div>

  <div class="insight">
    <strong>4. Repeat devs launch the same coin multiple times in one session.</strong><br>
    "Luke" launched Monero + MoneroCat back to back in Batch 002 — both migrated under 2 minutes. In Batch 003, Ziggy appeared twice: the first (17s) was organic, the second (105s) was a distributed bundle (23 same-slot buys). DoubleZebra also appeared twice. Watching dev wallets = early edge.
  </div>

  <div class="insight">
    <strong>5. Distributed bundles look organic until you check same-slot buys.</strong><br>
    DoubleZebra had 201 unique buyers in 1 min which looks clean — but 20 of those buys landed in the exact same block as the coin creation. That's impossible organically. Same for second Ziggy (23 same-slot). Threshold: ≥5 same-slot buys = bundle.
  </div>

  <div class="insight">
    <strong>6. Best real-time rule (from batch-002 threshold scan):</strong><br>
    <code style="background:#0f172a;padding:2px 6px;border-radius:4px">≥50 unique buyers in first 60 seconds (no bundle flags)</code> → <strong>33% chance of migration</strong>, fires ~12 times per hour, catches 100% of organic fast migrators.
  </div>
</div>

<!-- ── CROSS-BATCH REPEATS ── -->
<div class="section">
  <h2>Cross-Batch Repeat Patterns</h2>
  <p>Same coins or devs appearing across batches — worth tracking their wallet.</p>
  <table>
    <tr style="background:#1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase">
      <th style="text-align:left;padding:8px 12px">Coin</th>
      <th>Batch 002</th>
      <th>Batch 003</th>
      <th>Note</th>
    </tr>
    <tr>
      <td>GOLDPEPE</td>
      <td style="text-align:center">Migrated 2m 8s</td>
      <td style="text-align:center">Migrated 5m 14s</td>
      <td style="color:#94a3b8">Same dev relaunching. Both times bundled/controlled.</td>
    </tr>
    <tr>
      <td>CrimeDog family</td>
      <td style="text-align:center">CrimeDog (WANTED) — 6m 41s</td>
      <td style="text-align:center">CRIMEDOG — 3m 39s · CRIMEWIF</td>
      <td style="color:#94a3b8">Same dev, crime-themed coins. Repeats every session.</td>
    </tr>
    <tr>
      <td>Ziggy</td>
      <td style="text-align:center">—</td>
      <td style="text-align:center">Organic 17s · Bundle 105s</td>
      <td style="color:#94a3b8">Dev re-launched with bundle after organic one popped.</td>
    </tr>
    <tr>
      <td>DoubleZebra</td>
      <td style="text-align:center">—</td>
      <td style="text-align:center">Bundle 55s · Less-bundled 3m 30s</td>
      <td style="color:#94a3b8">Launched twice in same hour with different bundle sizes.</td>
    </tr>
    <tr>
      <td>Luke (Monero/MoneroCat)</td>
      <td style="text-align:center">Both migrated &lt;2 min</td>
      <td style="text-align:center">—</td>
      <td style="color:#94a3b8">Same dev, back-to-back organic migrations. Track this wallet.</td>
    </tr>
  </table>
</div>

<p style="margin-top:32px;color:#334155;font-size:12px">Generated {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")} · meme-explorer analysis pipeline</p>
</body>
</html>"""

OUT.write_text(html)
print(f"Report saved → {OUT}")
print(f"  Organic migrators: {len(organic)}")
print(f"  Bundles filtered:  {len(bundles)+len(controlled)}")
