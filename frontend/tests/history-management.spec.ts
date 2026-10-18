import { test, expect, type Page, type Route } from '@playwright/test'
import type { ScanRecord } from '../src/lib/api'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

function scan(id: number): ScanRecord {
  return {
    id,
    timestamp: '2026-01-01T12:00:00Z',
    profile: 'baseline',
    status: 'completed',
    summary: {
      total_packages: 1, ecosystems_found: 1, findings_count: 1,
      ecosystem_counts: { npm: 1 },
    },
  }
}

type Mode = 'success' | 'partial' | 'delete-error' | 'read-error' | 'arrival'

interface HistoryFixture {
  records: ScanRecord[]
  reads: number[]
  deletes: string[]
  snapshots: number[][]
  unmatched: string[]
}

async function readHistory(route: Route, state: HistoryFixture, mode: Mode) {
  const url = new URL(route.request().url())
  const offset = Number(url.searchParams.get('offset'))
  state.reads.push(offset)
  expect(url.searchParams.get('limit')).toBe('20')
  expect(url.searchParams.has('offset')).toBe(true)
  if (mode === 'read-error') {
    await route.fulfill({ status: 503, json: { detail: 'History temporarily unavailable' } })
    return
  }
  await route.fulfill({ json: {
    scans: state.records.slice(offset, offset + 20), total: state.records.length,
    limit: 20, offset,
  } })
}

async function deleteHistory(route: Route, state: HistoryFixture, mode: Mode) {
  const snapshot = state.records.map(({ id }) => id)
  state.snapshots.push(snapshot)
  if (mode === 'delete-error') {
    await route.fulfill({ status: 503, json: { detail: 'History deletion unavailable' } })
    return
  }
  // A scan created after the server takes its snapshot must survive this operation.
  if (mode === 'arrival') state.records.unshift(scan(126))
  const failures = mode === 'partial' ? [{ id: 1, detail: 'Sample result file could not be removed' }] : []
  const deleted = snapshot.filter((id) => !failures.some((failure) => failure.id === id))
  state.records = state.records.filter(({ id }) => !deleted.includes(id))
  await route.fulfill({ json: { deleted_ids: deleted, failures, remaining: state.records.length } })
}

async function mockHistory(page: Page, mode: Mode = 'success') {
  const state = {
    records: Array.from({ length: 125 }, (_, i) => scan(125 - i)),
    reads: [] as number[],
    deletes: [] as string[],
    snapshots: [] as number[][],
    unmatched: [] as string[],
  }
  const about: Record<string, unknown> = {
    '/api/health': { status: 'ok', version: 'test' },
    '/api/scanner': { version: 'test', commit: null, error: null },
    '/api/exposure-catalog': { catalogues: 0, entries: 0, versions: 0, available: false },
    '/api/host-directories': { mounted: false, path: '/sample', directories: [] },
  }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (method === 'DELETE') state.deletes.push(url.pathname)
    switch (`${method} ${url.pathname}`) {
      case 'GET /api/scans':
        await route.fulfill({ json: state.records.slice(0, 20) })
        return
      case 'GET /api/scan-history':
        await readHistory(route, state, mode)
        return
      case 'DELETE /api/scan-history':
        await deleteHistory(route, state, mode)
        return
    }
    if (method === 'GET' && url.pathname in about) {
      await route.fulfill({ json: about[url.pathname] })
      return
    }
    state.unmatched.push(`${method} ${url.pathname}`)
    await route.abort()
  })
  return state
}

const count = (page: Page, n: number) => page.getByText(new RegExp(`^Scan history:\\s*${n} scans?$`))
const results = (page: Page, id: number) => page.getByRole('link', { name: `Results for scan ${id}`, exact: true })
const findings = (page: Page, id: number) => page.getByRole('link', { name: `Findings for scan ${id}`, exact: true })

async function openSettings(page: Page) {
  await page.goto(`${BASE_URL}/settings`)
  await expect(count(page, 125)).toBeVisible()
}

async function confirmClear(page: Page, accept: boolean) {
  let message = ''
  page.once('dialog', async (dialog) => {
    message = dialog.message()
    if (accept) await dialog.accept()
    else await dialog.dismiss()
  })
  const button = page.getByRole('button', { name: 'Clear all scan data', exact: true })
  await button.focus()
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(() => message).not.toBe('')
  expect(message).toMatch(/all.*125.*scans/i)
  expect(message).toMatch(/start|snapshot/i)
  expect(message).toMatch(/new.*(retain|keep|not.*delet)|(?:retain|keep).*new/i)
}

for (const width of [1280, 375]) {
  test(`Settings exposes all 125 scans with keyboard pagination at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await mockHistory(page)
    await openSettings(page)
    const previous = page.getByRole('button', { name: 'Previous history page', exact: true })
    const next = page.getByRole('button', { name: 'Next history page', exact: true })
    await expect(previous).toBeDisabled()
    const visited: number[] = []
    for (let offset = 0; offset <= 120; offset += 20) {
      const ids = Array.from({ length: Math.min(20, 125 - offset) }, (_, i) => 125 - offset - i)
      for (const id of ids) {
        await expect(results(page, id)).toHaveAttribute('href', `/results/${id}`)
        await expect(findings(page, id)).toHaveAttribute('href', `/findings/${id}`)
      }
      visited.push(...ids)
      if (offset < 120) {
        await next.focus()
        await expect(next).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(results(page, 105 - offset)).toBeVisible()
      }
    }
    expect(new Set(visited).size).toBe(125)
    await expect(results(page, 1)).toBeVisible()
    await expect(findings(page, 1)).toBeVisible()
    await expect(next).toBeDisabled()
    for (let offset = 100; offset >= 0; offset -= 20) {
      await previous.focus()
      await page.keyboard.press('Space')
      await expect(results(page, 125 - offset)).toBeVisible()
    }
    await expect(previous).toBeDisabled()
    await expect(count(page, 125)).toBeVisible()
    expect(state.reads).toEqual(expect.arrayContaining([0, 20, 40, 60, 80, 100, 120]))
    expect(state.deletes).toEqual([])
    expect(state.unmatched).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('cancel preserves every scan and sends no deletion request', async ({ page }) => {
  const state = await mockHistory(page)
  await openSettings(page)
  await confirmClear(page, false)
  await expect(count(page, 125)).toBeVisible()
  await expect(results(page, 125)).toBeVisible()
  expect(state.deletes).toEqual([])
  expect(state.records).toHaveLength(125)
  expect(state.unmatched).toEqual([])
})

test('clear deletes the complete history through one server-side snapshot request', async ({ page }) => {
  const state = await mockHistory(page)
  await openSettings(page)
  await confirmClear(page, true)
  await expect(count(page, 0)).toBeVisible()
  await expect(page.getByRole('link', { name: /^Results for scan / })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clear all scan data' })).toBeDisabled()
  expect(state.deletes).toEqual(['/api/scan-history'])
  expect(state.snapshots).toEqual([Array.from({ length: 125 }, (_, i) => 125 - i)])
  expect(state.records).toEqual([])
  expect(state.unmatched).toEqual([])
})

test('a later arrival survives snapshot deletion and remains visible', async ({ page }) => {
  const state = await mockHistory(page, 'arrival')
  await openSettings(page)
  await confirmClear(page, true)
  await expect(count(page, 1)).toBeVisible()
  await expect(results(page, 126)).toBeVisible()
  await expect(findings(page, 126)).toBeVisible()
  expect(state.snapshots[0]).not.toContain(126)
  expect(state.records.map(({ id }) => id)).toEqual([126])
  expect(state.deletes).toEqual(['/api/scan-history'])
  expect(state.unmatched).toEqual([])
})

test('partial deletion retains failed records and reports the failure without success', async ({ page }) => {
  const state = await mockHistory(page, 'partial')
  await openSettings(page)
  await confirmClear(page, true)
  await expect(count(page, 1)).toBeVisible()
  await expect(results(page, 1)).toBeVisible()
  await expect(findings(page, 1)).toBeVisible()
  const error = page.getByRole('alert')
  await expect(error).toContainText(/fail|could not/i)
  await expect(error).toContainText(/1/)
  await expect(error).toContainText('Sample result file could not be removed')
  await expect(page.getByText(/successfully.*(?:clear|delet)|all.*(?:cleared|deleted)/i)).toHaveCount(0)
  expect(state.records.map(({ id }) => id)).toEqual([1])
  expect(state.deletes).toEqual(['/api/scan-history'])
  expect(state.unmatched).toEqual([])
})

test('a failed deletion request reports an error and leaves history intact', async ({ page }) => {
  const state = await mockHistory(page, 'delete-error')
  await openSettings(page)
  await confirmClear(page, true)
  await expect(page.getByRole('alert')).toContainText(/unavailable|fail|could not/i)
  await expect(count(page, 125)).toBeVisible()
  await expect(results(page, 125)).toBeVisible()
  await expect(page.getByText(/successfully.*(?:clear|delet)|all.*(?:cleared|deleted)/i)).toHaveCount(0)
  expect(state.records).toHaveLength(125)
  expect(state.deletes).toEqual(['/api/scan-history'])
  expect(state.unmatched).toEqual([])
})

test('an unavailable history page is not represented as an empty history', async ({ page }) => {
  const state = await mockHistory(page, 'read-error')
  await page.goto(`${BASE_URL}/settings`)
  await expect(page.getByRole('alert')).toContainText(/history.*(?:unavailable|fail)|(?:unable|could not|failed).*history/i)
  await expect(count(page, 0)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clear all scan data' })).toBeDisabled()
  expect(state.records).toHaveLength(125)
  expect(state.deletes).toEqual([])
  expect(state.unmatched).toEqual([])
})
