import { performance } from 'node:perf_hooks'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { extractFeatures } from '../../lib/analysis/filters/extract.js'
import { FILTERS, definition } from '../../lib/analysis/catalog/filters.js'
import { filterFeatures } from '../../lib/analysis/filters/evaluate.js'
import assert from 'node:assert/strict'
const output = resolve(process.argv[2])
await mkdir(output, { recursive: true })
const at = (n) => new Date(Date.parse('2026-01-01T00:00:00Z') + n).toISOString()
const launches = 1000,
  wallets = 60
const manifest = {
  run_id: 'run-concurrent',
  status: 'stopped',
  started_at: at(0),
  stops_at: at(60000),
  stopped_at: at(60000),
}
const raw = {
  name: 'raw/pumpapi-live.ndjson',
  lines: async function* () {
    for (let i = 0; i < launches; i++)
      yield JSON.stringify({
        source_at: at(0),
        received_at: at(0),
        payload_raw: JSON.stringify({ action: 'create', pool: 'pump', mint: 'M' + i }),
      })
    for (let s = 0; s < 60; s++)
      for (let i = 0; i < launches; i++)
        yield JSON.stringify({
          source_at: at(s * 1000),
          received_at: at(s * 1000),
          payload_raw: JSON.stringify({
            action: 'buy',
            mint: 'M' + i,
            signature: 'T' + s + '-' + i,
            txSigner: 'W' + s + '-' + i,
          }),
        })
  },
}
const start = performance.now()
const f = await extractFeatures(
  {
    schema: 'pump.collection-batch/1',
    batch_id: 'batch-concurrent',
    label: 'Synthetic 1000 concurrent launches',
    run_ids: [manifest.run_id],
  },
  [
    {
      runId: manifest.run_id,
      manifest,
      manifestText: JSON.stringify(manifest),
      raw: [raw],
      reliability: { name: 'normalized/reliability.ndjson', lines: async function* () {} },
      blob: async () => {
        throw Error('unexpected blob')
      },
    },
  ],
)
assert.equal(f.rows.length, launches)
for (const r of f.rows) {
  assert.equal(r.buy_count, 60)
  assert.equal(r.unique_buyers, wallets)
  assert.deepEqual(r.buy_bars, Array(60).fill(1))
  assert.deepEqual(r.arrival_buckets, Array(6).fill(10))
}
const counts = {}
for (const filter of FILTERS) {
  const c = filterFeatures(f, definition(filter.id))
  counts[filter.id] = c.summary.members
  assert.equal(c.summary.members, filter.id === 'repeat-buyer-concentration' ? 0 : 1000)
}
const report = {
  synthetic: true,
  simultaneously_active_launches: launches,
  unique_wallets: launches * wallets,
  raw_records: 61000,
  wall_seconds: (performance.now() - start) / 1000,
  peak_rss_bytes: process.resourceUsage().maxRSS * 1024,
  oracle: '60 buys and 60 distinct first buyers per coin; one per second; ten per bucket',
  cohort_counts: counts,
}
report.budgets_pass = report.peak_rss_bytes <= 1024 ** 3
await writeFile(join(output, 'concurrency.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report))
assert(report.budgets_pass)
