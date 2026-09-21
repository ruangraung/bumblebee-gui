import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const API_URL = process.env.API_URL || 'http://localhost:8001'

// ============================================
// API Tests
// ============================================

test.describe('API Health', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`)
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.status).toBe('ok')
  })

  test('scans endpoint returns array', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/scans`)
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(Array.isArray(data)).toBeTruthy()
  })
})

// ============================================
// Route contract
// ============================================

// Each route renders its own page, and none of them logs an error on the way
// in. The error assertion is the point: a page whose data fetch fails still
// answers 200 and still renders a heading, so a title check on its own stays
// green while the page is unusable. Locators are role based, because bare text
// and tag locators match several nodes on these pages and turn into strict mode
// violations rather than useful failures.
const ROUTES: { path: string; heading: string }[] = [
  { path: '/', heading: 'Dashboard' },
  { path: '/scan', heading: 'New scan' },
  { path: '/results', heading: 'Results' },
  { path: '/findings', heading: 'Findings' },
  { path: '/settings', heading: 'Settings' },
]

// The heading renders before the route's own fetches resolve, so allow them a
// moment to fail loudly instead of asserting on a half loaded page.
const SETTLE_MS = 700

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

test.describe('Route contract', () => {
  for (const route of ROUTES) {
    test(`${route.path} renders ${route.heading} without console errors`, async ({ page }) => {
      const errors = collectErrors(page)

      await page.goto(`${BASE_URL}${route.path}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.heading)

      if (route.path === '/scan') {
        await expect(page.getByRole('button', { name: /start scan/i })).toBeVisible()
      }

      await page.waitForTimeout(SETTLE_MS)

      expect(errors).toEqual([])
    })
  }
})

// ============================================
// Screenshots
// ============================================

test.describe('Screenshots', () => {
  test('dashboard screenshot', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/screenshots/dashboard.png', fullPage: true })
  })

  test('scan page screenshot', async ({ page }) => {
    await page.goto(`${BASE_URL}/scan`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/screenshots/scan.png', fullPage: true })
  })
})
