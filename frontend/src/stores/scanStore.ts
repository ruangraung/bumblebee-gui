import { create } from 'zustand'
import {
  api,
  type ScanEvent,
  type ScanRecord,
  type ScanRequest,
  type PackageRecord,
  type FindingRecord,
} from '@/lib/api'

interface ScanState {
  scans: ScanRecord[]
  currentScan: ScanRecord | null
  packages: PackageRecord[]
  findings: FindingRecord[]
  loading: boolean
  error: string | null
  /** Scan ids the user has cancelled; in-flight pollers stop quietly for these. */
  cancelledScanIds: number[]

  fetchScans: () => Promise<void>
  fetchScan: (id: number) => Promise<void>
  waitForScan: (id: number, intervalMs?: number) => Promise<ScanRecord | null>
  sseWaitForScan: (id: number) => Promise<ScanRecord | null>
  pollWaitForScan: (id: number, intervalMs?: number) => Promise<ScanRecord | null>
  fetchPackages: (id: number) => Promise<void>
  fetchFindings: (id: number) => Promise<void>
  createScan: (request: ScanRequest) => Promise<ScanRecord>
  deleteScan: (id: number) => Promise<void>
  clearError: () => void
}

export const useScanStore = create<ScanState>((set, get) => ({
  scans: [],
  currentScan: null,
  packages: [],
  findings: [],
  loading: false,
  error: null,
  cancelledScanIds: [],

  fetchScans: async () => {
    set({ loading: true, error: null })
    try {
      const scans = await api.listScans()
      set({ scans, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchScan: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const currentScan = await api.getScan(id)
      set({ currentScan, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  // Polling fallback: the original 2s-poll loop, used when SSE is unavailable.
  pollWaitForScan: async (id: number, intervalMs = 2000) => {
    // Poll until the scan reaches a terminal state (completed/failed).
    // Caps at ~30 minutes to avoid polling forever on a wedged backend.
    for (let attempt = 0; attempt < 900; attempt += 1) {
      if (get().cancelledScanIds.includes(id)) {
        // The user cancelled this scan — stop polling quietly.
        return null
      }
      try {
        const scan = await api.getScan(id)
        set({
          currentScan: scan,
          scans: get().scans.map((s) => (s.id === id ? scan : s)),
        })
        if (scan.status === 'completed' || scan.status === 'failed') {
          return scan
        }
      } catch (err) {
        if (get().cancelledScanIds.includes(id)) {
          // The scan was deleted (cancelled) between polls — not an error.
          return null
        }
        set({ error: (err as Error).message })
        throw err
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error(`Scan ${id} did not complete within 30 minutes`)
  },

  // SSE-first wait: subscribes to the scan's event stream and resolves on a
  // terminal event (completed/failed/cancelled). Live progress updates the
  // store as `packages_found` ticks up, so the UI re-renders without polling.
  sseWaitForScan: async (id: number) => {
    const applyProgress = (n?: number) => {
      if (typeof n !== 'number') return
      const current = get().currentScan
      set({
        currentScan: current ? { ...current, packages_found: n } : null,
        scans: get().scans.map((s) => (s.id === id ? { ...s, packages_found: n } : s)),
      })
    }

    return await new Promise<ScanRecord | null>((resolve, reject) => {
      const es = new EventSource(api.scanEventsUrl(id))
      let gotMessage = false

      const finishWithFetch = () => {
        es.close()
        api.getScan(id)
          .then((scan) => {
            set({
              currentScan: scan,
              scans: get().scans.map((s) => (s.id === id ? scan : s)),
            })
            resolve(scan)
          })
          .catch(reject)
      }

      es.addEventListener('snapshot', (e) => {
        gotMessage = true
        const data = JSON.parse((e as MessageEvent).data) as ScanEvent
        if (data.status === 'completed' || data.status === 'failed') {
          // Already terminal on connect — grab the final record.
          finishWithFetch()
        } else {
          applyProgress(data.packages_found)
        }
      })

      es.addEventListener('progress', (e) => {
        gotMessage = true
        const data = JSON.parse((e as MessageEvent).data) as ScanEvent
        applyProgress(data.packages_found)
      })

      es.addEventListener('completed', () => {
        gotMessage = true
        finishWithFetch()
      })

      es.addEventListener('failed', () => {
        gotMessage = true
        finishWithFetch()
      })

      es.addEventListener('cancelled', () => {
        es.close()
        resolve(null)
      })

      es.onerror = () => {
        if (!gotMessage) {
          // Couldn't connect to the event stream — fall back to polling.
          es.close()
          reject(new Error('SSE connection failed'))
        }
        // Otherwise EventSource auto-reconnects; transient drops are ignored.
      }
    })
  },

  waitForScan: async (id: number, intervalMs = 2000) => {
    // Prefer live push (SSE); fall back to polling if unavailable.
    if (typeof EventSource !== 'undefined') {
      try {
        return await get().sseWaitForScan(id)
      } catch {
        // Fall through to polling below.
      }
    }
    return get().pollWaitForScan(id, intervalMs)
  },

  fetchPackages: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const packages = await api.getScanPackages(id)
      set({ packages, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchFindings: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const findings = await api.getScanFindings(id)
      set({ findings, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  createScan: async (request: ScanRequest) => {
    set({ loading: true, error: null })
    try {
      const scan = await api.createScan(request)
      set({ scans: [scan, ...get().scans], loading: false })
      return scan
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
      throw err
    }
  },

  deleteScan: async (id: number) => {
    set({ loading: true, error: null })
    try {
      await api.deleteScan(id)
      set({
        scans: get().scans.filter((s) => s.id !== id),
        currentScan: get().currentScan?.id === id ? null : get().currentScan,
        cancelledScanIds: [...get().cancelledScanIds, id],
        loading: false,
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
