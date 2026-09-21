import type { FindingRecord, ScanRecord } from '@/lib/api'
import { buildCSV } from '@/lib/export'
import { isInProgress } from '@/lib/scans'
import { bySeverity } from '@/lib/severity'

export interface FindingFilters {
  search: string
  severity: string
  ecosystem: string
}

// The export shape, and the CSV column order with it.
const EXPORT_COLUMNS = [
  'package_name',
  'version',
  'ecosystem',
  'severity',
  'catalog_id',
  'catalog_name',
  'evidence',
  'source_file',
] as const

type ExportColumn = (typeof EXPORT_COLUMNS)[number]

// Fields a search looks at: package identity, catalog provenance, evidence and
// the file the match came from.
const SEARCH_FIELDS: readonly (keyof FindingRecord)[] = [
  'package_name',
  'catalog_id',
  'catalog_name',
  'evidence',
  'source_file',
]

function matchesSearch(finding: FindingRecord, query: string): boolean {
  return SEARCH_FIELDS.some((field) => (finding[field] ?? '').toLowerCase().includes(query))
}

export function getEcosystems(findings: FindingRecord[]): string[] {
  return Array.from(new Set(findings.map((finding) => finding.ecosystem))).sort()
}

// Filters run in the order the page shows them, then severity order decides the
// ranking. The query is trimmed, so a stray space does not hide every row.
export function filterAndSortFindings(
  findings: FindingRecord[],
  { search, severity, ecosystem }: FindingFilters,
): FindingRecord[] {
  let result = [...findings]

  if (severity !== 'all') {
    result = result.filter(
      (finding) => finding.severity.toLowerCase() === severity.toLowerCase(),
    )
  }
  if (ecosystem !== 'all') {
    result = result.filter(
      (finding) => finding.ecosystem.toLowerCase() === ecosystem.toLowerCase(),
    )
  }
  if (search.trim()) {
    const query = search.trim().toLowerCase()
    result = result.filter((finding) => matchesSearch(finding, query))
  }

  return result.sort(bySeverity)
}

function exportFields(finding: FindingRecord): string[] {
  return EXPORT_COLUMNS.map((column: ExportColumn) => finding[column] ?? '')
}

export function findingsToCSV(findings: FindingRecord[]): string {
  return buildCSV(EXPORT_COLUMNS, findings.map(exportFields))
}

// Before a scan is selected there is no id, so an export is named "latest".
export function findingsFilename(scanId: number | undefined, extension: 'json' | 'csv'): string {
  return `findings-${scanId ?? 'latest'}.${extension}`
}

// Which empty layout the findings page shows, if any. The four cases stay apart
// because they say different things, and two of them must never be reported as a
// scan that matched nothing: one that is still running, and one that failed. The
// results page already tells those apart; the findings page did not.
export type FindingsEmptyKind = 'none' | 'no-scans' | 'running' | 'failed' | 'no-findings'

export interface FindingsEmptyInput {
  loading: boolean
  scans: ScanRecord[]
  activeScan: ScanRecord | null
  findingsCount: number
}

export function findingsEmptyKind(state: FindingsEmptyInput): FindingsEmptyKind {
  if (state.loading) return 'none'
  if (state.scans.length === 0) return 'no-scans'
  if (state.activeScan === null) return 'none'
  if (state.activeScan.status === 'failed') return 'failed'
  if (isInProgress(state.activeScan.status)) return 'running'
  if (state.findingsCount === 0) return 'no-findings'
  return 'none'
}

// One message per case, so a case cannot be added without one.
export const FINDINGS_EMPTY_MESSAGES: Record<Exclude<FindingsEmptyKind, 'none'>, string> = {
  'no-scans': 'Run a scan to see exposure matches here.',
  running: 'This scan is still running. Matches appear here when it finishes.',
  failed: 'This scan failed, so nothing was compared.',
  'no-findings': 'No exposure matches were found in this scan.',
}
