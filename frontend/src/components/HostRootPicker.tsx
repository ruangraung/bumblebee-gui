import { Button } from '@/components/ui/button'
import { useHostBrowser } from '@/hooks/useHostBrowser'
import { directoryName } from '@/lib/hostMount'

interface HostRootPickerProps {
  roots: string[]
  onAddPath: (root: string) => void
}

// Pick a root from what is mounted, instead of typing a path that has to be
// right about a filesystem the user cannot see. A directory name opens it; the
// button beside it adds it as a root.
export function HostRootPicker({ roots, onAddPath }: HostRootPickerProps) {
  const { report, failed, at } = useHostBrowser()

  if (failed) {
    return (
      <p className="mb-3 text-sm text-muted-foreground">
        Could not read the mounted directories.
      </p>
    )
  }
  if (!report?.mounted) return null

  return (
    <div className="mb-3 rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 break-all text-sm text-muted-foreground">
          Browse <code className="font-mono">{report.path}</code>
        </span>
        {report.parent && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => at(report.parent)}
          >
            Up
          </Button>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="mb-2 min-h-11 whitespace-normal"
        disabled={roots.includes(report.path)}
        onClick={() => onAddPath(report.path)}
      >
        Use this directory as root
      </Button>

      {report.directories.length === 0 && (
        <p className="text-sm text-muted-foreground">No subdirectories.</p>
      )}

      <div className="space-y-1">
        {report.directories.map((directory) => {
          const added = roots.includes(directory)
          return (
            <div
              key={directory}
              className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-1.5"
            >
              <button
                type="button"
                onClick={() => at(directory)}
                title={directory}
                className="truncate font-mono text-sm hover:underline"
              >
                {directoryName(directory)}
              </button>
              <Button
                type="button"
                variant={added ? 'ghost' : 'outline'}
                size="sm"
                disabled={added}
                onClick={() => onAddPath(directory)}
              >
                {added ? 'Added' : 'Use as root'}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
