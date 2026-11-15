import { test, expect, type Page } from '@playwright/test'
import type { FindingRecord, PackageRecord, ScanRecord } from '../src/lib/api'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

const history: ScanRecord[] = Array.from({ length: 125 }, (_, index) => ({
  id: 125 - index,
  timestamp: '2026-01-01T12:00:00Z',
  profile: 'baseline',
  status: 'completed',
  summary: {
    total_packages: 1,
    ecosystems_found: 1,
    findings_count: 1,
    ecosystem_counts: { npm: 1 },
  },
}))
const recentScans = history.slice(0, 20)
const oldestScan = history[history.length - 1]

const oldestPackages: PackageRecord[] = [{
  package_name: 'sample-oldest-package',
  ecosystem: 'npm',
  version: '1.2.3',
  source_type: 'lockfile',
  source_file: '/sample/oldest/package-lock.json',
  project_path: '/sample/oldest',
  confidence: 'high',
}]

const oldestFindings: FindingRecord[] = [{
  package_name: 'sample-oldest-package',
  version: '1.2.3',
  ecosystem: 'npm',
  severity: 'high',
  catalog_id: 'SAMPLE-001',
  catalog_name: 'Sample catalogue',
  evidence: 'Distinctive evidence from the oldest scan.',
  source_file: '/sample/oldest/package-lock.json',
}]

async function mockHistory(page: Page) {
  const requests: { method: string; path: string }[] = []
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    requests.push({ method: request.method(), path })
    if (request.method() !== 'GET') {
      await route.abort()
      return
    }
    switch (path) {
      case '/api/scans':
        await route.fulfill({ json: recentScans })
        return
      case '/api/scans/1':
        await route.fulfill({ json: oldestScan })
        return
      case '/api/scans/1/packages':
        await route.fulfill({ json: oldestPackages })
        return
      case '/api/scans/1/findings':
        await route.fulfill({ json: oldestFindings })
        return
      case '/api/scans/999':
        await route.fulfill({ status: 404, json: { detail: 'Scan 999 not found' } })
        return
      default:
        await route.abort()
    }
  })
  return requests
}

// One read reports the scan as running, and that is the only read the app makes
// before the event stream answers: the backend commits the terminal row before
// it queues the completion event, so a refetch after that event cannot see a
// stale `running`. This case is pinned so a future reader does not re-add a
// retry loop for a race the API cannot produce.
test('an older running result reaches completion outside the recent list', async ({ page }) => {
  await mockHistory(page)
  let detailReads = 0
  await page.route('**/api/scans/1', (route) => {
    detailReads += 1
    return route.fulfill({ json: detailReads <= 1 ? { ...oldestScan, status: 'running', summary: null } : oldestScan })
  })
  await page.route('**/api/scans/1/events', (route) => route.fulfill({
    contentType: 'text/event-stream',
    body: 'event: completed\ndata: {"type":"completed"}\n\n',
  }))
  await page.goto(`${BASE_URL}/results/1`)
  await expect(page.getByRole('row').filter({ hasText: 'sample-oldest-package' })).toBeVisible()
})

// The findings view used to read a running scan and then stop: findings are only
// fetched for a completed scan, and nothing on that page waited for the terminal
// state, so a link shared while the scan was still working stayed empty until a
// manual reload. Both detail views now follow the same completion wait.
test('a running scan opened on the findings page reaches completion too', async ({ page }) => {
  await mockHistory(page)
  let detailReads = 0
  await page.route('**/api/scans/1', (route) => {
    detailReads += 1
    return route.fulfill({ json: detailReads <= 1 ? { ...oldestScan, status: 'running', summary: null } : oldestScan })
  })
  await page.route('**/api/scans/1/events', (route) => route.fulfill({
    contentType: 'text/event-stream',
    body: 'event: completed\ndata: {"type":"completed"}\n\n',
  }))
  await page.goto(`${BASE_URL}/findings/1`)
  // Findings render as cards, not table rows, so the assertion names the matched
  // package and the catalogue entry that produced it.
  await expect(page.getByText('sample-oldest-package@1.2.3')).toBeVisible()
  await expect(page.getByText('SAMPLE-001', { exact: false })).toBeVisible()
})

for (const view of ['results', 'findings'] as const) {
  test.describe(`Direct ${view} history links`, () => {
    test('loads the oldest scan outside the newest twenty records', async ({ page }) => {
      const requests = await mockHistory(page)
      await page.goto(`${BASE_URL}/${view}/1`)

      await expect.poll(() => requests).toContainEqual({ method: 'GET', path: '/api/scans/1' })
      const endpoint = view === 'results' ? 'packages' : 'findings'
      await expect.poll(() => requests).toContainEqual({
        method: 'GET', path: `/api/scans/1/${endpoint}`,
      })
      if (view === 'results') {
        const row = page.getByRole('row').filter({ hasText: 'sample-oldest-package' })
        await expect(row).toBeVisible()
        await expect(row.getByRole('cell', { name: '1.2.3', exact: true })).toBeVisible()
        await expect(row.getByRole('cell', { name: '/sample/oldest', exact: true })).toBeVisible()
      } else {
        await expect(page.getByText('sample-oldest-package@1.2.3', { exact: true })).toBeVisible()
        await expect(page.getByText(oldestFindings[0].evidence, { exact: true })).toBeVisible()
      }
      await expect(page).toHaveURL(`${BASE_URL}/${view}/1`)
    })

    test('shows an explicit not-found state for a missing scan', async ({ page }) => {
      const requests = await mockHistory(page)
      await page.goto(`${BASE_URL}/${view}/999`)

      await expect.poll(() => requests).toContainEqual({ method: 'GET', path: '/api/scans/999' })
      await expect(page.getByText(/scan.*not found/i)).toBeVisible()
      await expect(page.getByText('sample-oldest-package', { exact: true })).toHaveCount(0)
      await expect(page.getByText('sample-oldest-package@1.2.3', { exact: true })).toHaveCount(0)
      await expect(page).toHaveURL(`${BASE_URL}/${view}/999`)
      await page.getByRole('button', { name: 'Choose a recent scan' }).click()
      await expect(page).toHaveURL(`${BASE_URL}/${view}`)
    })

    test('rejects a malformed ID without interpreting its numeric prefix', async ({ page }) => {
      const requests = await mockHistory(page)
      await page.goto(`${BASE_URL}/${view}/1junk`)

      await expect(page.getByText(/invalid scan id/i)).toBeVisible()
      expect(requests.filter(({ path }) => /^\/api\/scans\/1(?:\/|$)/.test(path))).toEqual([])
      await expect(page.getByText('sample-oldest-package', { exact: true })).toHaveCount(0)
      await expect(page.getByText('sample-oldest-package@1.2.3', { exact: true })).toHaveCount(0)
      await expect(page).toHaveURL(`${BASE_URL}/${view}/1junk`)
    })
  })
}
