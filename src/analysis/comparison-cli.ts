#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildBuyActivityComparisonPage } from './comparison-page.js'
import type { TenSecondBuyActivityResult } from './types.js'

function argument(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`missing --${name}`)
  return value
}

async function main(): Promise<void> {
  const resultPath = resolve(argument('result'))
  const outputPath = resolve(argument('output'))
  const result = JSON.parse(await readFile(resultPath, 'utf8')) as TenSecondBuyActivityResult
  if (result.schema !== 'pump.analysis-result/1' || result.skill_id !== 'ten-second-buy-activity') {
    throw new Error('result must be a ten-second-buy-activity analysis result')
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, buildBuyActivityComparisonPage(result), 'utf8')
  process.stdout.write(`${JSON.stringify({ output_path: outputPath, rows: result.summary.observable })}\n`)
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
