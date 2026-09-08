import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { RunStore, validateDatasetTree } from '../lib/storage/index.js'

async function temporaryRoot(t) {
  const root = await mkdtemp(join(os.tmpdir(), 'pump-observer-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

function normalized(run, schema, source, extras = {}) {
  return {
    schema,
    dataset_version: '1.0.0',
    run_id: run.manifest.run_id,
    source,
    received_at: '2026-08-26T12:00:01.000Z',
    ...extras,
  }
}

test('writes byte-faithful raw data, normalized facts, dedup facts, and atomic final state', async t => {
  const root = await temporaryRoot(t)
  let now = Date.parse('2026-08-26T12:00:00.000Z')
  const store = new RunStore(root, {
    now: () => now,
    flushPolicy: { max_records: 2, max_delay_ms: 250 },
    enabledAdapters: ['fixture'],
  })
  const run = await store.createRun(5)
  const payloads = [Buffer.from('{"kind":"create","n":"12345678901234567890"}'), Buffer.from('{"kind":"trade"}')]
  const raws = await Promise.all(payloads.map((payload, index) => run.appendRaw({
    stream: 'pumpapi-live',
    source: 'fixture',
    transport: 'live',
    channel: 'events',
    payload,
    eventId: `event-${index + 1}`,
    receivedAt: `2026-08-26T12:00:0${index + 1}.000Z`,
  })))
  assert.deepEqual(raws.map(record => record.seq), [1, 2])
  const boundedManifest = JSON.parse(await readFile(join(root, 'runs', run.manifest.run_id, 'manifest.json'), 'utf8'))
  assert.equal(boundedManifest.durable_raw_seq, 2)
  assert.deepEqual(raws.map(record => record.payload_raw), payloads.map(payload => payload.toString('utf8')))
  assert.deepEqual(raws.map(record => record.byte_len), payloads.map(payload => payload.byteLength))

  const binary = Buffer.alloc(1024 * 1024 + 1, 0xff)
  const blobRaw = await run.appendRaw({
    stream: 'metadata',
    source: 'fixture-metadata',
    transport: 'fetch',
    channel: 'image',
    payload: binary,
    mediaType: 'application/octet-stream',
    receivedAt: '2026-08-26T12:00:03.000Z',
  })
  assert.equal(blobRaw.payload_raw, null)
  assert.equal(blobRaw.blob_ref?.size, binary.byteLength)

  const mint = 'MintFixture11111111111111111111111111111111'
  await run.appendNormalized('tokens', normalized(run, 'pump.token/1', 'fixture', {
    mint,
    decimals: 6,
    supply_raw: '1000000000000000000',
    unavailable_metric: null,
    unavailable_metric_status: 'missing',
    raw_seq: 1,
  }), `token:${mint}`)
  const trade = normalized(run, 'pump.trade/1', 'fixture', {
    mint,
    signature: 'signature-1',
    base_amount_raw: '900719925474099312345',
    quote_amount_raw: '123456789',
    raw_seq: 2,
  })
  assert.equal(await run.appendNormalized('trades', trade, 'trade:signature-1'), true)
  assert.equal(await run.appendNormalized('trades', trade, 'trade:signature-1'), false)
  await assert.rejects(
    () => run.appendNormalized('trades', normalized(run, 'pump.trade/1', 'fixture', { mint: 'UnknownMint', raw_seq: 2 })),
    /unknown mint/u,
  )
  await assert.rejects(
    () => run.appendNormalized('events', normalized(run, 'pump.event/1', 'fixture', { raw_seq: 99 })),
    /outside durable run sequence/u,
  )

  now += 120_000
  const finalManifest = await run.finalize('manual_early')
  assert.equal(finalManifest.status, 'stopped')
  assert.equal(finalManifest.stop_reason, 'manual_early')
  assert.equal(finalManifest.latest_raw_seq, 3)
  assert.equal(finalManifest.durable_raw_seq, 3)
  assert.deepEqual(finalManifest.counts, {
    raw_records: 3,
    normalized_records: 3,
    tokens: 1,
    reliability_records: 1,
  })

  const report = await validateDatasetTree(root)
  assert.deepEqual(report, { runs: 1, raw_records: 3, normalized_records: 3, blobs: 1 })
  const tokenLine = JSON.parse((await readFile(join(root, 'runs', run.manifest.run_id, 'normalized', 'tokens.ndjson'), 'utf8')).trim())
  assert.equal(tokenLine.supply_raw, '1000000000000000000')
  assert.equal(tokenLine.unavailable_metric, null)
  assert.equal(tokenLine.unavailable_metric_status, 'missing')
  await store.close()
})

test('allocates durable unique run IDs and supports a two-run consumer after reopen', async t => {
  const root = await temporaryRoot(t)
  const now = Date.parse('2026-08-26T13:00:00.000Z')
  const store = new RunStore(root, { now: () => now })
  await store.init()
  const [first, second] = await Promise.all([store.createRun(5), store.createRun(10)])
  assert.notEqual(first.manifest.run_id, second.manifest.run_id)
  assert.match(first.manifest.run_id, /^run-0001-/u)
  assert.match(second.manifest.run_id, /^run-0002-/u)
  await Promise.all([first.finalize('timer_expired'), second.finalize('manual_early')])
  await store.close()

  const consumer = new RunStore(root, { now: () => now + 700_000 })
  const manifests = await consumer.listManifests()
  assert.deepEqual(manifests.map(item => item.sequence), [2, 1])
  assert.deepEqual(manifests.map(item => item.duration_ms), [600_000, 300_000])
  const catalog = (await readFile(join(root, 'catalog.ndjson'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
  assert.equal(catalog.length, 4)
  assert.deepEqual(new Set(catalog.map(item => item.run_id)), new Set([first.manifest.run_id, second.manifest.run_id]))
  assert.deepEqual(await validateDatasetTree(root), { runs: 2, raw_records: 0, normalized_records: 0, blobs: 0 })
  await consumer.close()
})

test('startup recovery marks a nonterminal manifest interrupted and never resumes it', async t => {
  const root = await temporaryRoot(t)
  let now = Date.parse('2026-08-26T14:00:00.000Z')
  const crashedStore = new RunStore(root, { now: () => now })
  const crashedRun = await crashedStore.createRun(5)
  await crashedRun.appendRaw({
    stream: 'pumpapi-live',
    source: 'fixture',
    transport: 'live',
    channel: 'events',
    payload: Buffer.from('{"event":"before-crash"}'),
  })
  await crashedRun.flush()
  await crashedStore.close()

  now += 60_000
  const restarted = new RunStore(root, { now: () => now })
  const recovered = await restarted.listManifests()
  assert.equal(recovered[0].status, 'interrupted')
  assert.equal(recovered[0].stop_reason, 'interrupted')
  assert.equal(recovered[0].latest_raw_seq, 1)
  assert.equal(recovered[0].durable_raw_seq, 1)

  const next = await restarted.createRun(5)
  assert.equal(next.manifest.sequence, 2)
  await next.finalize('timer_expired')
  assert.deepEqual(await validateDatasetTree(root), { runs: 2, raw_records: 1, normalized_records: 0, blobs: 0 })
  await restarted.close()
})

test('validator detects blob byte corruption', async t => {
  const root = await temporaryRoot(t)
  const store = new RunStore(root)
  const run = await store.createRun(5)
  const raw = await run.appendRaw({
    stream: 'metadata',
    source: 'fixture',
    transport: 'fetch',
    channel: 'binary',
    payload: Buffer.alloc(1024 * 1024 + 1, 0xfe),
  })
  await run.finalize('timer_expired')
  await writeFile(join(root, 'runs', run.manifest.run_id, raw.blob_ref.path), Buffer.from('corrupt'))
  await assert.rejects(() => validateDatasetTree(root), /byte length mismatch|hash mismatch/u)
  await store.close()
})
