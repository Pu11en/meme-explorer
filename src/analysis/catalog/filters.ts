import { FEATURE_SCHEMA, FORMULA, type Expression, type FilterDefinition } from '../contracts/first-minute.js'
import { validateDefinition } from '../filters/evaluate.js'
export const FILTERS = [
  {
    id: 'observable-launches',
    name: 'Complete First-Minute Coverage',
    description: 'Select launches with a fully observed first minute.',
    defaults: {},
  },
  {
    id: 'minimum-buy-activity',
    name: 'Minimum Buy Activity',
    description: 'Select launches with at least the requested first-minute buy count.',
    defaults: { min_buys: 10 },
  },
  {
    id: 'buyer-diversity',
    name: 'Buyer Diversity',
    description: 'Select launches with at least the requested distinct buying wallets in the first minute.',
    defaults: { min_unique_buyers: 5 },
  },
  {
    id: 'repeat-buyer-concentration',
    name: 'Repeat-Buyer Concentration',
    description: 'Select launches whose fraction of buys beyond each wallet’s first buy meets a threshold.',
    defaults: { min_repeat_ratio: 0.5 },
  },
  {
    id: 'launch-activity-shape',
    name: 'Buy Activity Shape',
    description: 'Select sustained, opening-burst or building buy activity during the first minute.',
    defaults: { mode: 'sustained', min_buys_per_bucket: 1 },
  },
  {
    id: 'new-buyer-arrival-rate',
    name: 'New Buyer Arrival Rate',
    description:
      'Select steady new buyers: each ten-second segment of the first minute meets a new-wallet minimum.',
    defaults: { min_new_buyers_per_bucket: 1 },
  },
] as const
export function definition(id: string, overrides: Record<string, unknown> = {}): FilterDefinition {
  const entry = FILTERS.find((f) => f.id === id)
  if (!entry) throw new Error('unknown filter: ' + id)
  let defaults: Record<string, string | number> = { ...entry.defaults }
  if (id === 'launch-activity-shape') {
    const mode = overrides.mode ?? 'sustained'
    defaults =
      mode === 'opening-burst'
        ? { mode, min_opening_share: 0.7 }
        : mode === 'building'
          ? { mode, growth_factor: 2 }
          : mode === 'sustained'
            ? { mode, min_buys_per_bucket: 1 }
            : {}
    if (!defaults.mode) throw new Error('unknown shape mode')
  }
  for (const [k, v] of Object.entries(overrides))
    if (!Object.hasOwn(defaults, k) || typeof v !== typeof defaults[k])
      throw new Error('unsupported parameter: ' + k)
  const p = { ...defaults, ...overrides } as Record<string, string | number>
  for (const [k, v] of Object.entries(p))
    if (
      typeof v === 'number' &&
      (!Number.isFinite(v) ||
        v < 0 ||
        v > Number.MAX_SAFE_INTEGER ||
        ((k === 'min_buys' || k === 'min_unique_buyers' || k.includes('per_bucket')) &&
          !Number.isSafeInteger(v)))
    )
      throw new Error('invalid parameter: ' + k)
  if (id === 'new-buyer-arrival-rate' && (p.min_new_buyers_per_bucket as number) < 1)
    throw new Error('new buyer minimum must be positive')
  // Ordinary numeric/series fields are null on incomplete windows: preserve unknown through composition.
  let expression: Expression
  switch (id) {
    case 'observable-launches':
      expression = { op: 'eq', field: 'observation_status', value: 'complete' }
      break
    case 'minimum-buy-activity':
      expression = { op: 'gte', field: 'buy_count', value: p.min_buys! }
      break
    case 'buyer-diversity':
      expression = { op: 'gte', field: 'unique_buyers', value: p.min_unique_buyers! }
      break
    case 'repeat-buyer-concentration':
      expression = {
        op: 'ratio',
        numerator: 'repeat_buy_count',
        denominator: 'buy_count',
        minimum: p.min_repeat_ratio as number,
      }
      break
    case 'new-buyer-arrival-rate':
      expression = {
        op: 'shape',
        series: 'arrival_buckets',
        mode: 'sustained',
        threshold: p.min_new_buyers_per_bucket as number,
      }
      break
    default:
      expression = {
        op: 'shape',
        series: 'buy_buckets',
        mode: p.mode as 'sustained' | 'opening-burst' | 'building',
        threshold: (p.min_buys_per_bucket ?? p.min_opening_share ?? p.growth_factor) as number,
      }
  }
  const d: FilterDefinition = {
    schema: 'pump.filter-definition/1',
    id,
    version: '1.0.0',
    name: entry.name,
    description: entry.description,
    source_schema: FEATURE_SCHEMA,
    formula_version: FORMULA,
    window_ms: 60000,
    missing_policy: 'unknown',
    parameters: p,
    expression,
  }
  validateDefinition(d)
  return d
}
