import { AlertTriangle } from 'lucide-react'
import type { ScanRecord } from '@/lib/api'

import { CatalogueLine } from '@/components/CatalogueLine'
import { partialNote } from '@/lib/scans'

// How many of the loaded findings match the current filters. The caller decides
// whether the banner is shown, because that also depends on loading state. A
// scan that stopped at its time limit says so here as well: the count is real,
// the coverage behind it is not complete.
export function FindingsSummary({ count, scan }: { count: number; scan: ScanRecord | null }) {
  const note = partialNote(scan)

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="space-y-1">
        <p className="text-sm">
          <span className="font-mono font-medium">{count}</span>{' '}
          {count === 1 ? 'package matches' : 'packages match'} your exposure catalog
        </p>
        {note && <p className="text-sm text-amber-600 dark:text-amber-400">{note}</p>}
        <CatalogueLine />
      </div>
    </div>
  )
}
