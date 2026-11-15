import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ScanPicker from '@/components/ScanPicker'
import { ScanLoadError } from '@/components/ScanLoadError'
import { PackageFilters } from '@/components/PackageFilters'
import { ResultsHeader } from '@/components/ResultsHeader'
import { ScanVerdict } from '@/components/ScanVerdict'
import { ResultsBody } from '@/components/ResultsBody'
import { ResultsSummary } from '@/components/ResultsSummary'
import { ExportActions } from '@/components/ExportActions'
import { useActiveScan } from '@/hooks/useActiveScan'
import { usePackageTable } from '@/hooks/usePackageTable'

export default function Results() {
  const { scanId } = useParams<{ scanId?: string }>()
  const navigate = useNavigate()
  const { scans, activeScan, packages, loading, error, clearError, cancel } = useActiveScan(scanId)
  const table = usePackageTable(packages)

  const handleCancel = useCallback(async () => {
    if (!activeScan) return
    // Cancel deletes the record, the same destructive act as clearing the
    // whole history — so it gets the same confirmation.
    const confirmed = window.confirm(
      'Cancel this scan? Its record and the packages found so far are deleted.',
    )
    if (!confirmed) return
    await cancel()
    navigate('/')
  }, [activeScan, cancel, navigate])

  if (error) {
    return <ScanLoadError title="Failed to load results" error={error} scanId={scanId} recentPath="/results" clearError={clearError} />
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ResultsHeader scan={activeScan} packageCount={packages.length} />
      <ScanVerdict scan={activeScan} />
      <ScanPicker scans={scans} activeId={activeScan?.id} basePath="/results" />

      {packages.length > 0 && (
        <PackageFilters
          ecosystems={table.ecosystems}
          search={table.search}
          onSearchChange={table.setSearch}
          ecosystem={table.ecosystemFilter}
          onEcosystemChange={table.setEcosystemFilter}
          sortKey={table.sortKey}
          onSortChange={table.setSortKey}
        />
      )}

      <ResultsBody scan={{ activeScan, packages, loading }} table={table} onCancel={handleCancel} />
      <ExportActions scan={activeScan} packages={table.filtered} />
      <ResultsSummary scan={activeScan} />
    </div>
  )
}
