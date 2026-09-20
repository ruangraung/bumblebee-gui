import { useCallback } from 'react'
import type { FindingRecord } from '@/lib/api'
import { downloadTextFile } from '@/lib/export'
import { findingsFilename, findingsToCSV } from '@/lib/findings'

// Download actions for a set of finding rows.
export function useFindingsExport(findings: FindingRecord[], scanId?: number) {
  const exportJSON = useCallback(() => {
    downloadTextFile(
      findingsFilename(scanId, 'json'),
      JSON.stringify(findings, null, 2),
      'application/json',
    )
  }, [findings, scanId])

  const exportCSV = useCallback(() => {
    downloadTextFile(findingsFilename(scanId, 'csv'), findingsToCSV(findings), 'text/csv')
  }, [findings, scanId])

  return { exportJSON, exportCSV }
}
