import { useEffect } from 'react'
import type { ScanRecord } from '@/lib/api'
import { isInProgress } from '@/lib/scans'

// Keeps a detail view honest about a scan that is still working: when the record
// is in progress, wait for the terminal state and swap it in.
//
// Shared by the results and the findings views. It lives here rather than inside
// one of them because the two disagreeing is exactly what went wrong: results
// waited for a running scan, findings read the record once and then stopped, so
// a link shared while the scan was still working stayed empty on that page until
// a manual reload.
export function useResultCompletion(
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
