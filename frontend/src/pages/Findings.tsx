import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Download, Search } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { Button } from '@/components/ui/button'
import { FindingRecord } from '@/lib/api'

// ── Severity config ──

const SEVERITY_META: Record<string, { label: string; color: string; order: number }> = {
  critical: {
    label: 'CRITICAL',
    color: 'bg-red-600 text-white dark:bg-red-700',
    order: 0,
  },
  high: {
    label: 'HIGH',
    color: 'bg-orange-500 text-white dark:bg-orange-600',
    order: 1,
  },
  medium: {
    label: 'MEDIUM',
    color: 'bg-yellow-500 text-white dark:bg-yellow-600',
    order: 2,
  },
  low: {
    label: 'LOW',
    color: 'bg-blue-500 text-white dark:bg-blue-600',
    order: 3,
  },
  info: {
    label: 'INFO',
    color: 'bg-gray-400 text-white dark:bg-gray-500',
    order: 4,
  },
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-l-red-600',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-blue-500',
  info: 'border-l-gray-400',
}

function getSeverityMeta(severity: string) {
  const key = severity.toLowerCase()
  return (
    SEVERITY_META[key] ?? {
      label: severity.toUpperCase(),
      color: 'bg-gray-400 text-white dark:bg-gray-500',
      order: 99,
    }
  )
}

function getSeverityBorderColor(severity: string): string {
  return SEVERITY_COLORS[severity.toLowerCase()] ?? 'border-l-gray-400'
}

// ── Ecosystem badge colors (matching Results page) ──

function ecosystemColor(eco: string): string {
  const map: Record<string, string> = {
    npm: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    pypi: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    cargo: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    go: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    maven: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    nuget: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    gem: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  }
  return map[eco] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
}

// ── Export helpers ──

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

  // Resolve the scan to display: explicit param or latest with findings
  const activeScan = useMemo(() => {
    if (scanId) {
      return scans.find((s) => s.id === Number(scanId)) ?? null
    }
    // Prefer latest completed scan with findings
    const withFindings = scans.filter(
      (s) => s.status === 'completed' && (s.summary?.findings_count ?? 0) > 0
    )
    if (withFindings.length > 0) return withFindings[0]
    // Fall back to latest completed scan
    const completed = scans.filter((s) => s.status === 'completed')
    if (completed.length > 0) return completed[0]
    return scans[0] ?? null
  }, [scans, scanId])

  // Load scans list on mount
  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  // Fetch findings once we have an active scan
  useEffect(() => {
    if (activeScan) {
      fetchFindings(activeScan.id)
    }
  }, [activeScan, fetchFindings])

  // Derive unique ecosystems from findings
  const ecosystems = useMemo(() => {
    const set = new Set(findings.map((f) => f.ecosystem))
    return Array.from(set).sort()
  }, [findings])

  // Derive unique severities from findings
  const severities = useMemo(() => {
    const set = new Set(findings.map((f) => f.severity.toLowerCase()))
    return Array.from(set).sort((a, b) => {
      const aOrder = getSeverityMeta(a).order
      const bOrder = getSeverityMeta(b).order
      return aOrder - bOrder
    })
  }, [findings])

  // Filter + sort by severity
  const filtered = useMemo(() => {
    let result = [...findings]

    // Severity filter
    if (severityFilter !== 'all') {
      result = result.filter(
        (f) => f.severity.toLowerCase() === severityFilter.toLowerCase()
      )
    }

    // Ecosystem filter
    if (ecosystemFilter !== 'all') {
      result = result.filter(
        (f) => f.ecosystem.toLowerCase() === ecosystemFilter.toLowerCase()
      )
    }

    // Search filter
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

    // Sort by severity (critical first)
    result.sort((a, b) => {
      const aOrder = getSeverityMeta(a.severity).order
      const bOrder = getSeverityMeta(b.severity).order
      return aOrder - bOrder
    })

    return result
  }, [findings, severityFilter, ecosystemFilter, searchQuery])

  // ── Export helpers ──

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

  // ── Error state ──

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-destructive font-medium mb-2">Failed to load findings</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={clearError}>
          Dismiss
        </Button>
      </div>
    )
  }

  // ── Empty states ──

  if (!loading && scans.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Findings</h1>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">No exposure scans yet</h2>
          <p className="text-muted-foreground mt-2">
            Run a scan with an exposure catalog to see findings here.
          </p>
        </div>
      </div>
    )
  }

  if (!loading && activeScan && findings.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Findings</h1>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">No findings</h2>
          <p className="text-muted-foreground mt-2">
            No exposure matches were found in this scan.
          </p>
        </div>
      </div>
    )
  }

  // ── Main render ──

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <h1 className="text-2xl font-bold">Findings</h1>

      {/* ── Summary banner ── */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{filtered.length}</span>{' '}
            {filtered.length === 1 ? 'package matches' : 'packages match'} your
            exposure catalog
          </p>
        </div>
      )}

      {/* ── Filters bar ── */}
      {(findings.length > 0 || loading) && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
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

          {/* Severity dropdown */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All severities</option>
            {severities.map((s) => (
              <option key={s} value={s}>
                {getSeverityMeta(s).label}
              </option>
            ))}
          </select>

          {/* Ecosystem dropdown */}
          <select
            value={ecosystemFilter}
            onChange={(e) => setEcosystemFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All ecosystems</option>
            {ecosystems.map((eco) => (
              <option key={eco} value={eco}>
                {eco}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && findings.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 && findings.length > 0 ? (
        /* ── No matches after filtering ── */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">
            No findings match your current filters.
          </p>
        </div>
      ) : (
        /* ── Findings list ── */
        <div className="space-y-3">
          {filtered.map((finding, i) => {
            const meta = getSeverityMeta(finding.severity)
            const borderColor = getSeverityBorderColor(finding.severity)

            return (
              <div
                key={`${finding.package_name}-${finding.version}-${finding.catalog_id}-${i}`}
                className={`rounded-lg border border-border bg-card p-4 border-l-4 ${borderColor}`}
              >
                {/* Severity badge + package header */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                  <span className="font-semibold text-sm">
                    {finding.package_name} {finding.version}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ecosystemColor(finding.ecosystem)}`}
                  >
                    {finding.ecosystem}
                  </span>
                </div>

                {/* Catalog info + evidence */}
                {finding.catalog_id && (
                  <p className="text-sm font-medium text-foreground mb-1">
                    {finding.catalog_id} — {finding.catalog_name}
                  </p>
                )}
                {finding.evidence && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Evidence: {finding.evidence}
                  </p>
                )}
                {finding.source_file && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Source: {finding.source_file}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Export buttons ── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportJSON}>
            <Download className="mr-1.5 h-4 w-4" />
            Export Findings JSON
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1.5 h-4 w-4" />
            Export Findings CSV
          </Button>
        </div>
      )}
    </div>
  )
}
