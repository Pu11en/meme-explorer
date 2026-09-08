import assert from 'node:assert/strict'
import test from 'node:test'
import { PumpObserverService } from '../lib/service.js'

class ManualScheduler {
  nowValue = Date.parse('2026-08-26T12:00:00.000Z')
  tasks = []

  now() {
    return this.nowValue
  }

  schedule(delayMs, callback) {
    const task = { at: this.nowValue + delayMs, callback, cancelled: false }
    this.tasks.push(task)
    return { cancel: () => { task.cancelled = true } }
  }

  advance(ms) {
    this.nowValue += ms
    const ready = this.tasks.filter(task => !task.cancelled && task.at <= this.nowValue)
    for (const task of ready) {
      task.cancelled = true
      task.callback()
    }
  }
}

const sessionId = 'session-test'

test('one overall timer finalizes a five-minute run', async () => {
  const scheduler = new ManualScheduler()
  const completed = []
  const service = new PumpObserverService({
    scheduler,
    onTimerComplete: run => { completed.push(run) },
  })

  const run = service.start(sessionId, 5)
  assert.equal(service.state, 'running')
  assert.equal(run.durationMinutes, 5)
  assert.equal(service.status().remainingMs, 300_000)
  assert.throws(() => service.start(sessionId, 10), /run already active/u)

  scheduler.advance(299_000)
  assert.equal(service.state, 'running')
  scheduler.advance(1_000)
  await Promise.resolve()

  assert.equal(service.state, 'stopped')
  assert.equal(service.activeRun, undefined)
  assert.equal(completed.length, 1)
  assert.equal(completed[0].stopReason, 'timer_expired')
  assert.equal(service.listRuns()[0].status, 'stopped')
})

test('manual stop preserves a partial run', () => {
  const scheduler = new ManualScheduler()
  const service = new PumpObserverService({ scheduler })
  const started = service.start(sessionId, 10)
  scheduler.advance(180_000)
  const stopped = service.stop()

  assert.equal(stopped.id, started.id)
  assert.equal(stopped.stopReason, 'manual_early')
  assert.equal(stopped.stoppedAt - stopped.startedAt, 180_000)
  assert.equal(service.getRun(started.id)?.status, 'stopped')
  assert.throws(() => service.stop(), /no active run/u)
})

test('invalid durations and absent coin data fail explicitly', () => {
  const service = new PumpObserverService()
  assert.throws(() => service.start(sessionId, 7), /exactly 5 or 10/u)
  assert.throws(() => service.getCoin('missing', 'coin'), /unknown run/u)
})

test('dispose marks an active run interrupted', () => {
  const scheduler = new ManualScheduler()
  const service = new PumpObserverService({ scheduler })
  const run = service.start(sessionId, 5)
  service.dispose()
  assert.equal(service.getRun(run.id)?.status, 'interrupted')
  assert.equal(service.getRun(run.id)?.stopReason, 'interrupted')
})
