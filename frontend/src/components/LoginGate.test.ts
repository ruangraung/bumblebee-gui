// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { createElement } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginGate from './LoginGate'
import { useAuthStore } from '@/stores/authStore'

afterEach(() => vi.unstubAllGlobals())

test('submitting the token posts it to the session endpoint', async () => {
  useAuthStore.setState({ checked: true, authRequired: true, authenticated: false, error: null })
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ auth_required: true, authenticated: true }) })
  vi.stubGlobal('fetch', fetch)
  render(createElement(LoginGate))
  fireEvent.change(screen.getByLabelText('API token'), { target: { value: 'lab-secret' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await waitFor(() => expect(useAuthStore.getState().authenticated).toBe(true))
  expect(fetch).toHaveBeenNthCalledWith(1, '/api/session', expect.objectContaining({ method: 'POST' }))
})
