import { AlertTriangle } from 'lucide-react'
import type { ScanRecord } from '@/lib/api'
import ScanPicker from '@/components/ScanPicker'
import { FindingsHeader } from '@/components/FindingsHeader'

export type FindingsEmptyKind = 'none' | 'no-scans' | 'no-findings'

interface FindingsEmptyState {
  loading: boolean
  scans: ScanRecord[]
  activeScan: ScanRecord | null
  findingsCount: number
}

// Which empty layout applies, if any. A failed catalog match and the absence of
// any scan at all read differently to a user, and only the second one can offer
// a scan to switch to.
export function findingsEmptyKind(state: FindingsEmptyState): FindingsEmptyKind {
  if (state.loading) return 'none'
  if (state.scans.length === 0) return 'no-scans'
  if (state.activeScan === null) return 'none'
  if (state.findingsCount === 0) return 'no-findings'
  return 'none'
}

const EMPTY_MESSAGES: Record<Exclude<FindingsEmptyKind, 'none'>, string> = {
  'no-scans': 'Run a scan with an exposure catalog to see findings here.',
  'no-findings': 'No exposure matches were found in this scan.',
}

interface FindingsEmptyViewProps {
  kind: Exclude<FindingsEmptyKind, 'none'>
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
      <EmptyState message={EMPTY_MESSAGES[kind]} />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
