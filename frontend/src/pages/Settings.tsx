import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { PRESETS } from '@/lib/scanForm'
import { useScanHistory } from '@/hooks/useScanHistory'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Theme = 'light' | 'dark' | 'system'

const THEMES: Theme[] = ['light', 'dark', 'system']

// Dark first, and a stored choice wins when it is one this app understands.
function storedTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem('theme') as Theme | null
  return stored && THEMES.includes(stored) ? stored : 'dark'
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function Settings() {
  // ---- Theme (dark-first) ------------------------------------------------
  const [theme, setTheme] = useState<Theme>(storedTheme)

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

  // ---- Scan history --------------------------------------------------------
  const { count, clearing, clearAll } = useScanHistory()

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
          {PRESETS.map((preset) => (
            <div
              key={preset.label}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {preset.description}
                </p>
              </div>
              <p className="shrink-0 font-mono text-xs text-muted-foreground">
                {preset.profile} · {preset.ecosystems.join(' + ')}
              </p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Presets are fixed. Choose one on the Scan page, where it fills the
          form.
        </p>
      </Section>

      {/* Data Management */}
      <Section title="Data management">
        <div className="space-y-4 rounded-lg border bg-card px-4 py-4">
          <p className="text-sm">
            Scan history: <span className="font-mono">{count}</span>{' '}
            {count === 1 ? 'scan' : 'scans'}
          </p>
          <Button
            variant="destructive"
            size="sm"
            disabled={clearing || count === 0}
            onClick={clearAll}
          >
            {clearing ? (
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
