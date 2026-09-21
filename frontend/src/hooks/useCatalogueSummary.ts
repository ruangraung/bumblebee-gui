import { useEffect, useState } from 'react'

import { api, type CatalogueSummary } from '@/lib/api'

// The bundled catalogues do not change while the image runs, so this reads them
// once. Null covers both "not loaded" and "could not load": the line renders
// nothing rather than naming a denominator it does not have.
export function useCatalogueSummary(): CatalogueSummary | null {
  const [summary, setSummary] = useState<CatalogueSummary | null>(null)

  useEffect(() => {
    let live = true
    api
      .exposureCatalogue()
      .then((value) => live && setSummary(value))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  return summary
}
