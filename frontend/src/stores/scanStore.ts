import { create } from 'zustand'
import {
  api,
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

  waitForScan: async (id: number, intervalMs = 2000) => {
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
