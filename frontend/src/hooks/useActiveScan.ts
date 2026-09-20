import { useCallback, useEffect, useMemo } from 'react'
import { useScanStore } from '@/stores/scanStore'
import { isInProgress, packagesToFetch, resolveActiveScan, scanPackages } from '@/lib/scans'

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

  const activeScan = useMemo(() => resolveActiveScan(scans, scanId), [scans, scanId])
  const packages = scanPackages(packagesByScan, activeScan)

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  useEffect(() => {
    const missing = packagesToFetch(packagesByScan, activeScan)
    if (missing !== null) fetchPackages(missing)
  }, [activeScan, packagesByScan, fetchPackages])

  const scanStatus = activeScan?.status
  useEffect(() => {
    if (activeScan && isInProgress(scanStatus)) {
      waitForScan(activeScan.id).catch(() => {
        // Errors are surfaced through the store
      })
    }
  }, [activeScan?.id, scanStatus, waitForScan])

  const cancel = useCallback(async () => {
    if (activeScan) await deleteScan(activeScan.id)
  }, [activeScan, deleteScan])

  return { scans, activeScan, packages, loading, error, clearError, cancel }
}
