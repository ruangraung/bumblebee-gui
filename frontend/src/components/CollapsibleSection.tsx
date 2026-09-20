import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  count?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

// A titled section that folds away, with an optional count beside the title.
// The body is not rendered while closed, so a closed section costs nothing.
export function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent/50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1">{title}</span>
        {count !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">{count}</span>
        )}
      </button>
      {open && <div className="border-t border-border px-4 py-4">{children}</div>}
    </div>
  )
}
