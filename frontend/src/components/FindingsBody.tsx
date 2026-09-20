import type { FindingRecord } from '@/lib/api'
import { Badge, severityVariant } from '@/components/ui/badge'
import { severityLabel } from '@/lib/severity'

interface FindingsBodyProps {
  findings: FindingRecord[]
  filtered: FindingRecord[]
  loading: boolean
}

// Picks which state the findings area shows. The first check wins, so a scan
// still loading outranks an empty filter result, which outranks the list.
export function FindingsBody({ findings, filtered, loading }: FindingsBodyProps) {
  if (loading && findings.length === 0) return <Loading />
  if (filtered.length === 0 && findings.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-muted-foreground">No findings match your current filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {filtered.map((finding, i) => (
        <FindingCard key={`${finding.package_name}-${finding.version}-${finding.catalog_id}-${i}`} finding={finding} />
      ))}
    </div>
  )
}

function FindingCard({ finding }: { finding: FindingRecord }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={severityVariant(finding.severity)}>{severityLabel(finding.severity)}</Badge>
        <span className="font-mono text-sm font-medium">
          {finding.package_name}@{finding.version}
        </span>
        <Badge variant="neutral" className="font-mono">
          {finding.ecosystem}
        </Badge>
      </div>

      {finding.catalog_id && (
        <p className="mt-2.5 text-sm text-muted-foreground">
          <span className="font-mono text-foreground">{finding.catalog_id}</span>
          {finding.catalog_name ? ` — ${finding.catalog_name}` : ''}
        </p>
      )}
      {finding.evidence && (
        <p className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {finding.evidence}
        </p>
      )}
      {finding.source_file && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">src: {finding.source_file}</p>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}
