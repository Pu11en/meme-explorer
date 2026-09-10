#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileInputs, extractFeatures } from './extract.js'
import { validateBatch, validateFeatures } from '../contracts/first-minute.js'
import { saveArtifact, boundedReceipt, reserve, digest } from './artifacts.js'
export function argumentsMap(args: string[], allowed: string[]): Map<string, string> {
  const out = new Map<string, string>()
  for (let i = 0; i < args.length; i++) {
    const k = args[i]!
    if (k === '--') continue
    if (!k.startsWith('--') || !allowed.includes(k.slice(2)) || out.has(k.slice(2)))
      throw new Error('unknown or duplicate argument: ' + k)
    if (k === '--all') {
      out.set('all', 'true')
      continue
    }
    const v = args[++i]
    if (v === undefined || v.startsWith('--')) throw new Error('missing value for ' + k)
    out.set(k.slice(2), v)
  }
  return out
}
export function required(a: Map<string, string>, name: string): string {
  const v = a.get(name)
  if (v === undefined) throw new Error('missing --' + name)
  return v
}
export async function analyzeMain(args: string[]): Promise<void> {
  const a = argumentsMap(args, ['data-root', 'batch', 'output-root'])
  const root = resolve(required(a, 'data-root'))
  const out = resolve(required(a, 'output-root'))
  if (out === root || out.startsWith(root + '/'))
    throw new Error('use an output root outside the source data tree')
  const batch: unknown = JSON.parse(await readFile(resolve(required(a, 'batch')), 'utf8'))
  validateBatch(batch)
  await mkdir(out, { recursive: true })
  await reserve(out)
  const features = await extractFeatures(batch, await fileInputs(root, batch))
  const { content_hash, result_id, ...content } = features
  if (digest(content) !== content_hash) throw new Error('feature hash mismatch')
  validateFeatures(features)
  await reserve(out)
  const target = join(out, batch.batch_id, 'first-minute', result_id)
  const resultPath = await saveArtifact(target, 'result.json', features)
  const receipt = {
    schema: 'pump.first-minute-receipt/1',
    result_id,
    content_hash,
    batch_id: batch.batch_id,
    summary: features.summary,
    raw_records: features.sources.reduce((n, r) => n + r.raw_records, 0),
    full_result_path: resultPath,
    preview: features.rows
      .slice(0, 20)
      .map((r) => ({
        observation_id: r.observation_id,
        symbol: r.symbol,
        buy_count: r.buy_count,
        unique_buyers: r.unique_buyers,
        observation_status: r.observation_status,
      })),
  }
  await saveArtifact(target, 'receipt.json', receipt)
  process.stdout.write(boundedReceipt(receipt) + '\n')
}
