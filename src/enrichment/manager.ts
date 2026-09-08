import { parseLosslessJson } from '../pumpapi/lossless-json.js'
import type { LosslessJson } from '../pumpapi/lossless-json.js'
import type { RunDataset } from '../storage/run-store.js'
import type { NormalizedRecord } from '../storage/types.js'
import { SafeFetcher, type SafeFetchResult, type SafeFetchStatus } from './safe-fetch.js'
import type { DexPairRequest, EnrichmentTaskResult, MetadataRequest } from './types.js'

export interface InWindowEnrichmentOptions {
  readonly fetcher?: SafeFetcher
  readonly now?: () => number
  readonly ipfsGateway?: string
  readonly dexBaseUrl?: string
}

function object(value: LosslessJson | undefined): Record<string, LosslessJson> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function text(value: LosslessJson | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function metadataUrl(uri: string, gateway: string): string {
  if (uri.startsWith('ipfs://')) {
    const path = uri.slice('ipfs://'.length).replace(/^ipfs\//u, '')
    if (path === '') throw new Error('empty IPFS URI')
    return new URL(path, gateway.endsWith('/') ? gateway : `${gateway}/`).toString()
  }
  const url = new URL(uri)
  if (url.protocol !== 'https:') throw new Error(`unsupported metadata protocol: ${url.protocol}`)
  return url.toString()
}

function emptyFetch(status: SafeFetchStatus, requestedUrl: string, now: number, error: string): SafeFetchResult {
  const at = new Date(now).toISOString()
  return {
    status,
    requested_url: requestedUrl,
    final_url: null,
    redirect_chain: [],
    started_at: at,
    completed_at: at,
    latency_ms: 0,
    http_status: null,
    headers: {},
    media_type: null,
    bytes: null,
    byte_len: null,
    sha256: null,
    error,
  }
}

function reliabilityStatus(fetch: SafeFetchResult): string {
  if (fetch.http_status === 429) return 'rate_limited'
  if (fetch.status === 'blocked') return 'blocked'
  if (fetch.status === 'timeout') return 'timeout'
  if (fetch.status === 'bad_media') return 'decode_error'
  if (fetch.status === 'dns_error' || fetch.status === 'failed' || fetch.status === 'http_error' || fetch.status === 'too_large') return 'failed'
  return 'ok'
}

export class InWindowEnrichment {
  private readonly fetcher: SafeFetcher
  private readonly now: () => number
  private readonly ipfsGateway: string
  private readonly dexBaseUrl: string
  private readonly tasks = new Set<Promise<unknown>>()
  private readonly controllers = new Set<AbortController>()
  private stopping = false

  constructor(
    private readonly dataset: RunDataset,
    options: InWindowEnrichmentOptions = {},
  ) {
    this.fetcher = options.fetcher ?? new SafeFetcher()
    this.now = options.now ?? (() => Date.now())
    this.ipfsGateway = options.ipfsGateway ?? 'https://ipfs.io/ipfs/'
    this.dexBaseUrl = options.dexBaseUrl ?? 'https://api.dexscreener.com/latest/dex/pairs/solana/'
  }

  scheduleMetadata(request: MetadataRequest): Promise<EnrichmentTaskResult> {
    return this.track('metadata', request.mint, controller => this.fetchMetadata(request, controller.signal))
  }

  scheduleDexPair(request: DexPairRequest): Promise<EnrichmentTaskResult> {
    return this.track('dex_pair', request.mint, controller => this.fetchDexPair(request, controller.signal))
  }

  async stop(): Promise<void> {
    this.stopping = true
    for (const controller of this.controllers) controller.abort(new DOMException('run stopped', 'AbortError'))
    await Promise.allSettled([...this.tasks])
  }

  private track(
    kind: EnrichmentTaskResult['kind'],
    mint: string,
    work: (controller: AbortController) => Promise<EnrichmentTaskResult>,
  ): Promise<EnrichmentTaskResult> {
    const now = this.now()
    const stopsAt = Date.parse(this.dataset.manifest.stops_at)
    if (this.stopping || now >= stopsAt) {
      return Promise.resolve({ kind, mint, accepted: false, fetch: emptyFetch('timeout', '', now, 'run window is closed') })
    }
    const controller = new AbortController()
    this.controllers.add(controller)
    const task = work(controller).finally(() => {
      this.controllers.delete(controller)
      this.tasks.delete(task)
    })
    this.tasks.add(task)
    return task
  }

  private async fetchMetadata(request: MetadataRequest, signal: AbortSignal): Promise<EnrichmentTaskResult> {
    let url: string
    try {
      url = metadataUrl(request.uri, this.ipfsGateway)
    } catch (error) {
      const fetch = emptyFetch('blocked', request.uri, this.now(), error instanceof Error ? error.message : String(error))
      if (this.insideWindow()) await this.writeFailure('metadata', request.mint, fetch)
      return { kind: 'metadata', mint: request.mint, accepted: this.insideWindow(), fetch }
    }
    const fetch = await this.fetcher.fetch(url, signal)
    if (!this.insideWindow()) return { kind: 'metadata', mint: request.mint, accepted: false, fetch }
    if (fetch.status !== 'success' || fetch.bytes === null) {
      await this.writeFailure('metadata', request.mint, fetch)
      return { kind: 'metadata', mint: request.mint, accepted: true, fetch }
    }
    const raw = await this.dataset.appendRaw({
      stream: 'metadata',
      source: 'metadata-fetch',
      transport: 'fetch',
      channel: 'metadata',
      payload: fetch.bytes,
      ...(fetch.media_type === null ? {} : { mediaType: fetch.media_type }),
      receivedAt: fetch.completed_at,
      commitment: 'unknown',
      parserVersion: 'metadata/1',
    })
    let claims: Record<string, unknown> = {}
    let decodeStatus = 'ok'
    if (fetch.media_type === 'application/json' || fetch.media_type === 'text/json') {
      try {
        const root = object(parseLosslessJson(Buffer.from(fetch.bytes).toString('utf8')))
        if (root === undefined) throw new Error('metadata root must be an object')
        claims = {
          name: text(root.name),
          symbol: text(root.symbol),
          description: text(root.description),
          image: text(root.image),
          website: text(root.website) ?? text(root.external_url),
          twitter: text(root.twitter),
          telegram: text(root.telegram),
          unknown_fields: Object.fromEntries(Object.entries(root).filter(([key]) => ![
            'name', 'symbol', 'description', 'image', 'website', 'external_url', 'twitter', 'telegram',
          ].includes(key))),
        }
      } catch (error) {
        decodeStatus = 'decode_error'
        claims = { decode_error: error instanceof Error ? error.message : String(error) }
      }
    }
    const record: NormalizedRecord = {
      schema: 'pump.metadata/1',
      dataset_version: '1.0.0',
      run_id: this.dataset.manifest.run_id,
      source: 'metadata-fetch',
      received_at: fetch.completed_at,
      raw_seq: raw.seq,
      mint: request.mint,
      uri: request.uri,
      final_url: fetch.final_url,
      status: decodeStatus,
      media_type: fetch.media_type,
      content_sha256: fetch.sha256,
      content_size: fetch.byte_len,
      latency_ms: fetch.latency_ms,
      redirect_chain: fetch.redirect_chain,
      creator_claims_untrusted: claims,
    }
    await this.dataset.appendNormalized('metadata', record, `metadata:${request.mint}:${fetch.sha256 ?? fetch.final_url}`)
    if (decodeStatus !== 'ok') await this.writeFailure('metadata_decode', request.mint, { ...fetch, status: 'bad_media' })
    return { kind: 'metadata', mint: request.mint, accepted: true, fetch }
  }

  private async fetchDexPair(request: DexPairRequest, signal: AbortSignal): Promise<EnrichmentTaskResult> {
    const url = new URL(encodeURIComponent(request.pairAddress), this.dexBaseUrl.endsWith('/') ? this.dexBaseUrl : `${this.dexBaseUrl}/`).toString()
    const fetch = await this.fetcher.fetch(url, signal)
    if (!this.insideWindow()) return { kind: 'dex_pair', mint: request.mint, accepted: false, fetch }
    if (fetch.status !== 'success' || fetch.bytes === null) {
      await this.writeFailure('dexscreener', request.mint, fetch)
      return { kind: 'dex_pair', mint: request.mint, accepted: true, fetch }
    }
    const stream = request.referenceKind === 'sol_usd' ? 'dexscreener-solusd' : 'dexscreener-pairs'
    const raw = await this.dataset.appendRaw({
      stream,
      source: 'dexscreener',
      transport: 'poll',
      channel: request.referenceKind ?? 'token_pair',
      payload: fetch.bytes,
      ...(fetch.media_type === null ? {} : { mediaType: fetch.media_type }),
      receivedAt: fetch.completed_at,
      commitment: 'provider',
      parserVersion: 'dexscreener-pair/1',
    })
    let pair: Record<string, LosslessJson> | undefined
    try {
      const root = object(parseLosslessJson(Buffer.from(fetch.bytes).toString('utf8')))
      const pairs = root?.pairs
      if (Array.isArray(pairs)) {
        pair = pairs.map(object).find(candidate => text(candidate?.pairAddress)?.toLowerCase() === request.pairAddress.toLowerCase())
          ?? pairs.map(object).find(candidate => candidate !== undefined)
      } else {
        pair = object(root?.pair)
      }
    } catch (error) {
      await this.writeFailure('dexscreener_decode', request.mint, { ...fetch, status: 'bad_media', error: error instanceof Error ? error.message : String(error) }, raw.seq)
      return { kind: 'dex_pair', mint: request.mint, accepted: true, fetch }
    }
    if (pair === undefined) {
      await this.writeFailure('dexscreener_not_indexed', request.mint, fetch, raw.seq, 'not_indexed')
      return { kind: 'dex_pair', mint: request.mint, accepted: true, fetch }
    }
    const record: NormalizedRecord = {
      schema: 'pump.market/1',
      dataset_version: '1.0.0',
      run_id: this.dataset.manifest.run_id,
      source: 'dexscreener',
      received_at: fetch.completed_at,
      raw_seq: raw.seq,
      mint: request.mint,
      reference_kind: request.referenceKind ?? 'token_pair',
      pair_address: text(pair.pairAddress),
      chain_id: text(pair.chainId),
      dex_id: text(pair.dexId),
      base_token: pair.baseToken ?? null,
      quote_token: pair.quoteToken ?? null,
      price_native: pair.priceNative ?? null,
      price_usd: pair.priceUsd ?? null,
      liquidity: pair.liquidity ?? null,
      txns: pair.txns ?? null,
      volume: pair.volume ?? null,
      price_change: pair.priceChange ?? null,
      fdv: pair.fdv ?? null,
      market_cap: pair.marketCap ?? null,
      pair_created_at: pair.pairCreatedAt ?? null,
      cache_age: fetch.headers.age ?? null,
      provider_status: 'indexed',
    }
    await this.dataset.appendNormalized('markets', record, `market:${request.referenceKind ?? 'token_pair'}:${request.pairAddress}:${fetch.completed_at}`)
    return { kind: 'dex_pair', mint: request.mint, accepted: true, fetch }
  }

  private insideWindow(): boolean {
    const now = this.now()
    return !this.stopping && now >= Date.parse(this.dataset.manifest.started_at) && now < Date.parse(this.dataset.manifest.stops_at)
  }

  private async writeFailure(
    scope: string,
    mint: string,
    fetch: SafeFetchResult,
    rawSeq: number | null = null,
    explicitStatus?: string,
  ): Promise<void> {
    const record: NormalizedRecord = {
      schema: 'pump.reliability/1',
      dataset_version: '1.0.0',
      run_id: this.dataset.manifest.run_id,
      source: scope.startsWith('dexscreener') ? 'dexscreener' : 'metadata-fetch',
      received_at: fetch.completed_at,
      raw_seq: rawSeq,
      mint,
      kind: scope,
      status: explicitStatus ?? reliabilityStatus(fetch),
      detail: {
        requested_url: fetch.requested_url,
        final_url: fetch.final_url,
        http_status: fetch.http_status,
        media_type: fetch.media_type,
        error: fetch.error,
        latency_ms: fetch.latency_ms,
      },
    }
    await this.dataset.appendNormalized('reliability', record)
  }
}
