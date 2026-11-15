// One owner for the theme choice: two surfaces used to read and write the same
// storage key with different vocabularies, so a system choice became dark on reload.

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEMES: readonly Theme[] = ['light', 'dark', 'system']

export const THEME_STORAGE_KEY = 'theme'

// Dark-first fallback, so an unknown value lands on a theme the stylesheets define.
const FALLBACK: Theme = 'dark'

// The slice of Storage this module needs, which keeps it testable without a DOM.
export interface ThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export function parseTheme(raw: string | null): Theme {
  return isTheme(raw) ? raw : FALLBACK
}

// Resolved on read, so the OS preference is never frozen into storage as a choice.
export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

// The header button stays two-state: a click pins the opposite of what is shown.
export function nextThemeAfterToggle(resolved: ResolvedTheme): Theme {
  return resolved === 'dark' ? 'light' : 'dark'
}

function browserStorage(): ThemeStorage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

// A read must not write: rewriting on mount is what destroyed a saved choice.
export function readTheme(store: ThemeStorage | null = browserStorage()): Theme {
  if (!store) return FALLBACK
  try {
    return parseTheme(store.getItem(THEME_STORAGE_KEY))
  } catch {
    return FALLBACK
  }
}

export function writeTheme(theme: Theme, store: ThemeStorage | null = browserStorage()): void {
  if (!store) return
  try {
    store.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Blocked storage must not break the page; the choice still applies to this session.
  }
}
