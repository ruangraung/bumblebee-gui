import { create } from 'zustand'
import { api } from '@/lib/api'

// The session cookie is HttpOnly, so the client cannot read it. Auth state is
// therefore derived from the /api/session probe rather than from any cookie or
// stored token; the token itself is only ever sent once, to log in.
interface AuthState {
  checked: boolean
  authRequired: boolean
  authenticated: boolean
  error: string | null
  check: () => Promise<void>
  login: (token: string) => Promise<boolean>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  checked: false,
  authRequired: false,
  authenticated: false,
  error: null,

  check: async () => {
    try {
      const status = await api.sessionStatus()
      set({
        checked: true,
        authRequired: status.auth_required,
        authenticated: status.authenticated,
        error: null,
      })
    } catch (err) {
      set({ checked: true, error: (err as Error).message })
    }
  },

  login: async (token) => {
    try {
      await api.login(token)
      const status = await api.sessionStatus()
      set({
        authRequired: status.auth_required,
        authenticated: status.authenticated,
        error: null,
      })
      return status.authenticated
    } catch (err) {
      set({ error: (err as Error).message })
      return false
    }
  },

  logout: async () => {
    await api.logout()
    set({ authenticated: false })
  },
}))
