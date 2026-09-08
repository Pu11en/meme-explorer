import { createHash } from 'node:crypto'
import { open, rename, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { ensureDirectory, pathExists, syncDirectory } from './files.js'
import type { BlobRef } from './types.js'

export class BlobStore {
  constructor(private readonly root: string) {}

  async put(bytes: Uint8Array, mediaType: string | null = null): Promise<BlobRef> {
    const buffer = Buffer.from(bytes)
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    const path = join(this.root, sha256)
    await ensureDirectory(this.root)
    if (!(await pathExists(path))) {
      const temporary = join(this.root, `.${process.pid}-${Date.now()}-${sha256}.tmp`)
      const handle = await open(temporary, 'wx', 0o600)
      try {
        await handle.writeFile(buffer)
        await handle.sync()
      } finally {
        await handle.close()
      }
      try {
        await rename(temporary, path)
        await syncDirectory(this.root)
      } catch (error) {
        await rm(temporary, { force: true }).catch(() => undefined)
        if (!(await pathExists(path))) throw error
      }
    }
    return { sha256, size: buffer.byteLength, media_type: mediaType, path: `blobs/${basename(path)}` }
  }
}
