import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

interface MountReport {
  mounted: boolean
  path: string
  parent: string | null
  directories: string[]
}

const mount: MountReport = {
  mounted: true,
  path: '/host',
  parent: null,
  directories: ['/host/api'],
}

const leaf: MountReport = {
  mounted: true,
  path: '/host/api',
  parent: '/host',
  directories: [],
}

async function openRoots(page: Page, rootReport: MountReport = mount) {
  const requestedPaths: string[] = []
  // Keep these tests independent of the real host mount and scan backend.
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname !== '/api/host-directories') {
      await route.abort()
      return
    }
    const path = url.searchParams.get('path') || '/host'
    requestedPaths.push(path)
    if (path !== '/host' && path !== '/host/api') {
      await route.fulfill({ status: 400, json: { detail: 'Unexpected directory' } })
      return
    }
    await route.fulfill({ json: path === '/host/api' ? leaf : rootReport })
  })

  await page.goto(`${BASE_URL}/scan`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New scan')
  await page.getByRole('button', { name: /^Root directories/ }).click()
  return requestedPaths
}

async function enterLeaf(page: Page) {
  await openRoots(page)
  await page.getByRole('button', { name: 'api', exact: true }).click()
  await expect(page.getByText('Browse /host/api', { exact: true })).toBeVisible()
}

test.describe('Host root picker file-only directories', () => {
  test('mounted leaf keeps the browse path and Up control', async ({ page }) => {
    await enterLeaf(page)

    await expect(page.getByText('Browse /host/api', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Up', exact: true })).toBeVisible()
    await expect(page.getByText('No subdirectories.', { exact: true })).toBeVisible()
  })

  test('current directory can be added once as a root', async ({ page }) => {
    await enterLeaf(page)

    const addCurrent = page.getByRole('button', {
      name: 'Use this directory as root', exact: true,
    })
    await expect(addCurrent).toBeEnabled()
    await addCurrent.click()

    await expect(page.getByRole('button', { name: 'Remove /host/api', exact: true })).toHaveCount(1)
    await expect(addCurrent).toBeDisabled()
  })

  test('Up navigates from the file-only leaf back to the mount', async ({ page }) => {
    const requestedPaths = await openRoots(page)
    await page.getByRole('button', { name: 'api', exact: true }).click()
    await expect(page.getByText('Browse /host/api', { exact: true })).toBeVisible()
    const beforeUp = requestedPaths.length

    await page.getByRole('button', { name: 'Up', exact: true }).click()

    await expect(page.getByText('Browse /host', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'api', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Up', exact: true })).toHaveCount(0)
    await expect(page.getByText('No subdirectories.', { exact: true })).toHaveCount(0)
    expect(requestedPaths.slice(beforeUp)).toEqual(['/host'])
  })

  test('file-only mount root remains selectable without Up', async ({ page }) => {
    await openRoots(page, { ...mount, directories: [] })

    await expect(page.getByText('Browse /host', { exact: true })).toBeVisible()
    await expect(page.getByText('No subdirectories.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Up', exact: true })).toHaveCount(0)
    const addCurrent = page.getByRole('button', {
      name: 'Use this directory as root', exact: true,
    })
    await expect(addCurrent).toBeEnabled()
    await addCurrent.click()
    await expect(page.getByRole('button', { name: 'Remove /host', exact: true })).toHaveCount(1)
    await expect(addCurrent).toBeDisabled()
  })

  test('unmounted response does not expose the picker', async ({ page }) => {
    await openRoots(page, { ...mount, mounted: false, directories: [] })

    await expect(page.getByText(/^No host directory is mounted/)).toBeVisible()
    await expect(page.getByText(/^Browse /)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Up', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', {
      name: 'Use this directory as root', exact: true,
    })).toHaveCount(0)
    await expect(page.getByText('No subdirectories.', { exact: true })).toHaveCount(0)
  })
})
