import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-agent'
import { PumpObserverService, type PumpObserverServiceOptions } from './service.js'
import { PumpObserverRuntime, type RuntimeRequest } from './runtime.js'
import type { ObserverRun, PumpObserverAction, PumpObserverResult } from './types.js'

export * from './derived/index.js'
export * from './enrichment/index.js'
export * from './pumpapi/index.js'
export * from './recorder.js'
export * from './replay/index.js'
export * from './runtime.js'
export * from './service.js'
export * from './storage/index.js'
export * from './types.js'

export const name = 'pump-observer'

export interface PumpObserverPluginOptions {
  readonly service?: PumpObserverServiceOptions
  readonly dataRoot?: string
  readonly enrichment?: boolean
  readonly connectTimeoutMs?: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    pumpObserver: PumpObserverService | PumpObserverRuntime
  }
}

function result(action: PumpObserverAction, text: string, run?: ObserverRun, remainingMs?: number): PumpObserverResult {
  return {
    ok: true,
    action,
    text,
    ...(run === undefined ? {} : { runId: run.id, status: run.status }),
    ...(remainingMs === undefined ? {} : { remainingMs }),
  }
}

function parsePage(value: number | undefined): number {
  if (value === undefined) return 1
  if (!Number.isInteger(value) || value < 1) throw new Error('page must be a positive integer')
  return value
}

function formatRemaining(milliseconds: number | undefined): string {
  if (milliseconds === undefined) return 'none'
  return `${Math.ceil(milliseconds / 1000)}s`
}

function completionText(run: ObserverRun): string {
  return `${run.label} completed. Run ID: ${run.id}. Coins: ${run.coinCount}. Events: ${run.eventCount}. Ask to show run ${run.id}.`
}

function completionMessage(run: ObserverRun) {
  const text = completionText(run)
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: name, form: 'notice', summary: `${run.label} completed` },
  })
}

function deliverCompletion(ctx: Context, sessionId: SessionId, run: ObserverRun): void {
  const registry = ctx.get('agents')
  const agent = registry?.get(sessionId)
  if (agent === undefined) return
  const message = completionMessage(run)
  if (agent.status === 'idle') agent.followup(message)
  else agent.inject(message)
}

function deliverRuntimeCompletion(ctx: Context, sessionId: SessionId, text: string): void {
  const agent = ctx.get('agents')?.get(sessionId)
  if (agent === undefined) return
  const message = createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: name, form: 'notice', summary: 'Pump observation run completed' },
  })
  if (agent.status === 'idle') agent.followup(message)
  else agent.inject(message)
}

function dispatch(
  service: PumpObserverService,
  request: {
    action: PumpObserverAction
    durationMinutes?: number
    runId?: string
    coin?: string
    page?: number
  },
  agent?: Agent,
): PumpObserverResult {
  switch (request.action) {
    case 'start': {
      if (agent === undefined) throw new Error('start requires a calling session')
      if (request.durationMinutes === undefined) throw new Error('start requires duration_minutes equal to 5 or 10')
      const run = service.start(agent.session.id, request.durationMinutes)
      return result('start', `${run.label} started and will end at ${new Date(run.stopsAt).toISOString()}.`, run, run.stopsAt - run.startedAt)
    }
    case 'status': {
      const status = service.status()
      return result('status', status.run === undefined
        ? 'Pump observer is stopped.'
        : `${status.run.label} is running; remaining ${formatRemaining(status.remainingMs)}.`, status.run, status.remainingMs)
    }
    case 'stop': {
      const run = service.stop()
      return result('stop', `${run.label} stopped early and was preserved.`, run, 0)
    }
    case 'list_runs': {
      const page = parsePage(request.page)
      const runs = service.listRuns()
      const pageSize = 20
      const selected = runs.slice((page - 1) * pageSize, page * pageSize)
      const text = selected.length === 0
        ? `No runs on page ${page}.`
        : selected.map(run => `${run.id} | ${run.label} | ${run.status}`).join('\n')
      return result('list_runs', text)
    }
    case 'get_run': {
      if (request.runId === undefined) throw new Error('get_run requires run_id')
      const run = service.getRun(request.runId)
      if (run === undefined) throw new Error(`unknown run: ${request.runId}`)
      return result('get_run', `${run.label} | ${run.status} | coins ${run.coinCount} | events ${run.eventCount}`, run)
    }
    case 'get_coin': {
      if (request.runId === undefined || request.coin === undefined) throw new Error('get_coin requires run_id and coin')
      return service.getCoin(request.runId, request.coin)
    }
  }
}

function parseCommand(input: string): {
  action: PumpObserverAction
  durationMinutes?: number
  runId?: string
  coin?: string
} {
  const parts = input.trim().split(/\s+/u).filter(Boolean)
  const verb = parts[0] ?? 'status'
  if (verb === 'start') return { action: 'start', durationMinutes: Number(parts[1]) }
  if (verb === 'status') return { action: 'status' }
  if (verb === 'stop') return { action: 'stop' }
  if (verb === 'runs') return { action: 'list_runs' }
  if (verb === 'run') {
    const runId = parts[1]
    if (runId === undefined) throw new Error('run requires a run ID')
    return { action: 'get_run', runId }
  }
  if (verb === 'coin') {
    const runId = parts[1]
    const coin = parts[2]
    if (runId === undefined || coin === undefined) throw new Error('coin requires a run ID and mint')
    return { action: 'get_coin', runId, coin }
  }
  throw new Error('usage: /pump start <5|10> | status | stop | runs | run <run-id> | coin <run-id> <mint>')
}

export async function apply(ctx: Context, options: PumpObserverPluginOptions = {}): Promise<void> {
  const runtime = options.dataRoot === undefined ? undefined : new PumpObserverRuntime(options.dataRoot, {
    ...(options.enrichment === undefined ? {} : { enrichment: options.enrichment }),
    ...(options.connectTimeoutMs === undefined ? {} : { connectTimeoutMs: options.connectTimeoutMs }),
    onComplete: (sessionId, _manifest, text) => deliverRuntimeCompletion(ctx, sessionId, text),
  })
  if (runtime !== undefined) await runtime.init()
  let service!: PumpObserverService
  service = new PumpObserverService({
    ...options.service,
    onTimerComplete: async run => {
      await options.service?.onTimerComplete?.(run)
      deliverCompletion(ctx, run.ownerSessionId, run)
    },
  })
  const control = runtime ?? service
  ctx.provide('pumpObserver', control)
  ctx.effect(() => async () => {
    if (runtime !== undefined) await runtime.dispose()
    else service.dispose()
  }, name)

  const execute = async (request: RuntimeRequest, agent?: Agent): Promise<PumpObserverResult> => runtime === undefined
    ? dispatch(service, request, agent)
    : runtime.execute(request, agent?.session.id)

  ctx.inject(['tools'], toolCtx => {
    toolCtx.tools.register(defineTool({
      name: 'pump_observer',
      description: 'Start, inspect, stop, or retrieve one on-demand Pump.fun observation run. Use one overall duration of exactly 5 or 10 minutes.',
      parameters: {
        action: {
          type: 'string',
          required: true,
          enum: ['start', 'status', 'stop', 'list_runs', 'get_run', 'get_coin'],
          description: 'Operation to perform.',
        },
        duration_minutes: { type: 'number', description: 'Required for start; exactly 5 or 10.' },
        run_id: { type: 'string', description: 'Required for get_run/get_coin.' },
        coin: { type: 'string', description: 'Mint or symbol for get_coin.' },
        page: { type: 'number', description: 'Positive one-based page for list/retrieval actions.' },
        view: { type: 'string', enum: ['summary', 'coins', 'raw'], description: 'get_run view; defaults to summary.' },
        stream: { type: 'string', description: 'Raw stream name when get_run view is raw.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            action: { type: 'string', required: true },
            text: { type: 'string', required: true },
            runId: { type: 'string' },
            status: { type: 'string' },
            remainingMs: { type: 'number' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: String((value as { text?: unknown }).text ?? '') }],
      },
      execute: async (args, exec) => execute({
        action: args.action as PumpObserverAction,
        ...(args.duration_minutes === undefined ? {} : { durationMinutes: args.duration_minutes }),
        ...(args.run_id === undefined ? {} : { runId: args.run_id }),
        ...(args.coin === undefined ? {} : { coin: args.coin }),
        ...(args.page === undefined ? {} : { page: args.page }),
        ...(args.view === undefined ? {} : { view: args.view as NonNullable<RuntimeRequest['view']> }),
        ...(args.stream === undefined ? {} : { stream: args.stream }),
      }, exec.agent),
    }))
  })

  ctx.inject(['commands'], commandCtx => {
    commandCtx.commands.register({
      name: 'pump',
      description: 'Control or inspect the Pump.fun observer',
      input: { hint: 'start <5|10> | status | stop | runs | run <id> | coin <run-id> <mint>' },
      handler: async ({ agent, rawInput }) => {
        try {
          return { kind: 'success', text: (await execute(parseCommand(rawInput), agent)).text }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })
  })
}

export default apply
