import { useParams } from 'react-router-dom'
import ScanPicker from '@/components/ScanPicker'
import { ScanLoadError } from '@/components/ScanLoadError'
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
    return <ScanLoadError title="Failed to load findings" error={error} scanId={scanId} recentPath="/findings" clearError={clearError} />
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

      {showSummary && <FindingsSummary count={table.filtered.length} scan={activeScan} />}

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
