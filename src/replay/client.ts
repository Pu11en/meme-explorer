import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { createZstdDecompress } from 'node:zlib'
import type { RunManifest } from '../storage/types.js'
import type { ReplayRepairSession } from './repair.js'

export interface ReplayArchive {
  readonly status: 'available' | 'missing' | 'failed'
  readonly lines?: AsyncIterable<Uint8Array>
  readonly detail?: string
}

export type ReplayArchiveFetcher = (url: string, signal?: AbortSignal) => Promise<ReplayArchive>

export function replayArchiveUrls(manifest: RunManifest): string[] {
  const start = Date.parse(manifest.started_at)
  const stopExclusive = Date.parse(manifest.stops_at)
  const urls: string[] = []
  for (let hour = Math.floor(start / 3_600_000) * 3_600_000; hour < stopExclusive; hour += 3_600_000) {
    const date = new Date(hour)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hourLabel = String(date.getUTCHours()).padStart(2, '0')
    urls.push(`https://replay.pumpapi.io/${year}/${month}/${day}/${hourLabel}.jsonl.zst`)
  }
  return urls
}

export const fetchReplayArchive: ReplayArchiveFetcher = async (url, signal) => {
  try {
    const response = await fetch(url, signal === undefined ? {} : { signal })
    if (response.status === 404) return { status: 'missing', detail: 'HTTP 404' }
    if (!response.ok || response.body === null) return { status: 'failed', detail: `HTTP ${response.status}` }
    const compressed = Readable.fromWeb(response.body as never)
    const decompressed = compressed.pipe(createZstdDecompress())
    const reader = createInterface({ input: decompressed, crlfDelay: Number.POSITIVE_INFINITY })
    return {
      status: 'available',
      lines: (async function* () {
        for await (const line of reader) if (line !== '') yield Buffer.from(line, 'utf8')
      })(),
    }
  } catch (error) {
    return { status: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }
}

export async function repairFromArchives(
  session: ReplayRepairSession,
  fetcher: ReplayArchiveFetcher = fetchReplayArchive,
  signal?: AbortSignal,
): Promise<RunManifest> {
  for (const url of replayArchiveUrls(session.manifest)) {
    const archive = await fetcher(url, signal)
    if (archive.status !== 'available' || archive.lines === undefined) {
      await session.markMissingArchive(url, archive.detail ?? archive.status)
      continue
    }
    let lineNumber = 0
    for await (const line of archive.lines) {
      lineNumber += 1
      await session.appendLine(line, url, lineNumber)
    }
  }
  return session.finalize()
}
