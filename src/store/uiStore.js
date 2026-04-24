import { create } from 'zustand'

export const useUIStore = create((set) => ({
  error: null,
  showError: (title, message, technicalInfo = null) => {
    set({ error: { title, message, technicalInfo } })
  },
  clearError: () => set({ error: null }),
}))
