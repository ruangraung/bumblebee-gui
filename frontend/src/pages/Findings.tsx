import { useParams } from 'react-router-dom'
import ScanPicker from '@/components/ScanPicker'
import { Button } from '@/components/ui/button'
import { FindingsEmptyView } from '@/components/FindingsEmptyView'
import { findingsEmptyKind } from '@/lib/findings'
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

  const emptyKind = findingsEmptyKind({ loading, scans, activeScan, findingsCount: findings.length })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="mb-2 font-medium text-destructive">Failed to load findings</p>
        <p className="mb-4 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={clearError}>Dismiss</Button>
      </div>
    )
  }

  if (emptyKind !== 'none') {
    return <FindingsEmptyView kind={emptyKind} scans={scans} activeScan={activeScan} />
  }

  const showSummary = !loading && table.filtered.length > 0
  const showFilters = findings.length > 0 || loading

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FindingsHeader />

      <ScanPicker scans={scans} activeId={activeScan?.id} basePath="/findings" />

      {showSummary && <FindingsSummary count={table.filtered.length} />}

      {showFilters && (
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
