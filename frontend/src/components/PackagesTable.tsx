import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PackageRecord } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface PackagesTableProps {
  rows: PackageRecord[]
  page: number
  totalPages: number
  pageNumbers: (number | '...')[]
  range: { start: number; end: number; total: number }
  onPageChange: (page: number) => void
}

export function PackagesTable({
  rows,
  page,
  totalPages,
  pageNumbers,
  range,
  onPageChange,
}: PackagesTableProps) {
  return (
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
          {rows.map((pkg, i) => (
            <tr
              key={`${pkg.package_name}-${pkg.version}-${i}`}
              className="border-b border-border last:border-0 transition-colors hover:bg-accent/40"
            >
              <td className="px-4 py-2.5 font-mono text-[13px] font-medium">{pkg.package_name}</td>
              <td className="px-4 py-2.5">
                <Badge variant="neutral" className="font-mono">{pkg.ecosystem}</Badge>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{pkg.version}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{pkg.source_type ?? 'n/a'}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{pkg.project_path ?? 'n/a'}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{pkg.confidence ?? 'n/a'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination
        page={page}
        totalPages={totalPages}
        pageNumbers={pageNumbers}
        range={range}
        onPageChange={onPageChange}
      />
    </div>
  )
}

type PaginationProps = Omit<PackagesTableProps, 'rows'>

function Pagination({ page, totalPages, pageNumbers, range, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <span className="font-mono text-xs text-muted-foreground">
        {range.start}–{range.end} / {range.total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
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
              onClick={() => onPageChange(p as number)}
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
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
