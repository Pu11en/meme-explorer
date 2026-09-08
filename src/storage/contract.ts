export const DATASET_VERSION = '1.0.0' as const

export const RECORD_SCHEMAS = Object.freeze([
  'pump.raw/1',
  'pump.token/1',
  'pump.event/1',
  'pump.trade/1',
  'pump.wallet/1',
  'pump.curve/1',
  'pump.migration/1',
  'pump.metadata/1',
  'pump.market/1',
  'pump.reliability/1',
  'pump.candle/1',
  'pump.trade-summary/1',
] as const)

export const DATASET_CONTRACT = Object.freeze({
  dataset_version: DATASET_VERSION,
  record_schemas: RECORD_SCHEMAS,
  durations_ms: [300_000, 600_000],
  run_statuses: ['starting', 'running', 'stopping', 'stopped', 'interrupted', 'error'],
  stop_reasons: ['timer_expired', 'manual_early', 'interrupted', 'error'],
  transports: ['live', 'replay', 'fetch', 'poll', 'derived'],
  commitments: ['processed', 'confirmed', 'finalized', 'provider', 'unknown'],
  reliability_states: [
    'ok', 'missing', 'not_indexed', 'rate_limited', 'blocked', 'timeout',
    'decode_error', 'failed', 'gap', 'no_route', 'unknown',
  ],
  invariants: [
    'raw records are immutable and carry exact byte hash/length',
    'raw seq is strictly monotonic within a run',
    'provider numeric quantities remain exact strings with mint/decimals context',
    'absence is null plus reliability state, never a false zero',
    'normalized records require source and received_at provenance',
    'at most one run is active per Host process',
    'duration is exactly 300000 or 600000 milliseconds',
    'derived records carry reproducible formula versions',
  ],
})

export type RecordSchema = typeof RECORD_SCHEMAS[number]
