import { Download } from 'lucide-react'
import type { FindingRecord } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useFindingsExport } from '@/hooks/useFindingsExport'

interface FindingsExportActionsProps {
  findings: FindingRecord[]
  scanId?: number
}

export function FindingsExportActions({ findings, scanId }: FindingsExportActionsProps) {
  const { exportJSON, exportCSV } = useFindingsExport(findings, scanId)

  if (findings.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={exportJSON}>
        <Download className="mr-1.5 h-4 w-4" />
        JSON
      </Button>
      <Button variant="outline" size="sm" onClick={exportCSV}>
        <Download className="mr-1.5 h-4 w-4" />
        CSV
      </Button>
    </div>
  )
}
