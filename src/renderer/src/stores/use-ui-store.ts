import { create } from 'zustand'

export interface UiStore {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'
  actions: {
    toggleSidebar: () => void
    setTheme: (theme: 'light' | 'dark' | 'system') => void
  }
}

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  theme: 'system',
  actions: {
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setTheme: (theme) => set({ theme })
  }
}))
