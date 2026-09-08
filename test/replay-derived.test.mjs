import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import test from 'node:test'
import {
  addExact,
  compareExact,
  DerivedDatasetBuilder,
  fetchReplayArchive,
  repairFromArchives,
  replayArchiveUrls,
  ReplayRepairSession,
  RunStore,
  subtractExact,
  validateDatasetTree,
} from '../lib/index.js'

async function temporaryRoot(t) {
  const root = await mkdtemp(join(os.tmpdir(), 'pump-replay-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function readLines(path) {
  try {
    const text = await readFile(path, 'utf8')
    return text.split('\n').filter(Boolean).map(line => JSON.parse(line))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function seedLiveRun(store, nowRef) {
  const run = await store.createRun(10)
  const mint = 'MintReplay'
  const createRaw = await run.appendRaw({
    stream: 'pumpapi-live', source: 'pumpapi', transport: 'live', channel: 'data-stream',
    payload: Buffer.from('{"signature":"sig-create","action":"create"}'),
    eventId: 'sig-create', sourceAt: '2026-08-26T17:55:35.000Z', receivedAt: '2026-08-26T17:55:35.100Z',
  })
  await run.appendNormalized('tokens', {
    schema: 'pump.token/1', dataset_version: '1.0.0', run_id: run.manifest.run_id,
    source: 'pumpapi', received_at: '2026-08-26T17:55:35.100Z', raw_seq: createRaw.seq,
    source_at: '2026-08-26T17:55:35.000Z', signature: 'sig-create', mint,
    first_seen_at: '2026-08-26T17:55:35.100Z',
  }, `token:${mint}`)
  await run.appendNormalized('events', {
    schema: 'pump.event/1', dataset_version: '1.0.0', run_id: run.manifest.run_id,
    source: 'pumpapi', received_at: '2026-08-26T17:55:35.100Z', raw_seq: createRaw.seq,
    source_at: '2026-08-26T17:55:35.000Z', signature: 'sig-create', mint,
    action: 'create', action_raw: 'create', event_key: 'sig-create:0:create', breakdown_index: 0,
  }, 'event:sig-create:0:create')
  const buyRaw = await run.appendRaw({
    stream: 'pumpapi-live', source: 'pumpapi', transport: 'live', channel: 'data-stream',
    payload: Buffer.from('{"signature":"sig-live","action":"buy"}'),
    eventId: 'sig-live', sourceAt: '2026-08-26T17:55:40.000Z', receivedAt: '2026-08-26T17:55:40.100Z',
  })
  await run.appendNormalized('events', {
    schema: 'pump.event/1', dataset_version: '1.0.0', run_id: run.manifest.run_id,
    source: 'pumpapi', received_at: '2026-08-26T17:55:40.100Z', raw_seq: buyRaw.seq,
    source_at: '2026-08-26T17:55:40.000Z', signature: 'sig-live', mint,
    action: 'buy', action_raw: 'buy', event_key: 'sig-live:0:buy', breakdown_index: 0,
  }, 'event:sig-live:0:buy')
  await run.appendNormalized('trades', {
    schema: 'pump.trade/1', dataset_version: '1.0.0', run_id: run.manifest.run_id,
    source: 'pumpapi', received_at: '2026-08-26T17:55:40.100Z', raw_seq: buyRaw.seq,
    source_at: '2026-08-26T17:55:40.000Z', signature: 'sig-live', mint,
    side: 'buy', price_quote: '0.10', quote_amount_raw: '1.25', signing_wallet: 'SignerCrossRun', breakdown_index: 0,
  }, 'trade:sig-live:0:buy')
  await run.appendNormalized('reliability', {
    schema: 'pump.reliability/1', dataset_version: '1.0.0', run_id: run.manifest.run_id,
    source: 'pumpapi', received_at: '2026-08-26T17:55:45.000Z', raw_seq: null,
    kind: 'disconnected', status: 'gap', detail: { code: 1006 },
  })
  nowRef.value += 600_000
  await run.finalize('timer_expired')
  return run.manifest.run_id
}

function archive(lines) {
  return { status: 'available', lines: (async function* () { for (const line of lines) yield Buffer.from(JSON.stringify(line)) })() }
}

test('exact decimal helpers never use floating-point coercion', () => {
  assert.equal(addExact('900719925474099312345.1', '0.0000000009'), '900719925474099312345.1000000009')
  assert.equal(subtractExact('1.000000000000000001', '0.999999999999999999'), '0.000000000000000002')
  assert.equal(compareExact('1e40', '9999999999999999999999999999999999999999'), 1)
})

test('production replay fetcher streams Zstandard JSONL archives', async t => {
  const body = zstdCompressSync(Buffer.from('{"signature":"one"}\n{"signature":"two"}\n'))
  const server = createServer((request, response) => {
    if (request.url === '/missing') {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'content-type': 'application/zstd' }).end(body)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const address = server.address()
  assert.equal(typeof address, 'object')
  const base = `http://127.0.0.1:${address.port}`
  const archiveResult = await fetchReplayArchive(`${base}/archive`)
  assert.equal(archiveResult.status, 'available')
  const lines = []
  for await (const line of archiveResult.lines) lines.push(Buffer.from(line).toString('utf8'))
  assert.deepEqual(lines, ['{"signature":"one"}', '{"signature":"two"}'])
  assert.equal((await fetchReplayArchive(`${base}/missing`)).status, 'missing')
})

test('replay repairs only in-window events, preserves schema eras and distinct breakdown positions', async t => {
  const root = await temporaryRoot(t)
  const nowRef = { value: Date.parse('2026-08-26T17:55:30.000Z') }
  const store = new RunStore(root, { now: () => nowRef.value })
  const runId = await seedLiveRun(store, nowRef)
  await store.close()
  const repair = await ReplayRepairSession.open(root, runId, () => nowRef.value)
  const urls = replayArchiveUrls(repair.manifest)
  assert.equal(urls.length, 2)
  assert.match(urls[0], /\/17\.jsonl\.zst$/u)
  assert.match(urls[1], /\/18\.jsonl\.zst$/u)

  const byUrl = new Map([
    [urls[0], archive([
      { signature: 'sig-live', timestamp: '2026-08-26T17:55:40.000Z', action: 'buy', mint: 'MintReplay', tokenAmount: 1, quoteAmount: 1 },
      { signature: 'sig-replay-sell', timestamp: '2026-08-26T17:56:00.000Z', action: 'sell', mint: 'MintReplay', tokenAmount: 2, quoteAmount: 2, price: 0.2, signer: 'ReplaySeller' },
    ])],
    [urls[1], archive([
      { signature: 'sig-old-era', timestamp: '2026-08-26T18:04:00.000Z', txType: 'buy', mint: 'MintReplay', tokenAmount: 3, price: 0.3, signer: 'OldEraBuyer', localTimestamp: '2026-08-26T19:01:00.000Z' },
      { signature: 'sig-multi', timestamp: '2026-08-26T18:05:20.000Z', mint: 'MintReplay', signer: 'MultiSeller', events: [
        { action: 'sell', tokenAmount: 4, quoteAmount: 3, price: 0.15 },
        { action: 'sell', tokenAmount: 5, quoteAmount: 4, price: 0.1 },
      ] },
      { signature: 'sig-outside', timestamp: '2026-08-26T18:05:30.000Z', action: 'buy', mint: 'MintReplay', quoteAmount: 99 },
    ])],
  ])
  const manifest = await repairFromArchives(repair, async url => byUrl.get(url))
  assert.equal(manifest.repair.status, 'complete')
  assert.equal(manifest.repair.accepted_events, 4)
  assert.equal(manifest.repair.duplicate_events, 1)
  assert.equal(manifest.repair.rejected_events, 1)
  assert.equal(manifest.latest_raw_seq, 6)
  assert.equal(manifest.durable_raw_seq, 6)

  const replayRaw = await readLines(join(root, 'runs', runId, 'raw', 'pumpapi-replay.ndjson'))
  assert.equal(replayRaw.length, 4)
  assert.ok(replayRaw.every(record => record.transport === 'replay' && record.ingested_after_stop === true))
  assert.equal(replayRaw.some(record => record.event_id === 'sig-outside'), false)
  const events = await readLines(join(root, 'runs', runId, 'normalized', 'events.ndjson'))
  assert.equal(events.filter(record => record.signature === 'sig-multi').length, 2)
  assert.ok(events.some(record => record.signature === 'sig-old-era' && record.action === 'buy' && record.transport === 'replay'))
  const reliability = await readLines(join(root, 'runs', runId, 'normalized', 'reliability.ndjson'))
  assert.ok(reliability.some(record => record.kind === 'replay_dedup'))
  assert.ok(reliability.some(record => record.kind === 'replay_out_of_window'))
  assert.deepEqual(await validateDatasetTree(root), {
    runs: 1,
    raw_records: 6,
    normalized_records: manifest.counts.normalized_records,
    blobs: 0,
  })

  const builder = new DerivedDatasetBuilder(root)
  const firstBuild = await builder.build(runId)
  const candlesBefore = await readFile(join(root, 'runs', runId, 'derived', 'candles.ndjson'), 'utf8')
  const summariesBefore = await readFile(join(root, 'runs', runId, 'derived', 'trade-summaries.ndjson'), 'utf8')
  const secondBuild = await builder.build(runId)
  assert.equal((await readFile(join(root, 'runs', runId, 'derived', 'candles.ndjson'), 'utf8')), candlesBefore)
  assert.equal((await readFile(join(root, 'runs', runId, 'derived', 'trade-summaries.ndjson'), 'utf8')), summariesBefore)
  assert.equal(firstBuild.candles, 4)
  assert.equal(secondBuild.signer_index_rows, 0)
  assert.equal(secondBuild.mint_index_rows, 0)
  const candles = candlesBefore.trim().split('\n').map(line => JSON.parse(line))
  assert.equal(candles[0].partial, true)
  assert.equal(candles.at(-1).partial, true)
  assert.ok(candles.every(candle => candle.gap_state === 'gap_possible'))
  const summary = JSON.parse(summariesBefore.trim())
  assert.equal(summary.buy_count, 2)
  assert.equal(summary.sell_count, 3)
  assert.equal(summary.quote_amount_missing_count, 1)
  assert.equal(summary.net_quote_raw, null)
  assert.equal(summary.amount_status, 'partial_missing_amounts')
  assert.equal(summary.formula_version, 'pump-derived/1')
})

test('missing replay archives stay explicit and cross-run signer indexes remain factual', async t => {
  const root = await temporaryRoot(t)
  let now = Date.parse('2026-08-26T20:00:00.000Z')
  const store = new RunStore(root, { now: () => now })
  const run = await store.createRun(5)
  const raw = await run.appendRaw({
    stream: 'pumpapi-live', source: 'pumpapi', transport: 'live', channel: 'data-stream',
    payload: Buffer.from('{}'), receivedAt: new Date(now).toISOString(),
  })
  await run.appendNormalized('tokens', {
    schema: 'pump.token/1', dataset_version: '1.0.0', run_id: run.manifest.run_id,
    source: 'pumpapi', received_at: new Date(now).toISOString(), raw_seq: raw.seq, mint: 'MintSecond',
  })
  await run.appendNormalized('trades', {
    schema: 'pump.trade/1', dataset_version: '1.0.0', run_id: run.manifest.run_id,
    source: 'pumpapi', received_at: new Date(now).toISOString(), raw_seq: raw.seq, mint: 'MintSecond',
    source_at: new Date(now + 1_000).toISOString(), signature: 'sig-second', side: 'buy',
    quote_amount_raw: '0', price_quote: '0', signing_wallet: 'SignerCrossRun',
  })
  now += 300_000
  await run.finalize('timer_expired')
  await store.close()
  const repair = await ReplayRepairSession.open(root, run.manifest.run_id, () => now)
  const repaired = await repairFromArchives(repair, async () => ({ status: 'missing', detail: 'fixture 404' }))
  assert.equal(repaired.repair.status, 'partial')
  assert.equal(repaired.repair.missing_archives.length, 1)
  const reliability = await readLines(join(root, 'runs', run.manifest.run_id, 'normalized', 'reliability.ndjson'))
  assert.ok(reliability.some(record => record.kind === 'replay_archive_missing' && record.status === 'missing'))
  const builder = new DerivedDatasetBuilder(root)
  await builder.build(run.manifest.run_id)

  now += 1_000
  const secondStore = new RunStore(root, { now: () => now })
  const secondRun = await secondStore.createRun(5)
  const secondRaw = await secondRun.appendRaw({
    stream: 'pumpapi-live', source: 'pumpapi', transport: 'live', channel: 'data-stream',
    payload: Buffer.from('{}'), receivedAt: new Date(now).toISOString(),
  })
  await secondRun.appendNormalized('tokens', {
    schema: 'pump.token/1', dataset_version: '1.0.0', run_id: secondRun.manifest.run_id,
    source: 'pumpapi', received_at: new Date(now).toISOString(), raw_seq: secondRaw.seq, mint: 'MintThird',
  })
  await secondRun.appendNormalized('trades', {
    schema: 'pump.trade/1', dataset_version: '1.0.0', run_id: secondRun.manifest.run_id,
    source: 'pumpapi', received_at: new Date(now).toISOString(), raw_seq: secondRaw.seq, mint: 'MintThird',
    source_at: new Date(now + 1_000).toISOString(), signature: 'sig-third', side: 'sell',
    quote_amount_raw: '1', price_quote: '1', signing_wallet: 'SignerCrossRun',
  })
  now += 300_000
  await secondRun.finalize('timer_expired')
  await secondStore.close()
  await builder.build(secondRun.manifest.run_id)

  const signerIndex = await readLines(join(root, 'indexes', 'signers.ndjson'))
  const signerRows = signerIndex.filter(record => record.address === 'SignerCrossRun')
  assert.equal(new Set(signerRows.map(record => record.run_id)).size, 2)
  assert.ok(signerRows.every(record => !('identity' in record) && !('bot' in record) && !('insider' in record)))
  const summary = (await readLines(join(root, 'runs', run.manifest.run_id, 'derived', 'trade-summaries.ndjson')))[0]
  assert.equal(summary.buy_quote_known_raw, '0')
  assert.equal(summary.net_quote_raw, '0')
  assert.equal(summary.amount_status, 'complete_for_retained_trades')
})
