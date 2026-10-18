import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useScanHistory } from '@/hooks/useScanHistory'
import type { ScanHistoryPage } from '@/lib/api'

function HistoryRows({ page }: { page: ScanHistoryPage }) {
  if (page.total === 0) return <p className="text-sm text-muted-foreground">No scans recorded.</p>
  return (
    <ul className="divide-y">
      {page.scans.map((scan) => (
        <li key={scan.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <span>#{scan.id} · {scan.profile} · {scan.status}</span>
          <div className="flex gap-4">
            <Link className="inline-flex min-h-11 items-center text-primary underline" to={`/results/${scan.id}`} aria-label={`Results for scan ${scan.id}`}>Results</Link>
            <Link className="inline-flex min-h-11 items-center text-primary underline" to={`/findings/${scan.id}`} aria-label={`Findings for scan ${scan.id}`}>Findings</Link>
          </div>
        </li>
      ))}
    </ul>
  )
}

function HistoryPaging({ page, busy, setOffset }: {
  page: ScanHistoryPage
  busy: boolean
  setOffset: (offset: number) => void
}) {
  return (
    <nav aria-label="Scan history pages" className="flex flex-wrap gap-2">
      <Button variant="outline" className="min-h-11" aria-label="Previous history page" disabled={busy || page.offset === 0} onClick={() => setOffset(Math.max(0, page.offset - page.limit))}>Previous</Button>
      <Button variant="outline" className="min-h-11" aria-label="Next history page" disabled={busy || page.offset + page.limit >= page.total} onClick={() => setOffset(page.offset + page.limit)}>Next</Button>
    </nav>
  )
}

function HistoryCount({ page }: { page: ScanHistoryPage | null }) {
  if (!page) return null
  return <p className="text-sm">Scan history: <span className="font-mono">{page.total}</span> {page.total === 1 ? 'scan' : 'scans'}</p>
}

function HistoryActions({ page, loading, clearing, clearAll, reload }: ReturnType<typeof useScanHistory>) {
  const busy = loading || clearing
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="min-h-11" disabled={busy} onClick={reload}>Refresh history</Button>
      <Button variant="destructive" className="min-h-11" disabled={busy || !page || page.total === 0} onClick={clearAll}>
        {clearing ? 'Clearing…' : 'Clear all scan data'}
      </Button>
    </div>
  )
}

export function ScanHistoryPanel() {
  const history = useScanHistory()
  const { page, loading, error, setOffset, clearing, deletionError } = history
  const busy = loading || clearing
  return (
    <div className="space-y-4 rounded-lg border bg-card px-4 py-4">
      <HistoryCount page={page} />
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading scan history…</p>}
      {error && <p role="alert" className="text-sm text-destructive">Scan history unavailable: {error}</p>}
      {deletionError && <p role="alert" className="whitespace-pre-wrap break-words text-sm text-destructive">Could not delete some scan data. {deletionError}</p>}
      {page && <HistoryRows page={page} />}
      {page && <HistoryPaging page={page} busy={busy} setOffset={setOffset} />}
      <HistoryActions {...history} />
      <p className="text-sm text-muted-foreground">Each page reflects current history. Clearing removes scans present when deletion starts; new scans are retained.</p>
    </div>
  )
}
