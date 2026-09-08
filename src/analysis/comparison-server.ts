#!/usr/bin/env node
import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? fallback : process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`missing --${name}`)
  return value
}

async function main(): Promise<void> {
  const pagePath = resolve(argument('page'))
  const port = Number(argument('port', '4179'))
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('port must be an integer from 1 through 65535')
  await access(pagePath)
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || !['/', '/index.html'].includes(request.url ?? '')) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not found\n')
      return
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    createReadStream(pagePath).pipe(response)
  })
  server.listen(port, '127.0.0.1', () => process.stdout.write(`Comparison page: http://localhost:${port}\n`))
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
