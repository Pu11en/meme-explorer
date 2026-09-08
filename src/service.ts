import type { SessionId } from '@deepseek-ai/dsh-session'
import type {
  ObserverRun,
  ObserverState,
  ObserverStatus,
  RunDurationMinutes,
  StopReason,
} from './types.js'

export interface ScheduledHandle {
  cancel(): void
}

export interface ObserverScheduler {
  now(): number
  schedule(delayMs: number, callback: () => void): ScheduledHandle
}

export interface PumpObserverServiceOptions {
  readonly scheduler?: ObserverScheduler
  readonly onTimerComplete?: (run: ObserverRun) => void | Promise<void>
}

const systemScheduler: ObserverScheduler = {
  now: () => Date.now(),
  schedule: (delayMs, callback) => {
    const timer = setTimeout(callback, delayMs)
    return { cancel: () => clearTimeout(timer) }
  },
}

function assertDuration(value: number): asserts value is RunDurationMinutes {
  if (value !== 5 && value !== 10) {
    throw new Error('duration_minutes must be exactly 5 or 10')
  }
}

function runLabel(sequence: number, startedAt: number, durationMinutes: number): string {
  const sequenceLabel = String(sequence).padStart(3, '0')
  return `Run ${sequenceLabel} — ${new Date(startedAt).toISOString()} — ${durationMinutes} min`
}

export class PumpObserverService {
  private stateValue: ObserverState = 'stopped'
  private activeRunValue: ObserverRun | undefined
  private readonly runs: ObserverRun[] = []
  private timer: ScheduledHandle | undefined
  private nextSequence = 1
  private readonly scheduler: ObserverScheduler
  private readonly onTimerComplete: ((run: ObserverRun) => void | Promise<void>) | undefined

  constructor(options: PumpObserverServiceOptions = {}) {
    this.scheduler = options.scheduler ?? systemScheduler
    this.onTimerComplete = options.onTimerComplete
  }

  get state(): ObserverState {
    return this.stateValue
  }

  get activeRun(): ObserverRun | undefined {
    return this.activeRunValue
  }

  start(ownerSessionId: SessionId, durationMinutes: number): ObserverRun {
    assertDuration(durationMinutes)
    if (this.activeRunValue !== undefined) {
      throw new Error(`run already active: ${this.activeRunValue.label}`)
    }

    this.stateValue = 'starting'
    const startedAt = this.scheduler.now()
    const sequence = this.nextSequence++
    const run: ObserverRun = Object.freeze({
      id: `run-${String(sequence).padStart(4, '0')}-${new Date(startedAt).toISOString().replaceAll(/[-:]/g, '').replace('.000', '')}`,
      label: runLabel(sequence, startedAt, durationMinutes),
      sequence,
      ownerSessionId,
      durationMinutes,
      startedAt,
      stopsAt: startedAt + durationMinutes * 60_000,
      status: 'running',
      eventCount: 0,
      coinCount: 0,
    })
    this.activeRunValue = run
    this.runs.push(run)
    this.stateValue = 'running'
    this.timer = this.scheduler.schedule(durationMinutes * 60_000, () => {
      const completed = this.finalize('timer_expired')
      if (completed !== undefined && this.onTimerComplete !== undefined) {
        void Promise.resolve(this.onTimerComplete(completed)).catch(() => undefined)
      }
    })
    return run
  }

  status(): ObserverStatus {
    const run = this.activeRunValue
    return {
      state: this.stateValue,
      run,
      remainingMs: run === undefined ? undefined : Math.max(0, run.stopsAt - this.scheduler.now()),
    }
  }

  stop(): ObserverRun {
    const run = this.finalize('manual_early')
    if (run === undefined) throw new Error('no active run')
    return run
  }

  listRuns(): readonly ObserverRun[] {
    return [...this.runs].reverse()
  }

  getRun(id: string): ObserverRun | undefined {
    return this.runs.find(run => run.id === id)
  }

  getCoin(runId: string, coin: string): never {
    if (this.getRun(runId) === undefined) throw new Error(`unknown run: ${runId}`)
    throw new Error(`coin data is not available in E-001: ${coin}`)
  }

  dispose(): void {
    this.timer?.cancel()
    this.timer = undefined
    if (this.activeRunValue !== undefined) this.finalize('interrupted')
  }

  private finalize(reason: StopReason): ObserverRun | undefined {
    const active = this.activeRunValue
    if (active === undefined) return undefined
    this.stateValue = 'stopping'
    this.timer?.cancel()
    this.timer = undefined
    const stopped: ObserverRun = Object.freeze({
      ...active,
      stoppedAt: this.scheduler.now(),
      status: reason === 'interrupted' ? 'interrupted' : reason === 'error' ? 'error' : 'stopped',
      stopReason: reason,
    })
    const index = this.runs.findIndex(run => run.id === active.id)
    if (index >= 0) this.runs[index] = stopped
    this.activeRunValue = undefined
    this.stateValue = 'stopped'
    return stopped
  }
}
