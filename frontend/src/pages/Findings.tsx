import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Download, Search } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge, severityVariant } from '@/components/ui/badge'

// ── Severity label ──

function severityLabel(severity: string): string {
  const meta: Record<string, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    info: 'INFO',
  }
  return meta[severity.toLowerCase()] ?? severity.toUpperCase()
}

// ── Export helper ──

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ── Component ──

export default function Findings() {
  const { scanId } = useParams<{ scanId?: string }>()
  const {
    scans,
    findings,
    loading,
    error,
    fetchScans,
    fetchFindings,
    clearError,
  } = useScanStore()

  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [ecosystemFilter, setEcosystemFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const activeScan = useMemo(() => {
    if (scanId) {
      return scans.find((s) => s.id === Number(scanId)) ?? null
    }
    const withFindings = scans.filter(
      (s) => s.status === 'completed' && (s.summary?.findings_count ?? 0) > 0
    )
    if (withFindings.length > 0) return withFindings[0]
    const completed = scans.filter((s) => s.status === 'completed')
    if (completed.length > 0) return completed[0]
    return scans[0] ?? null
  }, [scans, scanId])

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  useEffect(() => {
    if (activeScan && activeScan.status === 'completed') {
      fetchFindings(activeScan.id)
    }
  }, [activeScan, fetchFindings])

  const ecosystems = useMemo(() => {
    const set = new Set(findings.map((f) => f.ecosystem))
    return Array.from(set).sort()
  }, [findings])

  const severities = useMemo(() => {
    const order: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    }
    const set = new Set(findings.map((f) => f.severity.toLowerCase()))
    return Array.from(set).sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99))
  }, [findings])

  const filtered = useMemo(() => {
    let result = [...findings]

    if (severityFilter !== 'all') {
      result = result.filter(
        (f) => f.severity.toLowerCase() === severityFilter.toLowerCase()
      )
    }
    if (ecosystemFilter !== 'all') {
      result = result.filter(
        (f) => f.ecosystem.toLowerCase() === ecosystemFilter.toLowerCase()
      )
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (f) =>
          f.package_name.toLowerCase().includes(q) ||
          f.catalog_id?.toLowerCase().includes(q) ||
          f.catalog_name?.toLowerCase().includes(q) ||
          f.evidence?.toLowerCase().includes(q) ||
          f.source_file?.toLowerCase().includes(q)
      )
    }

    const order: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    }
    result.sort((a, b) => (order[a.severity.toLowerCase()] ?? 99) - (order[b.severity.toLowerCase()] ?? 99))

    return result
  }, [findings, severityFilter, ecosystemFilter, searchQuery])

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `findings-${activeScan?.id ?? 'latest'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, activeScan])

  const exportCSV = useCallback(() => {
    const header = 'package_name,version,ecosystem,severity,catalog_id,catalog_name,evidence,source_file'
    const rows = filtered.map((f) =>
      [
        escapeCSV(f.package_name),
        escapeCSV(f.version),
        escapeCSV(f.ecosystem),
        escapeCSV(f.severity),
        escapeCSV(f.catalog_id ?? ''),
        escapeCSV(f.catalog_name ?? ''),
        escapeCSV(f.evidence ?? ''),
        escapeCSV(f.source_file ?? ''),
      ].join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `findings-${activeScan?.id ?? 'latest'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, activeScan])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="mb-2 font-medium text-destructive">Failed to load findings</p>
        <p className="mb-4 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={clearError}>Dismiss</Button>
      </div>
    )
  }

  if (!loading && scans.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Findings"
          description="Packages matched against your exposure catalog, ranked by severity."
        />
        <EmptyState icon message="Run a scan with an exposure catalog to see findings here." />
      </div>
    )
  }

  if (!loading && activeScan && findings.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Findings"
          description="Packages matched against your exposure catalog, ranked by severity."
        />
        <EmptyState icon message="No exposure matches were found in this scan." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <PageHeader
        title="Findings"
        description="Packages matched against your exposure catalog, ranked by severity."
      />

      {/* Summary banner */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm">
            <span className="font-mono font-medium">{filtered.length}</span>{' '}
            {filtered.length === 1 ? 'package' : 'packages'} match your exposure
            catalog
          </p>
        </div>
      )}

      {/* Filters */}
      {(findings.length > 0 || loading) && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search findings…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-56 rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">all severities</option>
            {severities.map((s) => (
              <option key={s} value={s}>{severityLabel(s)}</option>
            ))}
          </select>

          <select
            value={ecosystemFilter}
            onChange={(e) => setEcosystemFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">all ecosystems</option>
            {ecosystems.map((eco) => (
              <option key={eco} value={eco}>{eco}</option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {loading && findings.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 && findings.length > 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-muted-foreground">
            No findings match your current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((finding, i) => (
            <div
              key={`${finding.package_name}-${finding.version}-${finding.catalog_id}-${i}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={severityVariant(finding.severity)}>
                  {severityLabel(finding.severity)}
                </Badge>
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
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  src: {finding.source_file}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Export */}
      {filtered.length > 0 && (
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
      )}
    </div>
  )
}

function EmptyState({ icon, message }: { icon?: boolean; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
          <AlertTriangle className="h-6 w-6" />
        </div>
      )}
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
