import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  nextThemeAfterToggle,
  readTheme,
  resolveTheme,
  writeTheme,
} from '@/lib/theme'
import type { ResolvedTheme, Theme } from '@/lib/theme'

// The single owner: reads storage once, writes only on a deliberate choice, and
// resolves system against the OS.

interface ThemeContextValue {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

// Dark-first while the OS preference is unavailable, matching the app default.
function prefersDarkNow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(DARK_QUERY).matches
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [prefersDark, setPrefersDark] = useState(prefersDarkNow)

  // Tracked for the session, so returning to system responds to the current OS.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved = resolveTheme(theme, prefersDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    writeTheme(next)
  }, [])

  const toggle = useCallback(() => {
    setTheme(nextThemeAfterToggle(resolved))
  }, [resolved, setTheme])

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
