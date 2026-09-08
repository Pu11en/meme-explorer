import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATASET_VERSION, RECORD_SCHEMAS } from './contract.js'
import { readJson } from './files.js'
import type { RawEnvelope, RunManifest } from './types.js'

export interface DatasetValidationReport {
  readonly runs: number
  readonly raw_records: number
  readonly normalized_records: number
  readonly blobs: number
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value === '') throw new Error(`${label} must be a non-empty string`)
  return value
}

function iso(value: unknown, label: string): string {
  const result = string(value, label)
  if (!Number.isFinite(Date.parse(result))) throw new Error(`${label} must be ISO time`)
  return result
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${label} must be a non-negative safe integer`)
  return value as number
}

export function validateManifest(value: unknown): asserts value is RunManifest {
  const record = object(value, 'manifest')
  if (record.schema !== 'pump.run/1') throw new Error('manifest schema mismatch')
  if (record.dataset_version !== DATASET_VERSION) throw new Error('manifest dataset version mismatch')
  string(record.run_id, 'manifest.run_id')
  string(record.label, 'manifest.label')
  integer(record.sequence, 'manifest.sequence')
  if (record.duration_ms !== 300_000 && record.duration_ms !== 600_000 && record.duration_ms !== 3_600_000) throw new Error('manifest duration must be 300000, 600000 or 3600000')
  iso(record.started_at, 'manifest.started_at')
  iso(record.stops_at, 'manifest.stops_at')
  const latest = integer(record.latest_raw_seq, 'manifest.latest_raw_seq')
  const durable = integer(record.durable_raw_seq, 'manifest.durable_raw_seq')
  if (durable > latest) throw new Error('manifest durable_raw_seq exceeds latest_raw_seq')
}

export function validateNormalizedRecord(value: unknown, runId: string, latestRawSeq: number): void {
  const record = object(value, 'normalized record')
  const schema = string(record.schema, 'normalized.schema')
  if (schema === 'pump.raw/1' || !RECORD_SCHEMAS.includes(schema as never)) throw new Error(`unknown normalized schema: ${schema}`)
  if (record.dataset_version !== DATASET_VERSION) throw new Error('normalized dataset version mismatch')
  if (record.run_id !== runId) throw new Error('normalized run reference mismatch')
  string(record.source, 'normalized.source')
  iso(record.received_at, 'normalized.received_at')
  if (record.raw_seq !== undefined && record.raw_seq !== null) {
    const rawSeq = integer(record.raw_seq, 'normalized.raw_seq')
    if (rawSeq < 1 || rawSeq > latestRawSeq) throw new Error('normalized raw_seq is outside run bounds')
  }
}

async function lines(path: string): Promise<unknown[]> {
  const text = await readFile(path, 'utf8')
  return text.split('\n').filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line) as unknown
    } catch (error) {
      throw new Error(`${path}:${index + 1} is not JSON`, { cause: error })
    }
  })
}

async function validateRaw(value: unknown, runRoot: string, runId: string, expectedSeq: number): Promise<boolean> {
  const record = object(value, 'raw record') as unknown as RawEnvelope
  if (record.schema !== 'pump.raw/1' || record.dataset_version !== DATASET_VERSION) throw new Error('raw schema/version mismatch')
  if (record.run_id !== runId) throw new Error('raw run reference mismatch')
  if (record.seq !== expectedSeq) throw new Error(`raw sequence discontinuity: expected ${expectedSeq}, got ${record.seq}`)
  iso(record.received_at, 'raw.received_at')
  const bytes = record.payload_raw !== null
    ? Buffer.from(record.payload_raw, 'utf8')
    : record.blob_ref !== null
      ? await readFile(join(runRoot, record.blob_ref.path))
      : (() => { throw new Error('raw record has neither inline payload nor blob') })()
  if (bytes.byteLength !== record.byte_len) throw new Error(`raw byte length mismatch at seq ${record.seq}`)
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== record.sha256) throw new Error(`raw hash mismatch at seq ${record.seq}`)
  return record.blob_ref !== null
}

export async function validateDatasetTree(root: string): Promise<DatasetValidationReport> {
  const contract = await readJson<{ dataset_version?: string }>(join(root, 'contract.json'))
  if (contract.dataset_version !== DATASET_VERSION) throw new Error('contract dataset version mismatch')
  const runEntries = (await readdir(join(root, 'runs'), { withFileTypes: true })).filter(entry => entry.isDirectory())
  let rawRecords = 0
  let normalizedRecords = 0
  let blobs = 0
  for (const entry of runEntries) {
    const runRoot = join(root, 'runs', entry.name)
    const manifest = await readJson<unknown>(join(runRoot, 'manifest.json'))
    validateManifest(manifest)
    const rawFiles = (await readdir(join(runRoot, 'raw'), { withFileTypes: true })).filter(file => file.isFile() && file.name.endsWith('.ndjson'))
    const raw = (await Promise.all(rawFiles.map(file => lines(join(runRoot, 'raw', file.name))))).flat()
    const ordered = raw.map(value => object(value, 'raw record')).sort((a, b) => Number(a.seq) - Number(b.seq))
    for (let index = 0; index < ordered.length; index += 1) {
      if (await validateRaw(ordered[index], runRoot, manifest.run_id, index + 1)) blobs += 1
    }
    if (ordered.length !== manifest.latest_raw_seq) throw new Error(`manifest raw count mismatch for ${manifest.run_id}`)
    rawRecords += ordered.length
    const normalizedFiles = (await readdir(join(runRoot, 'normalized'), { withFileTypes: true })).filter(file => file.isFile() && file.name.endsWith('.ndjson'))
    for (const file of normalizedFiles) {
      const records = await lines(join(runRoot, 'normalized', file.name))
      for (const record of records) validateNormalizedRecord(record, manifest.run_id, manifest.latest_raw_seq)
      normalizedRecords += records.length
    }
  }
  return { runs: runEntries.length, raw_records: rawRecords, normalized_records: normalizedRecords, blobs }
}
