import type {
  PumpApiFrame,
  PumpApiHandlers,
  PumpApiMessageEvent,
  PumpApiReliabilityEvent,
  PumpApiSocket,
  PumpApiSocketFactory,
} from './types.js'

export interface PumpApiLiveAdapterOptions {
  readonly endpoint?: string
  readonly socketFactory?: PumpApiSocketFactory
  readonly now?: () => number
  readonly monotonicNow?: () => number
  readonly reconnectBaseMs?: number
  readonly reconnectMaxMs?: number
  readonly schedule?: (delayMs: number, callback: () => void) => { cancel(): void }
}

const defaultSocketFactory: PumpApiSocketFactory = url => new WebSocket(url) as unknown as PumpApiSocket

async function messageBytes(event: PumpApiMessageEvent): Promise<Uint8Array> {
  if (typeof event.data === 'string') return Buffer.from(event.data, 'utf8')
  if (event.data instanceof ArrayBuffer) return new Uint8Array(event.data)
  if (ArrayBuffer.isView(event.data)) return new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
  return new Uint8Array(await event.data.arrayBuffer())
}

export class PumpApiLiveAdapter {
  private readonly endpoint: string
  private readonly socketFactory: PumpApiSocketFactory
  private readonly now: () => number
  private readonly monotonicNow: () => number
  private readonly reconnectBaseMs: number
  private readonly reconnectMaxMs: number
  private readonly schedule: NonNullable<PumpApiLiveAdapterOptions['schedule']>
  private socket: PumpApiSocket | undefined
  private reconnectHandle: { cancel(): void } | undefined
  private handlers: PumpApiHandlers | undefined
  private frameChain: Promise<void> = Promise.resolve()
  private stopping = false
  private attempt = 0
  private startMono = 0
  private opened: PromiseWithResolvers<void> | undefined

  constructor(options: PumpApiLiveAdapterOptions = {}) {
    this.endpoint = options.endpoint ?? 'wss://stream.pumpapi.io/'
    this.socketFactory = options.socketFactory ?? defaultSocketFactory
    this.now = options.now ?? (() => Date.now())
    this.monotonicNow = options.monotonicNow ?? (() => performance.now())
    this.reconnectBaseMs = options.reconnectBaseMs ?? 250
    this.reconnectMaxMs = options.reconnectMaxMs ?? 10_000
    this.schedule = options.schedule ?? ((delayMs, callback) => {
      const timer = setTimeout(callback, delayMs)
      timer.unref?.()
      return { cancel: () => clearTimeout(timer) }
    })
  }

  get active(): boolean {
    return this.handlers !== undefined && !this.stopping
  }

  async start(handlers: PumpApiHandlers): Promise<void> {
    if (this.handlers !== undefined) throw new Error('PumpAPI adapter already owns a socket')
    this.handlers = handlers
    this.stopping = false
    this.attempt = 0
    this.startMono = this.monotonicNow()
    this.opened = Promise.withResolvers<void>()
    this.connect()
    return this.opened.promise
  }

  async stop(): Promise<void> {
    if (this.handlers === undefined) return
    this.stopping = true
    this.reconnectHandle?.cancel()
    this.reconnectHandle = undefined
    const socket = this.socket
    this.socket = undefined
    if (socket !== undefined && socket.readyState < 2) socket.close(1000, 'run complete')
    await this.frameChain
    this.handlers = undefined
    this.opened?.reject(new Error('PumpAPI adapter stopped before opening'))
    this.opened = undefined
    this.stopping = false
  }

  private connect(): void {
    if (this.stopping || this.handlers === undefined) return
    if (this.socket !== undefined) throw new Error('PumpAPI adapter attempted a second simultaneous socket')
    const socket = this.socketFactory(this.endpoint)
    this.socket = socket
    socket.binaryType = 'arraybuffer'
    socket.addEventListener('open', () => {
      if (socket !== this.socket) return
      this.attempt = 0
      this.opened?.resolve()
      this.opened = undefined
      this.emitReliability({ kind: 'connected', at: new Date(this.now()).toISOString(), attempt: 0, detail: { endpoint: this.endpoint } })
    }, { once: true })
    socket.addEventListener('message', event => {
      if (socket !== this.socket || this.stopping || this.handlers === undefined) return
      this.frameChain = this.frameChain.then(async () => {
        const bytes = await messageBytes(event)
        const frame: PumpApiFrame = {
          bytes,
          receivedAt: new Date(this.now()).toISOString(),
          receivedMonoMs: Math.max(0, this.monotonicNow() - this.startMono),
        }
        await this.handlers?.onFrame(frame)
      })
    })
    socket.addEventListener('error', event => {
      if (socket !== this.socket) return
      this.emitReliability({
        kind: 'socket_error',
        at: new Date(this.now()).toISOString(),
        attempt: this.attempt,
        detail: { message: event instanceof Error ? event.message : String(event) },
      })
    })
    socket.addEventListener('close', event => {
      if (socket !== this.socket) return
      this.socket = undefined
      if (this.stopping || this.handlers === undefined) return
      this.emitReliability({
        kind: 'disconnected',
        at: new Date(this.now()).toISOString(),
        attempt: this.attempt,
        detail: { code: event.code ?? null, reason: event.reason ?? '', was_clean: event.wasClean ?? null },
      })
      this.attempt += 1
      const delayMs = Math.min(this.reconnectMaxMs, this.reconnectBaseMs * 2 ** Math.max(0, this.attempt - 1))
      this.emitReliability({
        kind: 'reconnect_scheduled',
        at: new Date(this.now()).toISOString(),
        attempt: this.attempt,
        detail: { delay_ms: delayMs },
      })
      this.reconnectHandle = this.schedule(delayMs, () => {
        this.reconnectHandle = undefined
        this.connect()
      })
    }, { once: true })
  }

  private emitReliability(event: PumpApiReliabilityEvent): void {
    const handler = this.handlers?.onReliability
    if (handler === undefined) return
    this.frameChain = this.frameChain.then(() => Promise.resolve(handler(event)))
  }
}
