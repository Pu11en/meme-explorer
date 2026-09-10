import assert from 'node:assert/strict'
import test from 'node:test'
import { extractFeatures } from '../lib/analysis/filters/extract.js'
import { definition, FILTERS } from '../lib/analysis/catalog/filters.js'
import {
  evaluate,
  filterFeatures,
  validateExpression,
  validateDefinition,
} from '../lib/analysis/filters/evaluate.js'
import { validateFeatures } from '../lib/analysis/contracts/first-minute.js'
import { digest, boundedReceipt } from '../lib/analysis/filters/artifacts.js'
const epoch = Date.parse('2026-01-01T00:00:00Z')
const at = (n) => new Date(epoch + n).toISOString()
export function frame(mint, ms, payload) {
  return {
    source_at: ms === null ? null : at(ms),
    received_at: at(ms ?? 0),
    payload_raw: JSON.stringify({ mint, ...payload }),
  }
}
const create = (mint, ms = 0, extra = {}) => frame(mint, ms, { action: 'create', pool: 'pump', ...extra })
const buy = (mint, ms, wallet, sig, extra = {}) =>
  frame(mint, ms, {
    action: 'buy',
    signature: sig,
    ...(wallet === null ? {} : { txSigner: wallet }),
    ...extra,
  })
export async function fixture(
  records,
  { end = 60000, reliability = [], replay = [], id = 'run-fixture', batchId = 'batch-test' } = {},
) {
  const asFile = (name, values) => ({
    name,
    lines: async function* () {
      for (const r of values) yield typeof r === 'string' ? r : JSON.stringify(r)
    },
  })
  const manifest = {
    run_id: id,
    status: 'stopped',
    started_at: at(0),
    stops_at: at(end),
    stopped_at: at(end),
    counts: { raw_records: records.length + replay.length },
  }
  return extractFeatures(
    { schema: 'pump.collection-batch/1', batch_id: batchId, label: 'Fixture', run_ids: [id] },
    [
      {
        runId: id,
        manifest,
        manifestText: JSON.stringify(manifest),
        raw: [
          asFile('raw/pumpapi-live.ndjson', records),
          ...(replay.length ? [asFile('raw/pumpapi-replay.ndjson', replay)] : []),
        ],
        reliability: asFile('normalized/reliability.ndjson', reliability),
        blob: async () => {
          throw Error('unexpected blob')
        },
      },
    ],
  )
}
const one = (f, m) => f.rows.find((x) => x.mint === m)
test('source-time windows, independent explicit bars and first-wallet arrivals survive shuffled order and replay duplicates', async () => {
  const records = [
    buy('A', 12000, 'W1', 'tx12'),
    create('A'),
    buy('A', -1, 'PRE', 'negative'),
    buy('A', 0, 'W0', 'zero'),
    buy('A', 4000, 'W1', 'tx4'),
    buy('A', 9999, 'W2', 'tx9'),
    buy('A', 10000, 'W3', 'tx10'),
    buy('A', 59999, 'W4', 'tx59'),
    buy('A', 60000, 'OUT', 'tx60'),
    create('Other', 0, { pool: 'meteora-launchpad' }),
  ]
  const f = await fixture(records, { replay: [records[0], records[4]] })
  const r = one(f, 'A')
  assert.equal(f.rows.length, 1)
  assert.equal(r.buy_count, 6)
  assert.equal(r.unique_buyers, 5)
  assert.equal(r.repeat_buy_count, 1)
  assert.deepEqual(r.buy_buckets, [3, 2, 0, 0, 0, 1])
  assert.deepEqual(r.arrival_buckets, [3, 1, 0, 0, 0, 1])
  const buys = Array(60).fill(0)
  for (const i of [0, 4, 9, 10, 12, 59]) buys[i] = 1
  const arrivals = [...buys]
  arrivals[12] = 0
  assert.deepEqual(r.buy_bars, buys)
  assert.deepEqual(r.arrival_bars, arrivals)
  assert.equal(f.sources[0].duplicate_buys, 2)
  const shuffled = await fixture([...records].reverse())
  assert.deepEqual(shuffled.rows, f.rows)
  const rerun = await fixture(records, { replay: [records[0], records[4]] })
  assert.equal(rerun.content_hash, f.content_hash)
  for (const filter of FILTERS) {
    const a = filterFeatures(f, definition(filter.id)),
      b = filterFeatures(rerun, definition(filter.id))
    assert.deepEqual(a, b)
  }
})
test('creation buys and multiple same-transaction instructions remain distinct', async () => {
  const f = await fixture([
    create('A', 0, {
      signature: 'creation',
      breakdown: [
        { action: 'buy', trader: 'W1', quoteAmount: 1 },
        { action: 'buy', trader: 'W2', quoteAmount: 2 },
      ],
    }),
    buy('A', 1000, 'W1', 'same', { instructionIndex: 0 }),
    buy('A', 1000, 'W2', 'same', { instructionIndex: 1 }),
  ])
  assert.equal(one(f, 'A').buy_count, 4)
  assert.equal(one(f, 'A').unique_buyers, 2)
})
test('complete zero, partial coverage and missing wallets have different behavior', async () => {
  const f = await fixture([
    create('zero'),
    create('late', 35000),
    create('missing'),
    buy('missing', 1000, null, 'missing'),
    create('repeat'),
    ...Array.from({ length: 10 }, (_, i) => buy('repeat', i * 1000, 'W' + (i % 5), 'T' + i)),
  ])
  assert.equal(one(f, 'zero').buy_count, 0)
  assert.equal(one(f, 'late').buy_count, null)
  assert.equal(one(f, 'missing').buy_count, 1)
  assert.equal(one(f, 'missing').unique_buyers, null)
  assert.equal(
    evaluate(definition('minimum-buy-activity', { min_buys: 0 }).expression, one(f, 'zero')).value,
    true,
  )
  assert.equal(
    evaluate(definition('minimum-buy-activity', { min_buys: 0 }).expression, one(f, 'late')).value,
    null,
  )
  assert.equal(
    evaluate(definition('buyer-diversity', { min_unique_buyers: 0 }).expression, one(f, 'missing')).value,
    null,
  )
  assert.equal(
    evaluate({ op: 'not', arg: { op: 'gte', field: 'unique_buyers', value: 5 } }, one(f, 'missing')).value,
    null,
  )
  assert.equal(evaluate(definition('repeat-buyer-concentration').expression, one(f, 'repeat')).value, true)
  assert.equal(evaluate(definition('repeat-buyer-concentration').expression, one(f, 'zero')).value, null)
  for (const d of FILTERS) {
    const c = filterFeatures(f, definition(d.id))
    assert.equal(c.summary.members + c.summary.rejected + c.summary.unobservable, c.summary.input)
  }
  const custom = {
    ...definition('observable-launches'),
    expression: { op: 'present', field: 'buy_count', value: false },
  }
  assert.equal(filterFeatures(f, custom).summary.missing_selected, 1)
})
test('gaps, unreadable envelopes, missing timestamps and conflicting identities fail visibly', async () => {
  const f = await fixture([
    create('A'),
    buy('A', 1000, 'W', 'S'),
    buy('A', 1000, 'DIFFERENT', 'S'),
    create('B', null),
    create('C'),
    buy('C', null, 'W', 'T'),
  ])
  assert(one(f, 'A').reasons.includes('conflicting_duplicate_buy'))
  assert(one(f, 'B').reasons.includes('missing_creation_timestamp'))
  assert(one(f, 'C').reasons.includes('missing_buy_timestamp'))
  const g = await fixture([create('gap'), frame('gap', 11000, { action: 'sell' })], {
    reliability: [{ kind: 'disconnected', status: 'gap', received_at: at(10000) }],
  })
  assert(one(g, 'gap').reasons.includes('stream_gap'))
  const malformed = await fixture([create('A'), '{bad json'])
  assert(one(malformed, 'A').reasons.includes('unreadable_untimed_record'))
  const noid = await fixture([create('A'), buy('A', 1, 'W', undefined)])
  assert(one(noid, 'A').reasons.includes('missing_event_identity'))
})
test('all six definitions and every shape mode have exact positive and negative oracle cases', async () => {
  const rows = [
    create('sustained'),
    create('burst'),
    create('building'),
    create('diverse'),
    create('concentrated'),
    create('nine'),
    create('ten'),
    create('eleven'),
  ]
  for (const [name, counts] of [
    ['sustained', [5, 5, 5, 5, 5, 5]],
    ['burst', [12, 3, 1, 0, 1, 0]],
    ['building', [1, 1, 2, 2, 3, 3]],
  ])
    for (let b = 0; b < 6; b++)
      for (let j = 0; j < counts[b]; j++)
        rows.push(buy(name, b * 10000 + j, 'W' + b + '-' + j, name + b + '-' + j))
  for (const name of ['diverse', 'concentrated', 'nine', 'ten', 'eleven'])
    for (let i = 0; i < ({ nine: 9, ten: 10, eleven: 11 }[name] ?? 10); i++)
      rows.push(buy(name, i * 1000, name === 'concentrated' ? 'W' : 'W' + i, name + i))
  const f = await fixture(rows)
  const matches = (id, params = {}) =>
    filterFeatures(f, definition(id, params))
      .decisions.filter((r) => r.status === 'member')
      .map((r) => r.mint)
  assert.deepEqual(matches('new-buyer-arrival-rate', { min_new_buyers_per_bucket: 5 }), ['sustained'])
  assert(matches('launch-activity-shape').includes('sustained'))
  assert(!matches('launch-activity-shape').includes('burst'))
  assert(matches('launch-activity-shape', { mode: 'opening-burst' }).includes('burst'))
  assert(matches('launch-activity-shape', { mode: 'building' }).includes('building'))
  assert.deepEqual(matches('repeat-buyer-concentration'), ['concentrated'])
  assert(matches('buyer-diversity').includes('diverse'))
  assert(!matches('buyer-diversity').includes('concentrated'))
  const activity = matches('minimum-buy-activity')
  assert(!activity.includes('nine'))
  assert(activity.includes('ten'))
  assert(activity.includes('eleven'))
  assert.equal(matches('observable-launches').length, 8)
})
test('typed composition and versions reject invalid operators, parameters and legacy inputs', async () => {
  const f = await fixture([create('A'), buy('A', 1, 'W', 'S')])
  const r = one(f, 'A')
  assert.equal(
    evaluate(
      {
        op: 'all',
        args: [
          { op: 'range', field: 'buy_count', min: 1, max: 2 },
          { op: 'in', field: 'observation_status', values: ['complete'] },
        ],
      },
      r,
    ).value,
    true,
  )
  assert.equal(
    evaluate(
      {
        op: 'any',
        args: [
          { op: 'eq', field: 'buy_count', value: 2 },
          { op: 'eq', field: 'buy_count', value: 1 },
        ],
      },
      r,
    ).value,
    true,
  )
  for (const expr of [
    { op: 'eval', field: 'buy_count' },
    { op: 'gte', field: 'observation_status', value: 2 },
    { op: 'gte', field: 'buy_count', value: '1' },
    { op: 'gte', field: 'market_cap_at_61s', value: 1 },
  ])
    assert.throws(() => validateExpression(expr))
  for (const [id, p] of [
    ['minimum-buy-activity', { min_buys: -1 }],
    ['minimum-buy-activity', { min_buys: 1.5 }],
    ['new-buyer-arrival-rate', { min_new_buyers_per_bucket: 0 }],
    ['repeat-buyer-concentration', { min_repeat_ratio: 1.1 }],
    ['launch-activity-shape', { mode: 'building', min_buys_per_bucket: 1 }],
  ])
    assert.throws(() => definition(id, p))
  assert.throws(() => validateFeatures({ ...f, window_ms: 10000 }))
  assert.throws(() => validateDefinition({ ...definition('observable-launches'), window_ms: 30000 }))
  assert.throws(() => validateFeatures({ ...f, rows: [r, r] }))
  assert.throws(() => boundedReceipt({ big: 'x'.repeat(65536) }))
  const other = await fixture([create('A'), buy('A', 1, 'W', 'S')], { batchId: 'batch-other' })
  assert.deepEqual(
    filterFeatures(other, definition('minimum-buy-activity')).decisions,
    filterFeatures(f, definition('minimum-buy-activity')).decisions,
  )
  assert.equal(digest(definition('buyer-diversity')), digest(definition('buyer-diversity')))
})
test('finalized input requirement rejects running and mutated source files', async () => {
  const m = { run_id: 'r', status: 'running', started_at: at(0), stopped_at: at(60000), stops_at: at(60000) }
  const empty = { name: 'raw/pumpapi-live.ndjson', lines: async function* () {} }
  const input = {
    runId: 'r',
    manifest: m,
    manifestText: JSON.stringify(m),
    raw: [empty],
    reliability: empty,
    blob: async () => '',
  }
  await assert.rejects(
    () =>
      extractFeatures({ schema: 'pump.collection-batch/1', batch_id: 'b', label: 'B', run_ids: ['r'] }, [
        input,
      ]),
    /finalized/,
  )
})
test('nested buys are attributed to their own mint and source mutation fails closed', async () => {
  const f = await fixture([
    create('A', 0, { signature: 'multi', breakdown: [{ mint: 'B', action: 'buy', trader: 'W' }] }),
    create('B'),
  ])
  assert.equal(one(f, 'A').buy_count, 0)
  assert.equal(one(f, 'B').buy_count, 1)
  const m = { run_id: 'r', status: 'stopped', started_at: at(0), stopped_at: at(60000), stops_at: at(60000) }
  let read = 0
  const raw = {
    name: 'raw/pumpapi-live.ndjson',
    lines: async function* () {
      yield JSON.stringify(create(read++ === 0 ? 'A' : 'B'))
    },
  }
  const empty = { name: 'normalized/reliability.ndjson', lines: async function* () {} }
  await assert.rejects(
    () =>
      extractFeatures({ schema: 'pump.collection-batch/1', batch_id: 'b', label: 'B', run_ids: ['r'] }, [
        {
          runId: 'r',
          manifest: m,
          manifestText: JSON.stringify(m),
          raw: [raw],
          reliability: empty,
          blob: async () => '',
        },
      ]),
    /source changed/,
  )
})
test('artifact writes are immutable and semantically identical writes can resume', async (t) => {
  const { mkdtemp, readFile, rm, readdir } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { saveArtifact } = await import('../lib/analysis/filters/artifacts.js')
  const root = await mkdtemp(join(tmpdir(), 'filter-artifacts-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const path = await saveArtifact(root, 'result.json', { a: 1, b: 2 })
  assert.equal(await saveArtifact(root, 'result.json', { b: 2, a: 1 }), path)
  await assert.rejects(() => saveArtifact(root, 'result.json', { a: 2 }))
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { a: 1, b: 2 })
  assert.deepEqual(await readdir(root), ['result.json'])
})
test('ratio threshold comparisons avoid display rounding and corrupt series cannot pass contracts', async () => {
  const f = await fixture([create('A'), buy('A', 1, 'W', '1'), buy('A', 2, 'W', '2'), buy('A', 3, 'X', '3')])
  const r = one(f, 'A')
  assert.equal(
    evaluate(definition('repeat-buyer-concentration', { min_repeat_ratio: 0.333333 }).expression, r).value,
    true,
  )
  assert.equal(
    evaluate(definition('repeat-buyer-concentration', { min_repeat_ratio: 0.333334 }).expression, r).value,
    false,
  )
  const broken = structuredClone(f)
  broken.rows[0].buy_buckets = [0, 3, 0, 0, 0, 0]
  assert.throws(() => validateFeatures(broken), /bucket mismatch/)
  assert.throws(
    () =>
      filterFeatures({ ...f, batch: { ...f.batch, label: 'changed' } }, definition('observable-launches')),
    /hash mismatch/,
  )
})

test('an unreadable event without source time cannot be placed outside a minute using its late receipt', async () => {
  const f = await fixture([
    create('A'),
    { source_at: null, received_at: at(65000), payload_raw: '{broken' },
  ], { end: 70000 })
  assert.equal(one(f, 'A').observation_status, 'unobservable')
  assert(one(f, 'A').reasons.includes('unreadable_untimed_record'))
})
