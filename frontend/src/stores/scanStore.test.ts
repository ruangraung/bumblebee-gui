import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useScanStore } from './scanStore'

beforeEach(() => {
  useScanStore.setState({
    scans: [1, 2, 3].map((id) => ({ id, timestamp: '2026-01-01T00:00:00Z', profile: 'baseline', status: 'completed' })),
    currentScan: { id: 1, timestamp: '2026-01-01T00:00:00Z', profile: 'baseline', status: 'completed' },
    packagesByScan: { 1: [], 2: [], 3: [] },
    findingsByScan: { 1: [], 2: [], 3: [] },
    cancelledScanIds: [],
  })
})
afterEach(() => vi.unstubAllGlobals())

test('bulk deletion invalidates only successfully deleted scan caches', async () => {
  const result = { deleted_ids: [1], failures: [{ id: 2, detail: 'Could not delete scan' }], remaining: 2 }
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => result })
  vi.stubGlobal('fetch', fetch)
  expect(typeof useScanStore.getState().deleteHistory).toBe('function')
  expect(await useScanStore.getState().deleteHistory()).toEqual(result)
  expect(fetch).toHaveBeenCalledWith('/api/scan-history', expect.objectContaining({ method: 'DELETE' }))
  const state = useScanStore.getState()
  expect(state.scans.map((scan) => scan.id)).toEqual([2, 3])
  expect(Object.keys(state.packagesByScan)).toEqual(['2', '3'])
  expect(Object.keys(state.findingsByScan)).toEqual(['2', '3'])
  expect(state.currentScan).toBeNull()
  expect(state.cancelledScanIds).toContain(1)
})

test('failed bulk requests retain cached records and reject to the caller', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Deletion unavailable' }) }))
  expect(typeof useScanStore.getState().deleteHistory).toBe('function')
  await expect(useScanStore.getState().deleteHistory()).rejects.toThrow('Deletion unavailable')
  expect(useScanStore.getState().scans).toHaveLength(3)
  expect(Object.keys(useScanStore.getState().packagesByScan)).toHaveLength(3)
})
