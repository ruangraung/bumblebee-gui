import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ScanRecord } from '@/lib/api'
import { comparedLine } from '@/lib/scans'
import { scanVerdict, type ScanVerdict as Verdict } from '@/lib/verdict'
import { cn } from '@/lib/utils'
import { CatalogueLine } from '@/components/CatalogueLine'

// How the strip reads. A failed scan is the case that has no count and no
// catalogue line to show: nothing was compared, so the reason it carries is the
// whole message.
const LOOKS = {
  clean: {
    box: 'border-emerald-500/30 bg-emerald-500/5',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    note: '',
  },
  attention: {
    box: 'border-amber-500/30 bg-amber-500/5',
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    note: 'text-amber-600 dark:text-amber-400',
  },
  failed: {
    box: 'border-red-500/30 bg-red-500/5',
    icon: AlertTriangle,
    iconClass: 'text-red-600 dark:text-red-400',
    note: 'font-mono text-xs text-red-600 dark:text-red-400',
  },
} as const

// The scan's conclusion, above the table. A package list leaves the reader to
// work out whether anything matched, and on a table of several hundred rows the
// answer is not something you can see. The data file comes with it, because the
// table is a view of the scan and the file is the scan itself.
export function ScanVerdict({ scan }: { scan: ScanRecord | null }) {
  const verdict = scanVerdict(scan)
  if (!verdict || !scan) return null

  const look = LOOKS[verdict.failed ? 'failed' : verdict.clean ? 'clean' : 'attention']
  const Icon = look.icon

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        look.box,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', look.iconClass)} />
        <div className="space-y-1">
          <p className="text-sm">
            <VerdictLabel verdict={verdict} scan={scan} />
          </p>
          {verdict.note && <p className={cn('text-sm', look.note)}>{verdict.note}</p>}
          {verdict.failed ? null : <CatalogueLine />}
        </div>
      </div>

      <ScanDataPath path={scan.ndjson_path} />
    </div>
  )
}

// The label, and what was examined, when there is a count to give. A failed
// scan ran no comparison, so it shows neither.
function VerdictLabel({ verdict, scan }: { verdict: Verdict; scan: ScanRecord }) {
  if (verdict.clean || verdict.failed) {
    return <span className="font-medium">{verdict.label}</span>
  }
  return (
    <>
      <Link
        to={`/findings/${scan.id}`}
        className="font-medium underline underline-offset-4 hover:text-foreground"
      >
        {verdict.label}
      </Link>
      <span className="text-muted-foreground"> · {comparedLine(scan)}</span>
    </>
  )
}

function ScanDataPath({ path }: { path?: string }) {
  if (!path) return null
  return (
    <p className="truncate font-mono text-xs text-muted-foreground" title={path}>
      Scan data: {path}
    </p>
  )
}
