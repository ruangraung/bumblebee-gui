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
