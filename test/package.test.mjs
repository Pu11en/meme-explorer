import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

test('package is a Node-only DSH bundle with no client contribution', () => {
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.main, 'lib/index.js')
  assert.equal('dsh.client' in manifest, false)
  assert.match(patch, /id: pump-observer/u)
  assert.doesNotMatch(patch, /dsh\.client|client/u)
})

test('runtime dependency surface is limited to official peers', () => {
  assert.deepEqual(manifest.dependencies, undefined)
  const peers = Object.keys(manifest.peerDependencies).sort()
  assert.deepEqual(peers, [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-agent',
    '@deepseek-ai/dsh-commands',
    '@deepseek-ai/dsh-llm',
    '@deepseek-ai/dsh-session',
    '@deepseek-ai/dsh-tools',
  ])
})
