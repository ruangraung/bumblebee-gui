import { Download, Copy } from 'lucide-react'
import type { PackageRecord, ScanRecord } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { usePackageExport } from '@/hooks/usePackageExport'

interface ExportActionsProps {
  packages: PackageRecord[]
  scan: ScanRecord | null
}

export function ExportActions({ packages, scan }: ExportActionsProps) {
  const { exportJSON, exportCSV, copyToClipboard, copied } = usePackageExport(packages, scan?.id)

  if (packages.length === 0) return null

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
      <Button variant="outline" size="sm" onClick={copyToClipboard}>
        <Copy className="mr-1.5 h-4 w-4" />
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
