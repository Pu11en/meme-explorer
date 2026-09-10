import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { FILTERS, definition } from '../lib/analysis/catalog/filters.js'
import { digest } from '../lib/analysis/filters/artifacts.js'
import { extractFeatures } from '../lib/analysis/filters/extract.js'
const cwd = new URL('..', import.meta.url)
test('catalog defaults and definitions agree with executable skills', async () => {
  const c = JSON.parse(await readFile(new URL('../analysis/catalog.json', import.meta.url), 'utf8'))
  const filters = c.skills.filter((s) => s.type === 'filter')
  assert.equal(filters.length, 6)
  assert.equal(new Set(c.skills.map((s) => s.id)).size, c.skills.length)
  for (const item of filters) {
    const d = definition(item.id)
    assert.deepEqual(item.parameters, d.parameters)
    assert.equal(item.definition_hash, digest(d))
    assert.equal(item.input, d.source_schema)
  }
  execFileSync(process.execPath, ['scripts/analysis/generate-skills.mjs', '--check'], { cwd })
})
test('cached filtering CLI runs all six after raw data is absent and rejects modified content', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'filter-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const at = '2026-01-01T00:00:00.000Z',
    end = '2026-01-01T00:01:00.000Z',
    manifest = { run_id: 'r', status: 'stopped', started_at: at, stopped_at: end, stops_at: end }
  const f = await extractFeatures(
    { schema: 'pump.collection-batch/1', batch_id: 'b', label: 'B', run_ids: ['r'] },
    [
      {
        runId: 'r',
        manifest,
        manifestText: JSON.stringify(manifest),
        raw: [
          {
            name: 'raw/pumpapi-live.ndjson',
            lines: async function* () {
              yield JSON.stringify({
                source_at: at,
                received_at: at,
                payload_raw: JSON.stringify({ action: 'create', pool: 'pump', mint: 'M' }),
              })
            },
          },
        ],
        reliability: { name: 'normalized/reliability.ndjson', lines: async function* () {} },
        blob: async () => '',
      },
    ],
  )
  const path = join(root, 'features.json')
  await writeFile(path, JSON.stringify(f))
  const output = execFileSync(
    process.execPath,
    ['lib/analysis/filters/filter-cli.js', '--result', path, '--all', '--output-root', root],
    { cwd, encoding: 'utf8' },
  )
  const receipt = JSON.parse(output)
  assert.equal(receipt.filters.length, 6)
  assert(Buffer.byteLength(output) < 65536)
  for (const r of receipt.filters) {
    const c = JSON.parse(await readFile(r.full_result_path, 'utf8'))
    assert.equal(c.source_content_hash, f.content_hash)
    assert.equal(c.summary.input, 1)
  }
  await writeFile(path, JSON.stringify({ ...f, batch: { ...f.batch, label: 'tampered' } }))
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ['lib/analysis/filters/filter-cli.js', '--result', path, '--all', '--output-root', root],
        { cwd, stdio: 'pipe' },
      ),
    /Command failed/,
  )
})

test('one batch command writes six auditable cohorts and an offline page', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'filter-pipeline-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const data = join(root, 'data'),
    run = join(data, 'runs', 'r'),
    output = join(root, 'output')
  await mkdir(join(run, 'raw'), { recursive: true })
  await mkdir(join(run, 'normalized'))
  const at = '2026-01-01T00:00:00.000Z',
    end = '2026-01-01T00:01:00.000Z'
  await writeFile(
    join(run, 'manifest.json'),
    JSON.stringify({ run_id: 'r', status: 'stopped', started_at: at, stopped_at: end, stops_at: end }),
  )
  await writeFile(join(run, 'normalized', 'reliability.ndjson'), '')
  await writeFile(
    join(run, 'raw', 'pumpapi-live.ndjson'),
    JSON.stringify({
      source_at: at,
      received_at: at,
      payload_raw: JSON.stringify({
        action: 'create',
        pool: 'pump',
        mint: 'M',
        name: '</script><script>throw Error("injected")</script>',
      }),
    }) + '\n',
  )
  const batchPath = join(root, 'batch.json')
  await writeFile(
    batchPath,
    JSON.stringify({ schema: 'pump.collection-batch/1', batch_id: 'b', label: 'Fixture', run_ids: ['r'] }),
  )
  const args = [
    'lib/analysis/filters/run-cli.js',
    '--data-root',
    data,
    '--batch',
    batchPath,
    '--output-root',
    output,
  ]
  const receipt = JSON.parse(execFileSync(process.execPath, args, { cwd, encoding: 'utf8' }))
  assert.equal(receipt.filters.length, 6)
  assert.equal(receipt.summary.zero_buys, 1)
  const html = await readFile(receipt.page, 'utf8')
  assert(!html.includes('</script><script>throw Error("injected")</script>'))
  assert(html.includes('application/json'))
  assert(html.includes('New Buyer Arrival Rate'))
  const repeated = JSON.parse(execFileSync(process.execPath, args, { cwd, encoding: 'utf8' }))
  assert.deepEqual(repeated, receipt)
  await writeFile(
    join(run, 'manifest.json'),
    JSON.stringify({ run_id: 'r', status: 'error', started_at: at, stopped_at: end, stops_at: end }),
  )
  assert.throws(() => execFileSync(process.execPath, args, { cwd, stdio: 'pipe' }), /Command failed/)
})
