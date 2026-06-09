import { create } from 'zustand'

export const useUIStore = create((set) => ({
  error: null,
  showError: (title, message, technicalInfo = null, contactAdmin = false) => {
    set({ error: { title, message, technicalInfo, contactAdmin } })
  },
  clearError: () => set({ error: null }),
}))
