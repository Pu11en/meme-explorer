import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { PumpObserverRuntime, RunStore } from '../lib/index.js'

async function temporaryRoot(t) {
  const root = await mkdtemp(join(os.tmpdir(), 'pump-runtime-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('durable runtime paginates runs, coins, and bounded raw retrieval across restart', async t => {
  const root = await temporaryRoot(t)
  let now = Date.parse('2026-08-27T00:00:00.000Z')
  const store = new RunStore(root, { now: () => now })
  const special = await store.createRun(5)
  const raw = await special.appendRaw({
    stream: 'pumpapi-live', source: 'fixture', transport: 'live', channel: 'events',
    payload: Buffer.from(JSON.stringify({ payload: 'x'.repeat(3_000) })), receivedAt: new Date(now).toISOString(),
  })
  await special.appendNormalized('tokens', {
    schema: 'pump.token/1', dataset_version: '1.0.0', run_id: special.manifest.run_id,
    source: 'fixture', received_at: new Date(now).toISOString(), raw_seq: raw.seq,
    mint: 'MintInspect', symbol: 'INSP', name: 'Inspectable', first_seen_at: new Date(now).toISOString(),
  })
  await special.appendNormalized('events', {
    schema: 'pump.event/1', dataset_version: '1.0.0', run_id: special.manifest.run_id,
    source: 'fixture', received_at: new Date(now).toISOString(), raw_seq: raw.seq,
    mint: 'MintInspect', action: 'create', event_key: 'inspect:0:create',
  })
  now += 300_000
  await special.finalize('timer_expired')
  for (let index = 0; index < 20; index += 1) {
    now += 1_000
    const run = await store.createRun(index % 2 === 0 ? 5 : 10)
    now += run.manifest.duration_ms
    await run.finalize('timer_expired')
  }
  await store.close()

  const runtime = new PumpObserverRuntime(root, { now: () => now, enrichment: false })
  await runtime.init()
  const firstPage = JSON.parse((await runtime.execute({ action: 'list_runs', page: 1 })).text)
  assert.equal(firstPage.page_size, 20)
  assert.equal(firstPage.total_runs, 21)
  assert.equal(firstPage.runs.length, 20)
  assert.equal(firstPage.has_more, true)
  const secondPage = JSON.parse((await runtime.execute({ action: 'list_runs', page: 2 })).text)
  assert.equal(secondPage.runs.length, 1)
  assert.equal(secondPage.has_more, false)

  const summary = JSON.parse((await runtime.execute({ action: 'get_run', runId: special.manifest.run_id })).text)
  assert.equal(summary.run_id, special.manifest.run_id)
  assert.equal(summary.dataset_version, '1.0.0')
  const coins = JSON.parse((await runtime.execute({ action: 'get_run', runId: special.manifest.run_id, view: 'coins' })).text)
  assert.equal(coins.total_coins, 1)
  assert.equal(coins.coins[0].mint, 'MintInspect')
  const coin = JSON.parse((await runtime.execute({ action: 'get_coin', runId: special.manifest.run_id, coin: 'insp' })).text)
  assert.equal(coin.total_records, 1)
  assert.equal(coin.records[0].family, 'tokens')
  const rawPage = JSON.parse((await runtime.execute({
    action: 'get_run', runId: special.manifest.run_id, view: 'raw', stream: 'pumpapi-live', page: 1,
  })).text)
  assert.equal(rawPage.page_size, 10)
  assert.equal(rawPage.records[0].payload_truncated_for_session, true)
  assert.ok(rawPage.records[0].payload_raw.length < 2_100)
  await assert.rejects(() => runtime.execute({ action: 'get_run', runId: special.manifest.run_id, view: 'raw', stream: 'not-a-stream' }), /unknown raw stream/u)
  await runtime.dispose()

  const reopened = new PumpObserverRuntime(root, { now: () => now, enrichment: false })
  await reopened.init()
  const persisted = JSON.parse((await reopened.execute({ action: 'list_runs', page: 2 })).text)
  assert.equal(persisted.runs[0].run_id, special.manifest.run_id)
  assert.equal((await reopened.execute({ action: 'status' })).text, 'Pump observer is stopped.')
  await reopened.dispose()
})
