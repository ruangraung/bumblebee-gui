import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ScanRecord } from '@/lib/api'
import { comparedLine } from '@/lib/scans'
import { scanVerdict } from '@/lib/verdict'
import { cn } from '@/lib/utils'

// The scan's conclusion, above the table. A package list leaves the reader to
// work out whether anything matched, and on a table of several hundred rows the
// answer is not something you can see. The data file comes with it, because the
// table is a view of the scan and the file is the scan itself.
export function ScanVerdict({ scan }: { scan: ScanRecord | null }) {
  const verdict = scanVerdict(scan)
  if (!verdict || !scan) return null

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        verdict.clean ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <div className="flex items-center gap-3">
        {verdict.clean ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        )}
        <p className="text-sm">
          {verdict.clean ? (
            <span className="font-medium">{verdict.label}</span>
          ) : (
            <Link
              to={`/findings/${scan.id}`}
              className="font-medium underline underline-offset-4 hover:text-foreground"
            >
              {verdict.label}
            </Link>
          )}
          <span className="text-muted-foreground"> · {comparedLine(scan)}</span>
        </p>
      </div>

      {scan.ndjson_path && (
        <p className="truncate font-mono text-xs text-muted-foreground" title={scan.ndjson_path}>
          Scan data: {scan.ndjson_path}
        </p>
      )}
    </div>
  )
}
