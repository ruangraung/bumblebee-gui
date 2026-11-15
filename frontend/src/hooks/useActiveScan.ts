import { useCallback, useEffect } from 'react'
import { useScanStore } from '@/stores/scanStore'
import { useScanSelection } from '@/hooks/useScanSelection'
import { useResultCompletion } from '@/hooks/useResultCompletion'
import { packagesToFetch, resolveActiveScan, scanPackages } from '@/lib/scans'

// The scan a results view shows, its packages, and the lifecycle work that
// keeps both fresh: load the list, fetch missing results, wait while running.
export function useActiveScan(scanId?: string) {
  const {
    scans,
    packagesByScan,
    loading,
    error,
    fetchScans,
    fetchPackages,
    waitForScan,
    deleteScan,
    clearError,
  } = useScanStore()

  const selection = useScanSelection(scans, scanId, resolveActiveScan, { loading, error })
  const { activeScan } = selection
  const packages = scanPackages(packagesByScan, activeScan)

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  useEffect(() => {
    const missing = packagesToFetch(packagesByScan, activeScan)
    if (missing !== null) fetchPackages(missing)
  }, [activeScan, packagesByScan, fetchPackages])

  useResultCompletion(activeScan, waitForScan, selection.updateRequested)

  const cancel = useCallback(async () => {
    if (activeScan) await deleteScan(activeScan.id)
  }, [activeScan, deleteScan])

  return { scans, activeScan, packages, loading: selection.loading, error: selection.error, clearError, cancel }
}
