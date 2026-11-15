import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

// Two surfaces used to read and write the same key with different vocabularies,
// so a system choice from Settings became dark on the next load. The unit tests
// cover the resolution table; these run the real bundle and the real storage.

async function startEmpty(page: Page) {
  await page.goto(`${BASE_URL}/`)
  await page.evaluate(() => localStorage.clear())
}

async function storedTheme(page: Page) {
  return page.evaluate(() => localStorage.getItem('theme'))
}

function headerToggle(page: Page) {
  return page.getByRole('button', { name: /Switch to (light|dark) mode/ })
}

async function pickTheme(page: Page, label: 'Dark' | 'Light' | 'System') {
  await page.goto(`${BASE_URL}/settings`)
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.describe('a saved theme choice survives a reload', () => {
  test.use({ colorScheme: 'light' })

  test('system stays system, follows the OS, and only a click overrides it', async ({ page }) => {
    await startEmpty(page)
    await pickTheme(page, 'System')

    expect(await storedTheme(page)).toBe('system')
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    await expect(headerToggle(page)).toHaveAttribute('aria-label', 'Switch to dark mode')

    await page.reload()

    // The defect: this read came back as "dark" after one page load.
    expect(await storedTheme(page)).toBe('system')
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    await expect(headerToggle(page)).toHaveAttribute('aria-label', 'Switch to dark mode')

    // A system choice must still follow the OS after the choice was stored.
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    expect(await storedTheme(page)).toBe('system')

    // A click is an explicit choice, so it pins the opposite of what is shown.
    await headerToggle(page).click()
    expect(await storedTheme(page)).toBe('light')
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  })

  test('an explicit light choice survives a reload', async ({ page }) => {
    await startEmpty(page)
    await pickTheme(page, 'Light')

    expect(await storedTheme(page)).toBe('light')
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)

    await page.reload()

    expect(await storedTheme(page)).toBe('light')
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  })

  test('an explicit dark choice survives a reload', async ({ page }) => {
    await startEmpty(page)
    await pickTheme(page, 'Dark')

    expect(await storedTheme(page)).toBe('dark')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)

    await page.reload()

    expect(await storedTheme(page)).toBe('dark')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })
})

test.describe('system follows a dark OS', () => {
  test.use({ colorScheme: 'dark' })

  test('resolves dark on the first load without touching storage', async ({ page }) => {
    await startEmpty(page)
    await pickTheme(page, 'System')

    expect(await storedTheme(page)).toBe('system')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)

    await page.reload()

    expect(await storedTheme(page)).toBe('system')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })
})
