import { useCallback, useEffect, useState } from 'react'

import { api, type HostMountReport } from '@/lib/api'

export interface HostBrowser {
  report: HostMountReport | null
  failed: boolean
  at: (path?: string) => void
}

// Reading the mount one directory at a time. An undefined path means the mount
// root, which is the same request the mount notice makes.
export function useHostBrowser(): HostBrowser {
  const [path, setPath] = useState<string | undefined>(undefined)
  const [report, setReport] = useState<HostMountReport | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    api
      .hostDirectories(path)
      .then((value) => {
        if (!live) return
        setReport(value)
        setFailed(false)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [path])

  const at = useCallback((next?: string) => setPath(next), [])

  return { report, failed, at }
}
