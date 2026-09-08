import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  parseLosslessJson,
  PumpApiLiveAdapter,
  PumpApiRunRecorder,
  RunStore,
  validateDatasetTree,
} from '../lib/index.js'

async function temporaryRoot(t) {
  const root = await mkdtemp(join(os.tmpdir(), 'pump-live-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

class FixtureAdapter {
  handlers
  starts = 0
  stops = 0
  events = []

  async start(handlers) {
    if (this.handlers) throw new Error('fixture adapter already active')
    this.handlers = handlers
    this.starts += 1
    this.events.push('socket-open')
  }

  async stop() {
    this.stops += 1
    this.events.push('socket-close')
    this.handlers = undefined
  }

  async emit(value, receivedAt) {
    const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(JSON.stringify(value))
    await this.handlers.onFrame({ bytes, receivedAt, receivedMonoMs: 1 })
  }

  async reliability(kind, at, detail = {}) {
    await this.handlers.onReliability?.({ kind, at, attempt: 1, detail })
  }
}

class ManualTimer {
  now
  tasks = []

  constructor(now) { this.now = now }

  schedule(delayMs, callback) {
    const task = { at: this.now + delayMs, callback, cancelled: false }
    this.tasks.push(task)
    return { cancel: () => { task.cancelled = true } }
  }

  async advance(ms) {
    this.now += ms
    for (const task of this.tasks.filter(item => !item.cancelled && item.at <= this.now)) {
      task.cancelled = true
      await task.callback()
    }
    await Promise.resolve()
  }
}

function lines(text) {
  return text.trim() === '' ? [] : text.trim().split('\n').map(line => JSON.parse(line))
}

async function readFamily(root, runId, family) {
  try {
    return lines(await readFile(join(root, 'runs', runId, 'normalized', `${family}.ndjson`), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

test('lossless parser preserves provider numeric tokens as exact strings', () => {
  const parsed = parseLosslessJson('{"integer":900719925474099312345,"decimal":0.000000000123,"exponent":1.234e+40,"boolean":true}')
  assert.equal(parsed.integer, '900719925474099312345')
  assert.equal(parsed.decimal, '0.000000000123')
  assert.equal(parsed.exponent, '1.234e+40')
  assert.equal(parsed.boolean, true)
  assert.throws(() => parseLosslessJson('{"bad":01}'), /expected comma|invalid|trailing/u)
})

test('fixture stream captures all action classes, preserves duplicates raw, and deduplicates normalized events', async t => {
  const root = await temporaryRoot(t)
  const start = Date.parse('2026-08-26T12:00:00.000Z')
  let now = start
  const store = new RunStore(root, { now: () => now, flushPolicy: { max_records: 4, max_delay_ms: 250 } })
  const run = await store.createRun(10)
  const adapter = new FixtureAdapter()
  const timer = new ManualTimer(start)
  const recorder = new PumpApiRunRecorder({ adapter, now: () => timer.now, schedule: (delay, callback) => timer.schedule(delay, callback) })
  const order = adapter.events
  const originalFinalize = run.finalize.bind(run)
  run.finalize = async (...args) => {
    order.push('manifest-finalize')
    return originalFinalize(...args)
  }
  await recorder.start(run)
  await assert.rejects(() => recorder.start(run), /active run/u)
  assert.equal(adapter.starts, 1)

  const create = {
    signature: 'sig-create', timestamp: '2026-08-26T12:00:01.000Z', action: 'create',
    mint: 'Mint111', signer: 'Signer1', creator: 'Creator1', name: 'One', symbol: 'ONE', uri: 'ipfs://one',
    supply: 900719925474099312345n.toString(), virtualTokenReserves: '1000', virtualSolReserves: '20',
  }
  const buyBreakdown = {
    signature: 'sig-buy', timestamp: '2026-08-26T12:00:02.000Z', mint: 'Mint111', signer: 'Buyer1',
    events: [
      { action: 'buy', tokenAmount: '100', quoteAmount: '1', price: '0.01' },
      { action: 'buy', tokenAmount: '200', quoteAmount: '2', price: '0.01' },
    ],
  }
  const fixtures = [
    create,
    buyBreakdown,
    { signature: 'sig-sell', timestamp: '2026-08-26T12:00:03.000Z', action: 'sell', mint: 'Mint111', signer: 'Seller1', tokenAmount: '50', quoteAmount: '1' },
    { signature: 'sig-transfer', timestamp: '2026-08-26T12:00:04.000Z', action: 'transfer', mint: 'Mint111', from: 'A', to: 'B' },
    { signature: 'sig-migrate', timestamp: '2026-08-26T12:00:05.000Z', action: 'migrate', mint: 'Mint111', poolId: 'Pool1' },
    { signature: 'sig-pool', timestamp: '2026-08-26T12:00:06.000Z', action: 'createPool', mint: 'Mint111', poolId: 'Pool1' },
    { signature: 'sig-add', timestamp: '2026-08-26T12:00:07.000Z', action: 'add', mint: 'Mint111', poolId: 'Pool1', realTokenReserves: '500', realSolReserves: '10' },
    { signature: 'sig-remove', timestamp: '2026-08-26T12:00:08.000Z', action: 'remove', mint: 'Mint111', poolId: 'Pool1', realTokenReserves: '400', realSolReserves: '8' },
    { signature: 'sig-claim', timestamp: '2026-08-26T12:00:09.000Z', action: 'creatorFeeClaim', mint: 'Mint111', creatorFeeAddress: 'CreatorFee1' },
    { signature: 'sig-unknown', timestamp: '2026-08-26T12:00:10.000Z', action: 'newFutureAction', mint: 'Mint111', unknownField: 'kept-raw' },
    buyBreakdown,
  ]
  for (const fixture of fixtures) await adapter.emit(fixture, '2026-08-26T12:00:11.000Z')
  await adapter.reliability('disconnected', '2026-08-26T12:00:12.000Z', { code: 1006 })
  now += 60_000
  const manifest = await recorder.stop('manual_early')
  assert.equal(manifest.status, 'stopped')
  assert.equal(manifest.stop_reason, 'manual_early')
  assert.deepEqual(order.slice(-2), ['socket-close', 'manifest-finalize'])

  const raw = await store.readRaw(run.manifest.run_id, 'pumpapi-live')
  assert.equal(raw.length, 11)
  assert.match(raw.at(-1).payload_raw, /"events"/u)
  const events = await readFamily(root, run.manifest.run_id, 'events')
  assert.equal(events.length, 11)
  assert.deepEqual(new Set(events.map(item => item.action)), new Set([
    'create', 'buy', 'sell', 'transfer', 'migrate', 'create_pool', 'add_liquidity',
    'remove_liquidity', 'creator_fee_claim', 'newFutureAction',
  ]))
  assert.equal(events.filter(item => item.signature === 'sig-buy').length, 2)
  assert.deepEqual(events.filter(item => item.signature === 'sig-buy').map(item => item.breakdown_index), [0, 1])
  const trades = await readFamily(root, run.manifest.run_id, 'trades')
  assert.equal(trades.length, 3)
  assert.deepEqual(trades.filter(item => item.signature === 'sig-buy').map(item => item.token_amount_raw), ['100', '200'])
  const migrations = await readFamily(root, run.manifest.run_id, 'migrations')
  assert.equal(migrations.length, 2)
  const reliability = await readFamily(root, run.manifest.run_id, 'reliability')
  assert.ok(reliability.some(item => item.kind === 'dedup'))
  assert.ok(reliability.some(item => item.kind === 'disconnected'))
  assert.deepEqual(await validateDatasetTree(root), {
    runs: 1,
    raw_records: 11,
    normalized_records: manifest.counts.normalized_records,
    blobs: 0,
  })
  await store.close()
})

test('one overall ten-minute window gives a minute-eight launch only two minutes and rejects the stop boundary', async t => {
  const root = await temporaryRoot(t)
  const start = Date.parse('2026-08-26T13:00:00.000Z')
  const timer = new ManualTimer(start)
  const store = new RunStore(root, { now: () => timer.now })
  const run = await store.createRun(10)
  const adapter = new FixtureAdapter()
  const completed = Promise.withResolvers()
  const recorder = new PumpApiRunRecorder({
    adapter,
    now: () => timer.now,
    schedule: (delay, callback) => timer.schedule(delay, callback),
    onComplete: manifest => { completed.resolve(manifest) },
  })
  await recorder.start(run)
  await adapter.emit({ signature: 'launch', timestamp: '2026-08-26T13:08:00.000Z', action: 'create', mint: 'MintLate' }, '2026-08-26T13:08:00.100Z')
  await adapter.emit({ signature: 'last-trade', timestamp: '2026-08-26T13:09:59.999Z', action: 'buy', mint: 'MintLate', tokenAmount: '1', quoteAmount: '1' }, '2026-08-26T13:09:59.999Z')
  await adapter.emit({ signature: 'too-late', timestamp: '2026-08-26T13:10:00.000Z', action: 'buy', mint: 'MintLate', tokenAmount: '2', quoteAmount: '2' }, '2026-08-26T13:10:00.000Z')
  await timer.advance(600_000)
  const completion = await completed.promise
  assert.equal(completion.stop_reason, 'timer_expired')
  const raw = await store.readRaw(run.manifest.run_id, 'pumpapi-live')
  assert.deepEqual(raw.map(item => item.event_id), ['launch', 'last-trade'])
  const events = await readFamily(root, run.manifest.run_id, 'events')
  assert.deepEqual(events.map(item => item.signature), ['launch', 'last-trade'])
  assert.equal(adapter.stops, 1)
  await store.close()
})

test('decode failures preserve raw bytes and record explicit reliability state', async t => {
  const root = await temporaryRoot(t)
  const start = Date.parse('2026-08-26T14:00:00.000Z')
  const store = new RunStore(root, { now: () => start })
  const run = await store.createRun(5)
  const adapter = new FixtureAdapter()
  const recorder = new PumpApiRunRecorder({ adapter, now: () => start })
  await recorder.start(run)
  await adapter.emit('{"broken":', '2026-08-26T14:00:01.000Z')
  await recorder.stop('manual_early')
  const raw = await store.readRaw(run.manifest.run_id, 'pumpapi-live')
  assert.equal(raw[0].payload_raw, '{"broken":')
  const reliability = await readFamily(root, run.manifest.run_id, 'reliability')
  assert.equal(reliability[0].kind, 'decode_error')
  assert.equal(reliability[0].status, 'decode_error')
  await store.close()
})

class FakeSocket {
  readyState = 0
  binaryType = 'blob'
  listeners = new Map()

  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  emit(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  open() {
    this.readyState = 1
    this.emit('open')
  }

  serverClose(code = 1006) {
    this.readyState = 3
    this.emit('close', { code, reason: 'fixture', wasClean: false })
  }

  close() {
    this.readyState = 3
    this.emit('close', { code: 1000, reason: 'client', wasClean: true })
  }
}

test('live adapter owns one socket and reconnects only after close', async () => {
  const sockets = []
  const scheduled = []
  const reliability = []
  const adapter = new PumpApiLiveAdapter({
    socketFactory: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
    schedule: (delay, callback) => {
      const task = { delay, callback, cancelled: false }
      scheduled.push(task)
      return { cancel: () => { task.cancelled = true } }
    },
  })
  const starting = adapter.start({ onFrame: () => {}, onReliability: event => { reliability.push(event) } })
  assert.equal(sockets.length, 1)
  await assert.rejects(() => adapter.start({ onFrame: () => {} }), /already owns/u)
  sockets[0].open()
  await starting
  sockets[0].serverClose()
  await Promise.resolve()
  assert.equal(sockets.length, 1)
  assert.equal(scheduled.length, 1)
  scheduled[0].callback()
  assert.equal(sockets.length, 2)
  sockets[1].open()
  await adapter.stop()
  assert.ok(reliability.some(event => event.kind === 'disconnected'))
  assert.ok(reliability.some(event => event.kind === 'reconnect_scheduled'))
})
