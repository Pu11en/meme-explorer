import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import type { TenSecondBuyActivityResult, TenSecondBuyActivityRow } from './types.js'

const execFileAsync = promisify(execFile)

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function cleanLabel(value: string): string {
  return value.replaceAll('—', '-').replaceAll('–', '-')
}

function percent(value: string | null): string {
  return value === null ? 'N/A' : `${(Number(value) * 100).toFixed(1)}%`
}

function activityBars(row: TenSecondBuyActivityRow): string {
  const values = row.one_second_bars?.map(bar => bar.buy_count) ?? []
  const maximum = Math.max(1, ...values)
  return `<div class="spark" aria-label="Buys by second: ${values.join(', ')}">${values.map((value, second) =>
    `<i style="height:${Math.max(3, Math.round(value / maximum * 100))}%" title="Second ${second}: ${value}"></i>`,
  ).join('')}</div>`
}

function rankingRows(rows: readonly TenSecondBuyActivityRow[]): string {
  return rows.map(row => `<div class="rank-row">
    <div class="rank">${row.rank}</div>
    <div class="coin"><strong>${escapeHtml(row.name ?? 'Unnamed')}</strong><span>${escapeHtml(row.symbol ?? 'NO SYMBOL')}</span></div>
    <div class="metric"><strong>${row.buy_count}</strong><span>buys</span></div>
    <div class="metric"><strong>${row.unique_buyers}</strong><span>buyers</span></div>
    <div class="metric"><strong>${percent(row.repeat_buy_ratio)}</strong><span>repeat</span></div>
    ${activityBars(row)}
  </div>`).join('')
}

export function buildTenSecondVisualReport(result: TenSecondBuyActivityResult): string {
  const observable = result.rows.filter(row => row.observation_status === 'complete')
  const top = observable.slice(0, 20)
  const topTen = top.slice(0, 10)
  const leader = top[0]
  const focus = top.find(row => row.symbol?.toUpperCase() === 'RIZO') ?? leader
  const maxBuys = Math.max(1, ...topTen.map(row => row.buy_count ?? 0))
  const date = new Date(result.generated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' })
  const focusBars = focus?.one_second_bars?.map(bar => bar.buy_count).join(' / ') ?? 'N/A'
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>10-Second Buy Activity</title>
<style>
  :root{color-scheme:dark;--bg:#0b0d0f;--panel:#12161a;--line:#2a3137;--muted:#8b969f;--ink:#f3f6f7;--accent:#b8ff3d}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:Arial,Helvetica,sans-serif;font-variant-numeric:tabular-nums}
  .page{width:min(1500px,100%);margin:auto;padding:54px 58px 50px;min-height:100vh}.page+.page{page-break-before:always}
  header{display:grid;grid-template-columns:1fr auto;gap:30px;align-items:start;border-top:8px solid var(--accent);padding-top:28px}
  .kicker{color:var(--accent);font:700 13px/1.2 ui-monospace,monospace;letter-spacing:.13em;text-transform:uppercase}
  h1{font-size:62px;line-height:.94;letter-spacing:-.055em;margin:10px 0 18px;max-width:850px}.subtitle{color:var(--muted);font-size:17px;line-height:1.55;max-width:760px;margin:0}
  .stamp{text-align:right;color:var(--muted);font:12px/1.6 ui-monospace,monospace}.stamp b{display:block;color:var(--ink);font-size:14px}
  .stats{display:grid;grid-template-columns:repeat(5,1fr);border-block:1px solid var(--line);margin:42px 0 34px}.stat{padding:20px 18px 20px 0}.stat+.stat{border-left:1px solid var(--line);padding-left:18px}.stat strong{display:block;font-size:29px;letter-spacing:-.04em}.stat span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}
  .overview{display:grid;grid-template-columns:1.45fr .75fr;gap:38px}.section-label{font:700 12px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:18px}
  .bar-row{display:grid;grid-template-columns:28px 190px 1fr 48px;align-items:center;gap:12px;margin:9px 0;font-size:13px}.bar-row .n{color:var(--muted);font-family:ui-monospace,monospace}.bar-row .name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.track{height:18px;background:#1b2126;position:relative}.fill{height:100%;background:var(--accent)}.bar-row strong{text-align:right;font-size:14px}
  .focus{background:var(--panel);border:1px solid var(--line);padding:28px;align-self:start}.focus .position{color:var(--accent);font:700 13px ui-monospace,monospace}.focus h2{font-size:31px;line-height:1.04;letter-spacing:-.04em;margin:12px 0 6px}.focus .mint{font:10px/1.5 ui-monospace,monospace;color:var(--muted);overflow-wrap:anywhere}.focus-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;border-top:1px solid var(--line);margin-top:24px;padding-top:22px}.focus-grid strong{display:block;font-size:25px}.focus-grid span{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.07em}.sequence{margin-top:22px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font:11px/1.6 ui-monospace,monospace}.sequence b{color:var(--ink)}
  .page-two header{border-top-width:4px;display:flex;justify-content:space-between}.page-two h2{font-size:42px;letter-spacing:-.04em;margin:8px 0 3px}.legend{color:var(--muted);font-size:12px;align-self:end}.rank-list{margin-top:28px;border-top:1px solid var(--line)}
  .rank-row{display:grid;grid-template-columns:42px minmax(210px,1.4fr) 76px 76px 76px minmax(140px,.8fr);align-items:center;gap:15px;min-height:64px;border-bottom:1px solid var(--line)}.rank{font:700 15px ui-monospace,monospace;color:var(--accent)}.coin strong{display:block;font-size:14px}.coin span,.metric span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.07em;margin-top:3px}.metric strong{font-size:15px}.spark{height:35px;display:flex;gap:3px;align-items:end}.spark i{display:block;flex:1;background:var(--accent);min-width:3px}
  footer{display:flex;justify-content:space-between;color:var(--muted);font:10px/1.5 ui-monospace,monospace;margin-top:24px}.note{max-width:760px}
  @media screen and (max-width:850px){.page{padding:30px 22px}h1{font-size:44px}.stats{grid-template-columns:1fr 1fr}.stat{border-bottom:1px solid var(--line)}.overview{grid-template-columns:1fr}.stamp{display:none}.rank-row{grid-template-columns:32px 1fr 52px 52px}.rank-row>.metric:nth-of-type(4),.spark{display:none}}
  @media print{@page{size:A4 landscape;margin:0}.page{width:297mm;height:209mm;min-height:0;padding:7mm 13mm;overflow:hidden;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page+.page{page-break-before:auto}.page:last-child{break-after:auto;page-break-after:auto}h1{font-size:38px;margin:7px 0 10px}.subtitle{font-size:13px}.stats{margin:16px 0 18px}.stat{padding-top:12px;padding-bottom:12px}.stat strong{font-size:20px}.bar-row{margin:5px 0}.focus{padding:18px}.focus h2{font-size:24px}.focus-grid{gap:12px;margin-top:14px;padding-top:13px}.focus-grid strong{font-size:19px}.sequence{margin-top:12px;padding-top:10px}footer{margin-top:12px}.page-two h2{font-size:28px}.rank-list{margin-top:12px}.rank-row{min-height:5mm}.page-two .spark{height:26px}.page-two footer{margin-top:6px}}
</style></head><body>
<main class="page">
  <header><div><div class="kicker">Pump.fun launch analysis</div><h1>First 10 seconds,<br>ranked.</h1><p class="subtitle">A coin-relative view of immediate buy activity across ${result.batch.run_ids.length} recorded runs. The window includes creation through 9.999 seconds.</p></div><div class="stamp"><b>${escapeHtml(cleanLabel(result.batch.label))}</b>${escapeHtml(date)}<br>${escapeHtml(result.result_id)}</div></header>
  <section class="stats"><div class="stat"><strong>${result.input.raw_records_scanned.toLocaleString('en-US')}</strong><span>records scanned</span></div><div class="stat"><strong>${result.summary.coin_observations}</strong><span>Pump.fun launches</span></div><div class="stat"><strong>${result.summary.observable}</strong><span>complete windows</span></div><div class="stat"><strong>${result.summary.unobservable}</strong><span>unobservable</span></div><div class="stat"><strong>${result.summary.zero_buy_observations}</strong><span>complete zeroes</span></div></section>
  <section class="overview"><div><div class="section-label">Top 10 by buy count</div>${topTen.map(row => `<div class="bar-row"><span class="n">${row.rank}</span><span class="name">${escapeHtml(row.name ?? row.symbol ?? row.mint)}</span><span class="track"><span class="fill" style="width:${Math.round((row.buy_count ?? 0) / maxBuys * 100)}%;display:block"></span></span><strong>${row.buy_count}</strong></div>`).join('')}</div>
  ${focus === undefined ? '' : `<aside class="focus"><div class="position">RANK ${focus.rank}</div><h2>${escapeHtml(focus.name ?? 'Focus coin')}</h2><div class="mint">${escapeHtml(focus.mint)}</div><div class="focus-grid"><div><strong>${focus.buy_count}</strong><span>buys</span></div><div><strong>${focus.unique_buyers}</strong><span>unique buyers</span></div><div><strong>${percent(focus.repeat_buy_ratio)}</strong><span>repeat buys</span></div><div><strong>${escapeHtml(focus.buy_quote_raw ?? focus.buy_quote_known_raw)}</strong><span>buy volume</span></div></div><div class="sequence"><b>SECOND 0 TO 9</b><br>${focusBars}</div></aside>`}</section>
  <footer><span class="note">Ranking: buys, then unique buyers, then exact quote volume. Incomplete windows never become zero-buy observations.</span><span>METRIC 01 / 10-SECOND BUY ACTIVITY</span></footer>
</main>
<main class="page page-two"><header><div><div class="kicker">Ranked cohort preview</div><h2>Top 20 launches</h2></div><div class="legend">Each strip shows buy distribution across seconds 0 to 9</div></header><section class="rank-list">${rankingRows(top)}</section><footer><span>Full structured rows remain available to downstream analysis skills.</span><span>${result.summary.observable} COMPLETE OBSERVATIONS</span></footer></main>
</body></html>`
}

async function chromiumExecutable(): Promise<string> {
  const candidates = [process.env.CHROMIUM_PATH, '/snap/bin/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter((value): value is string => Boolean(value))
  for (const candidate of candidates) {
    try { await access(candidate); return candidate } catch { /* try the next installed browser */ }
  }
  throw new Error('Chromium is required to render the visual PDF and preview image')
}

export async function renderVisualReport(htmlPath: string, pdfPath: string, imagePath: string): Promise<void> {
  const chromium = await chromiumExecutable()
  const url = pathToFileURL(htmlPath).href
  const common = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars']
  await execFileAsync(chromium, [...common, `--print-to-pdf=${pdfPath}`, '--print-to-pdf-no-header', url], { maxBuffer: 1024 * 1024 })
  await execFileAsync(chromium, [...common, `--screenshot=${imagePath}`, '--window-size=1600,1200', url], { maxBuffer: 1024 * 1024 })
}
