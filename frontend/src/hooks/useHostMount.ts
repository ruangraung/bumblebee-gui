import { useEffect, useState } from 'react'

import { api, type HostMountReport } from '@/lib/api'

// The mount cannot change while the stack runs, so this reads it once. Null
// covers both "not loaded yet" and "could not load": the notice renders nothing
// in either case rather than claiming the mount is absent.
export function useHostMount(): HostMountReport | null {
  const [report, setReport] = useState<HostMountReport | null>(null)

  useEffect(() => {
    let live = true
    api
      .hostDirectories()
      .then((value) => live && setReport(value))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  return report
}
