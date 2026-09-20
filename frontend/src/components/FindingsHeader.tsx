import { PageHeader } from '@/components/PageHeader'

// The findings title block, in one place: it appeared three times in the page,
// once per render branch.
export function FindingsHeader() {
  return (
    <PageHeader
      title="Findings"
      description="Packages matched against your exposure catalog, ranked by severity."
    />
  )
}
