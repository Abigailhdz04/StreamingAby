import { create } from 'zustand'

interface AppState {
  darkMode: boolean
  sidebarOpen: boolean
  toggleDarkMode: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  darkMode: false,
  sidebarOpen: true,

  toggleDarkMode: () =>
    set((state) => ({
      darkMode: !state.darkMode,
    })),

  setSidebarOpen: (open) =>
    set({
      sidebarOpen: open,
    }),
}))