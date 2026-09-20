import { useMemo, useState } from 'react'
import type { FindingRecord } from '@/lib/api'
import { filterAndSortFindings, getEcosystems } from '@/lib/findings'
import { severitiesPresent } from '@/lib/severity'

// Severity and ecosystem filters plus the search query over one scan's
// findings, with every derived list the page renders.
export function useFindingsTable(findings: FindingRecord[]) {
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [ecosystemFilter, setEcosystemFilter] = useState<string>('all')

  const ecosystems = useMemo(() => getEcosystems(findings), [findings])

  const severities = useMemo(() => severitiesPresent(findings), [findings])

  const filtered = useMemo(
    () =>
      filterAndSortFindings(findings, {
        search: searchQuery,
        severity: severityFilter,
        ecosystem: ecosystemFilter,
      }),
    [findings, searchQuery, severityFilter, ecosystemFilter],
  )

  return {
    searchQuery,
    setSearchQuery,
    severityFilter,
    setSeverityFilter,
    ecosystemFilter,
    setEcosystemFilter,
    ecosystems,
    severities,
    filtered,
  }
}
