import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  InWindowEnrichment,
  isPublicAddress,
  RunStore,
  SafeFetcher,
} from '../lib/index.js'

async function temporaryRoot(t) {
  const root = await mkdtemp(join(os.tmpdir(), 'pump-enrich-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function* chunks(...values) {
  for (const value of values) yield Buffer.from(value)
}

function response(statusCode, contentType, body, headers = {}) {
  return {
    statusCode,
    headers: { 'content-type': contentType, ...headers },
    body: chunks(body),
  }
}

function publicResolver(hostname) {
  return Promise.resolve([{ address: hostname === 'private.test' ? '127.0.0.1' : '8.8.8.8', family: 4 }])
}

async function seedToken(run, mint = 'MintMeta') {
  await run.appendNormalized('tokens', {
    schema: 'pump.token/1',
    dataset_version: '1.0.0',
    run_id: run.manifest.run_id,
    source: 'fixture',
    received_at: run.manifest.started_at,
    raw_seq: null,
    mint,
  }, `seed:${mint}`)
}

async function readFamily(root, runId, family) {
  try {
    const text = await readFile(join(root, 'runs', runId, 'normalized', `${family}.ndjson`), 'utf8')
    return text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

test('safe fetch pins public DNS and blocks private, credentialed, and redirected private targets', async () => {
  let calls = 0
  const fetcher = new SafeFetcher({
    resolve: publicResolver,
    transport: async request => {
      calls += 1
      if (request.url.hostname === 'redirect.test') return response(302, 'text/plain', '', { location: 'https://private.test/secret' })
      return response(200, 'application/json', '{"ok":true}')
    },
  })
  assert.equal(isPublicAddress('8.8.8.8'), true)
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', 'fc00::1']) {
    assert.equal(isPublicAddress(address), false, address)
  }
  assert.equal((await fetcher.fetch('https://public.test/data')).status, 'success')
  assert.equal((await fetcher.fetch('https://private.test/data')).status, 'blocked')
  assert.equal((await fetcher.fetch('https://user:pass@public.test/data')).status, 'blocked')
  const redirected = await fetcher.fetch('https://redirect.test/start')
  assert.equal(redirected.status, 'blocked')
  assert.deepEqual(redirected.redirect_chain, ['https://redirect.test/start'])
  assert.equal(calls, 2)
})

test('safe fetch enforces media, size, timeout, redirects, and image byte hashes', async () => {
  const fetcher = new SafeFetcher({
    resolve: publicResolver,
    maxBytes: 8,
    transport: async request => {
      if (request.url.pathname === '/json') return response(200, 'application/json; charset=utf-8', '{"large":900719925474099312345}')
      if (request.url.pathname === '/image') return response(200, 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      if (request.url.pathname === '/bad-media') return response(200, 'text/html', '<html>bad</html>')
      if (request.url.pathname === '/large') return response(200, 'application/json', '123456789')
      if (request.url.pathname === '/redirect') return response(302, 'text/plain', '', { location: '/json' })
      throw new Error(`unexpected fixture path: ${request.url.pathname}`)
    },
  })
  const json = await fetcher.fetch('https://public.test/json')
  assert.equal(json.status, 'too_large')
  const image = await fetcher.fetch('https://public.test/image')
  assert.equal(image.status, 'success')
  assert.equal(image.byte_len, 4)
  assert.equal(image.sha256, '0f4636c78f65d3639ece5a064b5ae753e3408614a14fb18ab4d7540d2c248543')
  assert.equal((await fetcher.fetch('https://public.test/bad-media')).status, 'bad_media')
  assert.equal((await fetcher.fetch('https://public.test/large')).status, 'too_large')
  assert.equal((await fetcher.fetch('https://public.test/redirect')).status, 'too_large')

  const timeoutFetcher = new SafeFetcher({
    resolve: publicResolver,
    timeoutMs: 5,
    transport: request => new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true })
    }),
  })
  assert.equal((await timeoutFetcher.fetch('https://public.test/slow')).status, 'timeout')
})

test('metadata and recorded DEX contract responses persist raw and normalized in-window facts', async t => {
  const root = await temporaryRoot(t)
  let now = Date.parse('2026-08-26T15:00:00.000Z')
  const store = new RunStore(root, { now: () => now })
  const run = await store.createRun(5)
  await seedToken(run)
  const recordedDex = await readFile(new URL('./fixtures/dexscreener-pair-recorded-2026-08-31.json', import.meta.url), 'utf8')
  const fetcher = new SafeFetcher({
    now: () => now,
    resolve: publicResolver,
    transport: async request => {
      if (request.url.hostname === 'gateway.test') {
        return response(200, 'application/json', JSON.stringify({
          name: 'Claimed Name', description: 'Untrusted description', image: 'ipfs://image',
          twitter: 'https://x.com/claimed', unknownValue: 900719925474099312345n.toString(),
        }))
      }
      if (request.url.pathname.includes('missing')) return response(200, 'application/json', '{"schemaVersion":"1.0.0","pairs":null}')
      return response(200, 'application/json', recordedDex, { age: '12', 'cache-control': 'public, max-age=30' })
    },
  })
  const enrichment = new InWindowEnrichment(run, {
    fetcher,
    now: () => now,
    ipfsGateway: 'https://gateway.test/ipfs/',
    dexBaseUrl: 'https://dex.test/latest/dex/pairs/solana/',
  })
  const metadata = await enrichment.scheduleMetadata({ mint: 'MintMeta', uri: 'ipfs://bafy-meta' })
  assert.equal(metadata.accepted, true)
  assert.equal(metadata.fetch.final_url, 'https://gateway.test/ipfs/bafy-meta')
  const dex = await enrichment.scheduleDexPair({
    mint: 'MintMeta',
    pairAddress: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
    referenceKind: 'sol_usd',
  })
  assert.equal(dex.accepted, true)
  await enrichment.scheduleDexPair({ mint: 'MintMeta', pairAddress: 'missing' })
  now += 1_000
  await run.finalize('manual_early')

  const metadataRecords = await readFamily(root, run.manifest.run_id, 'metadata')
  assert.equal(metadataRecords.length, 1)
  assert.equal(metadataRecords[0].creator_claims_untrusted.name, 'Claimed Name')
  assert.equal(metadataRecords[0].creator_claims_untrusted.unknown_fields.unknownValue, '900719925474099312345')
  const markets = await readFamily(root, run.manifest.run_id, 'markets')
  assert.equal(markets.length, 1)
  assert.equal(markets[0].price_usd, '102.94')
  assert.equal(markets[0].liquidity.usd, '14334382.94')
  assert.equal(markets[0].txns.m5.buys, '226')
  assert.equal(markets[0].cache_age, '12')
  const reliability = await readFamily(root, run.manifest.run_id, 'reliability')
  assert.ok(reliability.some(item => item.status === 'not_indexed'))
  assert.equal((await store.readRaw(run.manifest.run_id, 'metadata')).length, 1)
  assert.equal((await store.readRaw(run.manifest.run_id, 'dexscreener-solusd')).length, 1)
  assert.equal((await store.readRaw(run.manifest.run_id, 'dexscreener-pairs')).length, 1)
  await store.close()
})

test('late enrichment is rejected and abortable work cannot block core appends or Stop', async t => {
  const root = await temporaryRoot(t)
  let now = Date.parse('2026-08-26T16:00:00.000Z')
  const store = new RunStore(root, { now: () => now })
  const run = await store.createRun(5)
  await seedToken(run)
  let release
  const transportStarted = Promise.withResolvers()
  const fetcher = new SafeFetcher({
    now: () => now,
    resolve: publicResolver,
    transport: request => new Promise((resolve, reject) => {
      release = () => resolve(response(200, 'application/json', '{"name":"late"}'))
      if (request.signal.aborted) reject(request.signal.reason)
      else request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true })
      transportStarted.resolve()
    }),
  })
  const enrichment = new InWindowEnrichment(run, { fetcher, now: () => now })
  const pending = enrichment.scheduleMetadata({ mint: 'MintMeta', uri: 'https://public.test/late' })
  await transportStarted.promise
  await run.appendRaw({
    stream: 'pumpapi-live', source: 'fixture', transport: 'live', channel: 'core',
    payload: Buffer.from('{"core":"unblocked"}'), receivedAt: new Date(now).toISOString(),
  })
  now = Date.parse(run.manifest.stops_at)
  release()
  const late = await pending
  assert.equal(late.accepted, false)
  assert.equal((await store.readRaw(run.manifest.run_id, 'metadata')).length, 0)

  now -= 1
  const second = enrichment.scheduleMetadata({ mint: 'MintMeta', uri: 'https://public.test/abort' })
  await Promise.resolve()
  const started = performance.now()
  await enrichment.stop()
  assert.ok(performance.now() - started < 100)
  assert.equal((await second).accepted, false)
  await run.finalize('timer_expired')
  assert.equal((await store.readRaw(run.manifest.run_id, 'pumpapi-live')).length, 1)
  await store.close()
})
