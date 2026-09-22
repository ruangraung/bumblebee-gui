import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { CatalogueSummary, HostMountReport, ScannerInfo } from '@/lib/api'

export interface AboutFacts {
  appVersion: string | null
  scanner: ScannerInfo | null
  catalogues: CatalogueSummary | null
  mount: HostMountReport | null
}

// Everything the About panel states, read from the API on mount. Each fact
// settles on its own, so one endpoint failing leaves that line unread instead of
// blanking the whole panel.
export function useAboutFacts(): AboutFacts {
  const [facts, setFacts] = useState<AboutFacts>({
    appVersion: null,
    scanner: null,
    catalogues: null,
    mount: null,
  })

  useEffect(() => {
    let live = true
    const settle = (patch: Partial<AboutFacts>) => {
      if (live) setFacts((prev) => ({ ...prev, ...patch }))
    }

    api
      .health()
      .then((health) => settle({ appVersion: health.version }))
      .catch(() => {})
    api
      .scanner()
      .then((info) => settle({ scanner: info }))
      .catch(() => {})
    api
      .exposureCatalogue()
      .then((summary) => settle({ catalogues: summary }))
      .catch(() => {})
    api
      .hostDirectories()
      .then((report) => settle({ mount: report }))
      .catch(() => {})

    return () => {
      live = false
    }
  }, [])

  return facts
}
