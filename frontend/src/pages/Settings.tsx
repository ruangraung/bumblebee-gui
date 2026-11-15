import type { ReactNode } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useTheme } from '@/components/ThemeProvider'
import { AboutPanel } from '@/components/AboutPanel'
import { ScanHistoryPanel } from '@/components/ScanHistoryPanel'
import { PRESETS } from '@/lib/scanForm'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function Settings() {
  // ---- Theme (dark-first) ------------------------------------------------
  // Owned by the theme provider; a second writer here destroyed a saved choice.
  const { theme, setTheme } = useTheme()

  // ---- Render --------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Settings"
        description="Appearance, scan presets, data management, and what this install is running."
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
        <ScanHistoryPanel />
      </Section>

      {/* About */}
      <Section title="About">
        <AboutPanel />
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: ReactNode }) {
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
  icon: ReactNode
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
