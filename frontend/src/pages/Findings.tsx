import { useParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import ScanPicker from '@/components/ScanPicker'
import { Button } from '@/components/ui/button'
import { FindingsHeader } from '@/components/FindingsHeader'
import { FindingsFilters } from '@/components/FindingsFilters'
import { FindingsSummary } from '@/components/FindingsSummary'
import { FindingsBody } from '@/components/FindingsBody'
import { FindingsExportActions } from '@/components/FindingsExportActions'
import { useActiveFindings } from '@/hooks/useActiveFindings'
import { useFindingsTable } from '@/hooks/useFindingsTable'

export default function Findings() {
  const { scanId } = useParams<{ scanId?: string }>()
  const { scans, activeScan, findings, loading, error, clearError } = useActiveFindings(scanId)
  const table = useFindingsTable(findings)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="mb-2 font-medium text-destructive">Failed to load findings</p>
        <p className="mb-4 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={clearError}>Dismiss</Button>
      </div>
    )
  }

  if (!loading && scans.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <FindingsHeader />
        <EmptyState icon message="Run a scan with an exposure catalog to see findings here." />
      </div>
    )
  }

  if (!loading && activeScan && findings.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <FindingsHeader />
        <ScanPicker scans={scans} activeId={activeScan?.id} basePath="/findings" />
        <EmptyState icon message="No exposure matches were found in this scan." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FindingsHeader />

      <ScanPicker scans={scans} activeId={activeScan?.id} basePath="/findings" />

      {!loading && table.filtered.length > 0 && <FindingsSummary count={table.filtered.length} />}

      {(findings.length > 0 || loading) && (
        <FindingsFilters
          search={table.searchQuery}
          onSearchChange={table.setSearchQuery}
          severities={table.severities}
          severity={table.severityFilter}
          onSeverityChange={table.setSeverityFilter}
          ecosystems={table.ecosystems}
          ecosystem={table.ecosystemFilter}
          onEcosystemChange={table.setEcosystemFilter}
        />
      )}

      <FindingsBody findings={findings} filtered={table.filtered} loading={loading} />

      <FindingsExportActions findings={table.filtered} scanId={activeScan?.id} />
    </div>
  )
}

// The two empty states a scan can produce, with the icon marking the one that
// points at a missing catalog rather than a filtered-out list.
function EmptyState({ icon, message }: { icon?: boolean; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
          <AlertTriangle className="h-6 w-6" />
        </div>
      )}
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
