import { test, expect } from '@playwright/test'

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
// UI Smoke Tests
// ============================================

test.describe('UI Smoke Tests', () => {
  test('dashboard loads', async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page.locator('h2')).toContainText('Dashboard')
  })

  test('scan page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/scan`)
    await expect(page.locator('text=Baseline')).toBeVisible()
  })

  test('results page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/results`)
    // Should show either results table or empty state
    await expect(page.locator('h2')).toBeVisible()
  })

  test('findings page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/findings`)
    await expect(page.locator('h2')).toBeVisible()
  })

  test('settings page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await expect(page.locator('h2')).toBeVisible()
  })
})

// ============================================
// Screenshot Tests
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
