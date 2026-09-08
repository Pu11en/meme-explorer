import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { open, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { addExact, compareExact } from '../derived/decimal.js'
import { parseLosslessJson, type LosslessJson } from '../pumpapi/lossless-json.js'
import { atomicWriteJson, ensureDirectory, pathExists } from '../storage/files.js'
import type { RunManifest } from '../storage/types.js'
import type {
  CollectionBatch,
  TenSecondBuyActivityReceipt,
  TenSecondBuyActivityResult,
  TenSecondBuyActivityRow,
} from './types.js'

const WINDOW_MS = 10_000 as const
const SKILL_VERSION = '1.0.0' as const
const FORMULA_VERSION = 'ten-second-buy-activity/1' as const

interface ReliabilityRecord {
  readonly kind?: unknown
  readonly status?: unknown
  readonly received_at?: unknown
}

interface RawRecord {
  readonly event_id?: unknown
  readonly source_at?: unknown
  readonly received_at?: unknown
  readonly payload_raw?: unknown
  readonly blob_ref?: unknown
  readonly sha256?: unknown
}

interface CoinState {
  readonly runId: string
  readonly mint: string
  readonly name: string | null
  readonly symbol: string | null
  readonly createdAt: string | null
  readonly createdEpoch: number
  readonly missingCreationTimestamp: boolean
  readonly buyers: Set<string>
  readonly slotCounts: Map<string, number>
  readonly bars: number[]
  buyCount: number
  buyQuoteKnownRaw: string
  missingQuoteAmountCount: number
  missingBuyerWalletCount: number
}

export interface AnalyzeTenSecondBuyActivityOptions {
  readonly dataRoot: string
  readonly batch: CollectionBatch
  readonly outputRoot?: string
  readonly previewLimit?: number
  readonly now?: () => number
}

async function* readNdjson<T>(path: string): AsyncGenerator<T> {
  const stream = createReadStream(path, { encoding: 'utf8' })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of lines) {
    if (line.trim() !== '') yield JSON.parse(line) as T
  }
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function losslessObject(value: LosslessJson): Record<string, LosslessJson> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function canonicalAction(value: unknown): string | null {
  const action = optionalString(value)
  if (action === null) return null
  const compact = action.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
  return compact === 'createtoken' ? 'create' : compact
}

function firstString(record: Record<string, LosslessJson>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = optionalString(record[key])
    if (value !== null) return value
  }
  return null
}

function firstArray(record: Record<string, LosslessJson>, keys: readonly string[]): readonly LosslessJson[] {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function epoch(value: string, field: string): number {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be an ISO timestamp`)
  return parsed
}

function repeatRatio(buys: number, buyers: number): string {
  if (buys === 0) return '0'
  return ((buys - buyers) / buys).toFixed(6).replace(/0+$/u, '').replace(/\.$/u, '')
}

function overlaps(start: number, end: number, gapStart: number, gapEnd: number): boolean {
  return start < gapEnd && gapStart < end
}

function runEndEpoch(manifest: RunManifest): number {
  const scheduled = epoch(manifest.stops_at, 'manifest stops_at')
  if (manifest.stopped_at === null) return scheduled
  return Math.min(scheduled, epoch(manifest.stopped_at, 'manifest stopped_at'))
}

function compareRows(left: TenSecondBuyActivityRow, right: TenSecondBuyActivityRow): number {
  if (left.observation_status !== right.observation_status) return left.observation_status === 'complete' ? -1 : 1
  if (left.buy_count !== right.buy_count) return (right.buy_count ?? -1) - (left.buy_count ?? -1)
  if (left.unique_buyers !== right.unique_buyers) return (right.unique_buyers ?? -1) - (left.unique_buyers ?? -1)
  const quote = compareExact(right.buy_quote_known_raw, left.buy_quote_known_raw)
  if (quote !== 0) return quote
  return left.mint.localeCompare(right.mint)
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

async function writeText(path: string, content: string): Promise<void> {
  const handle = await open(path, 'wx', 0o600)
  try {
    await handle.writeFile(content, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function markdownCell(value: unknown): string {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export async function analyzeTenSecondBuyActivity(
  options: AnalyzeTenSecondBuyActivityOptions,
): Promise<TenSecondBuyActivityReceipt> {
  if (options.batch.schema !== 'pump.collection-batch/1') throw new Error('unsupported collection batch schema')
  if (options.batch.run_ids.length === 0) throw new Error('collection batch requires at least one run ID')
  if (new Set(options.batch.run_ids).size !== options.batch.run_ids.length) throw new Error('collection batch run IDs must be unique')
  const previewLimit = options.previewLimit ?? 20
  if (!Number.isInteger(previewLimit) || previewLimit < 1 || previewLimit > 20) {
    throw new Error('preview limit must be an integer from 1 through 20; use the saved rows file for pagination')
  }

  const dataRoot = resolve(options.dataRoot)
  const manifests = new Map<string, RunManifest>()
  const coins = new Map<string, CoinState>()
  const observedReceiptTimes = new Map<string, number[]>()
  const disconnectedAt = new Map<string, number[]>()
  const unreadableAt = new Map<string, number[]>()
  let rawRecordsRepresented = 0
  let rawRecordsScanned = 0
  let createRecordsFound = 0
  let buyRecordsFound = 0

  for (const runId of options.batch.run_ids) {
    const runRoot = join(dataRoot, 'runs', runId)
    const manifest = JSON.parse(await readFile(join(runRoot, 'manifest.json'), 'utf8')) as RunManifest
    if (manifest.run_id !== runId) throw new Error(`manifest run ID mismatch for ${runId}`)
    if (!['stopped', 'interrupted'].includes(manifest.status)) throw new Error(`run is not analyzable: ${runId}`)
    manifests.set(runId, manifest)
    rawRecordsRepresented += manifest.counts.raw_records
    observedReceiptTimes.set(runId, [])
    disconnectedAt.set(runId, [])
    unreadableAt.set(runId, [])

    const rawOnlyCoins = new Set<string>()
    const pumpCreateKeys = new Set<string>()
    const rawBuyKeys = new Set<string>()
    const rawPaths = [join(runRoot, 'raw', 'pumpapi-live.ndjson'), join(runRoot, 'raw', 'pumpapi-replay.ndjson')]
    for (const rawPath of rawPaths) {
      if (!await pathExists(rawPath)) continue
      for await (const raw of readNdjson<RawRecord>(rawPath)) {
      rawRecordsScanned += 1
      const receivedAt = optionalString(raw.received_at)
      if (receivedAt !== null) observedReceiptTimes.get(runId)?.push(epoch(receivedAt, 'raw received_at'))
      let payloadText = optionalString(raw.payload_raw)
      if (payloadText === null && raw.blob_ref !== null && typeof raw.blob_ref === 'object') {
        const blobPath = optionalString((raw.blob_ref as Record<string, unknown>).path)
        if (blobPath !== null) {
          const resolvedBlob = resolve(runRoot, blobPath)
          if (resolvedBlob.startsWith(`${resolve(runRoot)}/`)) payloadText = await readFile(resolvedBlob, 'utf8')
        }
      }
      if (payloadText === null) {
        if (receivedAt !== null) unreadableAt.get(runId)?.push(epoch(receivedAt, 'raw received_at'))
        continue
      }
      let payload: Record<string, LosslessJson>
      try {
        const parsed = losslessObject(parseLosslessJson(payloadText))
        if (parsed === null) continue
        payload = parsed
      } catch {
        if (receivedAt !== null) unreadableAt.get(runId)?.push(epoch(receivedAt, 'raw received_at'))
        continue
      }
      const action = canonicalAction(firstString(payload, ['action', 'txType', 'tx_type', 'type']))
      const mint = firstString(payload, ['mint', 'tokenAddress', 'token_address'])
      const sourceAt = optionalString(raw.source_at)
      if (mint === null) continue
      const key = `${runId}:${mint}`
      if (action === 'create' && firstString(payload, ['pool'])?.toLowerCase() === 'pump') {
        createRecordsFound += 1
        pumpCreateKeys.add(key)
        rawOnlyCoins.add(key)
        const creationClock = sourceAt ?? receivedAt
        if (!coins.has(key) && creationClock !== null) coins.set(key, {
            runId,
            mint,
            name: optionalString(payload.name),
            symbol: optionalString(payload.symbol),
            createdAt: sourceAt,
            createdEpoch: epoch(creationClock, sourceAt === null ? 'create received_at' : 'create source_at'),
            missingCreationTimestamp: sourceAt === null,
            buyers: new Set(),
            slotCounts: new Map(),
            bars: Array.from({ length: 10 }, () => 0),
            buyCount: 0,
            buyQuoteKnownRaw: '0',
            missingQuoteAmountCount: 0,
            missingBuyerWalletCount: 0,
        })
      }
      if (!rawOnlyCoins.has(key)) continue
      const coin = coins.get(key)
      if (coin === undefined) continue
      if (sourceAt === null) {
        if (receivedAt !== null) unreadableAt.get(runId)?.push(epoch(receivedAt, 'raw received_at'))
        continue
      }
      const breakdown = firstArray(payload, ['breakdown', 'breakdowns', 'events', 'actions'])
      const candidates: Record<string, LosslessJson>[] = action === 'create'
        ? breakdown.map(losslessObject).filter((item): item is Record<string, LosslessJson> => item !== null)
        : action === 'buy' ? [payload] : []
      for (let index = 0; index < candidates.length; index += 1) {
        const item = candidates[index]
        if (item === undefined) continue
        const itemAction = action === 'create' ? canonicalAction(item.action) : action
        if (itemAction !== 'buy') continue
        const signature = firstString(payload, ['signature', 'txSignature', 'transactionSignature'])
          ?? optionalString(raw.event_id)
          ?? optionalString(raw.sha256)
          ?? createHash('sha256').update(payloadText).digest('hex')
        const buyKey = `${signature}:${index}`
        if (rawBuyKeys.has(buyKey)) continue
        const offset = epoch(sourceAt, 'buy source_at') - coin.createdEpoch
        if (offset < 0 || offset >= WINDOW_MS) continue
        rawBuyKeys.add(buyKey)
        buyRecordsFound += 1
        coin.buyCount += 1
        const barIndex = Math.floor(offset / 1000)
        coin.bars[barIndex] = (coin.bars[barIndex] ?? 0) + 1
        const wallet = firstString(item, ['trader', 'signer', 'user', 'txSigner'])
          ?? firstString(payload, ['txSigner', 'signer', 'user', 'trader'])
        if (wallet !== null) coin.buyers.add(wallet)
        else coin.missingBuyerWalletCount += 1
        const quoteValue = item.quoteAmount ?? item.quote_amount ?? item.solAmount ?? item.baseAmount
          ?? payload.quoteAmount ?? payload.quote_amount ?? payload.solAmount ?? payload.baseAmount
        const quote = typeof quoteValue === 'number' && Number.isFinite(quoteValue) ? String(quoteValue) : optionalString(quoteValue)
        if (quote === null) coin.missingQuoteAmountCount += 1
        else coin.buyQuoteKnownRaw = addExact(coin.buyQuoteKnownRaw, quote)
        const block = payload.block ?? payload.slot
        const slot = typeof block === 'number' && Number.isFinite(block) ? String(block) : optionalString(block)
        if (slot !== null) coin.slotCounts.set(slot, (coin.slotCounts.get(slot) ?? 0) + 1)
      }
    }
    }
    for (const key of [...coins.keys()]) {
      if (key.startsWith(`${runId}:`) && !pumpCreateKeys.has(key)) coins.delete(key)
    }

    for await (const reliability of readNdjson<ReliabilityRecord>(join(runRoot, 'normalized', 'reliability.ndjson'))) {
      if (reliability.kind !== 'disconnected' || reliability.status !== 'gap') continue
      const receivedAt = optionalString(reliability.received_at)
      if (receivedAt !== null) disconnectedAt.get(runId)?.push(epoch(receivedAt, 'reliability received_at'))
    }
  }

  const gaps = new Map<string, readonly [number, number][]>()
  for (const runId of options.batch.run_ids) {
    const receipts = (observedReceiptTimes.get(runId) ?? []).sort((a, b) => a - b)
    const manifest = manifests.get(runId)
    if (manifest === undefined) throw new Error(`missing loaded manifest: ${runId}`)
    const runEnd = runEndEpoch(manifest)
    gaps.set(runId, (disconnectedAt.get(runId) ?? []).map(start => {
      const recovered = receipts.find(receipt => receipt > start)
      return [start, recovered ?? runEnd] as const
    }))
  }

  const rows: TenSecondBuyActivityRow[] = []
  for (const coin of coins.values()) {
    const manifest = manifests.get(coin.runId)
    if (manifest === undefined) throw new Error(`missing loaded manifest: ${coin.runId}`)
    const windowEnd = coin.createdEpoch + WINDOW_MS
    const reasons: string[] = []
    if (coin.missingCreationTimestamp) reasons.push('missing_creation_timestamp')
    if (coin.createdEpoch < epoch(manifest.started_at, 'manifest started_at')) reasons.push('recording_window_started_late')
    if (windowEnd > runEndEpoch(manifest)) reasons.push('recording_window_ended')
    if ((gaps.get(coin.runId) ?? []).some(([start, end]) => overlaps(coin.createdEpoch, windowEnd, start, end))) {
      reasons.push('stream_gap')
    }
    if ((unreadableAt.get(coin.runId) ?? []).some(at => at >= coin.createdEpoch && at < windowEnd)) {
      reasons.push('unreadable_raw_event')
    }
    const complete = reasons.length === 0
    const quoteComplete = coin.missingQuoteAmountCount === 0
    rows.push({
      schema: 'pump.metric.ten-second-buy-activity/1',
      formula_version: FORMULA_VERSION,
      batch_id: options.batch.batch_id,
      run_id: coin.runId,
      mint: coin.mint,
      name: coin.name,
      symbol: coin.symbol,
      created_at: coin.createdAt,
      observation_status: complete ? 'complete' : 'unobservable',
      unobservable_reasons: reasons,
      buy_count: complete ? coin.buyCount : null,
      unique_buyers: complete ? coin.buyers.size : null,
      repeat_buy_ratio: complete && coin.missingBuyerWalletCount === 0 ? repeatRatio(coin.buyCount, coin.buyers.size) : null,
      buyer_identity_status: complete ? (coin.missingBuyerWalletCount === 0 ? 'complete' : 'partial_missing_wallets') : 'unobservable',
      missing_buyer_wallet_count: complete ? coin.missingBuyerWalletCount : null,
      buy_quote_raw: complete && quoteComplete ? coin.buyQuoteKnownRaw : null,
      buy_quote_known_raw: coin.buyQuoteKnownRaw,
      quote_amount_status: complete ? (quoteComplete ? 'complete' : 'partial_missing_amounts') : 'unobservable',
      missing_quote_amount_count: complete ? coin.missingQuoteAmountCount : null,
      max_buys_per_slot: complete ? Math.max(0, ...coin.slotCounts.values()) : null,
      one_second_bars: complete ? coin.bars.map((buyCount, second) => ({ second, buy_count: buyCount })) : null,
      rank: null,
    })
  }
  rows.sort(compareRows)
  let rank = 0
  const rankedRows = rows.map(row => row.observation_status === 'complete' ? { ...row, rank: ++rank } : row)
  const observable = rankedRows.filter(row => row.observation_status === 'complete')
  const generatedAt = new Date((options.now ?? Date.now)()).toISOString()
  const inputFingerprint = createHash('sha256').update(JSON.stringify({
    batch: options.batch,
    formula_version: FORMULA_VERSION,
    manifests: options.batch.run_ids.map(runId => manifests.get(runId)),
    generated_at: generatedAt,
  })).digest('hex').slice(0, 16)
  const resultId = `${options.batch.batch_id}-${FORMULA_VERSION.replace('/', '-')}-${inputFingerprint}`
  const result: TenSecondBuyActivityResult = {
    schema: 'pump.analysis-result/1',
    skill_id: 'ten-second-buy-activity',
    skill_version: SKILL_VERSION,
    formula_version: FORMULA_VERSION,
    result_id: resultId,
    generated_at: generatedAt,
    batch: options.batch,
    parameters: { window_ms: WINDOW_MS, preview_limit: previewLimit },
    input: {
      raw_records_represented: rawRecordsRepresented,
      raw_records_scanned: rawRecordsScanned,
      create_records_found: createRecordsFound,
      buy_records_found: buyRecordsFound,
    },
    summary: {
      coin_observations: rankedRows.length,
      observable: observable.length,
      unobservable: rankedRows.length - observable.length,
      zero_buy_observations: observable.filter(row => row.buy_count === 0).length,
    },
    rows: rankedRows,
  }
  const outputRoot = resolve(options.outputRoot ?? join(dataRoot, 'analysis'))
  const resultRoot = join(outputRoot, options.batch.batch_id, 'ten-second-buy-activity', resultId)
  await ensureDirectory(resultRoot)
  const fullResultPath = join(resultRoot, 'result.json')
  const rowsPath = join(resultRoot, 'rows.ndjson')
  const reportPath = join(resultRoot, 'report.md')
  const csvPath = join(resultRoot, 'rows.csv')
  await atomicWriteJson(fullResultPath, result)
  const rowsHandle = await open(rowsPath, 'w', 0o600)
  try {
    await rowsHandle.writeFile(rankedRows.map(row => JSON.stringify(row)).join('\n') + (rankedRows.length === 0 ? '' : '\n'), 'utf8')
    await rowsHandle.sync()
  } finally {
    await rowsHandle.close()
  }
  const csvColumns = ['rank', 'name', 'symbol', 'mint', 'run_id', 'created_at', 'observation_status', 'unobservable_reasons', 'buy_count', 'unique_buyers', 'repeat_buy_ratio', 'buy_quote_raw', 'buy_quote_known_raw', 'quote_amount_status', 'max_buys_per_slot', 'one_second_bars'] as const
  const csv = [
    csvColumns.join(','),
    ...rankedRows.map(row => csvColumns.map(column => {
      const value = column === 'unobservable_reasons'
        ? row.unobservable_reasons.join(';')
        : column === 'one_second_bars'
          ? row.one_second_bars?.map(bar => bar.buy_count).join(';') ?? ''
          : row[column]
      return csvCell(value)
    }).join(',')),
  ].join('\n') + '\n'
  await writeText(csvPath, csv)
  const reportRows = observable.slice(0, previewLimit)
  const report = [
    `# ${options.batch.label}: 10-Second Buy Activity`,
    '',
    `Generated: ${generatedAt}`,
    '',
    `This ranks Pump.fun launches by buys recorded during the half-open window from creation through 9.999 seconds. Complete zeroes are separate from unobservable windows.`,
    '',
    `- Raw records scanned: **${rawRecordsScanned.toLocaleString('en-US')}**`,
    `- Pump.fun launches: **${rankedRows.length.toLocaleString('en-US')}**`,
    `- Complete observations: **${observable.length.toLocaleString('en-US')}**`,
    `- Unobservable: **${(rankedRows.length - observable.length).toLocaleString('en-US')}**`,
    `- Complete zero-buy launches: **${observable.filter(row => row.buy_count === 0).length.toLocaleString('en-US')}**`,
    '',
    `## Top ${reportRows.length}`,
    '',
    '| Rank | Coin | Symbol | Buys | Buyers | Repeat % | Buy volume | Busiest slot | Buys by second (0–9) |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...reportRows.map(row => `| ${row.rank} | ${markdownCell(row.name ?? row.mint)} | ${markdownCell(row.symbol)} | ${row.buy_count} | ${row.unique_buyers} | ${row.repeat_buy_ratio === null ? '' : (Number(row.repeat_buy_ratio) * 100).toFixed(2)} | ${markdownCell(row.buy_quote_raw ?? row.buy_quote_known_raw)} | ${row.max_buys_per_slot} | ${row.one_second_bars?.map(bar => bar.buy_count).join(', ') ?? ''} |`),
    '',
    'The accompanying CSV contains every coin and is suitable for filtering or sorting.',
    '',
  ].join('\n')
  await writeText(reportPath, report)
  const receipt: TenSecondBuyActivityReceipt = {
    schema: 'pump.analysis-receipt/1',
    skill_id: 'ten-second-buy-activity',
    skill_version: SKILL_VERSION,
    result_id: resultId,
    batch_id: options.batch.batch_id,
    summary: result.summary,
    input: result.input,
    preview_limit: previewLimit,
    preview: observable.slice(0, previewLimit),
    full_result_path: fullResultPath,
    rows_path: rowsPath,
    report_path: reportPath,
    csv_path: csvPath,
  }
  await atomicWriteJson(join(resultRoot, 'receipt.json'), receipt)
  return receipt
}
