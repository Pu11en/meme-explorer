import { open, readFile, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { atomicWriteJson, ensureDirectory, pathExists, readJson, syncDirectory } from '../storage/files.js'
import { NdjsonWriter } from '../storage/ndjson.js'
import type { RunManifest } from '../storage/types.js'
import { addExact, compareExact, subtractExact } from './decimal.js'

export const DERIVED_FORMULA_VERSION = 'pump-derived/1' as const

interface JsonRecord { readonly [key: string]: unknown }

async function records(path: string): Promise<JsonRecord[]> {
  if (!(await pathExists(path))) return []
  return (await readFile(path, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as JsonRecord)
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/u.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

function sortedTrades(trades: JsonRecord[]): JsonRecord[] {
  return [...trades].sort((left, right) => {
    const time = (string(left.source_at) ?? string(left.received_at) ?? '').localeCompare(string(right.source_at) ?? string(right.received_at) ?? '')
    if (time !== 0) return time
    return (number(left.raw_seq) ?? 0) - (number(right.raw_seq) ?? 0)
      || (number(left.breakdown_index) ?? 0) - (number(right.breakdown_index) ?? 0)
  })
}

function high(values: string[]): string | null {
  return values.length === 0 ? null : values.reduce((best, value) => compareExact(value, best) > 0 ? value : best)
}

function low(values: string[]): string | null {
  return values.length === 0 ? null : values.reduce((best, value) => compareExact(value, best) < 0 ? value : best)
}

function sumKnown(values: (string | null)[]): { value: string | null; missing: number } {
  const known = values.filter((value): value is string => value !== null)
  return {
    value: known.length === 0 ? null : known.reduce((total, value) => addExact(total, value), '0'),
    missing: values.length - known.length,
  }
}

async function atomicWriteText(path: string, text: string): Promise<void> {
  await ensureDirectory(dirname(path))
  if (await pathExists(path)) {
    const existing = await readFile(path, 'utf8')
    if (existing === text) return
    throw new Error(`derived output already exists with different bytes: ${path}`)
  }
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  const handle = await open(temporary, 'wx', 0o600)
  try {
    await handle.writeFile(text, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temporary, path)
    await syncDirectory(dirname(path))
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

export interface DerivedBuildResult {
  readonly candles: number
  readonly summaries: number
  readonly signer_index_rows: number
  readonly mint_index_rows: number
}

export class DerivedDatasetBuilder {
  constructor(private readonly dataRoot: string) {}

  async build(runId: string): Promise<DerivedBuildResult> {
    const runRoot = join(this.dataRoot, 'runs', runId)
    const manifest = await readJson<RunManifest>(join(runRoot, 'manifest.json'))
    if (!['stopped', 'interrupted', 'error'].includes(manifest.status)) throw new Error(`cannot derive nonterminal run: ${manifest.status}`)
    const trades = sortedTrades(await records(join(runRoot, 'normalized', 'trades.ndjson')))
    const wallets = await records(join(runRoot, 'normalized', 'wallets.ndjson'))
    const tokens = await records(join(runRoot, 'normalized', 'tokens.ndjson'))
    const reliability = await records(join(runRoot, 'normalized', 'reliability.ndjson'))
    const gapState = reliability.some(record => record.status === 'gap' || record.kind === 'replay_archive_missing') ? 'gap_possible' : 'no_recorded_gap'
    const receivedAt = manifest.repair.updated_at ?? manifest.stopped_at ?? manifest.stops_at
    const candles = this.candles(manifest, trades, gapState, receivedAt)
    const summaries = this.summaries(manifest, trades, gapState, receivedAt)
    await atomicWriteText(join(runRoot, 'derived', 'candles.ndjson'), candles.map(record => `${JSON.stringify(record)}\n`).join(''))
    await atomicWriteText(join(runRoot, 'derived', 'trade-summaries.ndjson'), summaries.map(record => `${JSON.stringify(record)}\n`).join(''))
    const signerRows = await this.appendIndex('signers', this.signerRows(runId, trades, wallets))
    const mintRows = await this.appendIndex('mints', this.mintRows(runId, tokens))
    await atomicWriteJson(join(runRoot, 'manifest.json'), {
      ...manifest,
      derived: {
        formula_version: DERIVED_FORMULA_VERSION,
        built_at: receivedAt,
        candles: candles.length,
        trade_summaries: summaries.length,
      },
    })
    return { candles: candles.length, summaries: summaries.length, signer_index_rows: signerRows, mint_index_rows: mintRows }
  }

  private candles(manifest: RunManifest, trades: JsonRecord[], gapState: string, receivedAt: string): JsonRecord[] {
    const groups = new Map<string, JsonRecord[]>()
    for (const trade of trades) {
      const mint = string(trade.mint)
      const at = string(trade.source_at) ?? string(trade.received_at)
      if (mint === null || at === null || !Number.isFinite(Date.parse(at))) continue
      const minute = Math.floor(Date.parse(at) / 60_000) * 60_000
      const key = `${mint}:${minute}`
      const group = groups.get(key) ?? []
      group.push(trade)
      groups.set(key, group)
    }
    const runStart = Date.parse(manifest.started_at)
    const runStop = Date.parse(manifest.stops_at)
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => {
      const first = group[0] as JsonRecord
      const mint = string(first.mint) as string
      const at = string(first.source_at) ?? string(first.received_at) as string
      const minuteStart = Math.floor(Date.parse(at) / 60_000) * 60_000
      const prices = group.map(trade => string(trade.price_quote)).filter((value): value is string => value !== null)
      const volume = sumKnown(group.map(trade => string(trade.quote_amount_raw)))
      const rawSeqs = group.map(trade => number(trade.raw_seq)).filter((value): value is number => value !== null)
      return {
        schema: 'pump.candle/1', dataset_version: '1.0.0', run_id: manifest.run_id,
        source: 'local-derived', transport: 'derived', received_at: receivedAt, raw_seq: null,
        mint, interval: '1m', starts_at: new Date(minuteStart).toISOString(), ends_at: new Date(minuteStart + 60_000).toISOString(),
        open: prices[0] ?? null, high: high(prices), low: low(prices), close: prices.at(-1) ?? null,
        quote_volume_known_raw: volume.value, quote_volume_missing_count: volume.missing,
        quote_volume_status: volume.missing === 0 ? 'complete_for_retained_trades' : 'partial_missing_amounts',
        trade_count: group.length, partial: minuteStart < runStart || minuteStart + 60_000 > runStop,
        gap_state: gapState, input_raw_seq_first: rawSeqs.length === 0 ? null : Math.min(...rawSeqs),
        input_raw_seq_last: rawSeqs.length === 0 ? null : Math.max(...rawSeqs), formula_version: DERIVED_FORMULA_VERSION,
      }
    })
  }

  private summaries(manifest: RunManifest, trades: JsonRecord[], gapState: string, receivedAt: string): JsonRecord[] {
    const groups = new Map<string, JsonRecord[]>()
    for (const trade of trades) {
      const mint = string(trade.mint)
      if (mint === null) continue
      const group = groups.get(mint) ?? []
      group.push(trade)
      groups.set(mint, group)
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([mint, group]) => {
      const buys = group.filter(trade => trade.side === 'buy')
      const sells = group.filter(trade => trade.side === 'sell')
      const buyTotal = sumKnown(buys.map(trade => string(trade.quote_amount_raw)))
      const sellTotal = sumKnown(sells.map(trade => string(trade.quote_amount_raw)))
      const prices = group.map(trade => string(trade.price_quote)).filter((value): value is string => value !== null)
      const wallets = new Set(group.map(trade => string(trade.signing_wallet)).filter((value): value is string => value !== null))
      const allAmountsKnown = buyTotal.missing === 0 && sellTotal.missing === 0
      return {
        schema: 'pump.trade-summary/1', dataset_version: '1.0.0', run_id: manifest.run_id,
        source: 'local-derived', transport: 'derived', received_at: receivedAt, raw_seq: null, mint,
        buy_count: buys.length, sell_count: sells.length,
        buy_quote_known_raw: buyTotal.value, sell_quote_known_raw: sellTotal.value,
        quote_amount_missing_count: buyTotal.missing + sellTotal.missing,
        net_quote_raw: allAmountsKnown ? subtractExact(buyTotal.value ?? '0', sellTotal.value ?? '0') : null,
        amount_status: allAmountsKnown ? 'complete_for_retained_trades' : 'partial_missing_amounts',
        observed_wallet_count: wallets.size,
        first_trade_at: string(group[0]?.source_at) ?? string(group[0]?.received_at),
        last_trade_at: string(group.at(-1)?.source_at) ?? string(group.at(-1)?.received_at),
        first_price: prices[0] ?? null, last_price: prices.at(-1) ?? null, high_price: high(prices), low_price: low(prices),
        gap_state: gapState, right_censored_at: manifest.stops_at, formula_version: DERIVED_FORMULA_VERSION,
      }
    })
  }

  private signerRows(runId: string, trades: JsonRecord[], wallets: JsonRecord[]): JsonRecord[] {
    const rows: JsonRecord[] = []
    for (const trade of trades) {
      const address = string(trade.signing_wallet)
      if (address !== null) rows.push({ schema: 'pump.signer-index/1', dataset_version: '1.0.0', address, run_id: runId, signature: string(trade.signature), action: string(trade.side), mint: string(trade.mint) })
    }
    for (const wallet of wallets) {
      const address = string(wallet.address)
      if (address !== null) rows.push({ schema: 'pump.signer-index/1', dataset_version: '1.0.0', address, run_id: runId, signature: string(wallet.signature), action: string(wallet.action), mint: string(wallet.mint) })
    }
    return rows
  }

  private mintRows(runId: string, tokens: JsonRecord[]): JsonRecord[] {
    return tokens.flatMap(token => {
      const mint = string(token.mint)
      return mint === null ? [] : [{ schema: 'pump.mint-index/1', dataset_version: '1.0.0', mint, run_id: runId, signature: string(token.signature), first_seen_at: string(token.first_seen_at) ?? string(token.received_at) }]
    })
  }

  private async appendIndex(name: 'signers' | 'mints', candidates: JsonRecord[]): Promise<number> {
    const path = join(this.dataRoot, 'indexes', `${name}.ndjson`)
    const existing = await records(path)
    const keys = new Set(existing.map(record => JSON.stringify(record)))
    const additions = candidates.filter(record => {
      const key = JSON.stringify(record)
      if (keys.has(key)) return false
      keys.add(key)
      return true
    }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    if (additions.length === 0) return 0
    const writer = new NdjsonWriter(path, { max_records: 128, max_delay_ms: 250 })
    for (const record of additions) await writer.append(record)
    await writer.close()
    return additions.length
  }
}
