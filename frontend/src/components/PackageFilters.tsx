import { Search } from 'lucide-react'
import type { SortKey } from '@/lib/packages'

interface PackageFiltersProps {
  ecosystems: string[]
  search: string
  onSearchChange: (value: string) => void
  ecosystem: string
  onEcosystemChange: (value: string) => void
  sortKey: SortKey
  onSortChange: (value: SortKey) => void
}

export function PackageFilters({
  ecosystems,
  search,
  onSearchChange,
  ecosystem,
  onEcosystemChange,
  sortKey,
  onSortChange,
}: PackageFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search packages…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-56 rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <select
        value={ecosystem}
        onChange={(e) => onEcosystemChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="all">all ecosystems</option>
        {ecosystems.map((eco) => (
          <option key={eco} value={eco}>{eco}</option>
        ))}
      </select>

      <select
        value={sortKey}
        onChange={(e) => onSortChange(e.target.value as SortKey)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="name-asc">Name A→Z</option>
        <option value="name-desc">Name Z→A</option>
        <option value="ecosystem">Ecosystem</option>
        <option value="version">Version</option>
      </select>
    </div>
  )
}
