import { parseLosslessJson } from './pumpapi/lossless-json.js'
import { normalizePumpApiEvent, pumpApiSourceTime } from './pumpapi/normalize.js'
import type { LosslessJson } from './pumpapi/lossless-json.js'
import type { PumpApiFrame, PumpApiHandlers, PumpApiObject, PumpApiReliabilityEvent } from './pumpapi/types.js'
import { PumpApiLiveAdapter } from './pumpapi/live-adapter.js'
import type { RunDataset } from './storage/run-store.js'
import type { DatasetStopReason, NormalizedFamily, NormalizedRecord, RunManifest } from './storage/types.js'

export interface RecorderTimer {
  cancel(): void
}

export interface PumpApiAdapter {
  start(handlers: PumpApiHandlers): Promise<void>
  stop(): Promise<void>
}

export interface RecorderEnrichment {
  scheduleMetadata(request: { mint: string; uri: string; sourceRawSeq?: number }): Promise<unknown>
  scheduleDexPair(request: { mint: string; pairAddress: string; sourceRawSeq?: number }): Promise<unknown>
  stop(): Promise<void>
}

export interface PumpApiRunRecorderOptions {
  readonly adapter?: PumpApiAdapter
  readonly enrichment?: RecorderEnrichment
  readonly now?: () => number
  readonly schedule?: (delayMs: number, callback: () => void) => RecorderTimer
  readonly onComplete?: (manifest: RunManifest) => void | Promise<void>
}

function object(value: LosslessJson): PumpApiObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function firstText(record: PumpApiObject, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  return null
}

function inWindow(sourceAt: string | null, receivedAt: string, startMs: number, stopMs: number): boolean {
  const selected = sourceAt ?? receivedAt
  const epoch = Date.parse(selected)
  return Number.isFinite(epoch) && epoch >= startMs && epoch < stopMs
}

export class PumpApiRunRecorder {
  private readonly adapter: PumpApiAdapter
  private readonly enrichment: RecorderEnrichment | undefined
  private readonly now: () => number
  private readonly schedule: NonNullable<PumpApiRunRecorderOptions['schedule']>
  private readonly onComplete: PumpApiRunRecorderOptions['onComplete']
  private dataset: RunDataset | undefined
  private timer: RecorderTimer | undefined
  private accepting = false
  private processing: Promise<void> = Promise.resolve()
  private failure: unknown
  private readonly trackedMints = new Set<string>()
  private readonly scheduledMetadata = new Set<string>()
  private readonly scheduledPairs = new Set<string>()

  constructor(options: PumpApiRunRecorderOptions = {}) {
    this.adapter = options.adapter ?? new PumpApiLiveAdapter()
    this.enrichment = options.enrichment
    this.now = options.now ?? (() => Date.now())
    this.schedule = options.schedule ?? ((delayMs, callback) => {
      const timer = setTimeout(callback, delayMs)
      timer.unref?.()
      return { cancel: () => clearTimeout(timer) }
    })
    this.onComplete = options.onComplete
  }

  get active(): boolean {
    return this.accepting
  }

  async start(dataset: RunDataset): Promise<void> {
    if (this.dataset !== undefined) throw new Error('recorder already has an active run')
    this.dataset = dataset
    this.accepting = true
    this.failure = undefined
    this.trackedMints.clear()
    this.scheduledMetadata.clear()
    this.scheduledPairs.clear()
    const stopMs = Date.parse(dataset.manifest.stops_at)
    const delayMs = Math.max(0, stopMs - this.now())
    this.timer = this.schedule(delayMs, () => {
      void this.stop('timer_expired').then(manifest => this.onComplete?.(manifest)).catch(error => {
        this.failure = error
      })
    })
    try {
      await this.adapter.start({
        onFrame: frame => this.acceptFrame(frame),
        onReliability: event => this.acceptReliability(event),
      })
    } catch (error) {
      this.timer?.cancel()
      this.timer = undefined
      this.accepting = false
      this.dataset = undefined
      throw error
    }
  }

  async stop(reason: DatasetStopReason): Promise<RunManifest> {
    const dataset = this.dataset
    if (dataset === undefined) throw new Error('recorder has no active run')
    this.accepting = false
    this.timer?.cancel()
    this.timer = undefined
    await this.adapter.stop()
    await this.processing
    await this.enrichment?.stop()
    const failure = this.failure
    this.dataset = undefined
    if (failure !== undefined) {
      return dataset.finalize('error', 'error')
    }
    return dataset.finalize(reason)
  }

  private acceptFrame(frame: PumpApiFrame): Promise<void> {
    if (!this.accepting || this.dataset === undefined) return Promise.resolve()
    const task = this.processing.then(() => this.processFrame(frame))
    this.processing = task.catch(error => { this.failure = error })
    return task
  }

  private acceptReliability(event: PumpApiReliabilityEvent): Promise<void> {
    if (!this.accepting || this.dataset === undefined || event.kind === 'connected') return Promise.resolve()
    const task = this.processing.then(() => this.writeReliability(event.kind, event.at, {
      attempt: event.attempt,
      ...event.detail,
    }))
    this.processing = task.catch(error => { this.failure = error })
    return task
  }

  private async processFrame(frame: PumpApiFrame): Promise<void> {
    const dataset = this.dataset
    if (!this.accepting || dataset === undefined) return
    const startMs = Date.parse(dataset.manifest.started_at)
    const stopMs = Date.parse(dataset.manifest.stops_at)
    const text = Buffer.from(frame.bytes).toString('utf8')
    let root: PumpApiObject | undefined
    try {
      root = object(parseLosslessJson(text))
      if (root === undefined) throw new Error('PumpAPI frame root must be an object')
    } catch (error) {
      if (!inWindow(null, frame.receivedAt, startMs, stopMs)) return
      const raw = await dataset.appendRaw({
        stream: 'pumpapi-live',
        source: 'pumpapi',
        transport: 'live',
        channel: 'data-stream',
        payload: frame.bytes,
        receivedAt: frame.receivedAt,
        ...(frame.receivedMonoMs === null ? {} : { receivedMonoMs: frame.receivedMonoMs }),
        commitment: 'provider',
        parserVersion: 'pumpapi-tolerant/1',
      })
      await this.writeReliability('decode_error', frame.receivedAt, {
        message: error instanceof Error ? error.message : String(error),
      }, raw.seq)
      return
    }

    const previewGroups = normalizePumpApiEvent(root, {
      runId: dataset.manifest.run_id,
      rawSeq: dataset.manifest.latest_raw_seq + 1,
      receivedAt: frame.receivedAt,
      source: 'pumpapi',
    })
    const eligible = previewGroups.filter(group => inWindow(group.sourceAt, frame.receivedAt, startMs, stopMs))
    if (eligible.length === 0) return
    const sourceAt = pumpApiSourceTime(root) ?? eligible[0]?.sourceAt ?? null
    const raw = await dataset.appendRaw({
      stream: 'pumpapi-live',
      source: 'pumpapi',
      transport: 'live',
      channel: 'data-stream',
      payload: frame.bytes,
      ...(firstText(root, ['signature', 'txSignature', 'transactionSignature']) === null
        ? {}
        : { eventId: firstText(root, ['signature', 'txSignature', 'transactionSignature']) as string }),
      ...(sourceAt === null ? {} : { sourceAt }),
      receivedAt: frame.receivedAt,
      ...(frame.receivedMonoMs === null ? {} : { receivedMonoMs: frame.receivedMonoMs }),
      commitment: 'provider',
      parserVersion: 'pumpapi-tolerant/1',
    })
    const groups = normalizePumpApiEvent(root, {
      runId: dataset.manifest.run_id,
      rawSeq: raw.seq,
      receivedAt: frame.receivedAt,
      source: 'pumpapi',
    }).filter(group => inWindow(group.sourceAt, frame.receivedAt, startMs, stopMs))

    for (const group of groups) {
      const appended = await dataset.appendNormalized('events', group.event as NormalizedRecord, `event:${group.eventKey}`)
      if (!appended) continue
      for (const specialized of group.specialized) {
        if (specialized.family === 'tokens' && group.mint !== null) this.trackedMints.add(group.mint)
        if (['trades', 'curves', 'migrations'].includes(specialized.family)
          && group.mint !== null && !this.trackedMints.has(group.mint)) {
          await this.writeReliability('untracked_mint', frame.receivedAt, {
            mint: group.mint,
            action: group.action,
            event_key: group.eventKey,
          }, raw.seq)
          continue
        }
        const specializedAppended = await dataset.appendNormalized(
          specialized.family as NormalizedFamily,
          specialized.record as NormalizedRecord,
          specialized.dedupKey,
        )
        if (!specializedAppended || this.enrichment === undefined || group.mint === null) continue
        const uri = specialized.record.uri
        if (specialized.family === 'tokens' && typeof uri === 'string' && uri !== '' && !this.scheduledMetadata.has(group.mint)) {
          this.scheduledMetadata.add(group.mint)
          void this.enrichment.scheduleMetadata({ mint: group.mint, uri, sourceRawSeq: raw.seq }).catch(() => undefined)
        }
        const pairAddress = specialized.record.pool_id
        if (specialized.family === 'migrations' && typeof pairAddress === 'string' && pairAddress !== '' && !this.scheduledPairs.has(pairAddress)) {
          this.scheduledPairs.add(pairAddress)
          void this.enrichment.scheduleDexPair({ mint: group.mint, pairAddress, sourceRawSeq: raw.seq }).catch(() => undefined)
        }
      }
    }
  }

  private async writeReliability(
    kind: string,
    receivedAt: string,
    detail: Record<string, unknown>,
    rawSeq: number | null = null,
  ): Promise<void> {
    const dataset = this.dataset
    if (dataset === undefined) return
    const record: NormalizedRecord = {
      schema: 'pump.reliability/1',
      dataset_version: '1.0.0',
      run_id: dataset.manifest.run_id,
      source: 'pumpapi',
      received_at: receivedAt,
      raw_seq: rawSeq,
      kind,
      status: kind === 'decode_error' ? 'decode_error' : kind === 'disconnected' ? 'gap' : 'unknown',
      detail,
    }
    await dataset.appendNormalized('reliability', record)
  }
}
