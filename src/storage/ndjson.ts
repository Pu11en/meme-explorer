import type { FileHandle } from 'node:fs/promises'
import { open } from 'node:fs/promises'
import { dirname } from 'node:path'
import { ensureDirectory } from './files.js'
import type { FlushPolicy } from './types.js'

export class NdjsonWriter {
  private readonly pending: string[] = []
  private handlePromise: Promise<FileHandle> | undefined
  private timer: NodeJS.Timeout | undefined
  private chain: Promise<void> = Promise.resolve()
  private failure: unknown
  private closed = false

  constructor(
    readonly path: string,
    readonly policy: FlushPolicy,
  ) {}

  async append(value: unknown): Promise<void> {
    this.assertUsable()
    this.pending.push(`${JSON.stringify(value)}\n`)
    if (this.pending.length >= this.policy.max_records) {
      await this.flush()
      return
    }
    this.timer ??= setTimeout(() => {
      this.timer = undefined
      void this.flush().catch(error => { this.failure = error })
    }, this.policy.max_delay_ms)
    this.timer.unref?.()
  }

  async flush(): Promise<void> {
    this.assertUsable()
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    const batch = this.pending.splice(0)
    if (batch.length === 0) {
      await this.chain
      this.assertUsable()
      return
    }
    this.chain = this.chain.then(async () => {
      const handle = await this.handle()
      await handle.writeFile(batch.join(''), 'utf8')
      await handle.sync()
    })
    try {
      await this.chain
    } catch (error) {
      this.failure = error
      throw error
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    await this.flush()
    this.closed = true
    const handle = await this.handlePromise
    await handle?.close()
  }

  private async handle(): Promise<FileHandle> {
    if (this.handlePromise === undefined) {
      this.handlePromise = (async () => {
        await ensureDirectory(dirname(this.path))
        return open(this.path, 'a', 0o600)
      })()
    }
    return this.handlePromise
  }

  private assertUsable(): void {
    if (this.failure !== undefined) throw this.failure
    if (this.closed) throw new Error(`NDJSON writer is closed: ${this.path}`)
  }
}
