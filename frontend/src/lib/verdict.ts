import type { ScanRecord } from '@/lib/api'
import { failureReason, partialNote } from '@/lib/scans'

// The scan's conclusion, for the strip above the package table. It reads the
// scan's own summary rather than the loaded rows: the table is filtered,
// searched and paginated, so what is on screen is a view of the scan and not
// the verdict. A scan that has not finished, or that recorded no summary, has
// no verdict to give.
export interface ScanVerdict {
  matched: number
  // A concluded scan that matched nothing.
  clean: boolean
  // A scan that reached no conclusion, so its result implies nothing either
  // way. Never clean, and never pointing at matches it does not have.
  failed: boolean
  label: string
  note?: string
}

export function scanVerdict(scan: ScanRecord | null): ScanVerdict | null {
  if (!scan) return null
  if (scan.status === 'failed') return failedVerdict(scan)

  const summary = scan.summary
  if (scan.status !== 'completed' || !summary) return null

  const matched = summary.findings_count

  if (summary.timed_out === true) {
    return {
      matched,
      clean: false,
      failed: false,
      label:
        matched === 0
          ? 'Scan stopped at the time limit'
          : countLabel(matched),
      note: partialNote(scan) ?? undefined,
    }
  }

  return {
    matched,
    clean: matched === 0,
    failed: false,
    label: matched === 0 ? 'No catalogue matches' : countLabel(matched),
  }
}

// A failed scan produced no result, and the reason it carries is the scanner's
// own words. Without it the page shows an empty table, which reads the same as
// a scan that finished and matched nothing.
function failedVerdict(scan: ScanRecord): ScanVerdict {
  return {
    matched: 0,
    clean: false,
    failed: true,
    label: 'Scan failed',
    note: failureReason(scan) ?? undefined,
  }
}

// Matches, counted the way the sentence reads.
function countLabel(matched: number): string {
  return `${matched} catalogue ${matched === 1 ? 'match' : 'matches'}`
}
