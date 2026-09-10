import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, open, link, unlink, statfs } from 'node:fs/promises'
import { join } from 'node:path'
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
export function digest(v: unknown): string {
  return createHash('sha256').update(canonical(v)).digest('hex')
}
export async function reserve(path: string, minimum = 15 * 1024 ** 3): Promise<void> {
  const s = await statfs(path)
  if (s.bavail * s.bsize < minimum) throw new Error('analysis free-space reserve would be breached')
}
export async function saveArtifact(root: string, name: string, value: unknown): Promise<string> {
  await mkdir(root, { recursive: true })
  const path = join(root, name)
  const body = canonical(value) + '\n'
  const temporary = join(root, '.pending-' + randomUUID())
  const handle = await open(temporary, 'wx', 0o600)
  try {
    try {
      await handle.writeFile(body)
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await link(temporary, path)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST' || (await readFile(path, 'utf8')) !== body) throw e
    }
  } finally {
    await unlink(temporary)
  }
  return path
}
export function boundedReceipt(value: unknown): string {
  const s = JSON.stringify(value)
  if (Buffer.byteLength(s) > 65536) throw new Error('receipt exceeds 64 KiB')
  return s
}
