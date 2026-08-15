import { create } from 'zustand'
import {
  api,
  type ScanEvent,
  type ScanRecord,
  type ScanRequest,
  type PackageRecord,
  type FindingRecord,
} from '@/lib/api'

// Per-scan result caches are bounded so a long-lived session cannot grow
// without limit. Oldest entries are evicted first; pages lazily refetch a
// missing scan's results on demand.
const CACHE_LIMIT = 20

// Insertion-order trackers per cache (oldest at the front). Module-level on
// purpose: they are bookkeeping, not reactive state.
let packagesOrder: number[] = []
let findingsOrder: number[] = []

function cacheWrite<T>(
  cache: Record<number, T | undefined>,
  order: number[],
  id: number,
  value: T,
) {
  if (!(id in cache)) {
    order.push(id)
    while (order.length > CACHE_LIMIT) {
      const evicted = order.shift()
      if (evicted !== undefined) delete cache[evicted]
    }
  }
  cache[id] = value
}

function cacheDelete<T>(cache: Record<number, T | undefined>, order: number[], id: number) {
  delete cache[id]
  const idx = order.indexOf(id)
  if (idx !== -1) order.splice(idx, 1)
}

type ScanSet = (
  partial: Partial<ScanState> | ((state: ScanState) => Partial<ScanState>),
) => void

async function fetchScansImpl(silent: boolean, set: ScanSet): Promise<void> {
  if (!silent) set({ loading: true, error: null })
  try {
    const scans = await api.listScans()
    set({ scans, loading: false })
  } catch (err) {
    set({ error: (err as Error).message, loading: false })
  }
}

interface ScanState {
  scans: ScanRecord[]
  currentScan: ScanRecord | null
  /** Per-scan package results, lazily fetched and bounded (CACHE_LIMIT). */
  packagesByScan: Record<number, PackageRecord[] | undefined>
  /** Per-scan findings, lazily fetched and bounded (CACHE_LIMIT). */
  findingsByScan: Record<number, FindingRecord[] | undefined>
  loading: boolean
  error: string | null
  /** Scan ids the user has cancelled; in-flight pollers stop quietly for these. */
  cancelledScanIds: number[]

  fetchScans: () => Promise<void>
  /** Same as fetchScans but never flips `loading` — background refresh without flicker. */
  fetchScansSilent: () => Promise<void>
  /** Polls the scan list while any scan is running/pending; returns a stop fn. */
  pollScanList: (intervalMs?: number) => () => void
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
  packagesByScan: {},
  findingsByScan: {},
  loading: false,
  error: null,
  cancelledScanIds: [],

  fetchScans: async () => {
    await fetchScansImpl(false, set)
  },

  fetchScansSilent: async () => {
    await fetchScansImpl(true, set)
  },

  pollScanList: (intervalMs = 3000) => {
    let stopped = false
    let polls = 0
    // Safety cap (~10 minutes at the default interval): a wedged backend
    // must not keep the dashboard polling forever.
    const maxPolls = 200

    const loop = async () => {
      while (!stopped && polls < maxPolls) {
        polls += 1
        await fetchScansImpl(true, set)
        if (stopped) return
        const active = get().scans.some(
          (s) => s.status === 'running' || s.status === 'pending',
        )
        if (!active) return
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
    }
    void loop()
    return () => {
      stopped = true
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
  // scan's row in `scans` as `packages_found` ticks up, so the UI re-renders
  // without polling. Only the scans[] row is touched — concurrent waits for
  // different scans never clobber each other (or currentScan).
  sseWaitForScan: async (id: number) => {
    const applyProgress = (n?: number) => {
      if (typeof n !== 'number') return
      set({
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
      set((state) => {
        const packagesByScan = { ...state.packagesByScan }
        cacheWrite(packagesByScan, packagesOrder, id, packages)
        return { packagesByScan, loading: false }
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchFindings: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const findings = await api.getScanFindings(id)
      set((state) => {
        const findingsByScan = { ...state.findingsByScan }
        cacheWrite(findingsByScan, findingsOrder, id, findings)
        return { findingsByScan, loading: false }
      })
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
      set((state) => {
        const packagesByScan = { ...state.packagesByScan }
        const findingsByScan = { ...state.findingsByScan }
        cacheDelete(packagesByScan, packagesOrder, id)
        cacheDelete(findingsByScan, findingsOrder, id)
        return {
          scans: state.scans.filter((s) => s.id !== id),
          currentScan: state.currentScan?.id === id ? null : state.currentScan,
          cancelledScanIds: [...state.cancelledScanIds, id],
          packagesByScan,
          findingsByScan,
          loading: false,
        }
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
