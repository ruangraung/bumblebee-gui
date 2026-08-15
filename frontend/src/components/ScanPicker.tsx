import { useNavigate } from 'react-router-dom'
import type { ScanRecord } from '@/lib/api'
import { Badge, statusVariant } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Horizontal strip of recent scans for switching context on Results/Findings
// without back-navigation. Shows the 10 most recent; the Dashboard table is
// the full list.
const MAX_VISIBLE = 10

export default function ScanPicker({
  scans,
  activeId,
  basePath,
}: {
  scans: ScanRecord[]
  activeId?: number
  basePath: '/results' | '/findings'
}) {
  const navigate = useNavigate()

  if (scans.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {scans.slice(0, MAX_VISIBLE).map((scan) => {
        const active = scan.id === activeId
        return (
          <button
            key={scan.id}
            type="button"
            onClick={() => navigate(`${basePath}/${scan.id}`)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left transition-colors',
              active
                ? 'border-primary/60 bg-primary/5'
                : 'hover:border-muted-foreground/40 hover:bg-accent/50',
            )}
            aria-pressed={active}
          >
            <span className="font-mono text-xs text-muted-foreground">
              #{scan.id}
            </span>
            <span className="font-mono text-xs">{scan.profile}</span>
            <Badge variant={statusVariant(scan.status)}>{scan.status}</Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date(scan.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </button>
        )
      })}
    </div>
  )
}
