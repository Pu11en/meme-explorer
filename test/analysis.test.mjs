import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { analyzeTenSecondBuyActivity } from '../lib/index.js'

async function temporaryRoot(t) {
  const root = await mkdtemp(join(os.tmpdir(), 'pump-analysis-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function writeLines(path, rows) {
  await writeFile(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n')
}

test('ranks first-ten-second buys and preserves boundaries and observability', async t => {
  const root = await temporaryRoot(t)
  const runId = 'run-0001-fixture'
  const runRoot = join(root, 'runs', runId)
  await mkdir(join(runRoot, 'normalized'), { recursive: true })
  await writeFile(join(runRoot, 'manifest.json'), JSON.stringify({
    run_id: runId,
    status: 'stopped',
    started_at: '2026-01-01T00:00:00.000Z',
    stopped_at: '2026-01-01T00:01:00.000Z',
    stops_at: '2026-01-01T00:01:00.000Z',
    counts: { raw_records: 12 }
  }))
  const base = { run_id: runId, received_at: '2026-01-01T00:00:00.100Z' }
  await writeLines(join(runRoot, 'normalized', 'tokens.ndjson'), [
    { ...base, mint: 'MintA', name: 'A', symbol: 'A', source_at: '2026-01-01T00:00:00.000Z', raw_action: 'create' },
    { ...base, mint: 'MintB', name: 'B', symbol: 'B', source_at: '2026-01-01T00:00:55.000Z', raw_action: 'create' }
  ])
  await writeLines(join(runRoot, 'normalized', 'trades.ndjson'), [
    { ...base, mint: 'MintA', side: 'buy', source_at: '2026-01-01T00:00:00.000Z', signing_wallet: 'W1', quote_amount_raw: '1.2', slot: '1' },
    { ...base, mint: 'MintA', side: 'buy', source_at: '2026-01-01T00:00:09.999Z', signing_wallet: 'W1', quote_amount_raw: '0.8', slot: '1' },
    { ...base, mint: 'MintA', side: 'buy', source_at: '2026-01-01T00:00:10.000Z', signing_wallet: 'W2', quote_amount_raw: '5', slot: '2' }
  ])
  await writeLines(join(runRoot, 'normalized', 'reliability.ndjson'), [])
  await mkdir(join(runRoot, 'raw'), { recursive: true })
  await writeLines(join(runRoot, 'raw', 'pumpapi-live.ndjson'), [
    { event_id: 'create-a', source_at: '2026-01-01T00:00:00.000Z', received_at: '2026-01-01T00:00:00.100Z', payload_raw: JSON.stringify({ action: 'create', pool: 'pump', mint: 'MintA' }) },
    { event_id: 'buy-a1', source_at: '2026-01-01T00:00:00.000Z', received_at: '2026-01-01T00:00:00.100Z', payload_raw: JSON.stringify({ signature: 'buy-a1', action: 'buy', pool: 'pump', mint: 'MintA', txSigner: 'W1', quoteAmount: 1.2, block: 1 }) },
    { event_id: 'buy-a2', source_at: '2026-01-01T00:00:09.999Z', received_at: '2026-01-01T00:00:09.999Z', payload_raw: JSON.stringify({ signature: 'buy-a2', action: 'buy', pool: 'pump', mint: 'MintA', txSigner: 'W1', quoteAmount: 0.8, block: 1 }) },
    { event_id: 'buy-late', source_at: '2026-01-01T00:00:10.000Z', received_at: '2026-01-01T00:00:10.000Z', payload_raw: JSON.stringify({ signature: 'buy-late', action: 'buy', pool: 'pump', mint: 'MintA', txSigner: 'W2', quoteAmount: 5, block: 2 }) },
    { event_id: 'create-b', source_at: '2026-01-01T00:00:55.000Z', received_at: '2026-01-01T00:00:55.100Z', payload_raw: JSON.stringify({ action: 'create', pool: 'pump', mint: 'MintB' }) }
  ])

  const receipt = await analyzeTenSecondBuyActivity({
    dataRoot: root,
    batch: { schema: 'pump.collection-batch/1', batch_id: 'batch-test', label: 'Test', run_ids: [runId] },
    previewLimit: 20,
    now: () => Date.parse('2026-01-02T00:00:00.000Z')
  })

  assert.deepEqual(receipt.summary, {
    coin_observations: 2,
    observable: 1,
    unobservable: 1,
    zero_buy_observations: 0
  })
  const first = receipt.preview[0]
  assert.equal(first.mint, 'MintA')
  assert.equal(first.buy_count, 2)
  assert.equal(first.unique_buyers, 1)
  assert.equal(first.buy_quote_raw, '2')
  assert.equal(first.repeat_buy_ratio, '0.5')
  assert.equal(first.one_second_bars[0].buy_count, 1)
  assert.equal(first.one_second_bars[9].buy_count, 1)
  const saved = JSON.parse(await readFile(receipt.full_result_path, 'utf8'))
  const second = saved.rows.find(row => row.mint === 'MintB')
  assert.equal(second.observation_status, 'unobservable')
  assert.deepEqual(second.unobservable_reasons, ['recording_window_ended'])
  assert.equal(second.buy_count, null)
  await assert.rejects(() => analyzeTenSecondBuyActivity({
    dataRoot: root,
    batch: { schema: 'pump.collection-batch/1', batch_id: 'batch-test', label: 'Test', run_ids: [runId] },
    previewLimit: 21
  }), /preview limit/u)
})

test('recovers a Pump.fun launch missing from historical normalized token rows', async t => {
  const root = await temporaryRoot(t)
  const runId = 'run-raw-fallback'
  const runRoot = join(root, 'runs', runId)
  await mkdir(join(runRoot, 'normalized'), { recursive: true })
  await mkdir(join(runRoot, 'raw'), { recursive: true })
  await writeFile(join(runRoot, 'manifest.json'), JSON.stringify({
    run_id: runId, status: 'stopped', started_at: '2026-01-01T00:00:00.000Z', stopped_at: '2026-01-01T00:01:00.000Z',
    stops_at: '2026-01-01T00:01:00.000Z', counts: { raw_records: 4 }
  }))
  await writeLines(join(runRoot, 'normalized', 'tokens.ndjson'), [])
  await writeLines(join(runRoot, 'normalized', 'trades.ndjson'), [])
  await writeLines(join(runRoot, 'normalized', 'reliability.ndjson'), [])
  const raw = (event_id, source_at, payload) => ({
    event_id, source_at, received_at: source_at, payload_raw: JSON.stringify(payload)
  })
  await writeLines(join(runRoot, 'raw', 'pumpapi-live.ndjson'), [
    raw('create', '2026-01-01T00:00:00.000Z', {
      signature: 'create', type: 'CreateToken', pool: 'PUMP', tokenAddress: 'RawMint', name: 'Raw Coin', symbol: 'RAW', block: 1,
      events: [{ action: 'buy', signer: 'Creator', quote_amount: '9007199254740993' }]
    }),
    raw('buy-1', '2026-01-01T00:00:00.500Z', {
      txSignature: 'buy-1', tx_type: 'buy', pool: 'pump', token_address: 'RawMint', user: 'Buyer', solAmount: 2, slot: 1
    }),
    raw('duplicate-create', '2026-01-01T00:00:00.750Z', {
      signature: 'duplicate-create', action: 'CreateToken', pool: 'pump', mint: 'RawMint'
    }),
    raw('buy-2', '2026-01-01T00:00:10.000Z', {
      signature: 'buy-2', action: 'buy', pool: 'pump', mint: 'RawMint', txSigner: 'Late', quoteAmount: 3, block: 2
    })
  ])
  const receipt = await analyzeTenSecondBuyActivity({
    dataRoot: root,
    batch: { schema: 'pump.collection-batch/1', batch_id: 'raw-batch', label: 'Raw batch', run_ids: [runId] }
  })
  assert.equal(receipt.preview[0].mint, 'RawMint')
  assert.equal(receipt.preview[0].buy_count, 2)
  assert.equal(receipt.preview[0].unique_buyers, 2)
  assert.equal(receipt.preview[0].buy_quote_raw, '9007199254740995')
})

test('marks a launch unobservable when a recorded disconnect gap overlaps its ten-second window', async t => {
  const root = await temporaryRoot(t)
  const runId = 'run-gap'
  const runRoot = join(root, 'runs', runId)
  await mkdir(join(runRoot, 'normalized'), { recursive: true })
  await mkdir(join(runRoot, 'raw'), { recursive: true })
  await writeFile(join(runRoot, 'manifest.json'), JSON.stringify({
    run_id: runId, status: 'stopped', started_at: '2026-01-01T00:00:00.000Z', stopped_at: '2026-01-01T00:01:00.000Z',
    stops_at: '2026-01-01T00:01:00.000Z', counts: { raw_records: 2 }
  }))
  await writeLines(join(runRoot, 'normalized', 'tokens.ndjson'), [])
  await writeLines(join(runRoot, 'normalized', 'trades.ndjson'), [])
  await writeLines(join(runRoot, 'normalized', 'reliability.ndjson'), [
    { kind: 'disconnected', status: 'gap', received_at: '2026-01-01T00:00:05.000Z' }
  ])
  await writeLines(join(runRoot, 'raw', 'pumpapi-live.ndjson'), [
    { event_id: 'create', source_at: '2026-01-01T00:00:00.000Z', received_at: '2026-01-01T00:00:00.000Z', payload_raw: JSON.stringify({ action: 'create', pool: 'pump', mint: 'GapMint' }) },
    { event_id: 'later', source_at: '2026-01-01T00:00:20.000Z', received_at: '2026-01-01T00:00:20.000Z', payload_raw: JSON.stringify({ action: 'transfer', mint: 'GapMint' }) }
  ])
  const receipt = await analyzeTenSecondBuyActivity({
    dataRoot: root,
    batch: { schema: 'pump.collection-batch/1', batch_id: 'gap-batch', label: 'Gap batch', run_ids: [runId] }
  })
  const saved = JSON.parse(await readFile(receipt.full_result_path, 'utf8'))
  assert.equal(saved.rows[0].observation_status, 'unobservable')
  assert.deepEqual(saved.rows[0].unobservable_reasons, ['stream_gap'])
})
