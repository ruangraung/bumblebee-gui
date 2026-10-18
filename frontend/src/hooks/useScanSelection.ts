import { useEffect, useState } from 'react'
import { api, type ScanRecord } from '@/lib/api'

function validScanId(scanId: string | undefined): boolean {
  if (scanId === undefined) return true
  return /^[1-9]\d*$/.test(scanId) && Number.isSafeInteger(Number(scanId))
}

function useRequestedScan(scanId: string | undefined) {
  const [requested, setRequested] = useState<ScanRecord | null>(null)
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null)
  useEffect(() => {
    if (scanId === undefined || !validScanId(scanId)) return
    let active = true
    setRequested(null)
    setFailure(null)
    api.getScan(Number(scanId)).then(
      (scan) => { if (active) setRequested(scan) },
      (err: Error) => { if (active) setFailure({ id: scanId, message: err.message }) },
    )
    return () => { active = false }
  }, [scanId])
  return { requested, failure, updateRequested: setRequested }
}

export function useScanSelection(
  scans: ScanRecord[],
  scanId: string | undefined,
  resolveDefault: (scans: ScanRecord[]) => ScanRecord | null,
  { loading: listLoading, error: listError }: { loading: boolean; error: string | null },
) {
  const { requested, failure, updateRequested } = useRequestedScan(scanId)
  if (scanId === undefined) {
    return { activeScan: resolveDefault(scans), loading: listLoading, error: listError, updateRequested }
  }
  const activeScan = requested?.id === Number(scanId) ? requested : null
  const error = selectionError(scanId, failure)
  return { activeScan, loading: listLoading || (!activeScan && !error), error: error || listError, updateRequested }
}

function selectionError(scanId: string, failure: { id: string; message: string } | null) {
  if (!validScanId(scanId)) return 'Invalid scan ID.'
  if (failure?.id === scanId) return failure.message
  return null
}
