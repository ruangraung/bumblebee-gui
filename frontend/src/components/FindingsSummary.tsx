import { AlertTriangle } from 'lucide-react'

// How many of the loaded findings match the current filters. The caller decides
// whether the banner is shown, because that also depends on loading state.
export function FindingsSummary({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
      <p className="text-sm">
        <span className="font-mono font-medium">{count}</span>{' '}
        {count === 1 ? 'package' : 'packages'} match your exposure catalog
      </p>
    </div>
  )
}
