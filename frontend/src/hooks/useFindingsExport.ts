import { useCallback } from 'react'
import type { FindingRecord } from '@/lib/api'
import { downloadTextFile } from '@/lib/export'
import { findingsFilename, findingsToCSV } from '@/lib/findings'

// Download actions for a set of finding rows.
export function useFindingsExport(findings: FindingRecord[], scanId?: number, filtered = false) {
  const exportJSON = useCallback(() => {
    downloadTextFile(
      findingsFilename(scanId, 'json', { filtered }),
      JSON.stringify(findings, null, 2),
      'application/json',
    )
  }, [findings, scanId, filtered])

  const exportCSV = useCallback(() => {
    downloadTextFile(findingsFilename(scanId, 'csv', { filtered }), findingsToCSV(findings), 'text/csv')
  }, [findings, scanId, filtered])

  return { exportJSON, exportCSV }
}
