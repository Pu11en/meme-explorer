import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, access, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { directoryBytes, runScheduledRecording, validateJob, startDecision, storageStop } from '../lib/scheduled-recording.js'
import { RunStore } from '../lib/storage/run-store.js'
import { validateManifest, validateDatasetTree } from '../lib/storage/validation.js'

const start = Date.parse('2026-09-08T13:00:00Z')
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'scheduled-pump-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return {
    schema: 'pump.scheduled-recording/1', batch_id: 'batch-test', label: 'Test hour',
    starts_at: new Date(start).toISOString(), ends_at: new Date(start + 3_600_000).toISOString(),
    data_root: root, minimum_free_bytes: 100, maximum_batch_bytes: 500,
  }
}
const readStatus = job => readFile(join(job.data_root, 'job-status.json'), 'utf8').then(JSON.parse)

test('exact hour, absolute root, startup grace, and disk boundaries', async t => {
  const job = await fixture(t)
  validateJob(job)
  assert.throws(() => validateJob({ ...job, ends_at: job.starts_at }), /one hour/)
  assert.throws(() => validateJob({ ...job, data_root: 'relative' }), /absolute/)
  assert.equal(startDecision(job, start - 1), 'early')
  assert.equal(startDecision(job, start + 60_000), 'ready')
  assert.equal(startDecision(job, start + 60_001), 'missed')
  assert.equal(storageStop(job, 99, 0), 'low_disk_space')
  assert.equal(storageStop(job, 100, 500), 'batch_size_limit')
  assert.equal(storageStop(job, 100, 499), null)
})

test('one-hour manifests validate and invalid duration does not consume sequence', async t => {
  const job = await fixture(t)
  const store = new RunStore(job.data_root, { now: () => start })
  await assert.rejects(store.createRun(61), /duration/)
  const run = await store.createRun(60)
  assert.equal(run.manifest.sequence, 1)
  assert.equal(run.manifest.duration_ms, 3_600_000)
  validateManifest(run.manifest)
  await run.finalize('timer_expired')
  await store.close()
})

test('missed and repeated jobs never open a socket', async t => {
  const job = await fixture(t)
  await runScheduledRecording(job, { now: () => start + 60_001 })
  assert.equal((await readStatus(job)).state, 'missed')
  await assert.rejects(runScheduledRecording(job, { now: () => start }), /EEXIST/)
  await assert.rejects(access(join(job.data_root, 'runs')), /ENOENT/)
})

test('low disk before start skips recording without opening a socket', async t => {
  const job = await fixture(t)
  await runScheduledRecording(job, { now: () => start, freeBytes: async () => 99, usedBytes: async () => 0 })
  assert.equal((await readStatus(job)).state, 'skipped')
  await assert.rejects(access(join(job.data_root, 'runs')), /ENOENT/)
})

test('recorded events survive automatic end and batch resolves to valid dataset', async t => {
  const job = await fixture(t)
  let now = start
  let stops = 0
  const adapter = {
    async start(handlers) {
      await handlers.onFrame({ bytes: Buffer.from(JSON.stringify({
        action: 'create', mint: 'MintTest', pool: 'pump', signature: 'create-test',
        timestamp: new Date(start + 1000).toISOString(), name: 'Test', symbol: 'TEST',
      })), receivedAt: new Date(start + 1000).toISOString(), receivedMonoMs: 1000 })
      now = start + 3_600_000
    },
    async stop() { stops++ },
  }
  await runScheduledRecording(job, { adapter, now: () => now, enrichment: false, freeBytes: async () => 1000, usedBytes: async () => 0 })
  const status = await readStatus(job)
  assert.equal(status.state, 'completed')
  assert.equal(status.manifest.stop_reason, 'timer_expired')
  assert.equal(status.manifest.counts.tokens, 1)
  assert.equal(stops, 1)
  const batch = JSON.parse(await readFile(join(job.data_root, 'batch.json'), 'utf8'))
  assert.deepEqual(batch.run_ids, [status.run_id])
  assert.equal((await validateDatasetTree(job.data_root)).runs, 1)
})

test('disk exhaustion during capture finalizes once with early-stop evidence', async t => {
  const job = await fixture(t)
  let checks = 0
  let stops = 0
  await runScheduledRecording(job, {
    now: () => start, enrichment: false,
    adapter: { async start() {}, async stop() { stops++ } },
    freeBytes: async () => ++checks === 1 ? 1000 : 99, usedBytes: async () => 0,
  })
  const status = await readStatus(job)
  assert.equal(status.state, 'stopped_early')
  assert.equal(status.reason, 'low_disk_space')
  assert.equal(status.manifest.stop_reason, 'manual_early')
  assert.equal(stops, 1)
})

test('connection failure leaves an error manifest and cannot silently retry', async t => {
  const job = await fixture(t)
  await assert.rejects(runScheduledRecording(job, {
    now: () => start, enrichment: false,
    adapter: { async start() { throw new Error('fixture connection failure') }, async stop() {} },
    freeBytes: async () => 1000, usedBytes: async () => 0,
  }), /fixture connection failure/)
  const status = await readStatus(job)
  assert.equal(status.state, 'error')
  assert.equal(status.manifest.status, 'error')
})


test('disk scan tolerates a file renamed after directory listing but propagates real errors', async t => {
  const job = await fixture(t)
  await writeFile(join(job.data_root, '.123-456-abcd.tmp'), 'temporary')
  await writeFile(join(job.data_root, 'retained.json'), '12345')
  assert.equal(await directoryBytes(job.data_root, async path => {
    if (path.endsWith('.tmp')) throw Object.assign(new Error('renamed'), { code: 'ENOENT' })
    return stat(path)
  }), 5)
  await assert.rejects(directoryBytes(job.data_root, async () => {
    throw Object.assign(new Error('permission'), { code: 'EACCES' })
  }), { code: 'EACCES' })
})

test('a delayed start records sixty minutes rather than ending at the original clock deadline', async t => {
  const job = await fixture(t)
  let now = start + 10_000
  let checks = 0
  await runScheduledRecording(job, {
    now: () => now, enrichment: false, pollMs: 0,
    adapter: { async start() { now = start + 3_600_000 }, async stop() {} },
    freeBytes: async () => 1000,
    usedBytes: async () => { if (++checks === 2) now = start + 3_610_000; return 0 },
  })
  const result = await readStatus(job)
  assert.equal(result.state, 'completed')
  assert.equal(result.manifest.stop_reason, 'timer_expired')
  assert.equal(Date.parse(result.manifest.stopped_at) - Date.parse(result.manifest.started_at), 3_600_000)
})
