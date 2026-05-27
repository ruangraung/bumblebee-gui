import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor, Trash2, RefreshCw, Plus, Pencil, X, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Theme = 'light' | 'dark' | 'system'

interface ScanPreset {
  id: string
  label: string
  profile: string
  ecosystems: string
}

// ---------------------------------------------------------------------------
// Default data
// ---------------------------------------------------------------------------

const DEFAULT_PRESETS: ScanPreset[] = [
  { id: '1', label: 'Baseline', profile: 'baseline', ecosystems: 'all ecosystems' },
  { id: '2', label: 'Project', profile: 'project', ecosystems: 'all ecosystems' },
  { id: '3', label: 'npm audit', profile: 'baseline', ecosystems: 'ecosystem: npm' },
]

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function Settings() {
  // ---- Theme ---------------------------------------------------------------
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored && ['light', 'dark', 'system'].includes(stored)) return stored
    return 'system'
  })

  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    function applyTheme() {
      const effectiveDark = theme === 'dark' || (theme === 'system' && mq.matches)
      root.classList.toggle('dark', effectiveDark)
    }

    applyTheme()
    localStorage.setItem('theme', theme)

    mq.addEventListener('change', applyTheme)
    return () => mq.removeEventListener('change', applyTheme)
  }, [theme])

  // ---- Presets -------------------------------------------------------------
  const [presets, setPresets] = useState<ScanPreset[]>(DEFAULT_PRESETS)

  function removePreset(id: string) {
    setPresets((prev) => prev.filter((p) => p.id !== id))
  }

  // ---- Default Paths -------------------------------------------------------
  const [projectRoot, setProjectRoot] = useState('~/code')

  // ---- Data Management ----------------------------------------------------
  const [keepLast, setKeepLast] = useState('10')
  const [clearingData, setClearingData] = useState(false)

  function handleClearAllData() {
    setClearingData(true)
    // Placeholder: in a real app this would call an API / clear IndexedDB
    setTimeout(() => setClearingData(false), 1000)
  }

  // ---- Render --------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* ---- Appearance ---------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Appearance
        </h2>
        <div className="flex gap-2">
          <ThemeButton
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            icon={<Sun className="h-4 w-4" />}
            label="Light"
          />
          <ThemeButton
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            icon={<Moon className="h-4 w-4" />}
            label="Dark"
          />
          <ThemeButton
            active={theme === 'system'}
            onClick={() => setTheme('system')}
            icon={<Monitor className="h-4 w-4" />}
            label="System"
          />
        </div>
      </section>

      {/* ---- Scan Presets -------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Scan Presets
        </h2>
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="text-xs text-muted-foreground">
                  profile: {preset.profile}, {preset.ecosystems}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Edit ${preset.label}`}
                  onClick={() => {/* placeholder */}}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label={`Delete ${preset.label}`}
                  onClick={() => removePreset(preset.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => {/* placeholder */}}>
          <Plus className="h-4 w-4 mr-1" />
          Add preset
        </Button>
      </section>

      {/* ---- Default Paths ------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Default Paths
        </h2>
        <div className="flex items-center gap-3">
          <label htmlFor="project-root" className="text-sm font-medium shrink-0">
            Project root:
          </label>
          <input
            id="project-root"
            type="text"
            value={projectRoot}
            onChange={(e) => setProjectRoot(e.target.value)}
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="outline" size="sm">
            <FolderOpen className="h-4 w-4 mr-1" />
            Browse
          </Button>
        </div>
      </section>

      {/* ---- Data Management ----------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Data Management
        </h2>
        <div className="rounded-lg border bg-card px-4 py-3 space-y-4">
          <p className="text-sm">
            Scan history: <span className="font-medium">12 scans</span> (47 MB)
          </p>
          <div className="flex items-center gap-3">
            <label htmlFor="keep-last" className="text-sm">
              Keep last:
            </label>
            <select
              id="keep-last"
              value={keepLast}
              onChange={(e) => setKeepLast(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span className="text-sm text-muted-foreground">scans</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={clearingData}
            onClick={handleClearAllData}
          >
            {clearingData ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Clearing…
              </span>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear all scan data
              </>
            )}
          </Button>
        </div>
      </section>

      {/* ---- Updates ------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Updates
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
            <p className="text-sm">
              Bumblebee GUI <span className="font-medium">v0.1.0</span>
            </p>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Check GitHub
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
            <p className="text-sm">
              Bumblebee CLI <span className="font-medium">v0.1.1</span>
            </p>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Check GitHub
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ThemeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors border',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
