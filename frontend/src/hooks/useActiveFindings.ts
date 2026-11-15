import { useEffect } from 'react'
import { useScanStore } from '@/stores/scanStore'
import { useScanSelection } from '@/hooks/useScanSelection'
import { useResultCompletion } from '@/hooks/useResultCompletion'
import { findingsToFetch, resolveFindingsScan } from '@/lib/scans'

// The scan a findings view shows, its findings, and the lifecycle work that
// keeps both fresh: load the scan list, wait while a scan is still running, then
// fetch its findings once.
export function useActiveFindings(scanId?: string) {
  const {
    scans,
    findingsByScan,
    loading,
    error: storeError,
    fetchScans,
    fetchFindings,
    waitForScan,
    clearError,
  } = useScanStore()

  const selection = useScanSelection(scans, scanId, resolveFindingsScan, {
    loading,
    error: storeError,
  })
  const { activeScan } = selection

  // Per-scan cache read: empty until that scan's findings have been fetched.
  const findings = findingsByScan[activeScan?.id ?? -1] ?? []

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  // A scan opened while it is still working is followed to its terminal state,
  // otherwise this page never leaves the running state: findings are only
  // fetched for a completed scan.
  useResultCompletion(activeScan, waitForScan, selection.updateRequested)

  // Clearing a load error retries the fetch. Without this, dismissing the
  // error leaves the empty per-scan cache in place and the page reads as a
  // scan that matched nothing.
  useEffect(() => {
    if (storeError !== null) return
    const missing = findingsToFetch(findingsByScan, activeScan)
    if (missing !== null) fetchFindings(missing)
  }, [storeError, activeScan, findingsByScan, fetchFindings])

  return { scans, activeScan, findings, loading: selection.loading, error: selection.error, clearError }
}
