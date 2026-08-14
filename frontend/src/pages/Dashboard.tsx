import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Layers, AlertTriangle, Clock, Scan } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { StatsCard } from '@/components/StatsCard'
import { EcosystemChart } from '@/components/EcosystemChart'
import { Button } from '@/components/ui/button'
import { Badge, statusVariant } from '@/components/ui/badge'

export default function Dashboard() {
  const navigate = useNavigate()
  const { fetchScans, scans, loading } = useScanStore()

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  const lastScan = scans.length > 0 ? scans[0] : undefined
  const totalPackages = lastScan?.summary?.total_packages ?? 0
  const ecosystems = lastScan?.summary?.ecosystems_found ?? 0
  const findingsCount = lastScan?.summary?.findings_count ?? 0

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Supply-chain security at a glance.
          </p>
        </div>
        <Button onClick={() => navigate('/scan')}>
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
