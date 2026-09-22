// Route-contract verifier for refactor work.
//
// Lives in the repo so every refactor of these pages can be checked in one
// command instead of a hand-written throwaway probe. The demo stack must be up
// (docker compose up -d), which serves the frontend on :5173.
//
//   npm run verify:pages                        smoke every route, fail on any console or page error
//   npm run verify:pages -- --snapshot s.json   capture the route contract (run on a clean tree)
//   npm run verify:pages -- --check s.json      compare against a captured contract, fail on drift
//   npm run verify:pages -- --check s.json --strict-data   also fail on data movement
//
// The capture holds each route's headings, controls, table shape, inputs and
// normalized body text. It is compared in two tiers, because those fields do
// not all mean the same thing:
//
//   structure  the skeleton a refactor must not touch: headings, table headers,
//              input shapes, how many selects exist, and button labels with
//              digits folded and duplicates dropped. Drift here is a failure.
//   data       what the visible dataset happens to be: table row counts, select
//              option lists, and body text. These move whenever a scan is added,
//              so they are reported, not asserted. A check that fails on new
//              data proves nothing about the change being reviewed.
//
// The scan picker is why the tiers exist. Its entries render as buttons, so a
// single new scan used to fail the check on every route that shows the picker.
// Digits fold those entries into one stable label per profile instead.
//
// Two rules for reading the output:
//   - A structure failure is real. Fix it or justify it in the pull request.
//   - A data difference needs a same-moment control before it means anything.
//     Snapshot the unchanged system, then re-point this harness at the changed
//     one and compare. A snapshot taken before a data change and a check taken
//     after it will always differ, and that difference is the data.
//
// Run a check while nothing else touches the stack. A scan started mid-run moves
// the pages exactly as injected drift would, and the harness reports that
// movement without being able to say where it came from.
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

// Collapses every run of digits, so a scan id, a clock time, a package count and
// a version all read as the same placeholder. Used on labels only: a label's
// digits are data, its words are the interface.
function foldDigits(s) {
  return s.replace(/\d+/g, '<N>')
}

function uniqueFolded(labels) {
  return [...new Set(labels.map((l) => foldDigits(normalize(l))))].sort()
}

// The skeleton: present or absent, shaped or reshaped. Digits are folded and
// repeats are dropped, so N scans in the picker read as one entry per profile.
function structureOf(c) {
  return {
    headings: c.headings,
    tableHeaders: c.tableHeaders,
    inputs: c.inputs,
    selectCount: c.selects.length,
    buttons: uniqueFolded(c.buttons),
    errors: c.errors,
  }
}

// What the dataset makes visible right now.
function dataOf(c) {
  return {
    rowCount: c.rowCount,
    selects: c.selects,
    bodyText: c.bodyText,
    bodyWords: c.bodyText ? c.bodyText.split(' ').length : 0,
  }
}

// Word-level movement in body text. Reported, never asserted: package names and
// counts appear here, so it moves with the data by design.
function bodyDiff(before, after) {
  if (before.bodyText === after.bodyText) return null
  const A = before.bodyText.split(' ')
  const B = after.bodyText.split(' ')
  const dropped = A.filter((w) => !B.includes(w)).slice(0, 25)
  const added = B.filter((w) => !A.includes(w)).slice(0, 25)
  return `bodyText:\n      only-before: ${dropped.join(' | ') || '(none)'}\n      only-after:  ${added.join(' | ') || '(none)'}`
}

function keyDiff(key, before, after) {
  const a = JSON.stringify(before[key])
  const b = JSON.stringify(after[key])
  if (a === b) return null
  return `${key}:\n      before: ${a}\n      after:  ${b}`
}

function structureDiffs(before, after) {
  const out = []
  for (const key of ['headings', 'tableHeaders', 'inputs', 'selectCount', 'buttons', 'errors']) {
    const d = keyDiff(key, before, after)
    if (d) out.push(d)
  }
  return out
}

function dataDiffs(before, after) {
  const out = []
  if (before.rowCount !== after.rowCount) {
    out.push(`rows ${before.rowCount} -> ${after.rowCount}`)
  }
  if (before.bodyWords !== after.bodyWords) {
    out.push(`body words ${before.bodyWords} -> ${after.bodyWords}`)
  }
  if (JSON.stringify(before.selects) !== JSON.stringify(after.selects)) {
    out.push(`select options changed:\n      before: ${JSON.stringify(before.selects)}\n      after:  ${JSON.stringify(after.selects)}`)
  }
  const bd = bodyDiff(before, after)
  if (bd) out.push(bd)
  return out
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

async function captureAll() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  const captured = {}
  for (const route of ROUTES) captured[route.name] = await capture(page, route)
  await browser.close()
  return captured
}

function runSnapshot(captured, file) {
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

function runCheck(captured, file, strictData) {
  const before = JSON.parse(fs.readFileSync(file, 'utf8'))
  let structureDrift = 0
  let dataDrift = 0

  for (const route of ROUTES) {
    const was = before[route.name]
    const now = captured[route.name]
    const structural = structureDiffs(structureOf(was), structureOf(now))
    const data = dataDiffs(dataOf(was), dataOf(now))
    if (structural.length) {
      structureDrift++
      console.log(`\nFAIL structure ${route.path}`)
      structural.forEach((d) => console.log('    ' + d))
    }
    if (data.length) {
      dataDrift++
      console.log(`\ninfo data ${route.path}`)
      data.forEach((d) => console.log('    ' + d))
    }
  }

  const dataLine = dataDrift ? `${dataDrift}/${ROUTES.length} routes moved data (informational)` : 'no data movement'
  if (!structureDrift) {
    console.log(
      `\nPASS: structure matches on all ${ROUTES.length} routes; ${dataLine}` +
        (strictData && dataDrift ? ' (--strict-data turns this into a failure)' : ''),
    )
  }
  if (structureDrift) {
    console.log(`\nFAIL: structure drift on ${structureDrift}/${ROUTES.length} routes`)
  }
  process.exit(structureDrift || (strictData && dataDrift) ? 1 : 0)
}

function runSmoke(captured) {
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
}

;(async () => {
  const args = process.argv.slice(2)
  const snapIdx = args.indexOf('--snapshot')
  const checkIdx = args.indexOf('--check')
  const strictData = args.includes('--strict-data')
  const file = snapIdx >= 0 ? args[snapIdx + 1] : checkIdx >= 0 ? args[checkIdx + 1] : null
  if ((snapIdx >= 0 || checkIdx >= 0) && !file) {
    console.error('--snapshot and --check need a file path')
    process.exit(2)
  }

  const captured = await captureAll()
  if (snapIdx >= 0) return runSnapshot(captured, file)
  if (checkIdx >= 0) return runCheck(captured, file, strictData)
  return runSmoke(captured)
})()
