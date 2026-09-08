/** First-minute contracts deliberately reject the legacy ten-second schema. */
export const FEATURE_SCHEMA = 'pump.first-minute-features/1' as const
export const FORMULA = 'first-minute/1' as const
export const WINDOW_MS = 60_000 as const
export interface Batch {
  schema: 'pump.collection-batch/1'
  batch_id: string
  label: string
  run_ids: string[]
}
export interface FeatureRow {
  observation_id: string
  run_id: string
  mint: string
  name: string | null
  symbol: string | null
  created_at: string | null
  observation_status: 'complete' | 'unobservable'
  reasons: string[]
  buyer_identity_status: 'complete' | 'missing_wallets' | 'unobservable'
  buy_count: number | null
  unique_buyers: number | null
  known_unique_buyers: number
  missing_wallet_buys: number
  repeat_buy_count: number | null
  buy_bars: number[] | null
  arrival_bars: number[] | null
  buy_buckets: number[] | null
  arrival_buckets: number[] | null
}
export interface RunSource {
  run_id: string
  started_at: string
  ended_at: string
  raw_records: number
  raw_bytes: number
  files: { path: string; sha256: string; bytes: number }[]
  creation_venues: Record<string, number>
  pump_launches: number
  duplicate_buys: number
  gaps: { start: number; end: number }[]
  quality_reasons: string[]
}
export interface Features {
  schema: typeof FEATURE_SCHEMA
  formula_version: typeof FORMULA
  window_ms: typeof WINDOW_MS
  result_id: string
  content_hash: string
  batch: Batch
  sources: RunSource[]
  rows: FeatureRow[]
  summary: {
    observations: number
    complete: number
    unobservable: number
    zero_buys: number
    missing_wallets: number
  }
}
export const FIELD_REGISTRY = {
  observation_status: { type: 'string', unit: 'status', observed_by_ms: 60000 },
  buyer_identity_status: { type: 'string', unit: 'status', observed_by_ms: 60000 },
  buy_count: { type: 'number', unit: 'buys', observed_by_ms: 60000 },
  unique_buyers: { type: 'number', unit: 'wallets', observed_by_ms: 60000 },
  repeat_buy_count: { type: 'number', unit: 'buys', observed_by_ms: 60000 },
} as const
export type Field = keyof typeof FIELD_REGISTRY
export type Expression =
  | { op: 'all' | 'any'; args: Expression[] }
  | { op: 'not'; arg: Expression }
  | { op: 'eq' | 'gte' | 'lte'; field: Field; value: number | string }
  | { op: 'range'; field: Field; min: number; max: number }
  | { op: 'in'; field: Field; values: (string | number)[] }
  | { op: 'present'; field: Field; value: boolean }
  | { op: 'ratio'; numerator: 'repeat_buy_count'; denominator: 'buy_count'; minimum: number }
  | {
      op: 'shape'
      series: 'buy_buckets' | 'arrival_buckets'
      mode: 'sustained' | 'opening-burst' | 'building'
      threshold: number
    }
export interface FilterDefinition {
  schema: 'pump.filter-definition/1'
  id: string
  version: string
  name: string
  description: string
  source_schema: typeof FEATURE_SCHEMA
  formula_version: typeof FORMULA
  window_ms: 60000
  missing_policy: 'unknown'
  parameters: Record<string, string | number>
  expression: Expression
}
export interface Decision {
  observation_id: string
  mint: string
  run_id: string
  status: 'member' | 'rejected' | 'unobservable'
  reasons: string[]
}
export interface Cohort {
  schema: 'pump.filter-cohort/1'
  result_id: string
  content_hash: string
  batch_id: string
  source_result_id: string
  source_content_hash: string
  definition: FilterDefinition
  definition_hash: string
  decisions: Decision[]
  summary: {
    input: number
    members: number
    rejected: number
    unobservable: number
    missing_selected: number
    reasons: Record<string, number>
  }
}
export function object(v: unknown): Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('expected object')
  return v as Record<string, unknown>
}
export function identifier(v: unknown): asserts v is string {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(v))
    throw new Error('invalid identifier')
}
export function validateBatch(v: unknown): asserts v is Batch {
  const b = object(v)
  identifier(b.batch_id)
  if (
    b.schema !== 'pump.collection-batch/1' ||
    typeof b.label !== 'string' ||
    !Array.isArray(b.run_ids) ||
    b.run_ids.length === 0
  )
    throw new Error('invalid collection batch')
  b.run_ids.forEach(identifier)
  if (new Set(b.run_ids).size !== b.run_ids.length) throw new Error('duplicate run IDs')
}
function count(v: unknown): v is number {
  return Number.isSafeInteger(v) && (v as number) >= 0
}
export function validateFeatures(v: unknown): asserts v is Features {
  const f = object(v)
  validateBatch(f.batch)
  if (
    f.schema !== FEATURE_SCHEMA ||
    f.formula_version !== FORMULA ||
    f.window_ms !== WINDOW_MS ||
    !Array.isArray(f.rows) ||
    !Array.isArray(f.sources) ||
    typeof f.content_hash !== 'string' ||
    typeof f.result_id !== 'string'
  )
    throw new Error('incompatible first-minute features')
  const keys = new Set<string>()
  for (const value of f.rows) {
    const r = object(value)
    if (
      typeof r.run_id !== 'string' ||
      !f.batch.run_ids.includes(r.run_id) ||
      typeof r.mint !== 'string' ||
      r.mint.length === 0 ||
      r.observation_id !== JSON.stringify([r.run_id, r.mint]) ||
      keys.has(r.observation_id as string)
    )
      throw new Error('invalid or duplicate observation key')
    keys.add(r.observation_id as string)
    if (![r.name, r.symbol].every((v) => v === null || typeof v === 'string'))
      throw new Error('invalid display metadata')
    if (
      !Array.isArray(r.reasons) ||
      !r.reasons.every((x) => typeof x === 'string') ||
      !count(r.known_unique_buyers) ||
      !count(r.missing_wallet_buys)
    )
      throw new Error('invalid quality counts')
    if (r.observation_status === 'complete') {
      if (
        r.reasons.length ||
        typeof r.created_at !== 'string' ||
        !Number.isFinite(Date.parse(r.created_at)) ||
        !count(r.buy_count)
      )
        throw new Error('invalid complete row')
      for (const [field, length] of [
        ['buy_bars', 60],
        ['buy_buckets', 6],
      ] as const) {
        const values = r[field]
        if (
          !Array.isArray(values) ||
          values.length !== length ||
          !values.every(count) ||
          values.reduce((a, b) => a + b, 0) !== r.buy_count
        )
          throw new Error('invalid buy series')
      }
      const buyBars = r.buy_bars as number[],
        buyBuckets = r.buy_buckets as number[]
      if (buyBuckets.some((v, i) => v !== buyBars.slice(i * 10, i * 10 + 10).reduce((a, b) => a + b, 0)))
        throw new Error('buy bucket mismatch')
      if (r.known_unique_buyers + r.missing_wallet_buys > r.buy_count)
        throw new Error('impossible buyer counts')
      if (r.buyer_identity_status === 'complete') {
        if (
          r.missing_wallet_buys !== 0 ||
          !count(r.unique_buyers) ||
          r.unique_buyers > r.buy_count ||
          r.known_unique_buyers !== r.unique_buyers ||
          r.repeat_buy_count !== r.buy_count - r.unique_buyers
        )
          throw new Error('invalid buyer counts')
        for (const [field, length] of [
          ['arrival_bars', 60],
          ['arrival_buckets', 6],
        ] as const) {
          const a = r[field]
          if (
            !Array.isArray(a) ||
            a.length !== length ||
            !a.every(count) ||
            a.reduce((x, y) => x + y, 0) !== r.unique_buyers
          )
            throw new Error('invalid arrival series')
        }
        const arrivals = r.arrival_bars as number[],
          arrivalBuckets = r.arrival_buckets as number[]
        if (
          arrivals.some((v, i) => v > buyBars[i]!) ||
          arrivalBuckets.some((v, i) => v !== arrivals.slice(i * 10, i * 10 + 10).reduce((a, b) => a + b, 0))
        )
          throw new Error('arrival bucket mismatch')
      } else if (
        r.buyer_identity_status !== 'missing_wallets' ||
        r.missing_wallet_buys === 0 ||
        r.unique_buyers !== null ||
        r.repeat_buy_count !== null ||
        r.arrival_bars !== null ||
        r.arrival_buckets !== null
      )
        throw new Error('invalid missing wallets')
    } else if (
      r.observation_status !== 'unobservable' ||
      r.reasons.length === 0 ||
      r.buyer_identity_status !== 'unobservable' ||
      [
        'buy_count',
        'unique_buyers',
        'repeat_buy_count',
        'buy_bars',
        'arrival_bars',
        'buy_buckets',
        'arrival_buckets',
      ].some((k) => r[k] !== null)
    )
      throw new Error('invalid unobservable row')
  }
  const summary = object(f.summary),
    rows = f.rows as unknown as FeatureRow[]
  const actual = {
    observations: rows.length,
    complete: rows.filter((r) => r.observation_status === 'complete').length,
    unobservable: rows.filter((r) => r.observation_status !== 'complete').length,
    zero_buys: rows.filter((r) => r.buy_count === 0).length,
    missing_wallets: rows.filter((r) => r.buyer_identity_status === 'missing_wallets').length,
  }
  for (const [k, v] of Object.entries(actual))
    if (summary[k] !== v) throw new Error('feature summary mismatch')
  if (f.sources.length !== f.batch.run_ids.length) throw new Error('source lineage mismatch')
  for (let i = 0; i < f.sources.length; i++) {
    const source = object(f.sources[i])
    if (
      source.run_id !== f.batch.run_ids[i] ||
      !count(source.raw_records) ||
      !count(source.raw_bytes) ||
      !Array.isArray(source.files) ||
      source.files.length === 0
    )
      throw new Error('invalid source lineage')
  }
}
