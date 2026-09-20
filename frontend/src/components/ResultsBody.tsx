import type { PackageRecord, ScanRecord } from '@/lib/api'
import { PackagesTable } from '@/components/PackagesTable'
import { ScanningState } from '@/components/ScanningState'
import { isInProgress, noMatchMessage } from '@/lib/scans'
import { usePackageTable } from '@/hooks/usePackageTable'

interface ScanView {
  activeScan: ScanRecord | null
  packages: PackageRecord[]
  loading: boolean
}

interface ResultsBodyProps {
  scan: ScanView
  table: ReturnType<typeof usePackageTable>
  onCancel: () => void
}

// Picks which state the results area shows. Each case returns early so the
// order of the checks is also the precedence: a running scan outranks an
// empty list, which outranks the table.
export function ResultsBody({ scan, table, onCancel }: ResultsBodyProps) {
  const { activeScan, packages, loading } = scan

  if (loading && packages.length === 0) return <Loading />
  if (!activeScan) return <EmptyState message="Run a scan to see package results here." />
  if (isInProgress(activeScan.status)) {
    return <ScanningState packagesFound={activeScan.packages_found} onCancel={onCancel} />
  }
  if (activeScan.status === 'failed') {
    return <EmptyState message="This scan failed. Check the backend logs and try again." />
  }
  if (table.filtered.length === 0) {
    return (
      <EmptyState message={noMatchMessage({ search: table.search, ecosystem: table.ecosystemFilter })} />
    )
  }

  return (
    <PackagesTable
      rows={table.paged}
      page={table.page}
      totalPages={table.totalPages}
      pageNumbers={table.pageNumbers}
      range={{ start: table.pageStart, end: table.pageEnd, total: table.filtered.length }}
      onPageChange={(next) => table.setPage(Math.min(table.totalPages, Math.max(1, next)))}
    />
  )
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
