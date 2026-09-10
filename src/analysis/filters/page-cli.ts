#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { argumentsMap, required } from './cli.js'
import { validateFeatures } from '../contracts/first-minute.js'
import { FILTERS, definition } from '../catalog/filters.js'
import { filterFeatures } from './evaluate.js'
import { renderFirstMinutePage } from './page.js'
async function main() {
  const a = argumentsMap(process.argv.slice(2), ['result', 'output', 'validation', 'cohort'])
  const f: unknown = JSON.parse(await readFile(required(a, 'result'), 'utf8'))
  validateFeatures(f)
  const output = resolve(required(a, 'output'))
  await mkdir(dirname(output), { recursive: true })
  const cohorts = FILTERS.map((d) => filterFeatures(f, definition(d.id)))
  if (a.has('cohort')) {
    const custom = JSON.parse(await readFile(required(a, 'cohort'), 'utf8'))
    const i = cohorts.findIndex((c) => c.definition.id === custom.definition?.id)
    if (i < 0) throw new Error('custom cohort must use one of the six filter IDs')
    cohorts[i] = custom
  }
  await writeFile(output, renderFirstMinutePage(f, cohorts, a.get('validation')), { mode: 0o600 })
  console.log(JSON.stringify({ page: output, observations: f.rows.length }))
}
main().catch((e) => {
  console.error(String(e))
  process.exitCode = 1
})
