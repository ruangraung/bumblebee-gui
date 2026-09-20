import type { ScanRecord } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { scanSummaryLine } from '@/lib/scans'

interface ResultsHeaderProps {
  scan: ScanRecord | null
  packageCount: number
}

export function ResultsHeader({ scan, packageCount }: ResultsHeaderProps) {
  return (
    <div>
      <PageHeader
        title="Results"
        description="The packages a scan detected — search, filter, sort, and export."
      />
      <p className="mt-1 font-mono text-sm text-muted-foreground">
        {scanSummaryLine(scan, packageCount)}
      </p>
    </div>
  )
}
