import type { SessionId } from '@deepseek-ai/dsh-session'

export const RUN_DURATIONS_MINUTES = [5, 10] as const
export type RunDurationMinutes = typeof RUN_DURATIONS_MINUTES[number]

export type ObserverState = 'stopped' | 'starting' | 'running' | 'stopping'
export type RunStatus = 'running' | 'stopped' | 'interrupted' | 'error'
export type StopReason = 'timer_expired' | 'manual_early' | 'interrupted' | 'error'

export interface ObserverRun {
  readonly id: string
  readonly label: string
  readonly sequence: number
  readonly ownerSessionId: SessionId
  readonly durationMinutes: RunDurationMinutes
  readonly startedAt: number
  readonly stopsAt: number
  readonly stoppedAt?: number
  readonly status: RunStatus
  readonly stopReason?: StopReason
  readonly eventCount: number
  readonly coinCount: number
}

export interface ObserverStatus {
  readonly state: ObserverState
  readonly run: ObserverRun | undefined
  readonly remainingMs: number | undefined
}

export type PumpObserverAction = 'start' | 'status' | 'stop' | 'list_runs' | 'get_run' | 'get_coin'

export interface PumpObserverRequest {
  readonly action: PumpObserverAction
  readonly durationMinutes?: RunDurationMinutes
  readonly runId?: string
  readonly coin?: string
  readonly page?: number
}

export interface PumpObserverResult {
  readonly ok: boolean
  readonly action: PumpObserverAction
  readonly text: string
  readonly runId?: string
  readonly status?: string
  readonly remainingMs?: number
}
