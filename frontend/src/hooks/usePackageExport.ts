import { useCallback, useState } from 'react'
import type { PackageRecord } from '@/lib/api'
import { exportFilename, packagesToCSV, packagesToTSV } from '@/lib/packages'
import { downloadTextFile } from '@/lib/export'

// Download and clipboard actions for a set of package rows, plus the short
// confirmation the copy button shows.
export function usePackageExport(packages: PackageRecord[], scanId?: number) {
  const [copied, setCopied] = useState(false)

  const exportJSON = useCallback(() => {
    downloadTextFile(
      exportFilename(scanId, 'json'),
      JSON.stringify(packages, null, 2),
      'application/json',
    )
  }, [packages, scanId])

  const exportCSV = useCallback(() => {
    downloadTextFile(exportFilename(scanId, 'csv'), packagesToCSV(packages), 'text/csv')
  }, [packages, scanId])

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(packagesToTSV(packages))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [packages])

  return { exportJSON, exportCSV, copyToClipboard, copied }
}
