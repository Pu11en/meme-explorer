#!/usr/bin/env node
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { argumentsMap, required } from './cli.js'
import { FILTERS, definition } from '../catalog/filters.js'
import { validateFeatures, type FilterDefinition } from '../contracts/first-minute.js'
import { validateDefinition, filterFeatures } from './evaluate.js'
import { digest, saveArtifact, reserve, boundedReceipt } from './artifacts.js'
async function main() {
  const a = argumentsMap(process.argv.slice(2), [
    'result',
    'output-root',
    'all',
    'filter',
    'parameters',
    'definition',
  ])
  if ([a.has('all'), a.has('filter'), a.has('definition')].filter(Boolean).length !== 1)
    throw new Error('select exactly one of --all, --filter or --definition')
  if (a.has('parameters') && !a.has('filter')) throw new Error('--parameters requires --filter')
  const f: unknown = JSON.parse(await readFile(resolve(required(a, 'result')), 'utf8'))
  validateFeatures(f)
  const { result_id: _, content_hash, ...content } = f
  if (digest(content) !== content_hash) throw new Error('source content hash mismatch')
  let definitions: FilterDefinition[]
  if (a.has('definition')) {
    const d: unknown = JSON.parse(await readFile(resolve(required(a, 'definition')), 'utf8'))
    validateDefinition(d)
    definitions = [d]
  } else
    definitions = a.has('all')
      ? FILTERS.map((x) => definition(x.id))
      : [definition(required(a, 'filter'), JSON.parse(a.get('parameters') ?? '{}'))]
  const out = resolve(required(a, 'output-root'))
  await mkdir(out, { recursive: true })
  await reserve(out)
  const receipts = []
  for (const d of definitions) {
    const cohort = filterFeatures(f, d)
    const target = join(out, f.batch.batch_id, 'filters', cohort.result_id)
    const path = await saveArtifact(target, 'cohort.json', cohort)
    await saveArtifact(target, 'definition.json', d)
    const receipt = {
      schema: 'pump.filter-receipt/1',
      filter_id: d.id,
      result_id: cohort.result_id,
      definition_hash: cohort.definition_hash,
      source_result_id: f.result_id,
      summary: cohort.summary,
      full_result_path: path,
      preview: cohort.decisions.filter((x) => x.status === 'member').slice(0, 20),
    }
    await saveArtifact(target, 'receipt.json', receipt)
    boundedReceipt(receipt)
    receipts.push(receipt)
  }
  process.stdout.write(
    boundedReceipt({
      schema: 'pump.filter-set-receipt/1',
      batch_id: f.batch.batch_id,
      filters: receipts.map(({ preview, ...r }) => ({ ...r, preview: preview.slice(0, 3) })),
    }) + '\n',
  )
}
main().catch((e) => {
  process.stderr.write(String(e) + '\n')
  process.exitCode = 1
})
