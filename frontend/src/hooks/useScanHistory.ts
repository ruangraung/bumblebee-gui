import { useCallback, useEffect, useState } from 'react'
import { useScanStore } from '@/stores/scanStore'

// The scan history shown on the Settings page: how many scans exist, and
// deleting all of them. Both read the live store list, so the page cannot show
// a count that is not real.
export function useScanHistory() {
  const scans = useScanStore((state) => state.scans)
  const fetchScans = useScanStore((state) => state.fetchScans)
  const deleteScan = useScanStore((state) => state.deleteScan)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    fetchScans().catch(() => {
      // The store surfaces the failure; the page only reports the count.
    })
  }, [fetchScans])

  const clearAll = useCallback(async () => {
    if (scans.length === 0) return

    const confirmed = window.confirm(
      `Delete all ${scans.length} scans? Their records and result files are removed.`,
    )
    if (!confirmed) return

    setClearing(true)
    try {
      // Sequential, because deleting a running scan cancels it server-side
      // first. deleteScan reports its own failures through the store.
      for (const scan of scans) {
        await deleteScan(scan.id)
      }
    } finally {
      await fetchScans().catch(() => {})
      setClearing(false)
    }
  }, [scans, deleteScan, fetchScans])

  return { count: scans.length, clearing, clearAll }
}
