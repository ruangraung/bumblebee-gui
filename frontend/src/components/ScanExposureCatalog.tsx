import { CollapsibleSection } from '@/components/CollapsibleSection'

interface ScanExposureCatalogProps {
  value: string
  open: boolean
  onToggle: () => void
  onChange: (value: string) => void
}

// An optional local catalog file, cross-referenced against the findings.
export function ScanExposureCatalog({
  value,
  open,
  onToggle,
  onChange,
}: ScanExposureCatalogProps) {
  return (
    <CollapsibleSection title="Exposure catalog" open={open} onToggle={onToggle}>
      <p className="mb-3 text-sm text-muted-foreground">
        Findings are matched against the catalogues bundled with the scanner. Set a path to use your
        own catalog file or directory instead.
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Optional: path to a catalog file or directory"
        className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </CollapsibleSection>
  )
}
