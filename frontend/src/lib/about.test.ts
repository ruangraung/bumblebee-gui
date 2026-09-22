import { describe, expect, it } from 'vitest'

import { mountLine, scannerLine } from '@/lib/about'

describe('scannerLine', () => {
  it('says it is still reading before the API answers', () => {
    expect(scannerLine(null)).toBe('reading it')
  })

  it('states the version with the short commit', () => {
    expect(scannerLine({ version: 'v0.1.2', commit: 'cc57710', error: null })).toBe(
      'v0.1.2 (cc57710)',
    )
  })

  it('states the version alone when there is no commit', () => {
    expect(scannerLine({ version: 'v0.1.2', commit: null, error: null })).toBe('v0.1.2')
  })

  it('repeats why the binary did not report, rather than inventing a version', () => {
    const info = {
      version: null,
      commit: null,
      error: 'No scanner binary at /usr/local/bin/bumblebee.',
    }

    expect(scannerLine(info)).toBe('No scanner binary at /usr/local/bin/bumblebee.')
  })

  it('says not reported when there is neither a version nor a reason', () => {
    expect(scannerLine({ version: null, commit: null, error: null })).toBe('not reported')
  })
})

describe('mountLine', () => {
  it('names the path and how many directories are in it', () => {
    const report = { mounted: true, path: '/host', directories: ['/host/a', '/host/b'] }

    expect(mountLine(report)).toBe('/host, 2 directories')
  })

  it('counts a single directory in the singular', () => {
    expect(mountLine({ mounted: true, path: '/host', directories: ['/host/a'] })).toBe(
      '/host, 1 directory',
    )
  })

  it('says nothing is mounted', () => {
    expect(mountLine({ mounted: false, path: '/host', directories: [] })).toBe('nothing mounted')
  })

  it('says it is still reading before the API answers', () => {
    expect(mountLine(null)).toBe('reading it')
  })
})
