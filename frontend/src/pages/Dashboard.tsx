import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Layers, AlertTriangle, Clock } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { StatsCard } from '@/components/StatsCard'
import { EcosystemChart } from '@/components/EcosystemChart'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const navigate = useNavigate()
  const { fetchScans, scans, loading } = useScanStore()

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  const lastScan = scans.length > 0 ? scans[0] : undefined

  if (!loading && scans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">No scans yet</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          Run your first scan to see results here.
        </p>
        <Button onClick={() => navigate('/scan')}>Run First Scan</Button>
      </div>
    )
  }

  const totalPackages = lastScan?.summary?.total_packages ?? 0
  const ecosystems = lastScan?.summary?.ecosystems_found ?? 0
  const findingsCount = lastScan?.summary?.findings_count ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button onClick={() => navigate('/scan')}>Scan Now</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Packages"
          value={totalPackages}
          icon={<Package className="h-5 w-5" />}
        />
        <StatsCard
          title="Ecosystems"
          value={ecosystems}
          icon={<Layers className="h-5 w-5" />}
        />
        {findingsCount > 0 && (
          <StatsCard
            title="Findings"
            value={findingsCount}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        )}
      </div>

      {lastScan && (
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Last scan: {new Date(lastScan.timestamp).toLocaleString()} &middot;{' '}
            Profile: {lastScan.profile}
          </p>
        </div>
      )}

      {lastScan?.summary?.ecosystems_found &&
        lastScan.summary.ecosystems_found > 0 &&
        lastScan.summary.ecosystem_counts && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Ecosystems</h2>
            <EcosystemChart data={lastScan.summary.ecosystem_counts} />
          </div>
        )}

      {scans.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Recent Scans</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="p-4 font-medium">ID</th>
                <th className="p-4 font-medium">Timestamp</th>
                <th className="p-4 font-medium">Profile</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {scans.slice(0, 5).map((scan) => (
                <tr
                  key={scan.id}
                  className="border-b last:border-0 cursor-pointer hover:bg-accent"
                  onClick={() => navigate(`/results/${scan.id}`)}
                >
                  <td className="p-4">{scan.id}</td>
                  <td className="p-4">
                    {new Date(scan.timestamp).toLocaleString()}
                  </td>
                  <td className="p-4">{scan.profile}</td>
                  <td className="p-4">
                    <span
                      className={
                        scan.status === 'completed'
                          ? 'text-green-600'
                          : scan.status === 'failed'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }
                    >
                      {scan.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
