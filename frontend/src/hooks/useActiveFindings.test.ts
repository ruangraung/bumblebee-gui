// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type ScanRecord } from '@/lib/api'
import { useScanStore } from '@/stores/scanStore'
import { useActiveFindings } from '@/hooks/useActiveFindings'

// One completed scan whose findings are not cached: the hook fetches them, the
// fetch fails, and clearing the error must retry rather than leave the page
// reading as a scan that matched nothing.
const scan: ScanRecord = {
  id: 5,
  timestamp: '2026-11-16T02:00:00.000Z',
  profile: 'baseline',
  status: 'completed',
  summary: {
    total_packages: 10,
    ecosystems_found: 1,
    findings_count: 0,
    ecosystem_counts: { npm: 10 },
    timed_out: false,
  },
}

describe('useActiveFindings retry after a cleared load error', () => {
  let findingsCalls: number
  let scansCalls: number

  beforeEach(() => {
    findingsCalls = 0
    scansCalls = 0
    vi.spyOn(api, 'listScans').mockImplementation(async () => {
      scansCalls += 1
      return [scan]
    })
    vi.spyOn(api, 'getScanFindings').mockImplementation(async () => {
      findingsCalls += 1
      throw new Error('network gone')
    })
    useScanStore.setState({
      scans: [],
      findingsByScan: {},
      packagesByScan: {},
      error: null,
      loading: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refetches once the error is cleared', async () => {
    renderHook(() => useActiveFindings())

    await waitFor(() => {
      expect(findingsCalls).toBe(1)
    })
    expect(useScanStore.getState().error).toBe('network gone')

    act(() => {
      useScanStore.getState().clearError()
    })

    await waitFor(() => {
      expect(findingsCalls).toBe(2)
    })
  })
})
