import assert from 'node:assert/strict'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import apply from '../lib/index.js'

class ManualScheduler {
  nowValue = Date.parse('2026-08-26T12:00:00.000Z')
  tasks = []

  now() { return this.nowValue }

  schedule(delayMs, callback) {
    const task = { at: this.nowValue + delayMs, callback, cancelled: false }
    this.tasks.push(task)
    return { cancel: () => { task.cancelled = true } }
  }

  advance(ms) {
    this.nowValue += ms
    for (const task of this.tasks.filter(item => !item.cancelled && item.at <= this.nowValue)) {
      task.cancelled = true
      task.callback()
    }
  }
}

async function fixture(options) {
  const ctx = new Context()
  let tool
  let command
  const agents = new Map()
  ctx.provide('agents', { get: id => agents.get(id) })
  ctx.provide('tools', { register: definition => { tool = definition; return () => {} } })
  ctx.provide('commands', { register: definition => { command = definition; return () => {} } })
  await ctx.plugin(apply, options)
  return { ctx, agents, get tool() { return tool }, get command() { return command } }
}

function fakeAgent(id = 'session-plugin') {
  const notices = []
  return {
    session: { id },
    status: 'idle',
    notices,
    followup: message => { notices.push({ kind: 'followup', message }) },
    inject: message => { notices.push({ kind: 'inject', message }) },
  }
}

test('composition registers one cohesive tool and optional command', async () => {
  const f = await fixture()
  assert.equal(f.tool.name, 'pump_observer')
  assert.equal(f.command.name, 'pump')
  assert.deepEqual(f.tool.parameters.properties.action.enum, ['start', 'status', 'stop', 'list_runs', 'get_run', 'get_coin'])
})

test('tool and command operate on the same singleton service', async () => {
  const f = await fixture()
  const agent = fakeAgent()
  f.agents.set(agent.session.id, agent)
  const execution = { agent, signal: new AbortController().signal }

  const started = await f.tool.execute({ action: 'start', duration_minutes: 5 }, execution)
  assert.equal(started.action, 'start')
  assert.match(started.runId, /^run-0001-/u)

  const status = await f.tool.execute({ action: 'status' }, execution)
  assert.equal(status.status, 'running')

  const duplicate = await f.command.handler({ agent, rawInput: 'start 10', attachments: [], signal: execution.signal })
  assert.equal(duplicate.kind, 'error')
  assert.match(duplicate.text, /already active/u)

  const stopped = await f.command.handler({ agent, rawInput: 'stop', attachments: [], signal: execution.signal })
  assert.equal(stopped.kind, 'success')
  assert.match(stopped.text, /stopped early/u)

  const runs = await f.tool.execute({ action: 'list_runs', page: 1 }, execution)
  assert.match(runs.text, /run-0001-/u)
})

test('start requires a calling session and exact duration', async () => {
  const f = await fixture()
  await assert.rejects(() => f.tool.execute({ action: 'start', duration_minutes: 5 }, { signal: new AbortController().signal }), /calling session/u)
  const agent = fakeAgent()
  await assert.rejects(() => f.tool.execute({ action: 'start', duration_minutes: 7 }, { agent, signal: new AbortController().signal }), /exactly 5 or 10/u)
})

test('timer completion follows up an idle initiating session', async () => {
  const scheduler = new ManualScheduler()
  const f = await fixture({ service: { scheduler } })
  const agent = fakeAgent('session-idle')
  f.agents.set(agent.session.id, agent)

  const started = await f.tool.execute(
    { action: 'start', duration_minutes: 5 },
    { agent, signal: new AbortController().signal },
  )
  scheduler.advance(300_000)
  await Promise.resolve()

  assert.equal(agent.notices.length, 1)
  assert.equal(agent.notices[0].kind, 'followup')
  assert.equal(agent.notices[0].message.source.plugin, 'pump-observer')
  assert.match(agent.notices[0].message.content[0].text, new RegExp(started.runId, 'u'))
})

test('timer completion injects for a busy session and tolerates a missing session', async () => {
  const busyScheduler = new ManualScheduler()
  const busyFixture = await fixture({ service: { scheduler: busyScheduler } })
  const busyAgent = fakeAgent('session-busy')
  busyAgent.status = 'running'
  busyFixture.agents.set(busyAgent.session.id, busyAgent)
  await busyFixture.tool.execute(
    { action: 'start', duration_minutes: 5 },
    { agent: busyAgent, signal: new AbortController().signal },
  )
  busyScheduler.advance(300_000)
  await Promise.resolve()
  assert.equal(busyAgent.notices[0].kind, 'inject')

  const missingScheduler = new ManualScheduler()
  const missingFixture = await fixture({ service: { scheduler: missingScheduler } })
  const missingAgent = fakeAgent('session-gone')
  const started = await missingFixture.tool.execute(
    { action: 'start', duration_minutes: 5 },
    { agent: missingAgent, signal: new AbortController().signal },
  )
  missingScheduler.advance(300_000)
  await Promise.resolve()
  const run = await missingFixture.tool.execute(
    { action: 'get_run', run_id: started.runId },
    { agent: missingAgent, signal: new AbortController().signal },
  )
  assert.equal(run.status, 'stopped')
})
