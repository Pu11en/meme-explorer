import { mkdir, open, readdir, stat, statfs } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { PumpApiRunRecorder, type PumpApiAdapter } from './recorder.js'
import { InWindowEnrichment } from './enrichment/manager.js'
import { RunStore } from './storage/run-store.js'
import { atomicWriteJson } from './storage/files.js'
import type { RunManifest } from './storage/types.js'

export interface RecordingJob {
  readonly schema: 'pump.scheduled-recording/1'
  readonly batch_id: string
  readonly label: string
  readonly starts_at: string
  readonly ends_at: string
  readonly data_root: string
  readonly minimum_free_bytes: number
  readonly maximum_batch_bytes: number
}

export function validateJob(job: RecordingJob): void {
  if (job.schema !== 'pump.scheduled-recording/1') throw new Error('unsupported recording job')
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(job.batch_id)) throw new Error('invalid batch ID')
  if (!job.label?.trim()) throw new Error('label required')
  if (!isAbsolute(job.data_root)) throw new Error('data_root must be absolute')
  const start = Date.parse(job.starts_at)
  const end = Date.parse(job.ends_at)
  if (!Number.isFinite(start) || end - start !== 3_600_000) throw new Error('job must span exactly one hour')
  if (![job.minimum_free_bytes, job.maximum_batch_bytes].every(n => Number.isSafeInteger(n) && n > 0)) {
    throw new Error('positive integer storage limits required')
  }
}

export function startDecision(job: RecordingJob, now: number): 'ready' | 'early' | 'missed' {
  const start = Date.parse(job.starts_at)
  return now < start ? 'early' : now > start + 60_000 ? 'missed' : 'ready'
}

export function storageStop(job: RecordingJob, free: number, used: number): string | null {
  if (free < job.minimum_free_bytes) return 'low_disk_space'
  if (used >= job.maximum_batch_bytes) return 'batch_size_limit'
  return null
}

export async function directoryBytes(root: string, inspect: typeof stat = stat): Promise<number> {
  let bytes = 0
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = join(root, item.name)
    try {
      if (item.isDirectory()) bytes += await directoryBytes(path, inspect)
      else if (item.isFile()) bytes += Number((await inspect(path)).size)
    } catch (error) {
      // Atomic JSON writes can rename a listed temporary file before stat runs.
      // This is a sampled size guard; a vanished entry is counted next poll at its new path.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return bytes
}

async function availableBytes(root: string): Promise<number> {
  const fs = await statfs(root)
  return fs.bavail * fs.bsize
}

export interface RecordingOptions {
  readonly adapter?: PumpApiAdapter
  readonly enrichment?: boolean
  readonly signal?: AbortSignal
  readonly now?: () => number
  readonly pollMs?: number
  readonly freeBytes?: (root: string) => Promise<number>
  readonly usedBytes?: (root: string) => Promise<number>
}

/** One attempt per isolated batch root. Existing attempts are never restarted automatically. */
export async function runScheduledRecording(job: RecordingJob, options: RecordingOptions = {}): Promise<void> {
  validateJob(job)
  const now = options.now ?? Date.now
  const decision = startDecision(job, now())
  if (decision === 'early') throw new Error('job invoked before scheduled start')
  await mkdir(job.data_root, { recursive: true })
  const attempt = await open(join(job.data_root, 'attempt.json'), 'wx', 0o600)
  await attempt.writeFile(JSON.stringify({ pid: process.pid, job, attempted_at: new Date(now()).toISOString() }))
  await attempt.sync()
  await attempt.close()
  const statusPath = join(job.data_root, 'job-status.json')
  const status = (state: string, extra: Record<string, unknown> = {}) => atomicWriteJson(statusPath, {
    batch_id: job.batch_id, state, updated_at: new Date(now()).toISOString(),
    scheduled_start: job.starts_at, scheduled_end: job.ends_at, ...extra,
  })
  if (decision === 'missed') {
    await status('missed', { reason: 'start_more_than_60_seconds_late; no catch-up recording' })
    return
  }
  const freeBytes = options.freeBytes ?? availableBytes
  const usedBytes = options.usedBytes ?? directoryBytes
  const store = new RunStore(job.data_root, {
    now,
    enabledAdapters: options.enrichment === false ? ['pumpapi-live'] : ['pumpapi-live', 'metadata', 'dexscreener'],
  })
  let recorder: PumpApiRunRecorder | undefined
  let finalized: RunManifest | undefined
  let dataset: Awaited<ReturnType<RunStore['createRun']>> | undefined
  try {
    const free = await freeBytes(job.data_root)
    const initialStop = storageStop(job, free, await usedBytes(job.data_root))
    if (initialStop || options.signal?.aborted) {
      await status('skipped', { reason: initialStop ?? 'interrupted_before_start', free_bytes: free })
      return
    }
    dataset = await store.createRun(60)
    await atomicWriteJson(join(job.data_root, 'batch.json'), {
      schema: 'pump.collection-batch/1', batch_id: job.batch_id, label: job.label,
      run_ids: [dataset.manifest.run_id],
    })
    await status('connecting', { run_id: dataset.manifest.run_id, free_bytes: free })
    recorder = new PumpApiRunRecorder({
      ...(options.adapter ? { adapter: options.adapter } : {}),
      ...(options.enrichment === false ? {} : { enrichment: new InWindowEnrichment(dataset) }),
      now,
      // The job owns the full run duration and serializes all stop paths.
      schedule: () => ({ cancel() {} }),
    })
    let connectionTimer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        recorder.start(dataset),
        new Promise<never>((_, reject) => {
          connectionTimer = setTimeout(() => reject(new Error('connection timeout after 15 seconds')), 15_000)
        }),
      ])
    } finally {
      clearTimeout(connectionTimer)
    }
    const captureEnd = Date.parse(dataset.manifest.stops_at)
    let reason = 'scheduled_end'
    while (now() < captureEnd) {
      if (options.signal?.aborted) { reason = 'interrupted'; break }
      const free = await freeBytes(job.data_root)
      const used = await usedBytes(job.data_root)
      const stop = storageStop(job, free, used)
      if (stop) { reason = stop; break }
      await status('running', {
        run_id: dataset.manifest.run_id, actual_start: dataset.manifest.started_at,
        counts: dataset.manifest.counts, free_bytes: free, batch_bytes: used,
      })
      const wait = Math.max(0, Math.min(options.pollMs ?? 5_000, captureEnd - now()))
      await delay(wait, undefined, options.signal ? { signal: options.signal } : {}).catch(error => {
        if (!options.signal?.aborted) throw error
      })
    }
    // Startup within the grace period still receives sixty minutes from the actual run start.
    const stopReason = reason === 'scheduled_end' && now() >= Date.parse(dataset.manifest.stops_at)
      ? 'timer_expired' : reason === 'interrupted' ? 'interrupted' : 'manual_early'
    finalized = await recorder.stop(stopReason)
    await status(finalized.status === 'error' ? 'error' : reason === 'scheduled_end' ? 'completed' : 'stopped_early', {
      reason, run_id: finalized.run_id, manifest: finalized,
      batch_path: join(job.data_root, 'batch.json'), batch_bytes: await usedBytes(job.data_root),
      free_bytes: await freeBytes(job.data_root),
    })
    if (finalized.status === 'error') throw new Error('recorder finalized with processing errors')
  } catch (error) {
    if (!finalized && dataset) {
      try { finalized = recorder?.active ? await recorder.stop('error') : await dataset.finalize('error') }
      catch { /* Durable manifest is retained for interrupted-run recovery. */ }
    }
    await status('error', { message: error instanceof Error ? error.message : String(error), manifest: finalized ?? null })
    throw error
  } finally {
    await store.close()
  }
}
