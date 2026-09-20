import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/CollapsibleSection'

interface ScanRootDirectoriesProps {
  roots: string[]
  newRoot: string
  showHomeRootWarning: boolean
  open: boolean
  onToggle: () => void
  onNewRootChange: (value: string) => void
  onAdd: () => void
  onRemove: (root: string) => void
}

// Where the scan looks. An empty list means the CLI's own default paths, and a
// `~` root outside the deep profile gets a warning because the result set can
// get very large.
export function ScanRootDirectories({
  roots,
  newRoot,
  showHomeRootWarning,
  open,
  onToggle,
  onNewRootChange,
  onAdd,
  onRemove,
}: ScanRootDirectoriesProps) {
  return (
    <CollapsibleSection
      title="Root directories"
      count={`${roots.length}`}
      open={open}
      onToggle={onToggle}
    >
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={newRoot}
          onChange={(e) => onNewRootChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          placeholder="e.g. ./src or ~/projects"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={!newRoot.trim()}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      {showHomeRootWarning && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          Using <code className="font-mono">~</code> as a root without the{' '}
          <strong>deep</strong> profile may produce excessive results. Consider
          narrowing the path.
        </div>
      )}

      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No roots configured. Scanning from the default paths.
        </p>
      ) : (
        <div className="space-y-2">
          {roots.map((root) => (
            <div
              key={root}
              className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2"
            >
              <code className="font-mono text-sm">{root}</code>
              <button
                type="button"
                onClick={() => onRemove(root)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label={`Remove ${root}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
