import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor, Trash2, RefreshCw, Plus, X, FolderOpen, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
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
  { id: '1', label: 'Baseline', profile: 'baseline', ecosystems: 'npm + pypi' },
  { id: '2', label: 'Project', profile: 'project', ecosystems: 'npm + pypi + go + rubygems' },
  { id: '3', label: 'npm audit', profile: 'baseline', ecosystems: 'npm' },
]

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function Settings() {
  // ---- Theme (dark-first) ------------------------------------------------
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored && ['light', 'dark', 'system'].includes(stored)) return stored
    return 'dark'
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

  // ---- Data Management -----------------------------------------------------
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
      <PageHeader
        title="Settings"
        description="Appearance, scan presets, and data management."
      />

      {/* Appearance */}
      <Section title="Appearance">
        <div className="flex gap-2">
          <ThemeButton
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            icon={<Moon className="h-4 w-4" />}
            label="Dark"
          />
          <ThemeButton
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            icon={<Sun className="h-4 w-4" />}
            label="Light"
          />
          <ThemeButton
            active={theme === 'system'}
            onClick={() => setTheme('system')}
            icon={<Monitor className="h-4 w-4" />}
            label="System"
          />
        </div>
      </Section>

      {/* Scan Presets */}
      <Section title="Scan presets">
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {preset.profile} · {preset.ecosystems}
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
          <Plus className="mr-1 h-4 w-4" />
          Add preset
        </Button>
      </Section>

      {/* Default Paths */}
      <Section title="Default paths">
        <div className="flex items-center gap-3">
          <label htmlFor="project-root" className="shrink-0 text-sm font-medium">
            Project root
          </label>
          <input
            id="project-root"
            type="text"
            value={projectRoot}
            onChange={(e) => setProjectRoot(e.target.value)}
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="outline" size="sm">
            <FolderOpen className="mr-1 h-4 w-4" />
            Browse
          </Button>
        </div>
      </Section>

      {/* Data Management */}
      <Section title="Data management">
        <div className="space-y-4 rounded-lg border bg-card px-4 py-4">
          <p className="text-sm">
            Scan history: <span className="font-mono">12 scans</span>{' '}
            <span className="text-muted-foreground">(47 MB)</span>
          </p>
          <div className="flex items-center gap-3">
            <label htmlFor="keep-last" className="text-sm">
              Keep last
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
                <Trash2 className="mr-1 h-4 w-4" />
                Clear all scan data
              </>
            )}
          </Button>
        </div>
      </Section>

      {/* Updates */}
      <Section title="Updates">
        <div className="space-y-2">
          <UpdateRow name="Bumblebee GUI" version="v0.1.0" />
          <UpdateRow name="Bumblebee CLI" version="v0.1.1" />
        </div>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="overline">{title}</h2>
      {children}
    </section>
  )
}

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
        'inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-primary/60 bg-primary/10 text-primary'
          : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function UpdateRow({ name, version }: { name: string; version: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <p className="text-sm">
        {name} <span className="font-mono text-xs text-muted-foreground">{version}</span>
      </p>
      <Button variant="outline" size="sm">
        <RefreshCw className="mr-1 h-4 w-4" />
        Check
      </Button>
    </div>
  )
}
