import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Copy, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { PageHeader } from '@/components/PageHeader'
import ScanPicker from '@/components/ScanPicker'
import { ScanningState } from '@/components/ScanningState'
import { Button } from '@/components/ui/button'
import { EcosystemChart } from '@/components/EcosystemChart'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE = 50

type SortKey = 'name-asc' | 'name-desc' | 'ecosystem' | 'version'

export default function Results() {
  const { scanId } = useParams<{ scanId?: string }>()
  const navigate = useNavigate()
  const {
    scans,
    packagesByScan,
    loading,
    error,
    fetchScans,
    fetchPackages,
    waitForScan,
    deleteScan,
    clearError,
  } = useScanStore()

  const [search, setSearch] = useState('')
  const [ecosystemFilter, setEcosystemFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name-asc')
  const [page, setPage] = useState(1)
  const [copied, setCopied] = useState(false)

  // Resolve the scan to display: explicit param or latest
  const activeScan = useMemo(() => {
    if (scanId) {
      return scans.find((s) => s.id === Number(scanId)) ?? null
    }
    const completed = scans.filter((s) => s.status === 'completed')
    if (completed.length > 0) return completed[0]
    return scans[0] ?? null
  }, [scans, scanId])

  // Per-scan cache read — empty until that scan's results are fetched.
  const packages = packagesByScan[activeScan?.id ?? -1] ?? []

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  useEffect(() => {
    if (activeScan && activeScan.status === 'completed' && !packagesByScan[activeScan.id]) {
      fetchPackages(activeScan.id)
    }
  }, [activeScan, packagesByScan, fetchPackages])

  const scanStatus = activeScan?.status
  useEffect(() => {
    if (activeScan && (scanStatus === 'running' || scanStatus === 'pending')) {
      waitForScan(activeScan.id).catch(() => {
        // Errors are surfaced through the store
      })
    }
  }, [activeScan?.id, scanStatus, waitForScan])

  useEffect(() => {
    setPage(1)
  }, [search, ecosystemFilter, sortKey])

  const ecosystems = useMemo(() => {
    const set = new Set(packages.map((p) => p.ecosystem))
    return Array.from(set).sort()
  }, [packages])

  const filtered = useMemo(() => {
    let result = [...packages]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.package_name.toLowerCase().includes(q))
    }

    if (ecosystemFilter !== 'all') {
      result = result.filter((p) => p.ecosystem === ecosystemFilter)
    }

    result.sort((a, b) => {
      switch (sortKey) {
        case 'name-asc':
          return a.package_name.localeCompare(b.package_name)
        case 'name-desc':
          return b.package_name.localeCompare(a.package_name)
        case 'ecosystem':
          return a.ecosystem.localeCompare(b.ecosystem) || a.package_name.localeCompare(b.package_name)
        case 'version':
          return a.version.localeCompare(b.version) || a.package_name.localeCompare(b.package_name)
        default:
          return 0
      }
    })

    return result
  }, [packages, search, ecosystemFilter, sortKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const pageStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, filtered.length)

  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, page])

  const handleCancel = useCallback(async () => {
    if (!activeScan) return
    await deleteScan(activeScan.id)
    navigate('/')
  }, [activeScan, deleteScan, navigate])

  // ── Export helpers ──
  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `packages-${activeScan?.id ?? 'latest'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, activeScan])

  const exportCSV = useCallback(() => {
    const header = 'package_name,ecosystem,version,source_type,project_path,confidence'
    const rows = filtered.map((p) =>
      [escapeCSV(p.package_name), escapeCSV(p.ecosystem), escapeCSV(p.version), escapeCSV(p.source_type ?? ''), escapeCSV(p.project_path ?? ''), escapeCSV(p.confidence ?? '')].join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `packages-${activeScan?.id ?? 'latest'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, activeScan])

  const copyToClipboard = useCallback(async () => {
    const text = filtered.map((p) => `${p.package_name}\t${p.ecosystem}\t${p.version}\t${p.source_type ?? ''}\t${p.project_path ?? ''}\t${p.confidence ?? ''}`).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [filtered])

  // ── Render ──
  const scanDate = activeScan?.timestamp
    ? new Date(activeScan.timestamp).toISOString().slice(0, 10)
    : '—'
  const totalPackages = activeScan?.summary?.total_packages ?? packages.length

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="font-medium text-destructive">Failed to load results</p>
        <p className="mb-4 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={clearError}>Dismiss</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Header ── */}
      <div>
        <PageHeader
          title="Results"
          description="The packages a scan detected — search, filter, sort, and export."
        />
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {activeScan
            ? activeScan.status === 'completed'
              ? `${scanDate} · ${activeScan.profile} · ${totalPackages} packages`
              : `${scanDate} · ${activeScan.profile} · ${activeScan.status}`
            : 'no scan selected — run a scan first'}
        </p>
      </div>

      {/* Scan switcher */}
      <ScanPicker scans={scans} activeId={activeScan?.id} basePath="/results" />

      {/* ── Filters bar ── */}
      {packages.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search packages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

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

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="name-asc">Name A→Z</option>
            <option value="name-desc">Name Z→A</option>
            <option value="ecosystem">Ecosystem</option>
            <option value="version">Version</option>
          </select>
        </div>
      )}

      {/* ── Body ── */}
      {loading && packages.length === 0 ? (
        <Loading />
      ) : !activeScan ? (
        <EmptyState message="Run a scan to see package results here." />
      ) : activeScan.status === 'running' || activeScan.status === 'pending' ? (
        <ScanningState
          packagesFound={activeScan.packages_found}
          onCancel={handleCancel}
        />
      ) : activeScan.status === 'failed' ? (
        <EmptyState message="This scan failed. Check the backend logs and try again." />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search || ecosystemFilter !== 'all'
              ? 'No packages match your filters.'
              : 'No packages found in this scan.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium">Ecosystem</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Path</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((pkg, i) => (
                <tr
                  key={`${pkg.package_name}-${pkg.version}-${i}`}
                  className="border-b border-border last:border-0 transition-colors hover:bg-accent/40"
                >
                  <td className="px-4 py-2.5 font-mono text-[13px] font-medium">{pkg.package_name}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="neutral" className="font-mono">{pkg.ecosystem}</Badge>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{pkg.version}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{pkg.source_type ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{pkg.project_path ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{pkg.confidence ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="font-mono text-xs text-muted-foreground">
              {pageStart}–{pageEnd} / {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pageNumbers.map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export ── */}
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
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="mr-1.5 h-4 w-4" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}

      {/* ── Summary chart ── */}
      {activeScan?.summary?.ecosystem_counts &&
        Object.keys(activeScan.summary.ecosystem_counts).length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <EcosystemChart data={activeScan.summary.ecosystem_counts} />
          </div>
        )}
    </div>
  )
}

// ── Sub-components ──

function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
