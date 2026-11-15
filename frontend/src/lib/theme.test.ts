import { describe, expect, it } from 'vitest'
import {
  parseTheme,
  readTheme,
  resolveTheme,
  nextThemeAfterToggle,
  writeTheme,
} from '@/lib/theme'

// Stands in for window.localStorage, and records every write so a test can
// prove that reading the choice does not rewrite it.
function fakeStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set('theme', initial)
  const writes: string[] = []
  return {
    writes,
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null
    },
    setItem(key: string, value: string) {
      writes.push(`${key}=${value}`)
      map.set(key, value)
    },
  }
}

describe('parseTheme', () => {
  it('accepts the three values the app offers', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('system')).toBe('system')
  })

  it('falls back to dark for nothing stored, an empty value, or an unknown one', () => {
    // Dark-first is the app's stated default, so anything unrecognised has to
    // resolve to something the stylesheets actually define.
    expect(parseTheme(null)).toBe('dark')
    expect(parseTheme('')).toBe('dark')
    expect(parseTheme('sepia')).toBe('dark')
  })
})

describe('resolveTheme', () => {
  it('keeps an explicit choice regardless of the OS preference', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('follows the OS preference only for system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('nextThemeAfterToggle', () => {
  it('pins the opposite explicit value, never system', () => {
    // The header control is a two-state button. Clicking it is a deliberate
    // choice, so it must leave a value both surfaces can read back.
    expect(nextThemeAfterToggle('dark')).toBe('light')
    expect(nextThemeAfterToggle('light')).toBe('dark')
  })
})

describe('readTheme and writeTheme', () => {
  it('defaults to dark when nothing is stored', () => {
    expect(readTheme(fakeStorage())).toBe('dark')
  })

  it('does not throw without a browser storage', () => {
    expect(readTheme()).toBe('dark')
  })

  it('keeps system as a real stored state', () => {
    // system used to be read as dark and written back as dark on the next load.
    const storage = fakeStorage('system')
    expect(readTheme(storage)).toBe('system')

    writeTheme('system', storage)
    expect(readTheme(storage)).toBe('system')
  })

  it('reads a stored choice without writing to it', () => {
    // A rewrite on mount destroyed a saved system choice before any click.
    const storage = fakeStorage('system')
    readTheme(storage)
    expect(storage.writes).toEqual([])
  })

  it('writes the exact value it was given', () => {
    const storage = fakeStorage()
    writeTheme('light', storage)
    expect(storage.writes).toEqual(['theme=light'])
  })

  it('ignores a stored value this build does not offer', () => {
    expect(readTheme(fakeStorage('high-contrast'))).toBe('dark')
  })
})
