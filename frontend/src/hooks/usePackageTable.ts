import { useEffect, useMemo, useState } from 'react'
import type { PackageRecord } from '@/lib/api'
import {
  buildPageNumbers,
  filterAndSortPackages,
  getEcosystems,
  pageCount,
  pageRange,
  paginate,
  type SortKey,
} from '@/lib/packages'

// Search, ecosystem filter, sort order and page cursor over one scan's
// packages, plus every derived list the table renders.
export function usePackageTable(packages: PackageRecord[]) {
  const [search, setSearch] = useState('')
  const [ecosystemFilter, setEcosystemFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name-asc')
  const [page, setPage] = useState(1)

  // Changing the query or the sort order invalidates the cursor.
  useEffect(() => {
    setPage(1)
  }, [search, ecosystemFilter, sortKey])

  const ecosystems = useMemo(() => getEcosystems(packages), [packages])

  const filtered = useMemo(
    () => filterAndSortPackages(packages, { search, ecosystem: ecosystemFilter, sortKey }),
    [packages, search, ecosystemFilter, sortKey],
  )

  const totalPages = pageCount(filtered.length)
  const paged = useMemo(() => paginate(filtered, page), [filtered, page])
  const range = pageRange(filtered.length, page)
  const pageNumbers = useMemo(() => buildPageNumbers(totalPages, page), [totalPages, page])

  return {
    search,
    setSearch,
    ecosystemFilter,
    setEcosystemFilter,
    sortKey,
    setSortKey,
    page,
    setPage,
    ecosystems,
    filtered,
    totalPages,
    paged,
    pageStart: range.start,
    pageEnd: range.end,
    pageNumbers,
  }
}
