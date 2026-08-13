import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Copy, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { Button } from '@/components/ui/button'
import { EcosystemChart } from '@/components/EcosystemChart'

const PAGE_SIZE = 50

type SortKey = 'name-asc' | 'name-desc' | 'ecosystem' | 'version'

export default function Results() {
  const { scanId } = useParams<{ scanId?: string }>()
  const { scans, packages, loading, error, fetchScans, fetchPackages, clearError } = useScanStore()

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
    // Latest completed scan, or just the latest scan
    const completed = scans.filter((s) => s.status === 'completed')
    if (completed.length > 0) return completed[0]
    return scans[0] ?? null
  }, [scans, scanId])

  // Load scans list on mount
  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  // Fetch packages once we have an active scan
  useEffect(() => {
    if (activeScan) {
      fetchPackages(activeScan.id)
    }
  }, [activeScan, fetchPackages])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, ecosystemFilter, sortKey])

  // Derive unique ecosystems from packages
  const ecosystems = useMemo(() => {
    const set = new Set(packages.map((p) => p.ecosystem))
    return Array.from(set).sort()
  }, [packages])

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...packages]

    // Fuzzy search by name
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.package_name.toLowerCase().includes(q))
    }

    // Ecosystem filter
    if (ecosystemFilter !== 'all') {
      result = result.filter((p) => p.ecosystem === ecosystemFilter)
    }

    // Sort
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const pageStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, filtered.length)

  // Generate page numbers to display (show first, last, current ± 1, with ellipses)
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

  // Ecosystem badge color
  const ecosystemColor = (eco: string): string => {
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

  // ── Render ──

  const scanDate = activeScan?.timestamp
    ? new Date(activeScan.timestamp).toISOString().slice(0, 10)
    : '—'
  const totalPackages = activeScan?.summary?.total_packages ?? packages.length

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-destructive font-medium mb-2">Failed to load results</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={clearError}>Dismiss</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-muted-foreground mt-1">
          {activeScan
            ? `${scanDate} ${activeScan.profile} (${totalPackages} packages)`
            : 'No scan selected. Run a scan first.'}
        </p>
      </div>

      {/* ── Filters bar ── */}
      {packages.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
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

          {/* Ecosystem dropdown */}
          <select
            value={ecosystemFilter}
            onChange={(e) => setEcosystemFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All Ecosystems</option>
            {ecosystems.map((eco) => (
              <option key={eco} value={eco}>{eco}</option>
            ))}
          </select>

          {/* Sort dropdown */}
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

      {/* ── Table ── */}
      {loading && packages.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !activeScan ? (
        <EmptyState message="Run a scan to see package results here." />
      ) : filtered.length === 0 ? (
        <EmptyState message={search || ecosystemFilter !== 'all' ? 'No packages match your filters.' : 'No packages found in this scan.'} />
      ) : (
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Package</th>
                <th className="px-4 py-3 text-left font-medium">Ecosystem</th>
                <th className="px-4 py-3 text-left font-medium">Version</th>
                <th className="px-4 py-3 text-left font-medium">Source Type</th>
                <th className="px-4 py-3 text-left font-medium">Project Path</th>
                <th className="px-4 py-3 text-left font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((pkg, i) => (
                <tr
                  key={`${pkg.package_name}-${pkg.version}-${i}`}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium">{pkg.package_name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ecosystemColor(pkg.ecosystem)}`}>
                      {pkg.ecosystem}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{pkg.version}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{pkg.source_type ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{pkg.project_path ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{pkg.confidence ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Showing {pageStart}–{pageEnd} of {filtered.length}
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

      {/* ── Export buttons ── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportJSON}>
            <Download className="mr-1.5 h-4 w-4" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="mr-1.5 h-4 w-4" />
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </Button>
        </div>
      )}

      {/* ── Summary chart ── */}
      {activeScan?.summary?.ecosystem_counts && Object.keys(activeScan.summary.ecosystem_counts).length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <EcosystemChart data={activeScan.summary.ecosystem_counts} />
        </div>
      )}
    </div>
  )
}

// ── Helpers ──

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
