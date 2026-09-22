import { AlertTriangle, CheckCircle2, Clock, Scan, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ScanRecord } from '@/lib/api'
import ScanPicker from '@/components/ScanPicker'
import { FindingsHeader } from '@/components/FindingsHeader'
import { FINDINGS_EMPTY_MESSAGES, type FindingsEmptyKind } from '@/lib/findings'
import { comparedLine, failureReason } from '@/lib/scans'
import { cn } from '@/lib/utils'

type ShownKind = Exclude<FindingsEmptyKind, 'none'>

// One icon and one tone per case. A scan that ran and matched nothing is the
// page working, so it gets a check. A scan that failed, or that never ran, gets
// neither the check nor the tone. A scan that stopped at its time limit gets the
// amber tone, because its result is not a conclusion either way.
const CASES: Record<ShownKind, { icon: LucideIcon; tone: string }> = {
  'no-findings': {
    icon: CheckCircle2,
    tone: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  partial: {
    icon: Timer,
    tone: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  running: {
    icon: Clock,
    tone: 'border-border bg-muted text-muted-foreground',
  },
  failed: {
    icon: AlertTriangle,
    tone: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400',
  },
  'no-scans': {
    icon: Scan,
    tone: 'border-border bg-muted text-muted-foreground',
  },
}

interface FindingsEmptyViewProps {
  kind: ShownKind
  scans: ScanRecord[]
  activeScan: ScanRecord | null
}

export function FindingsEmptyView({ kind, scans, activeScan }: FindingsEmptyViewProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FindingsHeader />
      {kind === 'no-findings' && (
        <ScanPicker scans={scans} activeId={activeScan?.id} basePath="/findings" />
      )}
      <EmptyState kind={kind} scan={activeScan} />
    </div>
  )
}

function EmptyState({ kind, scan }: { kind: ShownKind; scan: ScanRecord | null }) {
  const { icon: Icon, tone } = CASES[kind]
  const reason = failureReason(scan)

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg border', tone)}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{FINDINGS_EMPTY_MESSAGES[kind]}</p>
      {(kind === 'no-findings' || kind === 'partial') && (
        <p className="mt-1 text-sm text-muted-foreground">{comparedLine(scan)}</p>
      )}
      {kind === 'failed' && reason && (
        <p className="mt-1 max-w-xl font-mono text-xs text-muted-foreground">{reason}</p>
      )}
    </div>
  )
}
