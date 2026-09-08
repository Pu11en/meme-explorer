import { createReadStream } from 'node:fs'
import { readFile, realpath } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createInterface } from 'node:readline'
import { join, resolve, relative } from 'node:path'
import {
  FEATURE_SCHEMA,
  FORMULA,
  WINDOW_MS,
  validateBatch,
  validateFeatures,
  type Batch,
  type FeatureRow,
  type Features,
  type RunSource,
} from '../contracts/first-minute.js'
import { digest, canonical } from './artifacts.js'
export interface InputFile {
  name: string
  lines: () => AsyncIterable<string>
}
export interface RunInput {
  runId: string
  manifest: Record<string, unknown>
  manifestText: string
  raw: InputFile[]
  reliability: InputFile
  blob: (path: string) => Promise<string>
}
type Obj = Record<string, unknown>
const obj = (v: unknown): Obj | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null
const string = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const first = (p: Obj, ks: string[]): string | null => {
  for (const k of ks) {
    const v = string(p[k])
    if (v !== null) return v
  }
  return null
}
const action = (p: Obj): string => {
  const a = (first(p, ['action', 'txType', 'tx_type', 'type']) ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return a === 'createtoken' ? 'create' : a
}
const time = (v: unknown): number | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}
export async function* lines(path: string): AsyncGenerator<string> {
  const stream = createReadStream(path, { encoding: 'utf8' })
  const reader = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of reader) yield line
  } finally {
    reader.close()
    stream.destroy()
  }
}
export async function fileInputs(dataRoot: string, batch: Batch): Promise<RunInput[]> {
  validateBatch(batch)
  const inputs: RunInput[] = []
  for (const id of batch.run_ids) {
    const root = await realpath(join(dataRoot, 'runs', id))
    const manifestText = await readFile(join(root, 'manifest.json'), 'utf8')
    const raw: InputFile[] = []
    for (const name of ['pumpapi-live', 'pumpapi-replay']) {
      const path = join(root, 'raw', name + '.ndjson')
      try {
        await realpath(path)
        raw.push({ name: 'raw/' + name + '.ndjson', lines: () => lines(path) })
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      }
    }
    if (!raw.length) throw new Error(`missing raw recording: ${id}`)
    inputs.push({
      runId: id,
      manifest: JSON.parse(manifestText),
      manifestText,
      raw,
      reliability: {
        name: 'normalized/reliability.ndjson',
        lines: () => lines(join(root, 'normalized/reliability.ndjson')),
      },
      blob: async (path) => {
        const p = await realpath(resolve(root, path))
        if (relative(root, p).startsWith('..') || relative(root, p) === '')
          throw new Error('invalid blob reference')
        return readFile(p, 'utf8')
      },
    })
  }
  return inputs
}
interface Coin {
  mint: string
  name: string | null
  symbol: string | null
  created: number | null
  reasons: Set<string>
  bars: number[]
  buyers: Map<string, number>
  buys: Map<string, string>
  missing: number
}
interface Gap {
  start: number
  end: number
}
function buckets(bars: number[]): number[] {
  return Array.from({ length: 6 }, (_, i) => bars.slice(i * 10, i * 10 + 10).reduce((a, b) => a + b, 0))
}
const names = ['mint', 'tokenAddress', 'token_address']
const walletNames = ['trader', 'signer', 'user', 'txSigner']
async function payload(raw: Obj, input: RunInput): Promise<Obj | null> {
  let text = string(raw.payload_raw)
  if (text === null) {
    const ref = obj(raw.blob_ref)
    const path = ref === null ? null : string(ref.path)
    if (path !== null) {
      text = await input.blob(path)
      const expected = string(ref?.sha256) ?? string(raw.sha256)
      if (expected !== null && createHash('sha256').update(text).digest('hex') !== expected)
        throw new Error('blob checksum mismatch')
    }
  }
  if (text === null) return null
  try {
    return obj(JSON.parse(text))
  } catch {
    return null
  }
}
/** Two streamed passes: creation/coverage index, then in-window buys. No raw corpus retained. */
export async function extractFeatures(batch: Batch, inputs: RunInput[]): Promise<Features> {
  validateBatch(batch)
  if (inputs.length !== batch.run_ids.length || inputs.some((r, i) => r.runId !== batch.run_ids[i]))
    throw new Error('input run list mismatch')
  const rows: FeatureRow[] = []
  const sources: RunSource[] = []
  for (const input of inputs) {
    const m = input.manifest
    const start = time(m.started_at),
      scheduled = time(m.stops_at),
      stopped = time(m.stopped_at)
    if (
      m.run_id !== input.runId ||
      !['stopped', 'interrupted'].includes(String(m.status)) ||
      start === null ||
      scheduled === null ||
      stopped === null
    )
      throw new Error(`run must be finalized with actual stop time: ${input.runId}`)
    if (m.latest_raw_seq !== undefined && m.latest_raw_seq !== m.durable_raw_seq)
      throw new Error('run has unflushed raw records')
    const end = Math.min(scheduled, stopped)
    if (end < start) throw new Error('invalid recording interval')
    const source: RunSource = {
      run_id: input.runId,
      started_at: new Date(start).toISOString(),
      ended_at: new Date(end).toISOString(),
      raw_records: 0,
      raw_bytes: 0,
      files: [
        {
          path: 'manifest.json',
          sha256: createHash('sha256').update(input.manifestText).digest('hex'),
          bytes: Buffer.byteLength(input.manifestText),
        },
      ],
      creation_venues: {},
      pump_launches: 0,
      duplicate_buys: 0,
      gaps: [],
      quality_reasons: [],
    }
    const gaps: Gap[] = []
    const badTimes: number[] = []
    let badAll = false
    const rh = createHash('sha256')
    let rb = 0
    for await (const line of input.reliability.lines()) {
      rh.update(line + '\n')
      rb += Buffer.byteLength(line + '\n')
      if (!line.trim()) continue
      let r: Obj | null
      try {
        r = obj(JSON.parse(line))
      } catch {
        r = null
      }
      if (r === null) {
        badAll = true
        continue
      }
      if (r.kind === 'disconnected' && r.status === 'gap') {
        const at = time(r.received_at)
        if (at === null) badAll = true
        else gaps.push({ start: at, end })
      }
    }
    source.files.push({ path: input.reliability.name, sha256: rh.digest('hex'), bytes: rb })
    const coins = new Map<string, Coin>()
    const creates = new Set<string>()
    for (const file of input.raw) {
      const h = createHash('sha256')
      let bytes = 0
      for await (const line of file.lines()) {
        h.update(line + '\n')
        bytes += Buffer.byteLength(line + '\n')
        if (!line.trim()) continue
        source.raw_records++
        let raw: Obj | null
        try {
          raw = obj(JSON.parse(line))
        } catch {
          raw = null
        }
        if (raw === null) {
          badAll = true
          continue
        }
        const receipt = time(raw.received_at)
        // A new live frame bounds a recorded disconnect; replay receipts cannot prove live recovery.
        if (!file.name.includes('replay') && receipt !== null)
          for (const g of gaps) if (receipt > g.start && receipt < g.end) g.end = receipt
        const p = await payload(raw, input)
        if (p === null) {
          // Receipt time cannot locate an unreadable event in a source-time window.
          const at = time(raw.source_at)
          if (at === null) badAll = true
          else badTimes.push(at)
          continue
        }
        if (action(p) !== 'create') continue
        const mint = first(p, names)
        if (mint === null) continue
        const venue = (first(p, ['pool']) ?? 'unknown').toLowerCase()
        const createKey = JSON.stringify([mint, venue])
        if (!creates.has(createKey)) {
          creates.add(createKey)
          source.creation_venues[venue] = (source.creation_venues[venue] ?? 0) + 1
        }
        if (venue !== 'pump') continue
        const created = time(raw.source_at)
        const old = coins.get(mint)
        if (old) {
          if (old.created !== created) old.reasons.add('conflicting_creation')
          continue
        }
        coins.set(mint, {
          mint,
          name: string(p.name),
          symbol: string(p.symbol),
          created,
          reasons: new Set(created === null ? ['missing_creation_timestamp'] : []),
          bars: Array(60).fill(0),
          buyers: new Map(),
          buys: new Map(),
          missing: 0,
        })
        if (coins.size > 100_000) throw new Error('launch state budget exceeded')
      }
      const hash = h.digest('hex')
      source.files.push({ path: file.name, sha256: hash, bytes })
      source.raw_bytes += bytes
    }
    source.pump_launches = coins.size
    source.gaps = gaps.sort((a, b) => a.start - b.start)
    if (badAll) source.quality_reasons.push('unreadable_untimed_record')
    let retained = 0
    for (const file of input.raw) {
      const h = createHash('sha256')
      for await (const line of file.lines()) {
        h.update(line + '\n')
        if (!line.trim()) continue
        let raw: Obj | null
        try {
          raw = obj(JSON.parse(line))
        } catch {
          continue
        }
        if (raw === null) continue
        const p = await payload(raw, input)
        if (p === null) continue
        const mint = first(p, names)
        if (mint === null) continue
        const at = time(raw.source_at)
        let nested: unknown[] | null = null
        for (const key of ['breakdown', 'breakdowns', 'events', 'actions'])
          if (Array.isArray(p[key]) && (p[key] as unknown[]).length) {
            nested = p[key] as unknown[]
            break
          }
        const candidates =
          nested === null ? [{ item: p, index: 0 }] : nested.map((v, index) => ({ item: obj(v), index }))
        for (const c of candidates) {
          if (c.item === null) {
            coins.get(mint)?.reasons.add('malformed_breakdown')
            continue
          }
          const item = c.item
          const act = action(item) || action(p)
          if (act !== 'buy') continue
          const coin = coins.get(first(item, names) ?? mint)
          if (coin === undefined || coin.created === null) continue
          if (at === null) {
            coin.reasons.add('missing_buy_timestamp')
            continue
          }
          const offset = at - coin.created
          if (offset < 0 || offset >= WINDOW_MS) continue
          const signature =
            first(item, ['signature', 'txSignature', 'transactionSignature']) ??
            first(p, ['signature', 'txSignature', 'transactionSignature']) ??
            string(raw.event_id)
          if (signature === null) {
            coin.reasons.add('missing_event_identity')
            continue
          }
          const discriminator =
            item.instructionIndex ??
            item.instruction_index ??
            item.eventIndex ??
            item.event_index ??
            p.instructionIndex ??
            p.instruction_index ??
            c.index
          if (!['string', 'number'].includes(typeof discriminator)) {
            coin.reasons.add('invalid_event_identity')
            continue
          }
          const key = JSON.stringify([signature, String(discriminator)])
          const wallet = first(item, walletNames) ?? first(p, walletNames)
          const fingerprint = canonical({
            at,
            wallet,
            quote:
              item.quoteAmount ??
              item.quote_amount ??
              item.solAmount ??
              p.quoteAmount ??
              p.quote_amount ??
              p.solAmount ??
              null,
            token: item.tokenAmount ?? p.tokenAmount ?? null,
          })
          const prev = coin.buys.get(key)
          if (prev !== undefined) {
            source.duplicate_buys++
            if (prev !== fingerprint) coin.reasons.add('conflicting_duplicate_buy')
            continue
          }
          coin.buys.set(key, fingerprint)
          retained++
          if (retained > 500_000) throw new Error('in-window event state budget exceeded')
          const second = Math.floor(offset / 1000)
          coin.bars[second] = (coin.bars[second] ?? 0) + 1
          if (wallet === null) coin.missing++
          else coin.buyers.set(wallet, Math.min(offset, coin.buyers.get(wallet) ?? Infinity))
        }
      }
      if (h.digest('hex') !== source.files.find((f) => f.path === file.name)?.sha256)
        throw new Error('source changed during extraction')
    }
    for (const coin of coins.values()) {
      if (coin.created !== null) {
        if (coin.created < start) coin.reasons.add('recording_started_late')
        if (coin.created + WINDOW_MS > end) coin.reasons.add('recording_ended_early')
        if (gaps.some((g) => coin.created! < g.end && g.start < coin.created! + WINDOW_MS))
          coin.reasons.add('stream_gap')
        if (badTimes.some((at) => at >= coin.created! && at < coin.created! + WINDOW_MS))
          coin.reasons.add('unreadable_event')
      }
      if (badAll) coin.reasons.add('unreadable_untimed_record')
      const complete = coin.reasons.size === 0
      const identities = complete && coin.missing === 0
      const arrival = Array<number>(60).fill(0)
      for (const offset of coin.buyers.values()) {
        const i = Math.floor(offset / 1000)
        arrival[i] = (arrival[i] ?? 0) + 1
      }
      const buys = coin.buys.size
      rows.push({
        observation_id: JSON.stringify([input.runId, coin.mint]),
        run_id: input.runId,
        mint: coin.mint,
        name: coin.name,
        symbol: coin.symbol,
        created_at: coin.created === null ? null : new Date(coin.created).toISOString(),
        observation_status: complete ? 'complete' : 'unobservable',
        reasons: [...coin.reasons].sort(),
        buyer_identity_status: !complete ? 'unobservable' : identities ? 'complete' : 'missing_wallets',
        buy_count: complete ? buys : null,
        unique_buyers: identities ? coin.buyers.size : null,
        known_unique_buyers: coin.buyers.size,
        missing_wallet_buys: coin.missing,
        repeat_buy_count: identities ? buys - coin.buyers.size : null,
        buy_bars: complete ? coin.bars : null,
        arrival_bars: identities ? arrival : null,
        buy_buckets: complete ? buckets(coin.bars) : null,
        arrival_buckets: identities ? buckets(arrival) : null,
      })
    }
    sources.push(source)
  }
  rows.sort((a, b) =>
    a.observation_id < b.observation_id ? -1 : a.observation_id > b.observation_id ? 1 : 0,
  )
  const content = {
    schema: FEATURE_SCHEMA,
    formula_version: FORMULA,
    window_ms: WINDOW_MS,
    batch,
    sources,
    rows,
    summary: {
      observations: rows.length,
      complete: rows.filter((r) => r.observation_status === 'complete').length,
      unobservable: rows.filter((r) => r.observation_status !== 'complete').length,
      zero_buys: rows.filter((r) => r.buy_count === 0).length,
      missing_wallets: rows.filter((r) => r.buyer_identity_status === 'missing_wallets').length,
    },
  }
  const hash = digest(content)
  const result: Features = {
    ...content,
    content_hash: hash,
    result_id: batch.batch_id + '-' + FORMULA.replace('/', '-') + '-' + hash.slice(0, 16),
  }
  validateFeatures(result)
  return result
}
