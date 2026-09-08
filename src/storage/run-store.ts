import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BlobStore } from './blob-store.js'
import { DATASET_CONTRACT, DATASET_VERSION, RECORD_SCHEMAS } from './contract.js'
import { atomicWriteJson, ensureDirectory, pathExists, readJson } from './files.js'
import { NdjsonWriter } from './ndjson.js'
import type {
  DatasetStopReason,
  FlushPolicy,
  NormalizedFamily,
  NormalizedRecord,
  RawAppendInput,
  RawEnvelope,
  RunCatalogRecord,
  RunManifest,
  RunDatasetStatus,
} from './types.js'

const DEFAULT_FLUSH_POLICY: FlushPolicy = Object.freeze({ max_records: 128, max_delay_ms: 250 })
const INLINE_LIMIT_BYTES = 1024 * 1024

export interface RunStoreOptions {
  readonly now?: () => number
  readonly flushPolicy?: FlushPolicy
  readonly enabledAdapters?: readonly string[]
}

interface SequenceState {
  readonly next_run_seq: number
  readonly last_run_id: string | null
}

function iso(epoch: number): string {
  return new Date(epoch).toISOString()
}

function durationMs(minutes: number): 300_000 | 600_000 {
  if (minutes === 5) return 300_000
  if (minutes === 10) return 600_000
  throw new Error('duration must be exactly 5 or 10 minutes')
}

function runId(sequence: number, startedAt: number): string {
  return `run-${String(sequence).padStart(4, '0')}-${iso(startedAt).replaceAll(/[-:]/g, '').replace('.000', '')}`
}

function humanLabel(sequence: number, startedAt: number, minutes: number): string {
  return `Run ${String(sequence).padStart(3, '0')} — ${iso(startedAt)} — ${minutes} min`
}

function initialCounts() {
  return { raw_records: 0, normalized_records: 0, tokens: 0, reliability_records: 0 }
}

function validateNormalized(record: NormalizedRecord, runIdValue: string, latestRawSeq: number): void {
  if (!RECORD_SCHEMAS.includes(record.schema)) throw new Error(`unknown normalized schema: ${record.schema}`)
  if (record.dataset_version !== DATASET_VERSION) throw new Error('normalized dataset_version mismatch')
  if (record.run_id !== runIdValue) throw new Error('normalized run_id mismatch')
  if (record.source.trim() === '') throw new Error('normalized source is required')
  if (!Number.isFinite(Date.parse(record.received_at))) throw new Error('normalized received_at must be ISO time')
  if (typeof record.raw_seq === 'number' && (record.raw_seq < 1 || record.raw_seq > latestRawSeq)) {
    throw new Error(`normalized raw_seq is outside durable run sequence: ${record.raw_seq}`)
  }
}

function isValidUtf8(bytes: Buffer, text: string): boolean {
  return Buffer.from(text, 'utf8').equals(bytes)
}

export class RunDataset {
  private manifestValue: RunManifest
  private readonly rawWriters = new Map<string, NdjsonWriter>()
  private readonly normalizedWriters = new Map<NormalizedFamily, NdjsonWriter>()
  private readonly blobs: BlobStore
  private readonly tokenMints = new Set<string>()
  private readonly dedupKeys = new Set<string>()
  private operations: Promise<void> = Promise.resolve()
  private manifestTimer: NodeJS.Timeout | undefined
  private dirtyRecords = 0
  private backgroundFailure: unknown
  private accepting = true
  private closed = false

  constructor(
    readonly root: string,
    manifest: RunManifest,
    private readonly catalog: NdjsonWriter,
    private readonly now: () => number,
  ) {
    this.manifestValue = manifest
    this.blobs = new BlobStore(join(root, 'blobs'))
  }

  get manifest(): RunManifest {
    return this.manifestValue
  }

  async appendRaw(input: RawAppendInput): Promise<RawEnvelope> {
    this.assertAccepting()
    return this.enqueue(() => this.appendRawNow(input))
  }

  private async appendRawNow(input: RawAppendInput): Promise<RawEnvelope> {
    this.assertRunning()
    const payload = Buffer.from(input.payload)
    const text = payload.toString('utf8')
    const canInline = payload.byteLength <= INLINE_LIMIT_BYTES && isValidUtf8(payload, text)
    const blob = canInline ? null : await this.blobs.put(payload, input.mediaType ?? null)
    const seq = this.manifestValue.latest_raw_seq + 1
    const receivedAt = input.receivedAt ?? iso(this.now())
    const envelope: RawEnvelope = {
      schema: 'pump.raw/1',
      dataset_version: DATASET_VERSION,
      run_id: this.manifestValue.run_id,
      seq,
      source: input.source,
      transport: input.transport,
      channel: input.channel,
      event_id: input.eventId ?? null,
      source_at: input.sourceAt ?? null,
      source_slot: input.sourceSlot ?? null,
      received_at: receivedAt,
      received_mono_ms: input.receivedMonoMs ?? null,
      commitment: input.commitment ?? 'unknown',
      parser_version: input.parserVersion ?? null,
      sha256: createHash('sha256').update(payload).digest('hex'),
      byte_len: payload.byteLength,
      payload_raw: canInline ? text : null,
      blob_ref: blob,
      in_window: true,
      ingested_after_stop: input.ingestedAfterStop ?? false,
    }
    await this.rawWriter(input.stream).append(envelope)
    this.manifestValue = {
      ...this.manifestValue,
      latest_raw_seq: seq,
      counts: { ...this.manifestValue.counts, raw_records: this.manifestValue.counts.raw_records + 1 },
    }
    await this.markDirty()
    return envelope
  }

  async appendNormalized(
    family: NormalizedFamily,
    record: NormalizedRecord,
    dedupKey?: string,
  ): Promise<boolean> {
    this.assertAccepting()
    return this.enqueue(() => this.appendNormalizedNow(family, record, dedupKey))
  }

  private async appendNormalizedNow(
    family: NormalizedFamily,
    record: NormalizedRecord,
    dedupKey?: string,
  ): Promise<boolean> {
    this.assertRunning()
    validateNormalized(record, this.manifestValue.run_id, this.manifestValue.latest_raw_seq)
    if (dedupKey !== undefined) {
      const scoped = `${family}:${dedupKey}`
      if (this.dedupKeys.has(scoped)) {
        await this.appendReliability({
          kind: 'dedup',
          status: 'ok',
          detail: { family, dedup_key: dedupKey },
          source: record.source,
          received_at: record.received_at,
          raw_seq: record.raw_seq ?? null,
        })
        await this.markDirty()
        return false
      }
      this.dedupKeys.add(scoped)
    }
    const mint = typeof record.mint === 'string' ? record.mint : undefined
    if (family === 'tokens') {
      if (mint === undefined || mint === '') throw new Error('token record requires mint')
      this.tokenMints.add(mint)
    } else if (['trades', 'curves', 'migrations', 'metadata', 'markets'].includes(family) && mint !== undefined && !this.tokenMints.has(mint)) {
      throw new Error(`normalized ${family} record references unknown mint: ${mint}`)
    }
    await this.normalizedWriter(family).append(record)
    this.manifestValue = {
      ...this.manifestValue,
      counts: {
        ...this.manifestValue.counts,
        normalized_records: this.manifestValue.counts.normalized_records + 1,
        tokens: this.manifestValue.counts.tokens + (family === 'tokens' ? 1 : 0),
        reliability_records: this.manifestValue.counts.reliability_records + (family === 'reliability' ? 1 : 0),
      },
    }
    await this.markDirty()
    return true
  }

  async flush(): Promise<void> {
    this.assertOpen()
    await this.operations
    await this.flushWritersAndManifest()
  }

  async finalize(reason: DatasetStopReason, status?: RunDatasetStatus): Promise<RunManifest> {
    this.assertOpen()
    this.accepting = false
    await this.flush()
    const terminalStatus: RunDatasetStatus = status ?? (reason === 'interrupted' ? 'interrupted' : reason === 'error' ? 'error' : 'stopped')
    this.manifestValue = {
      ...this.manifestValue,
      status: terminalStatus,
      stop_reason: reason,
      stopped_at: iso(this.now()),
      durable_raw_seq: this.manifestValue.latest_raw_seq,
    }
    await atomicWriteJson(join(this.root, 'manifest.json'), this.manifestValue)
    await Promise.all([
      ...[...this.rawWriters.values()].map(writer => writer.close()),
      ...[...this.normalizedWriters.values()].map(writer => writer.close()),
    ])
    this.closed = true
    const action: RunCatalogRecord['action'] = terminalStatus === 'interrupted' ? 'interrupted' : 'finalized'
    await this.catalog.append({
      schema: 'pump.catalog/1',
      dataset_version: DATASET_VERSION,
      run_id: this.manifestValue.run_id,
      action,
      at: this.manifestValue.stopped_at ?? iso(this.now()),
      status: terminalStatus,
      stop_reason: reason,
    } satisfies RunCatalogRecord)
    await this.catalog.flush()
    return this.manifestValue
  }

  private async appendReliability(input: {
    kind: string
    status: string
    detail: Record<string, unknown>
    source: string
    received_at: string
    raw_seq: number | null
  }): Promise<void> {
    const record: NormalizedRecord = {
      schema: 'pump.reliability/1',
      dataset_version: DATASET_VERSION,
      run_id: this.manifestValue.run_id,
      source: input.source,
      received_at: input.received_at,
      raw_seq: input.raw_seq,
      kind: input.kind,
      status: input.status,
      detail: input.detail,
    }
    await this.normalizedWriter('reliability').append(record)
    this.manifestValue = {
      ...this.manifestValue,
      counts: {
        ...this.manifestValue.counts,
        normalized_records: this.manifestValue.counts.normalized_records + 1,
        reliability_records: this.manifestValue.counts.reliability_records + 1,
      },
    }
  }

  private rawWriter(stream: RawAppendInput['stream']): NdjsonWriter {
    let writer = this.rawWriters.get(stream)
    if (writer === undefined) {
      writer = new NdjsonWriter(join(this.root, 'raw', `${stream}.ndjson`), this.manifestValue.flush_policy)
      this.rawWriters.set(stream, writer)
    }
    return writer
  }

  private normalizedWriter(family: NormalizedFamily): NdjsonWriter {
    let writer = this.normalizedWriters.get(family)
    if (writer === undefined) {
      writer = new NdjsonWriter(join(this.root, 'normalized', `${family}.ndjson`), this.manifestValue.flush_policy)
      this.normalizedWriters.set(family, writer)
    }
    return writer
  }

  private async markDirty(): Promise<void> {
    this.dirtyRecords += 1
    if (this.dirtyRecords >= this.manifestValue.flush_policy.max_records) {
      await this.flushWritersAndManifest()
      return
    }
    this.manifestTimer ??= setTimeout(() => {
      this.manifestTimer = undefined
      void this.flush().catch(error => { this.backgroundFailure = error })
    }, this.manifestValue.flush_policy.max_delay_ms)
    this.manifestTimer.unref?.()
  }

  private async flushWritersAndManifest(): Promise<void> {
    if (this.manifestTimer !== undefined) {
      clearTimeout(this.manifestTimer)
      this.manifestTimer = undefined
    }
    await Promise.all([
      ...[...this.rawWriters.values()].map(writer => writer.flush()),
      ...[...this.normalizedWriters.values()].map(writer => writer.flush()),
    ])
    this.manifestValue = { ...this.manifestValue, durable_raw_seq: this.manifestValue.latest_raw_seq }
    await atomicWriteJson(join(this.root, 'manifest.json'), this.manifestValue)
    this.dirtyRecords = 0
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation)
    this.operations = result.then(() => undefined, () => undefined)
    return result
  }

  private assertAccepting(): void {
    this.assertOpen()
    if (!this.accepting) throw new Error(`run is finalizing: ${this.manifestValue.run_id}`)
  }

  private assertRunning(): void {
    this.assertOpen()
    if (this.manifestValue.status !== 'running') throw new Error(`run is not writable: ${this.manifestValue.status}`)
  }

  private assertOpen(): void {
    if (this.backgroundFailure !== undefined) throw this.backgroundFailure
    if (this.closed) throw new Error(`run is closed: ${this.manifestValue.run_id}`)
  }
}

export class RunStore {
  private readonly now: () => number
  private readonly flushPolicy: FlushPolicy
  private readonly enabledAdapters: readonly string[]
  private readonly catalog: NdjsonWriter
  private initialized = false
  private createChain: Promise<void> = Promise.resolve()

  constructor(readonly root: string, options: RunStoreOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.flushPolicy = options.flushPolicy ?? DEFAULT_FLUSH_POLICY
    this.enabledAdapters = options.enabledAdapters ?? []
    this.catalog = new NdjsonWriter(join(root, 'catalog.ndjson'), this.flushPolicy)
  }

  async init(): Promise<void> {
    if (this.initialized) return
    await ensureDirectory(join(this.root, 'runs'))
    await ensureDirectory(join(this.root, 'indexes'))
    const contractPath = join(this.root, 'contract.json')
    if (await pathExists(contractPath)) {
      const existing = await readJson<{ dataset_version?: string }>(contractPath)
      if (existing.dataset_version !== DATASET_VERSION) throw new Error(`unsupported dataset version: ${existing.dataset_version ?? 'missing'}`)
    } else {
      await atomicWriteJson(contractPath, DATASET_CONTRACT)
    }
    const sequencePath = join(this.root, 'sequence.json')
    if (!(await pathExists(sequencePath))) {
      await atomicWriteJson(sequencePath, { next_run_seq: 1, last_run_id: null } satisfies SequenceState)
    }
    await this.recoverInterruptedRuns()
    this.initialized = true
  }

  async createRun(minutes: number): Promise<RunDataset> {
    await this.init()
    let created: RunDataset | undefined
    this.createChain = this.createChain.then(async () => {
      const sequencePath = join(this.root, 'sequence.json')
      const sequence = await readJson<SequenceState>(sequencePath)
      const startedAt = this.now()
      const id = runId(sequence.next_run_seq, startedAt)
      await atomicWriteJson(sequencePath, { next_run_seq: sequence.next_run_seq + 1, last_run_id: id } satisfies SequenceState)
      const ms = durationMs(minutes)
      const manifest: RunManifest = {
        schema: 'pump.run/1',
        dataset_version: DATASET_VERSION,
        run_id: id,
        label: humanLabel(sequence.next_run_seq, startedAt, minutes),
        sequence: sequence.next_run_seq,
        duration_ms: ms,
        status: 'running',
        stop_reason: null,
        created_at: iso(startedAt),
        started_at: iso(startedAt),
        stops_at: iso(startedAt + ms),
        stopped_at: null,
        latest_raw_seq: 0,
        durable_raw_seq: 0,
        flush_policy: this.flushPolicy,
        enabled_adapters: this.enabledAdapters,
        repair: {
          status: 'not_attempted',
          updated_at: null,
          accepted_events: 0,
          rejected_events: 0,
          duplicate_events: 0,
          missing_archives: [],
        },
        counts: initialCounts(),
      }
      const runRoot = join(this.root, 'runs', id)
      await ensureDirectory(join(runRoot, 'raw'))
      await ensureDirectory(join(runRoot, 'normalized'))
      await ensureDirectory(join(runRoot, 'derived'))
      await ensureDirectory(join(runRoot, 'blobs'))
      await atomicWriteJson(join(runRoot, 'manifest.json'), manifest)
      await this.catalog.append({
        schema: 'pump.catalog/1',
        dataset_version: DATASET_VERSION,
        run_id: id,
        action: 'created',
        at: manifest.created_at,
        status: 'running',
        stop_reason: null,
      } satisfies RunCatalogRecord)
      await this.catalog.flush()
      created = new RunDataset(runRoot, manifest, this.catalog, this.now)
    })
    await this.createChain
    if (created === undefined) throw new Error('run creation did not complete')
    return created
  }

  async listManifests(): Promise<RunManifest[]> {
    await this.init()
    const entries = await readdir(join(this.root, 'runs'), { withFileTypes: true })
    const manifests = await Promise.all(entries.filter(entry => entry.isDirectory()).map(entry => readJson<RunManifest>(join(this.root, 'runs', entry.name, 'manifest.json'))))
    return manifests.sort((a, b) => b.sequence - a.sequence)
  }

  async readRaw(runIdValue: string, stream: RawAppendInput['stream']): Promise<RawEnvelope[]> {
    const path = join(this.root, 'runs', runIdValue, 'raw', `${stream}.ndjson`)
    if (!(await pathExists(path))) return []
    return (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as RawEnvelope)
  }

  async close(): Promise<void> {
    await this.catalog.close()
  }

  private async recoverInterruptedRuns(): Promise<void> {
    const runsRoot = join(this.root, 'runs')
    const entries = await readdir(runsRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const manifestPath = join(runsRoot, entry.name, 'manifest.json')
      const manifest = await readJson<RunManifest>(manifestPath)
      if (!['starting', 'running', 'stopping'].includes(manifest.status)) continue
      const recovered: RunManifest = {
        ...manifest,
        status: 'interrupted',
        stop_reason: 'interrupted',
        stopped_at: iso(this.now()),
      }
      await atomicWriteJson(manifestPath, recovered)
      await this.catalog.append({
        schema: 'pump.catalog/1',
        dataset_version: DATASET_VERSION,
        run_id: recovered.run_id,
        action: 'interrupted',
        at: recovered.stopped_at ?? iso(this.now()),
        status: 'interrupted',
        stop_reason: 'interrupted',
      } satisfies RunCatalogRecord)
    }
    await this.catalog.flush()
  }
}
