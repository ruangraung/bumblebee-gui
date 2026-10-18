import { useCallback, useEffect } from 'react'
import { useScanStore } from '@/stores/scanStore'
import { useScanSelection } from '@/hooks/useScanSelection'
import type { ScanRecord } from '@/lib/api'
import { isInProgress, packagesToFetch, resolveActiveScan, scanPackages } from '@/lib/scans'

// The scan a results view shows, its packages, and the lifecycle work that
// keeps both fresh: load the list, fetch missing results, wait while running.
function useResultCompletion(
  scan: ScanRecord | null,
  wait: (id: number) => Promise<ScanRecord | null>,
  update: (scan: ScanRecord) => void,
) {
  useEffect(() => {
    let active = true
    if (scan && isInProgress(scan.status)) {
      wait(scan.id).then((completed) => {
        if (active && completed) update(completed)
      }).catch(() => {
        // Errors are surfaced through the store.
      })
    }
    return () => { active = false }
  }, [scan?.id, scan?.status, wait, update])
}

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
