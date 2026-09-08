import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BlobStore } from '../storage/blob-store.js'
import { atomicWriteJson, pathExists, readJson } from '../storage/files.js'
import { NdjsonWriter } from '../storage/ndjson.js'
import type { NormalizedFamily, NormalizedRecord, RawEnvelope, RunCatalogRecord, RunManifest } from '../storage/types.js'
import { parseLosslessJson } from '../pumpapi/lossless-json.js'
import { normalizePumpApiEvent } from '../pumpapi/normalize.js'
import type { LosslessJson } from '../pumpapi/lossless-json.js'
import type { PumpApiObject } from '../pumpapi/types.js'

function object(value: LosslessJson): PumpApiObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function validUtf8(bytes: Buffer, text: string): boolean {
  return Buffer.from(text, 'utf8').equals(bytes)
}

async function existingEventKeys(path: string): Promise<Set<string>> {
  if (!(await pathExists(path))) return new Set()
  const lines = (await readFile(path, 'utf8')).split('\n').filter(Boolean)
  return new Set(lines.map(line => JSON.parse(line).event_key).filter((value): value is string => typeof value === 'string'))
}

export interface ReplayAppendDecision {
  readonly accepted: number
  readonly rejected: number
  readonly duplicates: number
}

export class ReplayRepairSession {
  private manifestValue: RunManifest
  private readonly rawWriter: NdjsonWriter
  private readonly normalizedWriters = new Map<NormalizedFamily, NdjsonWriter>()
  private readonly catalog: NdjsonWriter
  private readonly blobs: BlobStore
  private readonly eventKeys: Set<string>
  private dirty = 0
  private timer: NodeJS.Timeout | undefined
  private closed = false

  private constructor(
    dataRoot: string,
    private readonly runRoot: string,
    manifest: RunManifest,
    eventKeys: Set<string>,
    private readonly now: () => number,
  ) {
    this.manifestValue = {
      ...manifest,
      repair: { ...manifest.repair, status: 'in_progress', updated_at: new Date(now()).toISOString() },
    }
    this.eventKeys = eventKeys
    this.rawWriter = new NdjsonWriter(join(runRoot, 'raw', 'pumpapi-replay.ndjson'), manifest.flush_policy)
    this.catalog = new NdjsonWriter(join(dataRoot, 'catalog.ndjson'), manifest.flush_policy)
    this.blobs = new BlobStore(join(runRoot, 'blobs'))
  }

  static async open(dataRoot: string, runId: string, now: () => number = () => Date.now()): Promise<ReplayRepairSession> {
    const runRoot = join(dataRoot, 'runs', runId)
    const manifest = await readJson<RunManifest>(join(runRoot, 'manifest.json'))
    if (!['stopped', 'interrupted', 'error'].includes(manifest.status)) throw new Error(`run is not terminal: ${manifest.status}`)
    const eventKeys = await existingEventKeys(join(runRoot, 'normalized', 'events.ndjson'))
    const session = new ReplayRepairSession(dataRoot, runRoot, manifest, eventKeys, now)
    await atomicWriteJson(join(runRoot, 'manifest.json'), session.manifestValue)
    return session
  }

  get manifest(): RunManifest {
    return this.manifestValue
  }

  async appendLine(line: Uint8Array, archiveUrl: string, archiveLine: number): Promise<ReplayAppendDecision> {
    this.assertOpen()
    const bytes = Buffer.from(line)
    let root: PumpApiObject | undefined
    try {
      root = object(parseLosslessJson(bytes.toString('utf8')))
    } catch (error) {
      await this.reliability('replay_decode_error', 'decode_error', { archive_url: archiveUrl, archive_line: archiveLine, error: error instanceof Error ? error.message : String(error) })
      this.updateRepair(0, 1, 0)
      await this.markDirty()
      return { accepted: 0, rejected: 1, duplicates: 0 }
    }
    if (root === undefined) {
      await this.reliability('replay_decode_error', 'decode_error', { archive_url: archiveUrl, archive_line: archiveLine, error: 'root is not an object' })
      this.updateRepair(0, 1, 0)
      await this.markDirty()
      return { accepted: 0, rejected: 1, duplicates: 0 }
    }
    const receivedAt = new Date(this.now()).toISOString()
    const preview = normalizePumpApiEvent(root, {
      runId: this.manifestValue.run_id,
      rawSeq: this.manifestValue.latest_raw_seq + 1,
      receivedAt,
      source: 'pumpapi',
      transport: 'replay',
    })
    const start = Date.parse(this.manifestValue.started_at)
    const stop = Date.parse(this.manifestValue.stops_at)
    const eligible = preview.filter(group => group.sourceAt !== null && Date.parse(group.sourceAt) >= start && Date.parse(group.sourceAt) < stop)
    if (eligible.length === 0) {
      await this.reliability('replay_out_of_window', 'ok', {
        archive_url: archiveUrl,
        archive_line: archiveLine,
        source_times: preview.map(group => group.sourceAt),
        decision: 'rejected',
      })
      this.updateRepair(0, 1, 0)
      await this.markDirty()
      return { accepted: 0, rejected: 1, duplicates: 0 }
    }

    const seq = this.manifestValue.latest_raw_seq + 1
    const text = bytes.toString('utf8')
    const inline = bytes.byteLength <= 1024 * 1024 && validUtf8(bytes, text)
    const blob = inline ? null : await this.blobs.put(bytes, 'application/x-ndjson')
    const raw: RawEnvelope = {
      schema: 'pump.raw/1',
      dataset_version: '1.0.0',
      run_id: this.manifestValue.run_id,
      seq,
      source: 'pumpapi',
      transport: 'replay',
      channel: archiveUrl,
      event_id: typeof root.signature === 'string' ? root.signature : null,
      source_at: eligible[0]?.sourceAt ?? null,
      source_slot: null,
      received_at: receivedAt,
      received_mono_ms: null,
      commitment: 'provider',
      parser_version: 'pumpapi-replay-tolerant/1',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      byte_len: bytes.byteLength,
      payload_raw: inline ? text : null,
      blob_ref: blob,
      in_window: true,
      ingested_after_stop: true,
    }
    await this.rawWriter.append(raw)
    this.manifestValue = {
      ...this.manifestValue,
      latest_raw_seq: seq,
      counts: { ...this.manifestValue.counts, raw_records: this.manifestValue.counts.raw_records + 1 },
    }
    const groups = normalizePumpApiEvent(root, {
      runId: this.manifestValue.run_id,
      rawSeq: seq,
      receivedAt,
      source: 'pumpapi',
      transport: 'replay',
    }).filter(group => group.sourceAt !== null && Date.parse(group.sourceAt) >= start && Date.parse(group.sourceAt) < stop)
    let accepted = 0
    let duplicates = 0
    for (const group of groups) {
      if (this.eventKeys.has(group.eventKey)) {
        duplicates += 1
        await this.reliability('replay_dedup', 'ok', { event_key: group.eventKey, archive_url: archiveUrl, archive_line: archiveLine }, seq)
        continue
      }
      this.eventKeys.add(group.eventKey)
      await this.normalized('events', group.event as NormalizedRecord)
      for (const specialized of group.specialized) await this.normalized(specialized.family, specialized.record as NormalizedRecord)
      accepted += 1
    }
    this.updateRepair(accepted, 0, duplicates)
    await this.markDirty()
    return { accepted, rejected: 0, duplicates }
  }

  async markMissingArchive(url: string, detail?: string): Promise<void> {
    this.assertOpen()
    if (!this.manifestValue.repair.missing_archives.includes(url)) {
      this.manifestValue = {
        ...this.manifestValue,
        repair: {
          ...this.manifestValue.repair,
          missing_archives: [...this.manifestValue.repair.missing_archives, url],
          updated_at: new Date(this.now()).toISOString(),
        },
      }
    }
    await this.reliability('replay_archive_missing', 'missing', { archive_url: url, detail: detail ?? null })
    await this.markDirty()
  }

  async finalize(): Promise<RunManifest> {
    this.assertOpen()
    await this.flush()
    const repairStatus = this.manifestValue.repair.missing_archives.length > 0 ? 'partial' : 'complete'
    this.manifestValue = {
      ...this.manifestValue,
      durable_raw_seq: this.manifestValue.latest_raw_seq,
      repair: { ...this.manifestValue.repair, status: repairStatus, updated_at: new Date(this.now()).toISOString() },
    }
    await atomicWriteJson(join(this.runRoot, 'manifest.json'), this.manifestValue)
    await Promise.all([this.rawWriter.close(), ...[...this.normalizedWriters.values()].map(writer => writer.close())])
    await this.catalog.append({
      schema: 'pump.catalog/1',
      dataset_version: '1.0.0',
      run_id: this.manifestValue.run_id,
      action: 'repaired',
      at: this.manifestValue.repair.updated_at ?? new Date(this.now()).toISOString(),
      status: this.manifestValue.status,
      stop_reason: this.manifestValue.stop_reason,
    } satisfies RunCatalogRecord)
    await this.catalog.close()
    this.closed = true
    return this.manifestValue
  }

  private async normalized(family: NormalizedFamily, record: NormalizedRecord): Promise<void> {
    let writer = this.normalizedWriters.get(family)
    if (writer === undefined) {
      writer = new NdjsonWriter(join(this.runRoot, 'normalized', `${family}.ndjson`), this.manifestValue.flush_policy)
      this.normalizedWriters.set(family, writer)
    }
    await writer.append(record)
    this.manifestValue = {
      ...this.manifestValue,
      counts: {
        ...this.manifestValue.counts,
        normalized_records: this.manifestValue.counts.normalized_records + 1,
        tokens: this.manifestValue.counts.tokens + (family === 'tokens' ? 1 : 0),
        reliability_records: this.manifestValue.counts.reliability_records + (family === 'reliability' ? 1 : 0),
      },
    }
  }

  private reliability(kind: string, status: string, detail: Record<string, unknown>, rawSeq: number | null = null): Promise<void> {
    return this.normalized('reliability', {
      schema: 'pump.reliability/1',
      dataset_version: '1.0.0',
      run_id: this.manifestValue.run_id,
      source: 'pumpapi',
      received_at: new Date(this.now()).toISOString(),
      raw_seq: rawSeq,
      kind,
      status,
      detail,
    })
  }

  private updateRepair(accepted: number, rejected: number, duplicates: number): void {
    this.manifestValue = {
      ...this.manifestValue,
      repair: {
        ...this.manifestValue.repair,
        accepted_events: this.manifestValue.repair.accepted_events + accepted,
        rejected_events: this.manifestValue.repair.rejected_events + rejected,
        duplicate_events: this.manifestValue.repair.duplicate_events + duplicates,
        updated_at: new Date(this.now()).toISOString(),
      },
    }
  }

  private async markDirty(): Promise<void> {
    this.dirty += 1
    if (this.dirty >= this.manifestValue.flush_policy.max_records) {
      await this.flush()
      return
    }
    this.timer ??= setTimeout(() => {
      this.timer = undefined
      void this.flush()
    }, this.manifestValue.flush_policy.max_delay_ms)
    this.timer.unref?.()
  }

  private async flush(): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    await Promise.all([this.rawWriter.flush(), ...[...this.normalizedWriters.values()].map(writer => writer.flush())])
    this.manifestValue = { ...this.manifestValue, durable_raw_seq: this.manifestValue.latest_raw_seq }
    await atomicWriteJson(join(this.runRoot, 'manifest.json'), this.manifestValue)
    this.dirty = 0
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('replay repair session is closed')
  }
}
