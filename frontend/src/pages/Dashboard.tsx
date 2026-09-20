import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Layers, AlertTriangle, Clock, Scan, X } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { PageHeader } from '@/components/PageHeader'
import { StatsCard } from '@/components/StatsCard'
import { EcosystemChart } from '@/components/EcosystemChart'
import { ScanPulseRing, ScanSweepBar } from '@/components/ScanningState'
import { Button } from '@/components/ui/button'
import { Badge, statusVariant } from '@/components/ui/badge'

export default function Dashboard() {
  const navigate = useNavigate()
  const { fetchScans, pollScanList, deleteScan, scans, loading } = useScanStore()

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  // Live refresh while anything runs; auto-stops when all scans are terminal.
  useEffect(() => pollScanList(3000), [pollScanList])

  // Stats summarize the latest COMPLETED scan (fall back to the newest row
  // when nothing has finished yet — e.g. the very first scan still running).
  const lastScan = useMemo(() => {
    const completed = scans.filter((s) => s.status === 'completed')
    return completed.length > 0 ? completed[0] : scans[0]
  }, [scans])
  const totalPackages = lastScan?.summary?.total_packages ?? 0
  const ecosystems = lastScan?.summary?.ecosystems_found ?? 0
  const findingsCount = lastScan?.summary?.findings_count ?? 0

  const runningScans = scans.filter((s) => s.status === 'running' || s.status === 'pending')

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-6">
        <PageHeader
          title="Dashboard"
          description="Packages, ecosystems, and findings from your latest completed scan, plus any scan still running."
        />
        <Button onClick={() => navigate('/scan')} className="shrink-0">
          <Scan className="mr-1.5 h-4 w-4" />
          New scan
        </Button>
      </div>

      {!loading && scans.length === 0 ? (
        <EmptyState onScan={() => navigate('/scan')} />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatsCard
              title="Packages"
              value={totalPackages}
              icon={<Package className="h-4 w-4" />}
            />
            <StatsCard
              title="Ecosystems"
              value={ecosystems}
              icon={<Layers className="h-4 w-4" />}
            />
            <StatsCard
              title="Findings"
              value={findingsCount}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>

          {/* Running now */}
          {runningScans.length > 0 && (
            <section className="space-y-3">
              <h2 className="overline">Running now</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {runningScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3"
                  >
                    <ScanPulseRing />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/results/${scan.id}`)}
                        className="w-full text-left"
                      >
                        <p className="text-sm font-medium">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{scan.id}
                          </span>{' '}
                          <span className="font-mono">{scan.profile}</span>
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {typeof scan.packages_found === 'number' &&
                          scan.packages_found > 0
                            ? `${scan.packages_found.toLocaleString()} packages found so far`
                            : 'discovering packages…'}
                        </p>
                      </button>
                      <ScanSweepBar className="mt-2 h-1 w-full" />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0"
                      onClick={() => deleteScan(scan.id)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Last scan line */}
          {lastScan && (
            <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Last scan{' '}
                <span className="font-mono text-foreground">
                  {new Date(lastScan.timestamp).toLocaleString()}
                </span>{' '}
                · profile{' '}
                <span className="font-mono text-foreground">{lastScan.profile}</span>
              </p>
            </div>
          )}

          {/* Ecosystem chart */}
          {lastScan?.summary?.ecosystem_counts &&
            Object.keys(lastScan.summary.ecosystem_counts).length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Ecosystem distribution
                </h2>
                <div className="mt-4">
                  <EcosystemChart data={lastScan.summary.ecosystem_counts} />
                </div>
              </div>
            )}

          {/* Recent scans */}
          {scans.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium">Recent scans</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">ID</th>
                    <th className="px-4 py-2.5 font-medium">Timestamp</th>
                    <th className="px-4 py-2.5 font-medium">Profile</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.slice(0, 5).map((scan) => (
                    <tr
                      key={scan.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/50"
                      onClick={() => navigate(`/results/${scan.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        #{scan.id}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {new Date(scan.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{scan.profile}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(scan.status)}>{scan.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EmptyState({ onScan }: { onScan: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <Package className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-medium">No scans yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Run your first scan to see results here.
      </p>
      <Button className="mt-6" onClick={onScan}>
        Run first scan
      </Button>
    </div>
  )
}
