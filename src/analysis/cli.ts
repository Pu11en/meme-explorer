#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { analyzeTenSecondBuyActivity } from './ten-second-buy-activity.js'
import type { CollectionBatch } from './types.js'

function argument(name: string, required = true): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (required && (value === undefined || value.startsWith('--'))) throw new Error(`missing --${name}`)
  return value
}

async function main(): Promise<void> {
  const dataRoot = resolve(argument('data-root') as string)
  const batchPath = resolve(argument('batch') as string)
  const previewText = argument('preview', false)
  const batch = JSON.parse(await readFile(batchPath, 'utf8')) as CollectionBatch
  const receipt = await analyzeTenSecondBuyActivity({
    dataRoot,
    batch,
    ...(previewText === undefined ? {} : { previewLimit: Number(previewText) }),
    renderVisualArtifacts: true,
  })
  process.stdout.write(`${JSON.stringify(receipt)}\n`)
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
