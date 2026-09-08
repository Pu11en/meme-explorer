import { createHash } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import type { IncomingHttpHeaders } from 'node:http'

export interface ResolvedAddress {
  readonly address: string
  readonly family: 4 | 6
}

export interface SafeTransportResponse {
  readonly statusCode: number
  readonly headers: IncomingHttpHeaders
  readonly body: AsyncIterable<Uint8Array>
}

export interface SafeTransportRequest {
  readonly url: URL
  readonly address: ResolvedAddress
  readonly signal: AbortSignal
  readonly headers: Record<string, string>
}

export type SafeResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>
export type SafeTransport = (request: SafeTransportRequest) => Promise<SafeTransportResponse>

export type SafeFetchStatus = 'success' | 'blocked' | 'timeout' | 'too_large' | 'bad_media' | 'http_error' | 'dns_error' | 'failed'

export interface SafeFetchResult {
  readonly status: SafeFetchStatus
  readonly requested_url: string
  readonly final_url: string | null
  readonly redirect_chain: readonly string[]
  readonly started_at: string
  readonly completed_at: string
  readonly latency_ms: number
  readonly http_status: number | null
  readonly headers: Record<string, string | readonly string[]>
  readonly media_type: string | null
  readonly bytes: Uint8Array | null
  readonly byte_len: number | null
  readonly sha256: string | null
  readonly error: string | null
}

export interface SafeFetcherOptions {
  readonly resolve?: SafeResolver
  readonly transport?: SafeTransport
  readonly now?: () => number
  readonly timeoutMs?: number
  readonly maxBytes?: number
  readonly maxRedirects?: number
  readonly allowedMediaTypes?: readonly string[]
  readonly userAgent?: string
}

const blocked = new BlockList()
for (const [network, prefix, type] of [
  ['0.0.0.0', 8, 'ipv4'], ['10.0.0.0', 8, 'ipv4'], ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'], ['169.254.0.0', 16, 'ipv4'], ['172.16.0.0', 12, 'ipv4'],
  ['192.0.0.0', 24, 'ipv4'], ['192.0.2.0', 24, 'ipv4'], ['192.168.0.0', 16, 'ipv4'],
  ['198.18.0.0', 15, 'ipv4'], ['198.51.100.0', 24, 'ipv4'], ['203.0.113.0', 24, 'ipv4'],
  ['224.0.0.0', 4, 'ipv4'], ['240.0.0.0', 4, 'ipv4'],
  ['::', 128, 'ipv6'], ['::1', 128, 'ipv6'], ['fc00::', 7, 'ipv6'], ['fe80::', 10, 'ipv6'],
  ['ff00::', 8, 'ipv6'], ['2001:db8::', 32, 'ipv6'],
] as const) blocked.addSubnet(network, prefix, type)

export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return false
  if (family === 4) return !blocked.check(address, 'ipv4')
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/iu.exec(address)?.[1]
  if (mapped !== undefined) return isPublicAddress(mapped)
  return !blocked.check(address, 'ipv6')
}

const defaultResolver: SafeResolver = async hostname => {
  const answers = await dnsLookup(hostname, { all: true, verbatim: true })
  return answers.map(answer => ({ address: answer.address, family: answer.family === 6 ? 6 : 4 }))
}

const defaultTransport: SafeTransport = request => new Promise((resolve, reject) => {
  const requester = request.url.protocol === 'https:' ? httpsRequest : httpRequest
  const nodeRequest = requester(request.url, {
    method: 'GET',
    headers: request.headers,
    signal: request.signal,
    lookup: (_hostname, _options, callback) => {
      callback(null, request.address.address, request.address.family)
    },
  }, response => {
    resolve({
      statusCode: response.statusCode ?? 0,
      headers: response.headers,
      body: response,
    })
  })
  nodeRequest.on('error', reject)
  nodeRequest.end()
})

function normalizedHeaders(headers: IncomingHttpHeaders): Record<string, string | readonly string[]> {
  return Object.fromEntries(Object.entries(headers).filter((entry): entry is [string, string | string[]] => entry[1] !== undefined))
}

function mediaType(headers: IncomingHttpHeaders): string | null {
  const value = headers['content-type']
  const first = Array.isArray(value) ? value[0] : value
  return first?.split(';', 1)[0]?.trim().toLowerCase() ?? null
}

function mediaAllowed(actual: string | null, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true
  if (actual === null) return false
  return allowed.some(candidate => candidate.endsWith('/*')
    ? actual.startsWith(candidate.slice(0, -1))
    : actual === candidate)
}

class TooLargeError extends Error {}
class BlockedTargetError extends Error {}
class DnsResolutionError extends Error {}
class BadMediaError extends Error {}
class HttpStatusError extends Error {
  constructor(readonly statusCode: number) { super(`HTTP ${statusCode}`) }
}

export class SafeFetcher {
  private readonly resolve: SafeResolver
  private readonly transport: SafeTransport
  private readonly now: () => number
  private readonly timeoutMs: number
  private readonly maxBytes: number
  private readonly maxRedirects: number
  private readonly allowedMediaTypes: readonly string[]
  private readonly userAgent: string

  constructor(options: SafeFetcherOptions = {}) {
    this.resolve = options.resolve ?? defaultResolver
    this.transport = options.transport ?? defaultTransport
    this.now = options.now ?? (() => Date.now())
    this.timeoutMs = options.timeoutMs ?? 5_000
    this.maxBytes = options.maxBytes ?? 5 * 1024 * 1024
    this.maxRedirects = options.maxRedirects ?? 3
    this.allowedMediaTypes = options.allowedMediaTypes ?? ['application/json', 'text/json', 'image/*']
    this.userAgent = options.userAgent ?? 'dsh-pump-observer/0.1'
  }

  async fetch(input: string, externalSignal?: AbortSignal): Promise<SafeFetchResult> {
    const started = this.now()
    const redirectChain: string[] = []
    let finalUrl: string | null = null
    let responseHeaders: Record<string, string | readonly string[]> = {}
    let responseStatus: number | null = null
    let responseMedia: string | null = null
    try {
      let current = new URL(input)
      for (let redirect = 0; redirect <= this.maxRedirects; redirect += 1) {
        if (current.protocol !== 'https:') throw new BlockedTargetError(`only HTTPS is allowed: ${current.protocol}`)
        if (current.username !== '' || current.password !== '') throw new BlockedTargetError('URL credentials are not allowed')
        const addresses = isIP(current.hostname) === 0
          ? await this.resolve(current.hostname).catch(error => { throw new DnsResolutionError(error instanceof Error ? error.message : String(error)) })
          : [{ address: current.hostname, family: isIP(current.hostname) as 4 | 6 }]
        if (addresses.length === 0) throw new DnsResolutionError('hostname returned no addresses')
        if (addresses.some(answer => !isPublicAddress(answer.address))) throw new BlockedTargetError(`hostname resolves to a blocked address: ${current.hostname}`)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(new DOMException('request timed out', 'TimeoutError')), this.timeoutMs)
        const abort = (): void => controller.abort(externalSignal?.reason)
        if (externalSignal?.aborted === true) abort()
        else externalSignal?.addEventListener('abort', abort, { once: true })
        const cleanup = (): void => {
          clearTimeout(timeout)
          externalSignal?.removeEventListener('abort', abort)
        }
        let response: SafeTransportResponse
        try {
          response = await this.transport({
            url: current,
            address: addresses[0] as ResolvedAddress,
            signal: controller.signal,
            headers: { accept: 'application/json, image/*;q=0.8', 'user-agent': this.userAgent },
          })
        } catch (error) {
          cleanup()
          throw error
        }
        responseStatus = response.statusCode
        responseHeaders = normalizedHeaders(response.headers)
        responseMedia = mediaType(response.headers)
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          const location = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location
          cleanup()
          if (location === undefined) throw new HttpStatusError(response.statusCode)
          if (redirect === this.maxRedirects) throw new BlockedTargetError('redirect limit exceeded')
          redirectChain.push(current.toString())
          current = new URL(location, current)
          continue
        }
        finalUrl = current.toString()
        if (response.statusCode < 200 || response.statusCode >= 300) {
          cleanup()
          throw new HttpStatusError(response.statusCode)
        }
        if (!mediaAllowed(responseMedia, this.allowedMediaTypes)) {
          cleanup()
          throw new BadMediaError(`unsupported media type: ${responseMedia ?? 'missing'}`)
        }
        const chunks: Buffer[] = []
        let length = 0
        try {
          for await (const chunk of response.body) {
            if (controller.signal.aborted) throw controller.signal.reason
            const buffer = Buffer.from(chunk)
            length += buffer.byteLength
            if (length > this.maxBytes) throw new TooLargeError(`response exceeded ${this.maxBytes} bytes`)
            chunks.push(buffer)
          }
        } finally {
          cleanup()
        }
        const bytes = Buffer.concat(chunks)
        return this.result('success', input, finalUrl, redirectChain, started, responseStatus, responseHeaders, responseMedia, bytes, null)
      }
      throw new BlockedTargetError('redirect limit exceeded')
    } catch (error) {
      const status: SafeFetchStatus = error instanceof BlockedTargetError ? 'blocked'
        : error instanceof DnsResolutionError ? 'dns_error'
          : error instanceof TooLargeError ? 'too_large'
            : error instanceof BadMediaError ? 'bad_media'
              : error instanceof HttpStatusError ? 'http_error'
                : error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError') ? 'timeout'
                  : externalSignal?.aborted === true ? 'timeout'
                    : 'failed'
      return this.result(status, input, finalUrl, redirectChain, started, responseStatus, responseHeaders, responseMedia, null, error instanceof Error ? error.message : String(error))
    }
  }

  private result(
    status: SafeFetchStatus,
    requestedUrl: string,
    finalUrl: string | null,
    redirects: readonly string[],
    started: number,
    httpStatus: number | null,
    headers: Record<string, string | readonly string[]>,
    contentType: string | null,
    bytes: Uint8Array | null,
    error: string | null,
  ): SafeFetchResult {
    const completed = this.now()
    return {
      status,
      requested_url: requestedUrl,
      final_url: finalUrl,
      redirect_chain: redirects,
      started_at: new Date(started).toISOString(),
      completed_at: new Date(completed).toISOString(),
      latency_ms: Math.max(0, completed - started),
      http_status: httpStatus,
      headers,
      media_type: contentType,
      bytes,
      byte_len: bytes?.byteLength ?? null,
      sha256: bytes === null ? null : createHash('sha256').update(bytes).digest('hex'),
      error,
    }
  }
}
