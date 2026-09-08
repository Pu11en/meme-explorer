import type { SafeFetchResult } from './safe-fetch.js'

export interface MetadataRequest {
  readonly mint: string
  readonly uri: string
  readonly sourceRawSeq?: number
}

export interface DexPairRequest {
  readonly mint: string
  readonly pairAddress: string
  readonly sourceRawSeq?: number
  readonly referenceKind?: 'token_pair' | 'sol_usd'
}

export interface EnrichmentTaskResult {
  readonly kind: 'metadata' | 'dex_pair'
  readonly mint: string
  readonly accepted: boolean
  readonly fetch: SafeFetchResult
}
