import { performance } from 'node:perf_hooks'
import { mkdir, readFile, statfs, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { cpus, totalmem } from 'node:os'
import { execFileSync } from 'node:child_process'
import { extractFeatures, fileInputs } from '../../lib/analysis/filters/extract.js'
import { definition, FILTERS } from '../../lib/analysis/catalog/filters.js'
import { filterFeatures } from '../../lib/analysis/filters/evaluate.js'
import { saveArtifact, boundedReceipt, reserve } from '../../lib/analysis/filters/artifacts.js'
const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => (i % 2 === 0 ? [...a, [v.slice(2), all[i + 1]]] : a), []),
)
const out = resolve(args.output)
await mkdir(out, { recursive: true })
await reserve(out)
const factor = Number(args.factor ?? 1)
if (![1, 2, 4].includes(factor)) throw Error('factor must be 1, 2 or 4')
const original = JSON.parse(await readFile(args.batch, 'utf8'))
const base = await fileInputs(args['data-root'], original)
const inputs = []
const shifted = (v, delta) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v) + delta).toISOString() : v
function renamePayload(p, suffix) {
  if (p === null || typeof p !== 'object') return p
  if (Array.isArray(p)) return p.map((v) => renamePayload(v, suffix))
  const result = { ...p }
  for (const [k, v] of Object.entries(result)) {
    if (
      [
        'mint',
        'tokenAddress',
        'token_address',
        'signature',
        'txSignature',
        'transactionSignature',
        'txSigner',
        'trader',
        'signer',
        'user',
      ].includes(k) &&
      typeof v === 'string'
    )
      result[k] = v + suffix
    else if (Array.isArray(v)) result[k] = v.map((x) => renamePayload(x, suffix))
  }
  return result
}
for (let replica = 0; replica < factor; replica++)
  for (const input of base) {
    if (factor === 1) {
      inputs.push(input)
      continue
    }
    const suffix = '-load' + replica
    const delta = replica * 3600000
    const id = input.runId + suffix
    const manifest = {
      ...input.manifest,
      run_id: id,
      started_at: shifted(input.manifest.started_at, delta),
      stopped_at: shifted(input.manifest.stopped_at, delta),
      stops_at: shifted(input.manifest.stops_at, delta),
    }
    const transform = (file, raw) => ({
      name: file.name,
      lines: async function* () {
        for await (const line of file.lines()) {
          if (!line.trim()) {
            yield line
            continue
          }
          const r = JSON.parse(line)
          r.run_id = id
          for (const k of ['source_at', 'received_at']) r[k] = shifted(r[k], delta)
          if (raw) {
            if (r.event_id) r.event_id += suffix
            if (r.payload_raw) {
              try {
                r.payload_raw = JSON.stringify(renamePayload(JSON.parse(r.payload_raw), suffix))
              } catch {}
            }
          }
          yield JSON.stringify(r)
        }
      },
    })
    inputs.push({
      ...input,
      runId: id,
      manifest,
      manifestText: JSON.stringify(manifest),
      raw: input.raw.map((f) => transform(f, true)),
      reliability: transform(input.reliability, false),
    })
  }
const batch =
  factor === 1
    ? original
    : {
        ...original,
        batch_id: original.batch_id + '-load' + factor,
        label: 'Synthetic ' + factor + 'x volume replay',
        run_ids: inputs.map((x) => x.runId),
      }
const runtime_source_hashes = {}
for (const path of [
  'lib/analysis/filters/extract.js',
  'lib/analysis/filters/evaluate.js',
  'lib/analysis/contracts/first-minute.js',
  'lib/analysis/catalog/filters.js',
  'lib/analysis/filters/artifacts.js',
])
  runtime_source_hashes[path] = createHash('sha256')
    .update(await readFile(new URL('../../' + path, import.meta.url)))
    .digest('hex')
const before = await statfs(out)
const began = performance.now()
const features = await extractFeatures(batch, inputs)
const extractionSeconds = (performance.now() - began) / 1000
const target = join(out, batch.batch_id)
const path = await saveArtifact(target, 'features.json', features)
const cohorts = []
const receipts = []
let derivedBytes = Buffer.byteLength(JSON.stringify(features))
const filtering = performance.now()
for (const f of FILTERS) {
  const c = filterFeatures(features, definition(f.id))
  cohorts.push(c)
  const cp = await saveArtifact(target, c.definition.id + '.json', c)
  derivedBytes += Buffer.byteLength(JSON.stringify(c))
  receipts.push({
    filter_id: f.id,
    summary: c.summary,
    content_hash: c.content_hash,
    full_result_path: cp,
    preview: c.decisions.filter((d) => d.status === 'member').slice(0, 20),
  })
}
const filterSeconds = (performance.now() - filtering) / 1000
const after = await statfs(out)
const receiptBytes = receipts.map((r) => Buffer.byteLength(boundedReceipt(r)))
let baseline_semantic_parity = null
if (factor > 1) {
  const baseline = JSON.parse(await readFile(join(out, original.batch_id, 'features.json'), 'utf8'))
  for (let replica = 0; replica < factor; replica++) {
    const suffix = '-load' + replica
    const normalized = features.rows
      .filter((r) => r.run_id.endsWith(suffix))
      .map((r) => {
        const run_id = r.run_id.slice(0, -suffix.length),
          mint = r.mint.slice(0, -suffix.length)
        return {
          ...r,
          run_id,
          mint,
          observation_id: JSON.stringify([run_id, mint]),
          created_at: shifted(r.created_at, -replica * 3600000),
        }
      })
      .sort((a, b) =>
        a.observation_id < b.observation_id ? -1 : a.observation_id > b.observation_id ? 1 : 0,
      )
    assert.deepEqual(normalized, baseline.rows)
  }
  baseline_semantic_parity = { passed: true, replicas: factor, observations_checked: features.rows.length }
}
const report = {
  runtime_source_hashes,
  baseline_semantic_parity,
  case: factor === 1 ? 'Batch 001 actual' : factor + 'x synthetic volume',
  factor,
  synthetic: factor !== 1,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: new URL('../..', import.meta.url) })
    .toString()
    .trim(),
  hardware: {
    cpu: cpus()[0]?.model,
    logical_cpus: cpus().length,
    total_memory_bytes: totalmem(),
    node: process.version,
  },
  input_raw_records: features.sources.reduce((n, r) => n + r.raw_records, 0),
  input_raw_bytes: features.sources.reduce((n, r) => n + r.raw_bytes, 0),
  observations: features.rows.length,
  known_wallets: features.rows.reduce((n, r) => n + r.known_unique_buyers, 0),
  extraction_seconds: extractionSeconds,
  filter_seconds: filterSeconds,
  total_seconds: (performance.now() - began) / 1000,
  peak_rss_bytes: process.resourceUsage().maxRSS * 1024,
  derived_bytes: derivedBytes,
  temporary_bytes: 0,
  free_bytes_before: before.bavail * before.bsize,
  free_bytes_after: after.bavail * after.bsize,
  max_receipt_bytes: Math.max(...receiptBytes),
  feature_path: path,
  feature_content_hash: features.content_hash,
  summary: features.summary,
  filters: receipts.map(({ preview, ...r }) => r),
}
report.budgets_pass =
  report.peak_rss_bytes <= 1024 ** 3 &&
  filterSeconds <= 60 &&
  derivedBytes <= 1024 ** 3 &&
  report.free_bytes_after >= 15 * 1024 ** 3 &&
  (factor !== 2 || report.total_seconds <= 900)
await writeFile(join(target, 'benchmark.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report))
if (!report.budgets_pass) process.exitCode = 1
