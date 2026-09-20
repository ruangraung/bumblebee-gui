import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ScanPicker from '@/components/ScanPicker'
import { Button } from '@/components/ui/button'
import { PackageFilters } from '@/components/PackageFilters'
import { ResultsHeader } from '@/components/ResultsHeader'
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
    await cancel()
    navigate('/')
  }, [activeScan, cancel, navigate])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="font-medium text-destructive">Failed to load results</p>
        <p className="mb-4 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={clearError}>Dismiss</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ResultsHeader scan={activeScan} packageCount={packages.length} />
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
