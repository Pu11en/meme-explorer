import {
  FIELD_REGISTRY,
  FEATURE_SCHEMA,
  FORMULA,
  object,
  identifier,
  validateFeatures,
  type Expression,
  type Field,
  type FeatureRow,
  type Features,
  type FilterDefinition,
  type Cohort,
} from '../contracts/first-minute.js'
import { parseExactDecimal } from '../../derived/decimal.js'
import { digest } from './artifacts.js'
export interface Evaluation {
  value: boolean | null
  reasons: string[]
}
function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER
}
export function validateExpression(value: unknown, depth = 0): asserts value is Expression {
  if (depth > 20) throw new Error('expression too deep')
  const e = object(value)
  if (e.op === 'all' || e.op === 'any') {
    if (!Array.isArray(e.args) || !e.args.length || e.args.length > 100)
      throw new Error('invalid composition')
    for (const a of e.args) validateExpression(a, depth + 1)
    return
  }
  if (e.op === 'not') {
    validateExpression(e.arg, depth + 1)
    return
  }
  if (e.op === 'shape') {
    if (
      !['buy_buckets', 'arrival_buckets'].includes(String(e.series)) ||
      !['sustained', 'opening-burst', 'building'].includes(String(e.mode)) ||
      !finite(e.threshold) ||
      e.threshold < 0 ||
      (e.mode === 'opening-burst' && e.threshold > 1) ||
      (e.mode === 'building' && e.threshold < 1) ||
      (e.mode === 'sustained' && !Number.isSafeInteger(e.threshold))
    )
      throw new Error('invalid shape')
    return
  }
  if (e.op === 'ratio') {
    if (
      e.numerator !== 'repeat_buy_count' ||
      e.denominator !== 'buy_count' ||
      !finite(e.minimum) ||
      e.minimum < 0 ||
      e.minimum > 1
    )
      throw new Error('invalid ratio')
    return
  }
  if (typeof e.field !== 'string' || !Object.hasOwn(FIELD_REGISTRY, e.field))
    throw new Error('unsupported field or observation time')
  const field = FIELD_REGISTRY[e.field as Field]
  if (e.op === 'present') {
    if (typeof e.value !== 'boolean') throw new Error('invalid presence')
    return
  }
  const valid = (v: unknown) => (field.type === 'number' ? finite(v) : typeof v === 'string')
  if (e.op === 'eq') {
    if (!valid(e.value)) throw new Error('invalid comparison type')
    return
  }
  if (e.op === 'gte' || e.op === 'lte') {
    if (field.type !== 'number' || !finite(e.value)) throw new Error('invalid numeric comparison')
    return
  }
  if (e.op === 'in') {
    if (!Array.isArray(e.values) || !e.values.length || !e.values.every(valid))
      throw new Error('invalid membership')
    return
  }
  if (e.op === 'range') {
    if (field.type !== 'number' || !finite(e.min) || !finite(e.max) || e.min > e.max)
      throw new Error('invalid range')
    return
  }
  throw new Error('unsupported operator')
}
export function validateDefinition(v: unknown): asserts v is FilterDefinition {
  const d = object(v)
  identifier(d.id)
  if (
    d.schema !== 'pump.filter-definition/1' ||
    d.source_schema !== FEATURE_SCHEMA ||
    d.formula_version !== FORMULA ||
    d.window_ms !== 60000 ||
    d.missing_policy !== 'unknown' ||
    typeof d.version !== 'string' ||
    !d.version ||
    typeof d.name !== 'string' ||
    typeof d.description !== 'string'
  )
    throw new Error('incompatible filter definition')
  object(d.parameters)
  validateExpression(d.expression)
}
function fractionAtLeast(n: number, d: number, threshold: number): boolean {
  const t = parseExactDecimal(String(threshold))
  return BigInt(n) * 10n ** BigInt(t.scale) >= BigInt(d) * t.coefficient
}
function result(value: boolean | null, reason: string): Evaluation {
  return { value, reasons: value === true ? [] : [reason] }
}
export function evaluate(e: Expression, row: FeatureRow): Evaluation {
  if (e.op === 'all' || e.op === 'any') {
    const a = e.args.map((x) => evaluate(x, row))
    const value =
      e.op === 'all'
        ? a.some((x) => x.value === false)
          ? false
          : a.some((x) => x.value === null)
            ? null
            : true
        : a.some((x) => x.value === true)
          ? true
          : a.some((x) => x.value === null)
            ? null
            : false
    return { value, reasons: value === true ? [] : [...new Set(a.flatMap((x) => x.reasons))].sort() }
  }
  if (e.op === 'not') {
    const r = evaluate(e.arg, row)
    return {
      value: r.value === null ? null : !r.value,
      reasons: r.value === null ? r.reasons : r.value ? ['negated_predicate_matched'] : [],
    }
  }
  if (e.op === 'ratio') {
    const n = row[e.numerator],
      d = row[e.denominator]
    if (n === null || d === null || d === 0) return result(null, 'repeat_ratio_unavailable')
    return result(fractionAtLeast(n, d, e.minimum), 'repeat_ratio_below_minimum')
  }
  if (e.op === 'shape') {
    const a = row[e.series]
    if (a === null) return result(null, e.series + '_unavailable')
    let pass: boolean
    if (e.mode === 'sustained') pass = a.every((v) => v >= e.threshold)
    else {
      const opening = (a[0] ?? 0) + (a[1] ?? 0),
        closing = (a[4] ?? 0) + (a[5] ?? 0),
        total = a.reduce((x, y) => x + y, 0)
      pass =
        e.mode === 'opening-burst'
          ? total > 0 && fractionAtLeast(opening, total, e.threshold)
          : opening > 0 && fractionAtLeast(closing, opening, e.threshold)
    }
    return result(pass, e.series + '_' + e.mode + '_failed')
  }
  if (!('field' in e)) throw new Error('invalid predicate')
  const v = row[e.field]
  if (e.op === 'present') return result((v !== null) === e.value, e.field + '_presence_failed')
  if (v === null) return result(null, e.field + '_unavailable')
  if (e.op === 'eq') return result(v === e.value, e.field + '_not_equal')
  if (e.op === 'gte') return result((v as number) >= (e.value as number), e.field + '_below_minimum')
  if (e.op === 'lte') return result((v as number) <= (e.value as number), e.field + '_above_maximum')
  if (e.op === 'range')
    return result((v as number) >= e.min && (v as number) <= e.max, e.field + '_outside_range')
  if (e.op === 'in') return result(e.values.includes(v), e.field + '_not_in_set')
  throw new Error('invalid comparison')
}
export function filterFeatures(features: Features, definition: FilterDefinition): Cohort {
  validateFeatures(features)
  validateDefinition(definition)
  const { content_hash, result_id, ...sourceContent } = features
  if (!result_id || digest(sourceContent) !== content_hash) throw new Error('source content hash mismatch')
  const decisions = features.rows.map((row) => {
    const e = evaluate(definition.expression, row)
    return {
      observation_id: row.observation_id,
      mint: row.mint,
      run_id: row.run_id,
      status:
        e.value === null ? ('unobservable' as const) : e.value ? ('member' as const) : ('rejected' as const),
      reasons: [...new Set([...e.reasons, ...(e.value !== true ? row.reasons : [])])].sort(),
    }
  })
  const summary = {
    input: decisions.length,
    members: 0,
    rejected: 0,
    unobservable: 0,
    missing_selected: 0,
    reasons: {} as Record<string, number>,
  }
  for (let i = 0; i < decisions.length; i++) {
    const d = decisions[i]!
    if (d.status === 'member') {
      summary.members++
      const r = features.rows[i]!
      if (r.observation_status !== 'complete' || r.buyer_identity_status !== 'complete')
        summary.missing_selected++
    } else if (d.status === 'rejected') summary.rejected++
    else summary.unobservable++
    for (const reason of d.reasons) summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1
  }
  const content = {
    schema: 'pump.filter-cohort/1' as const,
    batch_id: features.batch.batch_id,
    source_result_id: features.result_id,
    source_content_hash: features.content_hash,
    definition,
    definition_hash: digest(definition),
    decisions,
    summary,
  }
  const hash = digest(content)
  return { ...content, content_hash: hash, result_id: definition.id + '-' + hash.slice(0, 16) }
}
