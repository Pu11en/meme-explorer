#!/usr/bin/env python3
"""
Meme Explorer — local web dashboard on port 4200.
Generates pages on-demand from saved findings. No AI calls, no API cost.
"""
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from datetime import datetime, timezone

PORT      = 4200
REPO      = Path(__file__).parent.parent.resolve()
FINDINGS  = REPO / "analysis"

# ── helpers ────────────────────────────────────────────────────────────────
def classify(c):
    w60 = c.get("w60", {})
    if w60.get("same_slot_buys", 0) >= 5:  return "bundle"
    if w60.get("top_wallet_pct", 0) >= 40: return "bundle"
    if w60.get("unique_buyers", 0) <= 6 and c.get("sniper_ratio_60", 0) >= 80: return "controlled"
    return "organic"

def fmt_time(sec):
    if sec is None: return "—"
    return f"{sec//60}m {sec%60:02d}s"

def load_all_migrators():
    coins = []
    for p in sorted(FINDINGS.glob("batch-*-findings/all-migrators.json")):
        batch_id = p.parent.name.replace("-findings", "")
        with open(p) as f:
            batch_coins = json.load(f)
        for c in batch_coins:
            if c.get("migrated"):
                c["_batch"]   = batch_id
                c["_verdict"] = classify(c)
        coins.extend([c for c in batch_coins if c.get("migrated")])
    coins.sort(key=lambda c: c.get("migration_sec") or 9999)
    return coins

def load_summary():
    rows = []
    for p in sorted(FINDINGS.glob("batch-*-findings/findings.json")):
        batch_id = p.parent.name.replace("-findings", "")
        with open(p) as f:
            d = json.load(f)
        rows.append({
            "batch_id":    batch_id,
            "total_coins": d.get("total_coins", 0),
            "migrated":    d.get("migrated", 0),
        })
    return rows

# ── CSS / layout ───────────────────────────────────────────────────────────
NAV = """
<nav style="background:#0f172a;border-bottom:1px solid #1e293b;padding:0 24px;display:flex;gap:0;position:sticky;top:0;z-index:10">
  <a href="/" class="tab {organic}">🟢 Organic Migrators</a>
  <a href="/batches" class="tab {batches}">📦 Batches</a>
  <a href="/rules" class="tab {rules}">🔍 Detection Rules</a>
</nav>
"""

BASE_CSS = """
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
.tab{display:inline-block;padding:14px 20px;color:#64748b;text-decoration:none;font-size:13px;font-weight:500;border-bottom:2px solid transparent;transition:all .15s}
.tab:hover{color:#e2e8f0}
.tab.active{color:#f1f5f9;border-bottom-color:#60a5fa}
.page{padding:28px 28px;max-width:1100px;margin:0 auto}
h1{font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:4px}
.sub{color:#475569;font-size:13px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#1e293b;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding:10px 14px;text-align:left;position:sticky;top:49px}
td{padding:12px 14px;border-bottom:1px solid #1e293b22}
tr:hover td{background:#1e293b55}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
.organic{background:#14532d;color:#86efac}
.bundle{background:#450a0a;color:#fca5a5}
.controlled{background:#431407;color:#fdba74}
.btn{display:inline-block;background:#1d4ed8;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;transition:background .15s}
.btn:hover{background:#2563eb}
.stat{background:#1e293b;border-radius:8px;padding:18px 22px;display:inline-block;min-width:130px}
.stat .n{font-size:30px;font-weight:700}
.stat .l{font-size:12px;color:#64748b;margin-top:3px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
.empty{color:#475569;text-align:center;padding:48px;font-size:14px}
</style>
"""

def shell(title, body, active_tab):
    nav = NAV.format(
        organic="active" if active_tab == "organic" else "",
        batches="active" if active_tab == "batches" else "",
        rules  ="active" if active_tab == "rules"   else "",
    )
    return f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — Meme Explorer</title>{BASE_CSS}
</head><body>{nav}<div class="page">{body}</div></body></html>"""

# ── Pages ──────────────────────────────────────────────────────────────────
def page_organic():
    coins = load_all_migrators()
    organic = [c for c in coins if c["_verdict"] == "organic"]
    filtered = [c for c in coins if c["_verdict"] != "organic"]

    def row(c):
        w60  = c.get("w60", {})
        mint = c["mint"]
        name = c.get("name") or "?"
        sym  = c.get("symbol") or "?"
        v    = c["_verdict"]
        return f"""<tr>
          <td style="font-weight:600">{name} <span style="color:#475569;font-weight:400">({sym})</span></td>
          <td style="font-family:monospace;color:#475569;font-size:11px">{mint[:16]}…</td>
          <td><span style="color:#a3e635;font-weight:700">{fmt_time(c.get('migration_sec'))}</span></td>
          <td style="text-align:right">{w60.get('buy_count',0)}</td>
          <td style="text-align:right">{w60.get('unique_buyers',0)}</td>
          <td style="text-align:right">{w60.get('total_sol',0):.1f}</td>
          <td style="text-align:center">{w60.get('same_slot_buys',0)}</td>
          <td style="color:#475569;font-size:12px">{c.get('_batch','')}</td>
          <td><a href="https://pump.fun/coin/{mint}" target="_blank" class="btn">pump.fun ↗</a></td>
        </tr>"""

    stats = f"""<div class="stats">
      <div class="stat"><div class="n" style="color:#22c55e">{len(organic)}</div><div class="l">Organic Migrators</div></div>
      <div class="stat"><div class="n" style="color:#ef4444">{len(filtered)}</div><div class="l">Filtered (Bundle/Ctrl)</div></div>
      <div class="stat"><div class="n" style="color:#60a5fa">{len(coins)}</div><div class="l">Total Migrators</div></div>
    </div>"""

    if not organic:
        return shell("Organic Migrators", stats + '<div class="empty">No organic migrators yet — pipeline is collecting data.</div>', "organic")

    thead = """<tr><th>Coin</th><th>Mint</th><th>Migrated In</th><th style="text-align:right">1m Buys</th>
      <th style="text-align:right">1m Unique</th><th style="text-align:right">1m SOL</th>
      <th style="text-align:center">Same-Slot</th><th>Batch</th><th></th></tr>"""

    body = f"""
    <h1>🟢 Organic Migrators</h1>
    <div class="sub">Passed all fraud filters · sorted by migration speed · {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</div>
    {stats}
    <table>
      <thead>{thead}</thead>
      <tbody>{"".join(row(c) for c in organic)}</tbody>
    </table>
    <div style="margin-top:32px;border-top:1px solid #1e293b;padding-top:20px">
      <h2 style="font-size:15px;color:#475569;margin-bottom:12px">🚫 Filtered Out ({len(filtered)} bundles / controlled)</h2>
      <table>
        <thead>{thead}</thead>
        <tbody>{"".join(row(c) for c in filtered)}</tbody>
      </table>
    </div>"""

    return shell("Organic Migrators", body, "organic")

def page_batches():
    rows = load_summary()
    if not rows:
        body = '<h1>📦 Batches</h1><div class="empty">No batches yet.</div>'
        return shell("Batches", body, "batches")

    total_coins = sum(r["total_coins"] for r in rows)
    total_mig   = sum(r["migrated"] for r in rows)

    trows = "".join(f"""<tr>
      <td style="font-weight:600">{r['batch_id']}</td>
      <td style="text-align:right">{r['total_coins']:,}</td>
      <td style="text-align:right">{r['migrated']}</td>
      <td style="text-align:right">{r['migrated']/r['total_coins']*100:.1f}%</td>
    </tr>""" for r in rows)

    body = f"""
    <h1>📦 Batches</h1>
    <div class="sub">{len(rows)} batches recorded so far</div>
    <div class="stats">
      <div class="stat"><div class="n" style="color:#60a5fa">{total_coins:,}</div><div class="l">Total Coins</div></div>
      <div class="stat"><div class="n" style="color:#a78bfa">{total_mig}</div><div class="l">Total Migrated</div></div>
      <div class="stat"><div class="n" style="color:#f59e0b">{total_mig/total_coins*100:.1f}%</div><div class="l">Avg Migration Rate</div></div>
    </div>
    <table>
      <thead><tr><th>Batch</th><th style="text-align:right">Launches</th><th style="text-align:right">Migrated</th><th style="text-align:right">Rate</th></tr></thead>
      <tbody>{trows}</tbody>
    </table>"""
    return shell("Batches", body, "batches")

def page_rules():
    body = """
    <h1>🔍 Detection Rules</h1>
    <div class="sub">How the pipeline decides what's organic vs noise</div>
    <div style="display:flex;flex-direction:column;gap:14px;margin-top:8px">

    <div style="background:#1e293b;border-left:3px solid #ef4444;padding:16px 20px;border-radius:0 8px 8px 0">
      <div style="font-weight:700;color:#fca5a5;margin-bottom:6px">DISTRIBUTED BUNDLE — same_slot_buys ≥ 5</div>
      <div style="color:#94a3b8;font-size:13px;line-height:1.6">Multiple wallets all bought in the exact same block as the coin was created. The dev pre-coordinated a pack of wallets to launch together and inflate early metrics. DoubleZebra had 20 same-slot buys. Second Ziggy had 23. Dead giveaway.</div>
    </div>

    <div style="background:#1e293b;border-left:3px solid #f97316;padding:16px 20px;border-radius:0 8px 8px 0">
      <div style="font-weight:700;color:#fdba74;margin-bottom:6px">SINGLE-WALLET BUNDLE — top_wallet_pct ≥ 40%</div>
      <div style="color:#94a3b8;font-size:13px;line-height:1.6">One wallet holds 40%+ of the first-minute SOL volume. Classic bundle with fewer coordinated wallets.</div>
    </div>

    <div style="background:#1e293b;border-left:3px solid #eab308;padding:16px 20px;border-radius:0 8px 8px 0">
      <div style="font-weight:700;color:#fde047;margin-bottom:6px">CONTROLLED — unique_buyers ≤ 6 AND sniper_ratio ≥ 80%</div>
      <div style="color:#94a3b8;font-size:13px;line-height:1.6">A tiny cabal of known bot wallets controls the majority of buys. Real organic buyers haven't shown up yet.</div>
    </div>

    <div style="background:#1e293b;border-left:3px solid #22c55e;padding:16px 20px;border-radius:0 8px 8px 0">
      <div style="font-weight:700;color:#86efac;margin-bottom:6px">✅ ORGANIC — passes all filters</div>
      <div style="color:#94a3b8;font-size:13px;line-height:1.6">Real buyers. No same-slot coordination. No single wallet dominating. Unique buyer count is broad and genuine.</div>
    </div>

    <div style="background:#1e293b;padding:16px 20px;border-radius:8px;margin-top:8px">
      <div style="font-weight:600;color:#f1f5f9;margin-bottom:8px">Real-time trigger rule</div>
      <div style="font-family:monospace;background:#0f172a;padding:12px 16px;border-radius:6px;color:#a3e635;font-size:13px">≥ 50 unique buyers in first 60 seconds + same_slot_buys &lt; 5</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:8px">→ 33% chance of migration. Fires ~12 times per hour.</div>
    </div>

    <div style="background:#1e293b;padding:16px 20px;border-radius:8px">
      <div style="font-weight:600;color:#f1f5f9;margin-bottom:8px">Note on snipers</div>
      <div style="color:#94a3b8;font-size:13px;line-height:1.6">High sniper ratio alone is NOT filtered. 33 of 34 migrators per hour had known sniper wallets pile in — snipers chase winners, they don't cause them. Sniper presence = more eyes on a coin, not a red flag.</div>
    </div>
    </div>"""
    return shell("Detection Rules", body, "rules")

# ── Server ──────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/":
            html = page_organic()
        elif path == "/batches":
            html = page_batches()
        elif path == "/rules":
            html = page_rules()
        else:
            self.send_response(404); self.end_headers()
            self.wfile.write(b"Not found"); return

        body = html.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silence access logs

if __name__ == "__main__":
    print(f"Meme Explorer dashboard → http://localhost:{PORT}")
    HTTPServer(("", PORT), Handler).serve_forever()
