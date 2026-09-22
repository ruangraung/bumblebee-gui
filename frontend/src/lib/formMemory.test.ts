import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readFormMemory, writeFormMemory } from '@/lib/formMemory'
import type { RememberedForm } from '@/lib/formMemory'

const baseline: RememberedForm = {
  form: {
    profile: 'baseline',
    ecosystems: ['npm', 'pypi'],
    roots: [],
    exposureCatalog: '',
    findingsOnly: false,
    maxDuration: '',
  },
  activePreset: 'Baseline',
}

// vitest runs these in node, so the store is stubbed: one key, kept the way a
// browser keeps it.
function stubStore(seed?: string) {
  const store = new Map<string, string>()
  if (seed !== undefined) store.set('bumblebee.scan-form', seed)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
  stubStore()
})

describe('form memory', () => {
  it('says nothing before a scan has run', () => {
    expect(readFormMemory()).toBeNull()
  })

  it('round-trips the form as it was left', () => {
    const remembered: RememberedForm = {
      form: {
        ...baseline.form,
        profile: 'deep',
        ecosystems: ['go', 'npm'],
        roots: ['/host'],
        maxDuration: '10m',
      },
      activePreset: null,
    }

    writeFormMemory(remembered)

    expect(readFormMemory()).toEqual(remembered)
  })

  it('refuses a payload that is not JSON', () => {
    stubStore('{not json')

    expect(readFormMemory()).toBeNull()
  })

  it('refuses an ecosystem this build does not know', () => {
    stubStore(JSON.stringify({ ...baseline.form, ecosystems: ['npm', 'whatever'] }))

    expect(readFormMemory()).toBeNull()
  })

  it('refuses a form with nothing selected to scan', () => {
    stubStore(JSON.stringify({ ...baseline.form, ecosystems: [] }))

    expect(readFormMemory()).toBeNull()
  })

  it('fills the optional fields a partial payload leaves out', () => {
    stubStore(JSON.stringify({ profile: 'project', ecosystems: ['go'], roots: ['/host'] }))

    expect(readFormMemory()).toEqual({
      form: {
        profile: 'project',
        ecosystems: ['go'],
        roots: ['/host'],
        exposureCatalog: '',
        findingsOnly: false,
        maxDuration: '',
      },
      activePreset: null,
    })
  })

  it('drops a preset label this build no longer has', () => {
    stubStore(JSON.stringify({ ...baseline.form, activePreset: 'Retired preset' }))

    expect(readFormMemory()?.activePreset).toBeNull()
  })

  it('trims and deduplicates the roots it restores', () => {
    stubStore(JSON.stringify({ ...baseline.form, roots: [' /host ', '/host', '/srv'] }))

    expect(readFormMemory()?.form.roots).toEqual(['/host', '/srv'])
  })

  it('keeps remembering nothing when the store is unavailable', () => {
    vi.unstubAllGlobals()

    expect(readFormMemory()).toBeNull()
    expect(() => writeFormMemory(baseline)).not.toThrow()
  })
})
