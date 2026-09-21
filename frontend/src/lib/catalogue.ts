import type { CatalogueSummary } from '@/lib/api'

// The receipt behind a scan result: what the scanner actually compared against.
// This belongs beside a result that found nothing, because "no matches" reads
// as a clean bill of health until you know what it was measured against.
export function catalogueLine(summary: CatalogueSummary | null): string {
  if (!summary) return ''

  if (!summary.available) {
    return 'No exposure catalogues are installed in this image, so a scan cannot report a match.'
  }

  const versions = summary.versions.toLocaleString('en-US')
  return `Compared against ${versions} package versions in ${summary.catalogues} bundled catalogues, by exact package name and version rather than by CVE.`
}
