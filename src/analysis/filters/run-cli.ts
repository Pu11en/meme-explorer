#!/usr/bin/env node
/** A batch-to-page entry point; runs only against explicitly finalized recordings. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { argumentsMap, required } from './cli.js'
import { validateBatch } from '../contracts/first-minute.js'
import { extractFeatures, fileInputs } from './extract.js'
import { FILTERS, definition } from '../catalog/filters.js'
import { filterFeatures } from './evaluate.js'
import { boundedReceipt, reserve, saveArtifact } from './artifacts.js'
import { renderFirstMinutePage } from './page.js'
async function main() {
  const args = argumentsMap(process.argv.slice(2), ['batch', 'data-root', 'output-root'])
  const batch: unknown = JSON.parse(await readFile(resolve(required(args, 'batch')), 'utf8'))
  validateBatch(batch)
  const dataRoot = resolve(required(args, 'data-root'))
  const output = resolve(required(args, 'output-root'))
  if (output === dataRoot || output.startsWith(dataRoot + '/')) throw new Error('use a separate output root')
  await mkdir(output, { recursive: true })
  await reserve(output)
  const features = await extractFeatures(batch, await fileInputs(dataRoot, batch))
  const target = join(output, batch.batch_id, features.result_id)
  await reserve(output)
  const featurePath = await saveArtifact(target, 'features.json', features)
  const cohorts = FILTERS.map((f) => filterFeatures(features, definition(f.id)))
  const receipts = []
  for (const cohort of cohorts) {
    const path = await saveArtifact(target, cohort.definition.id + '.json', cohort)
    receipts.push({
      filter_id: cohort.definition.id,
      definition_hash: cohort.definition_hash,
      summary: cohort.summary,
      full_result_path: path,
    })
  }
  const page = join(target, 'index.html')
  await writeFile(page, renderFirstMinutePage(features, cohorts, 'Recorded first-minute analysis'), {
    mode: 0o600,
  })
  const receipt = {
    schema: 'pump.batch-filter-receipt/1',
    batch_id: batch.batch_id,
    feature_content_hash: features.content_hash,
    feature_path: featurePath,
    summary: features.summary,
    filters: receipts,
    page,
  }
  await saveArtifact(target, 'receipt.json', receipt)
  process.stdout.write(boundedReceipt(receipt) + '\n')
}
main().catch((error) => {
  process.stderr.write(String(error) + '\n')
  process.exitCode = 1
})
