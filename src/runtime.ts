import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { InWindowEnrichment } from './enrichment/manager.js'
import { PumpApiRunRecorder } from './recorder.js'
import { RunStore } from './storage/run-store.js'
import { pathExists } from './storage/files.js'
import type { PumpObserverAction, PumpObserverResult } from './types.js'
import type { RunManifest } from './storage/types.js'

export interface RuntimeRequest {
  readonly action: PumpObserverAction
  readonly durationMinutes?: number
  readonly runId?: string
  readonly coin?: string
  readonly page?: number
  readonly view?: 'summary' | 'coins' | 'raw'
  readonly stream?: string
}

export interface PumpObserverRuntimeOptions {
  readonly dataRoot: string
  readonly now?: () => number
  readonly connectTimeoutMs?: number
  readonly enrichment?: boolean
  readonly onComplete?: (sessionId: SessionId, manifest: RunManifest, notice: string) => void | Promise<void>
}

interface ActiveRuntimeRun {
  readonly sessionId: SessionId
  readonly manifest: RunManifest
  readonly recorder: PumpApiRunRecorder
}

const NORMALIZED_FAMILIES = ['tokens', 'events', 'trades', 'wallets', 'curves', 'migrations', 'metadata', 'markets', 'reliability'] as const
const RAW_STREAMS = ['pumpapi-live', 'pumpapi-replay', 'metadata', 'dexscreener-pairs', 'dexscreener-solusd'] as const

function positivePage(value: number | undefined): number {
  if (value === undefined) return 1
  if (!Number.isInteger(value) || value < 1) throw new Error('page must be a positive integer')
  return value
}

function result(action: PumpObserverAction, text: string, manifest?: RunManifest, remainingMs?: number): PumpObserverResult {
  return {
    ok: true,
    action,
    text,
    ...(manifest === undefined ? {} : { runId: manifest.run_id, status: manifest.status }),
    ...(remainingMs === undefined ? {} : { remainingMs }),
  }
}

async function scanNdjson(path: string, visit: (record: Record<string, unknown>) => void): Promise<void> {
  if (!(await pathExists(path))) return
  const input = createReadStream(path, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })
  for await (const line of lines) if (line !== '') visit(JSON.parse(line) as Record<string, unknown>)
}

function boundedRaw(record: Record<string, unknown>): Record<string, unknown> {
  const payload = record.payload_raw
  if (typeof payload !== 'string' || payload.length <= 2_000) return record
  return { ...record, payload_raw: `${payload.slice(0, 2_000)}…`, payload_truncated_for_session: true }
}

export class PumpObserverRuntime {
  private readonly store: RunStore
  private readonly now: () => number
  private readonly connectTimeoutMs: number
  private readonly enrichmentEnabled: boolean
  private readonly onComplete: PumpObserverRuntimeOptions['onComplete']
  private activeRun: ActiveRuntimeRun | undefined

  constructor(readonly dataRoot: string, options: Omit<PumpObserverRuntimeOptions, 'dataRoot'> = {}) {
    this.now = options.now ?? (() => Date.now())
    this.connectTimeoutMs = options.connectTimeoutMs ?? 15_000
    this.enrichmentEnabled = options.enrichment ?? true
    this.onComplete = options.onComplete
    this.store = new RunStore(dataRoot, {
      now: this.now,
      enabledAdapters: ['pumpapi-live', 'metadata', 'dexscreener'],
    })
  }

  async init(): Promise<void> {
    await this.store.init()
  }

  async execute(request: RuntimeRequest, sessionId?: SessionId): Promise<PumpObserverResult> {
    switch (request.action) {
      case 'start': return this.start(sessionId, request.durationMinutes)
      case 'status': return this.status()
      case 'stop': return this.stop()
      case 'list_runs': return this.listRuns(positivePage(request.page))
      case 'get_run': return this.getRun(request.runId, positivePage(request.page), request.view ?? 'summary', request.stream)
      case 'get_coin': return this.getCoin(request.runId, request.coin, positivePage(request.page))
    }
  }

  async dispose(): Promise<void> {
    if (this.activeRun !== undefined) await this.activeRun.recorder.stop('interrupted').catch(() => undefined)
    this.activeRun = undefined
    await this.store.close()
  }

  private async start(sessionId: SessionId | undefined, durationMinutes: number | undefined): Promise<PumpObserverResult> {
    if (sessionId === undefined) throw new Error('start requires a calling session')
    if (durationMinutes !== 5 && durationMinutes !== 10) throw new Error('duration_minutes must be exactly 5 or 10')
    if (this.activeRun !== undefined) throw new Error(`run already active: ${this.activeRun.manifest.label}`)
    const dataset = await this.store.createRun(durationMinutes)
    const enrichment = this.enrichmentEnabled ? new InWindowEnrichment(dataset, { now: this.now }) : undefined
    let recorder!: PumpApiRunRecorder
    recorder = new PumpApiRunRecorder({
      now: this.now,
      ...(enrichment === undefined ? {} : { enrichment }),
      onComplete: async manifest => {
        const active = this.activeRun
        if (active?.recorder === recorder) this.activeRun = undefined
        const notice = await this.completionNotice(manifest)
        await this.onComplete?.(sessionId, manifest, notice)
      },
    })
    this.activeRun = { sessionId, manifest: dataset.manifest, recorder }
    let connectTimer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        recorder.start(dataset),
        new Promise<never>((_resolve, reject) => {
          connectTimer = setTimeout(() => reject(new Error(`PumpAPI socket did not open within ${this.connectTimeoutMs} ms`)), this.connectTimeoutMs)
        }),
      ])
    } catch (error) {
      this.activeRun = undefined
      await recorder.stop('error').catch(() => dataset.finalize('error', 'error')).catch(() => undefined)
      throw error
    } finally {
      if (connectTimer !== undefined) clearTimeout(connectTimer)
    }
    return result('start', `${dataset.manifest.label} started. Run ID: ${dataset.manifest.run_id}. Overall stop: ${dataset.manifest.stops_at}.`, dataset.manifest, dataset.manifest.duration_ms)
  }

  private status(): PumpObserverResult {
    const active = this.activeRun
    if (active === undefined) return result('status', 'Pump observer is stopped.')
    const remaining = Math.max(0, Date.parse(active.manifest.stops_at) - this.now())
    return result('status', `${active.manifest.label} is running; ${Math.ceil(remaining / 1000)} seconds remain.`, active.manifest, remaining)
  }

  private async stop(): Promise<PumpObserverResult> {
    const active = this.activeRun
    if (active === undefined) throw new Error('no active run')
    const manifest = await active.recorder.stop('manual_early')
    if (this.activeRun?.recorder === active.recorder) this.activeRun = undefined
    return result('stop', `${manifest.label} stopped early after durable finalization. Run ID: ${manifest.run_id}.`, manifest, 0)
  }

  private async listRuns(page: number): Promise<PumpObserverResult> {
    const manifests = await this.store.listManifests()
    const pageSize = 20
    const selected = manifests.slice((page - 1) * pageSize, page * pageSize)
    return result('list_runs', JSON.stringify({
      page, page_size: pageSize, total_runs: manifests.length, has_more: page * pageSize < manifests.length,
      runs: selected.map(manifest => this.summary(manifest)),
    }, null, 2))
  }

  private async getRun(runId: string | undefined, page: number, view: 'summary' | 'coins' | 'raw', stream: string | undefined): Promise<PumpObserverResult> {
    if (runId === undefined) throw new Error('get_run requires run_id')
    const manifest = (await this.store.listManifests()).find(candidate => candidate.run_id === runId)
    if (manifest === undefined) throw new Error(`unknown run: ${runId}`)
    if (view === 'summary') return result('get_run', JSON.stringify(this.summary(manifest), null, 2), manifest)
    if (view === 'coins') {
      const coins = await this.coins(runId)
      const pageSize = 20
      return result('get_run', JSON.stringify({
        run: this.summary(manifest), page, page_size: pageSize, total_coins: coins.length,
        has_more: page * pageSize < coins.length, coins: coins.slice((page - 1) * pageSize, page * pageSize),
      }, null, 2), manifest)
    }
    const selectedStream = stream ?? 'pumpapi-live'
    if (!(RAW_STREAMS as readonly string[]).includes(selectedStream)) throw new Error(`unknown raw stream: ${selectedStream}`)
    const pageSize = 10
    const start = (page - 1) * pageSize
    let totalRecords = 0
    const selected: Record<string, unknown>[] = []
    await scanNdjson(join(this.dataRoot, 'runs', runId, 'raw', `${selectedStream}.ndjson`), record => {
      if (totalRecords >= start && totalRecords < start + pageSize) selected.push(boundedRaw(record))
      totalRecords += 1
    })
    return result('get_run', JSON.stringify({
      run_id: runId, stream: selectedStream, page, page_size: pageSize, total_records: totalRecords,
      has_more: page * pageSize < totalRecords, records: selected,
    }, null, 2), manifest)
  }

  private async getCoin(runId: string | undefined, coin: string | undefined, page: number): Promise<PumpObserverResult> {
    if (runId === undefined || coin === undefined) throw new Error('get_coin requires run_id and coin')
    const manifest = (await this.store.listManifests()).find(candidate => candidate.run_id === runId)
    if (manifest === undefined) throw new Error(`unknown run: ${runId}`)
    const pageSize = 20
    const start = (page - 1) * pageSize
    const selected: { family: string; record: Record<string, unknown> }[] = []
    let totalRecords = 0
    for (const family of NORMALIZED_FAMILIES) {
      await scanNdjson(join(this.dataRoot, 'runs', runId, 'normalized', `${family}.ndjson`), record => {
        const mint = typeof record.mint === 'string' ? record.mint : ''
        const symbol = typeof record.symbol === 'string' ? record.symbol : ''
        if (mint !== coin && symbol.toLowerCase() !== coin.toLowerCase()) return
        if (totalRecords >= start && totalRecords < start + pageSize) selected.push({ family, record })
        totalRecords += 1
      })
    }
    if (totalRecords === 0) throw new Error(`coin not found in ${runId}: ${coin}`)
    return result('get_coin', JSON.stringify({
      run_id: runId, coin, page, page_size: pageSize, total_records: totalRecords,
      has_more: page * pageSize < totalRecords, records: selected,
    }, null, 2), manifest)
  }

  private async completionNotice(manifest: RunManifest): Promise<string> {
    const coins = await this.coins(manifest.run_id)
    const first = coins.slice(0, 20)
    return `${manifest.label} completed after durable finalization. Run ID: ${manifest.run_id}. `
      + `Coins: ${coins.length}; raw records: ${manifest.counts.raw_records}; normalized records: ${manifest.counts.normalized_records}. `
      + `First coin page: ${JSON.stringify(first)}${coins.length > first.length ? ' — ask for the next coin page.' : ''}`
  }

  private async coins(runId: string): Promise<Record<string, unknown>[]> {
    const unique = new Map<string, Record<string, unknown>>()
    await scanNdjson(join(this.dataRoot, 'runs', runId, 'normalized', 'tokens.ndjson'), token => {
      const mint = typeof token.mint === 'string' ? token.mint : undefined
      if (mint !== undefined && !unique.has(mint)) unique.set(mint, {
        mint,
        symbol: token.symbol ?? null,
        name: token.name ?? null,
        first_seen_at: token.first_seen_at ?? token.received_at ?? null,
      })
    })
    return [...unique.values()]
  }

  private summary(manifest: RunManifest): Record<string, unknown> {
    return {
      run_id: manifest.run_id, label: manifest.label, status: manifest.status, stop_reason: manifest.stop_reason,
      started_at: manifest.started_at, stops_at: manifest.stops_at, stopped_at: manifest.stopped_at,
      duration_ms: manifest.duration_ms, counts: manifest.counts, repair: manifest.repair,
      dataset_root: join(this.dataRoot, 'runs', manifest.run_id), dataset_version: manifest.dataset_version,
    }
  }
}
