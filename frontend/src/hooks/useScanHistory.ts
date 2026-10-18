import { useEffect, useState } from 'react'
import { api, type ScanHistoryPage } from '@/lib/api'
import { useScanStore } from '@/stores/scanStore'

function useHistoryPage() {
  const [page, setPage] = useState<ScanHistoryPage | null>(null)
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api.scanHistory(offset).then((result) => {
      if (!active) return
      setPage(result)
      setLoading(false)
      if (offset > 0 && result.scans.length === 0) setOffset(0)
    }).catch((err: Error) => {
      if (!active) return
      setPage(null)
      setError(err.message)
      setLoading(false)
    })
    return () => { active = false }
  }, [offset, revision])

  function reload() {
    setOffset(0)
    setRevision((value) => value + 1)
  }
  return { page, loading, error, setOffset, reload }
}

export function useScanHistory() {
  const history = useHistoryPage()
  const deleteHistory = useScanStore((state) => state.deleteHistory)
  const [clearing, setClearing] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)

  async function clearAll() {
    if (!history.page || history.loading || clearing) return
    const confirmed = window.confirm(
      `Delete all scans present at the start of this operation (currently ${history.page.total} scans)? Their records and result files are removed, and running scans are cancelled. New scans are retained.`,
    )
    if (!confirmed) return
    setClearing(true)
    setDeletionError(null)
    try {
      const result = await deleteHistory()
      if (result.failures.length > 0) {
        setDeletionError(result.failures.map(({ id, detail }) => `Scan ${id}: ${detail}`).join('\n'))
      }
    } catch (err) {
      setDeletionError((err as Error).message)
    } finally {
      history.reload()
      setClearing(false)
    }
  }

  return { ...history, clearing, clearAll, deletionError }
}
