import { cn } from '@/lib/utils'
import { PRESETS } from '@/lib/scanForm'
import type { Preset } from '@/lib/scanForm'

interface ScanPresetsProps {
  activePreset: string | null
  onApply: (preset: Preset) => void
}

// The four starting points. The selected card stays highlighted until the user
// edits the form by hand, which is what clears the selection.
export function ScanPresets({ activePreset, onApply }: ScanPresetsProps) {
  return (
    <section className="space-y-3">
      <h2 className="overline">Quick presets</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRESETS.map((preset) => {
          const active = activePreset === preset.label
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onApply(preset)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left transition-colors',
                active
                  ? 'border-primary/60 bg-primary/5'
                  : 'hover:border-muted-foreground/40 hover:bg-accent/50',
              )}
            >
              <span className="text-sm font-medium">{preset.label}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                {preset.description}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
