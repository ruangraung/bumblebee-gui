// Route-contract verifier for refactor work.
//
// Lives in the repo so every refactor of these pages can be checked in one
// command instead of a hand-written throwaway probe. The demo stack must be up
// (docker compose up -d), which serves the frontend on :5173.
//
//   npm run verify:pages                        smoke every route, fail on any console or page error
//   npm run verify:pages -- --snapshot s.json   capture the route contract (run on a clean tree)
//   npm run verify:pages -- --check s.json      compare against a captured contract, fail on drift
//
// The contract holds each route's headings, controls, table shape, inputs and
// normalized body text. A pure refactor must not change any of it, so --check
// is the strongest cheap proof that a refactor altered no visible behavior.
const { chromium } = require('@playwright/test')
const fs = require('fs')

const BASE = process.env.VERIFY_BASE || 'http://localhost:5173'
const ROUTES = [
  { path: '/', name: 'dashboard' },
  { path: '/scan', name: 'scan' },
  { path: '/results', name: 'results' },
  { path: '/findings', name: 'findings' },
  { path: '/settings', name: 'settings' },
]

// Tokens a stable demo dataset still produces. Everything else is expected to
// survive a refactor byte for byte, which is what makes the diff meaningful.
function normalize(s) {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?/g, '<ISO>')
    .replace(/\b\d+ (second|minute|hour|day)s? ago\b/gi, '<AGO>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    .trim()
}

async function capture(page, route) {
  const errors = []
  const onPageError = (e) => errors.push('pageerror: ' + e.message)
  const onConsole = (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text())
  }
  page.on('pageerror', onPageError)
  page.on('console', onConsole)

  await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded' })
  // These pages poll the API, so networkidle is not a reliable signal. Wait for
  // real content and then let the first render settle.
  await page
    .waitForFunction(() => document.body.innerText.trim().length > 40, { timeout: 15000 })
    .catch(() => {})
  await page.waitForTimeout(800)

  const contract = {
    route: route.path,
    headings: (await page.locator('h1, h2, h3').allTextContents()).map(normalize),
    buttons: (await page.locator('button').allTextContents()).map(normalize).filter(Boolean).sort(),
    selects: await Promise.all(
      (await page.locator('select').all()).map(async (s) => ({
        options: (await s.locator('option').allTextContents()).map(normalize),
      })),
    ),
    tableHeaders: (await page.locator('table thead th').allTextContents()).map(normalize),
    rowCount: await page.locator('table tbody tr').count(),
    inputs: await Promise.all(
      (await page.locator('input').all()).map(async (i) => ({
        type: (await i.getAttribute('type')) || 'text',
        placeholder: normalize((await i.getAttribute('placeholder')) || ''),
      })),
    ),
    bodyText: normalize(await page.locator('body').innerText()),
    errors,
  }

  page.off('pageerror', onPageError)
  page.off('console', onConsole)
  return contract
}

function diffContracts(before, after) {
  const out = []
  for (const key of ['headings', 'buttons', 'selects', 'tableHeaders', 'inputs', 'rowCount']) {
    const a = JSON.stringify(before[key])
    const b = JSON.stringify(after[key])
    if (a !== b) out.push(`${key}:\n      before: ${a}\n      after:  ${b}`)
  }
  if (before.bodyText !== after.bodyText) {
    const A = before.bodyText.split(' ')
    const B = after.bodyText.split(' ')
    const dropped = A.filter((w) => !B.includes(w)).slice(0, 25)
    const added = B.filter((w) => !A.includes(w)).slice(0, 25)
    out.push(
      `bodyText changed:\n      only-before: ${dropped.join(' | ') || '(none)'}\n      only-after:  ${added.join(' | ') || '(none)'}`,
    )
  }
  if (before.errors.length || after.errors.length) {
    out.push(`errors:\n      before: ${JSON.stringify(before.errors)}\n      after:  ${JSON.stringify(after.errors)}`)
  }
  return out
}

;(async () => {
  const args = process.argv.slice(2)
  const snapIdx = args.indexOf('--snapshot')
  const checkIdx = args.indexOf('--check')
  const file = snapIdx >= 0 ? args[snapIdx + 1] : checkIdx >= 0 ? args[checkIdx + 1] : null
  if ((snapIdx >= 0 || checkIdx >= 0) && !file) {
    console.error('--snapshot and --check need a file path')
    process.exit(2)
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  const captured = {}
  for (const route of ROUTES) captured[route.name] = await capture(page, route)
  await browser.close()

  if (snapIdx >= 0) {
    fs.writeFileSync(file, JSON.stringify(captured, null, 2))
    const total = Object.values(captured).reduce((n, c) => n + c.errors.length, 0)
    console.log(`captured ${ROUTES.length} routes -> ${file} (console/page errors: ${total})`)
    for (const [name, c] of Object.entries(captured)) {
      console.log(
        `  ${name.padEnd(10)} rows=${String(c.rowCount).padEnd(4)} buttons=${c.buttons.length} selects=${c.selects.length} errors=${c.errors.length}`,
      )
      c.errors.forEach((e) => console.log('    ! ' + e.slice(0, 160)))
    }
    process.exit(total ? 1 : 0)
  }

  if (checkIdx >= 0) {
    const before = JSON.parse(fs.readFileSync(file, 'utf8'))
    let drifted = 0
    for (const route of ROUTES) {
      const diffs = diffContracts(before[route.name], captured[route.name])
      if (diffs.length) {
        drifted++
        console.log(`\nDRIFT on ${route.path}`)
        diffs.forEach((d) => console.log('    ' + d))
      }
    }
    console.log(
      drifted
        ? `\nFAIL: drift on ${drifted}/${ROUTES.length} routes`
        : `\nPASS: all ${ROUTES.length} routes match the contract, no visible change`,
    )
    process.exit(drifted ? 1 : 0)
  }

  let unhealthy = 0
  for (const route of ROUTES) {
    const c = captured[route.name]
    const bad = c.errors.length > 0 || c.bodyText.length < 50
    if (bad) unhealthy++
    console.log(
      `${bad ? 'FAIL' : 'ok  '} ${route.path.padEnd(10)} headings=${c.headings.length} rows=${c.rowCount} errors=${c.errors.length} textLen=${c.bodyText.length}`,
    )
    if (bad) c.errors.forEach((e) => console.log('     ! ' + e.slice(0, 160)))
  }
  console.log(unhealthy ? `\nFAIL: ${unhealthy}/${ROUTES.length} routes unhealthy` : `\nPASS: all ${ROUTES.length} routes clean`)
  process.exit(unhealthy ? 1 : 0)
})()
