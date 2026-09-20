import type { PackageRecord } from '@/lib/api'
import { buildCSV, sanitizeCell } from '@/lib/export'

export const PAGE_SIZE = 50

export type SortKey = 'name-asc' | 'name-desc' | 'ecosystem' | 'version'

// Only the string-valued columns are exported; `has_lifecycle_scripts` is a
// boolean and stays out of the CSV/TSV shape.
type ExportColumn =
  | 'package_name'
  | 'ecosystem'
  | 'version'
  | 'source_type'
  | 'project_path'
  | 'confidence'

const EXPORT_COLUMNS: readonly ExportColumn[] = [
  'package_name',
  'ecosystem',
  'version',
  'source_type',
  'project_path',
  'confidence',
]

function exportFields(pkg: PackageRecord): string[] {
  return EXPORT_COLUMNS.map((column) => pkg[column] ?? '')
}

export function packagesToCSV(packages: PackageRecord[]): string {
  return buildCSV(EXPORT_COLUMNS, packages.map(exportFields))
}

// Clipboard format: no header, tab-separated, so a paste lands as columns.
export function packagesToTSV(packages: PackageRecord[]): string {
  return packages.map((pkg) => exportFields(pkg).map(sanitizeCell).join('\t')).join('\n')
}

export function getEcosystems(packages: PackageRecord[]): string[] {
  return Array.from(new Set(packages.map((pkg) => pkg.ecosystem))).sort()
}

// Versions are read the way a person reads them, so 10.0.0 sorts above 9.0.0
// instead of below it. This is not full semver ordering: a pre-release suffix
// still sorts after its release.
function compareVersions(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true })
}

// Every sort key falls back to the package name, so equal ecosystems or
// versions still come out in a stable, readable order.
const COMPARATORS: Record<SortKey, (a: PackageRecord, b: PackageRecord) => number> = {
  'name-asc': (a, b) => a.package_name.localeCompare(b.package_name),
  'name-desc': (a, b) => b.package_name.localeCompare(a.package_name),
  ecosystem: (a, b) =>
    a.ecosystem.localeCompare(b.ecosystem) || a.package_name.localeCompare(b.package_name),
  version: (a, b) =>
    compareVersions(a.version, b.version) || a.package_name.localeCompare(b.package_name),
}

export function filterAndSortPackages(
  packages: PackageRecord[],
  { search, ecosystem, sortKey }: { search: string; ecosystem: string; sortKey: SortKey },
): PackageRecord[] {
  let result = [...packages]

  if (search.trim()) {
    const q = search.trim().toLowerCase()
    result = result.filter((pkg) => pkg.package_name.toLowerCase().includes(q))
  }

  if (ecosystem !== 'all') {
    result = result.filter((pkg) => pkg.ecosystem === ecosystem)
  }

  return result.sort(COMPARATORS[sortKey])
}

export function pageCount(totalItems: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalItems / pageSize))
}

export function pageRange(
  totalItems: number,
  page: number,
  pageSize = PAGE_SIZE,
): { start: number; end: number } {
  return {
    start: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
    end: Math.min(page * pageSize, totalItems),
  }
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

// Up to 7 pages are listed in full; beyond that the window collapses to first,
// last, and the neighbours of the current page, with gaps marked as ellipses.
export function buildPageNumbers(totalPages: number, page: number): (number | '...')[] {
  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }
  return pages
}

// Before a scan is committed to the URL there is no id yet, so exports of the
// pending set are named "latest".
export function exportFilename(scanId: number | undefined, extension: string): string {
  return `packages-${scanId ?? 'latest'}.${extension}`
}
