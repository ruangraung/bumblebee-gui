import { useEffect } from 'react'
import { useScanStore } from '@/stores/scanStore'
import { useScanSelection } from '@/hooks/useScanSelection'
import { findingsToFetch, resolveFindingsScan } from '@/lib/scans'

// The scan a findings view shows, its findings, and the lifecycle work that
// keeps both fresh: load the scan list, then fetch a completed scan's findings
// once, on demand.
export function useActiveFindings(scanId?: string) {
  const {
    scans,
    findingsByScan,
    loading,
    error,
    fetchScans,
    fetchFindings,
    clearError,
  } = useScanStore()

  const selection = useScanSelection(scans, scanId, resolveFindingsScan, { loading, error })
  const { activeScan } = selection

  // Per-scan cache read: empty until that scan's findings have been fetched.
  const findings = findingsByScan[activeScan?.id ?? -1] ?? []

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  useEffect(() => {
    const missing = findingsToFetch(findingsByScan, activeScan)
    if (missing !== null) fetchFindings(missing)
  }, [activeScan, findingsByScan, fetchFindings])

  return { scans, activeScan, findings, loading: selection.loading, error: selection.error, clearError }
}
