import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Vertical } from '../types/device'

type ActiveVertical = 'all' | Vertical

interface AppState {
  activeVertical: ActiveVertical
  selectedOrgId: string
  sidebarCollapsed: boolean
  user: { email: string; role: string; orgId: string } | null
  token: string | null
  setVertical: (v: ActiveVertical) => void
  setOrg: (id: string) => void
  toggleSidebar: () => void
  setUser: (user: AppState['user'], token: string) => void
  logout: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeVertical: 'all',
      selectedOrgId: '',
      sidebarCollapsed: false,
      user: null,
      token: null,
      setVertical: (v) => set({ activeVertical: v }),
      setOrg: (id) => set({ selectedOrgId: id }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setUser: (user, token) => {
        set({ user, token, selectedOrgId: user?.orgId ?? '' })
        if (token) localStorage.setItem('token', token)
      },
      logout: () => {
        set({ user: null, token: null })
        localStorage.removeItem('token')
      },
    }),
    { name: 'ruwi-app' },
  ),
)
