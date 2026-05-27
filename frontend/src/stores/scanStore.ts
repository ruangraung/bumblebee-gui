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

  fetchScans: () => Promise<void>
  fetchScan: (id: number) => Promise<void>
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
        loading: false,
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
