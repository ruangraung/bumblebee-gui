import { Search } from 'lucide-react'
import { severityLabel } from '@/lib/severity'

interface FindingsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  severities: string[]
  severity: string
  onSeverityChange: (value: string) => void
  ecosystems: string[]
  ecosystem: string
  onEcosystemChange: (value: string) => void
}

const CONTROL_CLASS =
  'h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FindingsFilters({
  search,
  onSearchChange,
  severities,
  severity,
  onSeverityChange,
  ecosystems,
  ecosystem,
  onEcosystemChange,
}: FindingsFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search findings…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-56 rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <select value={severity} onChange={(e) => onSeverityChange(e.target.value)} className={CONTROL_CLASS}>
        <option value="all">all severities</option>
        {severities.map((s) => (
          <option key={s} value={s}>
            {severityLabel(s)}
          </option>
        ))}
      </select>

      <select
        value={ecosystem}
        onChange={(e) => onEcosystemChange(e.target.value)}
        className={`${CONTROL_CLASS} font-mono`}
      >
        <option value="all">all ecosystems</option>
        {ecosystems.map((eco) => (
          <option key={eco} value={eco}>
            {eco}
          </option>
        ))}
      </select>
    </div>
  )
}
