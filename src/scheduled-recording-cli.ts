#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { runScheduledRecording, validateJob, type RecordingJob } from './scheduled-recording.js'

const controller = new AbortController()
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort())
try {
  const path = process.argv[2]
  if (!path) throw new Error('usage: scheduled-recording-cli <absolute-job.json> [--check]')
  const job = JSON.parse(await readFile(path, 'utf8')) as RecordingJob
  validateJob(job)
  if (process.argv[3] === '--check') console.log(JSON.stringify({ valid: true, job }))
  else {
    await runScheduledRecording(job, { signal: controller.signal })
    console.log(JSON.stringify({ batch_id: job.batch_id, finished_at: new Date().toISOString() }))
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
