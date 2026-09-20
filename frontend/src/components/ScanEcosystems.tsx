import { cn } from '@/lib/utils'
import { ALL_ECOSYSTEMS } from '@/lib/scanForm'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/CollapsibleSection'

interface ScanEcosystemsProps {
  ecosystems: string[]
  open: boolean
  onToggle: () => void
  onToggleEcosystem: (eco: string) => void
  onSelectAll: () => void
  onClear: () => void
}

// One checkbox per ecosystem the CLI can look for, with the selected count in
// the section header.
export function ScanEcosystems({
  ecosystems,
  open,
  onToggle,
  onToggleEcosystem,
  onSelectAll,
  onClear,
}: ScanEcosystemsProps) {
  return (
    <CollapsibleSection
      title="Ecosystems"
      count={`${ecosystems.length}/${ALL_ECOSYSTEMS.length}`}
      open={open}
      onToggle={onToggle}
    >
      <div className="mb-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
          Select all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ALL_ECOSYSTEMS.map((eco) => {
          const checked = ecosystems.includes(eco)
          return (
            <label
              key={eco}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 font-mono text-sm transition-colors',
                checked
                  ? 'border-primary/50 bg-primary/5 text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleEcosystem(eco)}
                className="accent-primary"
              />
              {eco}
            </label>
          )
        })}
      </div>
    </CollapsibleSection>
  )
}
