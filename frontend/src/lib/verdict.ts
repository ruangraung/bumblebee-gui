import type { ScanRecord } from '@/lib/api'

// The scan's conclusion, for the strip above the package table. It reads the
// scan's own summary rather than the loaded rows: the table is filtered,
// searched and paginated, so what is on screen is a view of the scan and not
// the verdict. A scan that has not finished, or that recorded no summary, has
// no verdict to give.
export interface ScanVerdict {
  matched: number
  clean: boolean
  label: string
  note?: string
}

export function scanVerdict(scan: ScanRecord | null): ScanVerdict | null {
  const summary = scan?.summary
  if (!scan || scan.status !== 'completed' || !summary) return null

  const matched = summary.findings_count
  const timedOut = summary.timed_out === true

  if (timedOut) {
    return {
      matched,
      clean: false,
      label:
        matched === 0
          ? 'Scan stopped at the time limit'
          : `${matched} catalogue ${matched === 1 ? 'match' : 'matches'}`,
      note: 'Results are partial. The scan did not finish walking the tree.',
    }
  }

  return {
    matched,
    clean: matched === 0,
    label:
      matched === 0
        ? 'No catalogue matches'
        : `${matched} catalogue ${matched === 1 ? 'match' : 'matches'}`,
  }
}
