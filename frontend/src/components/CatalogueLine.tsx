import { useCatalogueSummary } from '@/hooks/useCatalogueSummary'
import { catalogueLine } from '@/lib/catalogue'

// What a scan was measured against, under the result it belongs to. An absent
// catalogue is the one case that cannot find anything, so it gets the warning
// colour rather than the muted one.
export function CatalogueLine() {
  const summary = useCatalogueSummary()
  const line = catalogueLine(summary)
  if (!line) return null

  return (
    <p
      className={
        summary?.available === false
          ? 'text-xs text-amber-600 dark:text-amber-400'
          : 'text-xs text-muted-foreground'
      }
    >
      {line}
    </p>
  )
}
