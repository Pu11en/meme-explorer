import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? '/Users/drewp/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
)
const output = resolve(process.argv[2])
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  timeout: 60000,
  executablePath:
    process.env.BROWSER_EXECUTABLE ??
    '/Users/drewp/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell',
  args: ['--disable-gpu'],
})
const errors = []
const network = []
try {
  console.log('Browser launched')
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('request', (r) => network.push(r.url()))
  await page.goto(process.argv[3] ?? 'http://127.0.0.1:4182')
  await page.waitForSelector('#coins tr')
  console.log('Page loaded')
  const counts = []
  for (let i = 0; i < 6; i++) {
    await page.selectOption('#filter', String(i))
    const data = await page.evaluate(() => {
      const c = JSON.parse(document.getElementById('data').textContent).cohorts[
        Number(document.getElementById('filter').value)
      ]
      return {
        id: c.definition.id,
        members: c.summary.members,
        title: document.getElementById('filterTitle').textContent,
        rows: document.querySelectorAll('#coins tr').length,
        info: document.getElementById('pageInfo').textContent,
      }
    })
    assert(data.info.startsWith(data.members + ' coins'))
    assert(data.rows <= 50)
    counts.push(data)
  }
  await page.selectOption('#filter', '0')
  await page.selectOption('#status', 'unobservable')
  assert.equal(await page.locator('#coins tr').count(), 0)
  await page.selectOption('#status', 'rejected')
  assert((await page.locator('#coins').innerText()).includes('recording_ended_early'))
  await page.selectOption('#filter', '1')
  await page.selectOption('#status', 'unobservable')
  assert((await page.locator('#pageInfo').innerText()).startsWith('61 coins'))
  await page.selectOption('#filter', '5')
  await page.selectOption('#status', 'member')
  await page.selectOption('#metric', 'arrival_buckets')
  assert((await page.locator('#chart polyline').count()) > 0)
  await page.locator('#clear').click()
  assert.equal(await page.locator('#chart polyline').count(), 0)
  await page.locator('#coins input[type=checkbox]').first().check()
  assert.equal(await page.locator('#chart polyline').count(), 1)
  await page.locator('#search').fill('NO_SUCH_COIN_987654')
  assert.equal(await page.locator('#coins tr').count(), 0)
  await page.locator('#search').fill('')
  await page.screenshot({ path: join(output, 'desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: join(output, 'mobile.png'), fullPage: true })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await page.locator('#filter').focus()
  assert.equal(await page.evaluate(() => document.activeElement.id), 'filter')
  assert.deepEqual(errors, [])
  assert(network.every((u) => u.startsWith('http://127.0.0.1:4182')))
  await writeFile(
    join(output, 'browser.json'),
    JSON.stringify(
      {
        passed: true,
        filter_counts: counts,
        errors,
        network_requests: network,
        desktop: { width: 1280, height: 900 },
        mobile: { width: 390, height: 844 },
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    JSON.stringify({ passed: true, filters: counts.length, errors, network_requests: network.length }),
  )
} finally {
  await browser.close()
}
