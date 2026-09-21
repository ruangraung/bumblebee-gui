import type { FindingRecord, PackageRecord, ScanRecord } from '@/lib/api'

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
  if (!scan) return 'No scan selected. Run a scan first.'
  const date = scanDateLabel(scan.timestamp)
  if (scan.status === 'completed') {
    const total = scan.summary?.total_packages ?? packageCount
    return `${date} · ${scan.profile} · ${total} packages`
  }
  return `${date} · ${scan.profile} · ${scan.status}`
}

// The scan line follows the reader's own clock: a scan started at 01:30 in
// Jakarta belongs to that day, so the label is built from local parts rather
// than the UTC day of the timestamp.
export function scanDateLabel(timestamp?: string): string {
  if (!timestamp) return 'n/a'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'n/a'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
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

// A scan's findings are fetched once, on demand: a completed scan whose
// findings are still missing from the cache, and no other case.
export function findingsToFetch(
  cache: Record<number, FindingRecord[] | undefined>,
  scan: ScanRecord | null,
): number | null {
  if (!scan) return null
  if (scan.status !== 'completed') return null
  return cache[scan.id] === undefined ? scan.id : null
}

// The count of what was examined, shown under an empty findings page. A report
// of no matches on its own reads as though nothing was looked at, and this count
// is what separates that from a scan that walked the tree and matched nothing.
export function comparedLine(scan: ScanRecord | null): string {
  const total = scan?.summary?.total_packages
  if (typeof total !== 'number') return 'This scan recorded no package count.'
  return `${total} ${total === 1 ? 'package' : 'packages'} examined.`
}
