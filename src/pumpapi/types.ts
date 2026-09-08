import type { LosslessJson } from './lossless-json.js'

export interface PumpApiFrame {
  readonly bytes: Uint8Array
  readonly receivedAt: string
  readonly receivedMonoMs: number | null
}

export interface PumpApiReliabilityEvent {
  readonly kind: 'connected' | 'disconnected' | 'socket_error' | 'reconnect_scheduled'
  readonly at: string
  readonly attempt: number
  readonly detail: Record<string, unknown>
}

export interface PumpApiHandlers {
  readonly onFrame: (frame: PumpApiFrame) => void | Promise<void>
  readonly onReliability?: (event: PumpApiReliabilityEvent) => void | Promise<void>
}

export interface PumpApiMessageEvent {
  readonly data: string | ArrayBuffer | Blob | ArrayBufferView
}

export interface PumpApiCloseEvent {
  readonly code?: number
  readonly reason?: string
  readonly wasClean?: boolean
}

export interface PumpApiSocket {
  binaryType: string
  readonly readyState: number
  addEventListener(type: 'open', listener: () => void, options?: { once?: boolean }): void
  addEventListener(type: 'message', listener: (event: PumpApiMessageEvent) => void): void
  addEventListener(type: 'error', listener: (event: unknown) => void): void
  addEventListener(type: 'close', listener: (event: PumpApiCloseEvent) => void, options?: { once?: boolean }): void
  close(code?: number, reason?: string): void
}

export type PumpApiSocketFactory = (url: string) => PumpApiSocket

export interface PumpApiObject {
  readonly [key: string]: LosslessJson
}

export interface PumpApiNormalizedGroup {
  readonly action: string
  readonly eventKey: string
  readonly mint: string | null
  readonly sourceAt: string | null
  readonly event: Record<string, unknown>
  readonly specialized: readonly {
    readonly family: 'tokens' | 'trades' | 'wallets' | 'curves' | 'migrations'
    readonly dedupKey: string
    readonly record: Record<string, unknown>
  }[]
}
