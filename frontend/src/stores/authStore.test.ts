import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useAuthStore } from './authStore'

beforeEach(() => {
  useAuthStore.setState({ checked: false, authRequired: false, authenticated: false, error: null })
})
afterEach(() => vi.unstubAllGlobals())

test('check reads the session status from the API', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ auth_required: true, authenticated: false }) })
  vi.stubGlobal('fetch', fetch)
  await useAuthStore.getState().check()
  expect(fetch).toHaveBeenCalledWith('/api/session', expect.anything())
  const state = useAuthStore.getState()
  expect(state.checked).toBe(true)
  expect(state.authRequired).toBe(true)
  expect(state.authenticated).toBe(false)
})

test('login posts the token header then re-reads the session status', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ auth_required: true, authenticated: true }) })
  vi.stubGlobal('fetch', fetch)
  const ok = await useAuthStore.getState().login('lab-secret')
  expect(ok).toBe(true)
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    '/api/session',
    expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-Bumblebee-Token': 'lab-secret' }) }),
  )
  expect(useAuthStore.getState().authenticated).toBe(true)
})

test('a rejected login surfaces the error and stays unauthenticated', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'missing or invalid API token' }) }))
  const ok = await useAuthStore.getState().login('wrong')
  expect(ok).toBe(false)
  const state = useAuthStore.getState()
  expect(state.authenticated).toBe(false)
  expect(state.error).toBe('missing or invalid API token')
})

test('logout clears the session cookie and the authenticated flag', async () => {
  useAuthStore.setState({ authenticated: true })
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })
  vi.stubGlobal('fetch', fetch)
  await useAuthStore.getState().logout()
  expect(fetch).toHaveBeenCalledWith('/api/session', expect.objectContaining({ method: 'DELETE' }))
  expect(useAuthStore.getState().authenticated).toBe(false)
})
