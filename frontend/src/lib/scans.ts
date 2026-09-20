import type { PackageRecord, ScanRecord } from '@/lib/api'

export function isInProgress(status?: string): boolean {
  return status === 'running' || status === 'pending'
}

// Scan to show: URL param, else the most recent completed, else the most recent.
export function resolveActiveScan(scans: ScanRecord[], scanId?: string): ScanRecord | null {
  if (scanId) {
    return scans.find((s) => s.id === Number(scanId)) ?? null
  }
  const completed = scans.filter((s) => s.status === 'completed')
  if (completed.length > 0) return completed[0]
  return scans[0] ?? null
}

// Cached results for a scan; empty until that scan's results have been fetched.
export function scanPackages(
  cache: Record<number, PackageRecord[] | undefined>,
  scan: ScanRecord | null,
): PackageRecord[] {
  if (!scan) return []
  return cache[scan.id] ?? []
}

// A scan's packages are fetched once, on demand: a completed scan whose
// results are still missing from the cache, and no other case.
export function packagesToFetch(
  cache: Record<number, PackageRecord[] | undefined>,
  scan: ScanRecord | null,
): number | null {
  if (!scan) return null
  if (scan.status !== 'completed') return null
  return cache[scan.id] === undefined ? scan.id : null
}

// The scan line under the page title: date, profile, and what the scan knows
// so far. A finished scan reports its own total; a running one reports status.
export function scanSummaryLine(scan: ScanRecord | null, packageCount: number): string {
  if (!scan) return 'no scan selected — run a scan first'
  const date = scanDateLabel(scan.timestamp)
  if (scan.status === 'completed') {
    const total = scan.summary?.total_packages ?? packageCount
    return `${date} · ${scan.profile} · ${total} packages`
  }
  return `${date} · ${scan.profile} · ${scan.status}`
}

export function scanDateLabel(timestamp?: string): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toISOString().slice(0, 10)
}

// A filtered-out list reads differently from a scan that genuinely found
// nothing, so the empty state needs to know which one it is. The object keeps
// the two strings from being swapped positionally at the call site.
export function noMatchMessage({
  search,
  ecosystem,
}: {
  search: string
  ecosystem: string
}): string {
  if (search || ecosystem !== 'all') return 'No packages match your filters.'
  return 'No packages found in this scan.'
}

// The findings page prefers a completed scan that actually produced findings,
// because a scan with none renders an empty page. Everything else, including
// the URL-param case, follows the same rule as the results page.
export function resolveFindingsScan(scans: ScanRecord[], scanId?: string): ScanRecord | null {
  if (scanId) return resolveActiveScan(scans, scanId)
  const withFindings = scans.find(
    (scan) => scan.status === 'completed' && (scan.summary?.findings_count ?? 0) > 0,
  )
  return withFindings ?? resolveActiveScan(scans)
}
