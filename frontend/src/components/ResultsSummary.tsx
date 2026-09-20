import type { ScanRecord } from '@/lib/api'
import { EcosystemChart } from '@/components/EcosystemChart'

// Ecosystem breakdown for a finished scan, when it reported any counts.
export function ResultsSummary({ scan }: { scan: ScanRecord | null }) {
  const counts = scan?.summary?.ecosystem_counts
  if (!counts || Object.keys(counts).length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <EcosystemChart data={counts} />
    </div>
  )
}
