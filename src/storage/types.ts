import type { RecordSchema } from './contract.js'

export type RunDatasetStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'interrupted' | 'error'
export type DatasetStopReason = 'timer_expired' | 'manual_early' | 'interrupted' | 'error'
export type Transport = 'live' | 'replay' | 'fetch' | 'poll' | 'derived'
export type Commitment = 'processed' | 'confirmed' | 'finalized' | 'provider' | 'unknown'

export interface FlushPolicy {
  readonly max_records: number
  readonly max_delay_ms: number
}

export interface RunCounts {
  readonly raw_records: number
  readonly normalized_records: number
  readonly tokens: number
  readonly reliability_records: number
}

export interface RunRepairState {
  readonly status: 'not_attempted' | 'in_progress' | 'partial' | 'complete' | 'failed'
  readonly updated_at: string | null
  readonly accepted_events: number
  readonly rejected_events: number
  readonly duplicate_events: number
  readonly missing_archives: readonly string[]
}

export interface RunManifest {
  readonly schema: 'pump.run/1'
  readonly dataset_version: '1.0.0'
  readonly run_id: string
  readonly label: string
  readonly sequence: number
  readonly duration_ms: 300_000 | 600_000
  readonly status: RunDatasetStatus
  readonly stop_reason: DatasetStopReason | null
  readonly created_at: string
  readonly started_at: string
  readonly stops_at: string
  readonly stopped_at: string | null
  readonly latest_raw_seq: number
  readonly durable_raw_seq: number
  readonly flush_policy: FlushPolicy
  readonly enabled_adapters: readonly string[]
  readonly repair: RunRepairState
  readonly counts: RunCounts
}

export interface BlobRef {
  readonly sha256: string
  readonly size: number
  readonly media_type: string | null
  readonly path: string
}

export interface RawEnvelope {
  readonly schema: 'pump.raw/1'
  readonly dataset_version: '1.0.0'
  readonly run_id: string
  readonly seq: number
  readonly source: string
  readonly transport: Exclude<Transport, 'derived'>
  readonly channel: string
  readonly event_id: string | null
  readonly source_at: string | null
  readonly source_slot: number | null
  readonly received_at: string
  readonly received_mono_ms: number | null
  readonly commitment: Commitment
  readonly parser_version: string | null
  readonly sha256: string
  readonly byte_len: number
  readonly payload_raw: string | null
  readonly blob_ref: BlobRef | null
  readonly in_window: boolean
  readonly ingested_after_stop: boolean
}

export interface RawAppendInput {
  readonly stream: 'pumpapi-live' | 'pumpapi-replay' | 'metadata' | 'dexscreener-pairs' | 'dexscreener-solusd'
  readonly source: string
  readonly transport: Exclude<Transport, 'derived'>
  readonly channel: string
  readonly payload: Uint8Array
  readonly mediaType?: string
  readonly eventId?: string
  readonly sourceAt?: string
  readonly sourceSlot?: number
  readonly receivedAt?: string
  readonly receivedMonoMs?: number
  readonly commitment?: Commitment
  readonly parserVersion?: string
  readonly ingestedAfterStop?: boolean
}

export interface NormalizedRecord {
  readonly schema: Exclude<RecordSchema, 'pump.raw/1'>
  readonly dataset_version: '1.0.0'
  readonly run_id: string
  readonly source: string
  readonly received_at: string
  readonly mint?: string | null
  readonly raw_seq?: number | null
  readonly [key: string]: unknown
}

export type NormalizedFamily =
  | 'tokens'
  | 'events'
  | 'trades'
  | 'wallets'
  | 'curves'
  | 'migrations'
  | 'metadata'
  | 'markets'
  | 'reliability'

export interface RunCatalogRecord {
  readonly schema: 'pump.catalog/1'
  readonly dataset_version: '1.0.0'
  readonly run_id: string
  readonly action: 'created' | 'finalized' | 'interrupted' | 'repaired'
  readonly at: string
  readonly status: RunDatasetStatus
  readonly stop_reason: DatasetStopReason | null
}
