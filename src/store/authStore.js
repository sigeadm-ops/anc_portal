import { create } from 'zustand'
import { persist } from 'zustand/middleware'

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const HASH_KEY = 'anc_admin_hash_v1'
const DEFAULT_PWD = import.meta.env.VITE_ADMIN_DEFAULT_PWD || 'admin2026'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      isAdmin: false,
      isAuditMode: false,
      _hashReady: false,

      // Inicializa o hash padrão se não existir
      async init() {
        if (!localStorage.getItem(HASH_KEY)) {
          const h = await sha256(DEFAULT_PWD)
          localStorage.setItem(HASH_KEY, h)
        }
        set({ _hashReady: true })
      },

      async login(password) {
        const hash = await sha256(password)
        const stored = localStorage.getItem(HASH_KEY)
        if (hash === stored) {
          set({ isAdmin: true })
          return true
        }
        return false
      },

      logout() {
        set({ isAdmin: false, isAuditMode: false })
      },

      async toggleAuditMode(password) {
        // Senha mestre para auditoria (pode ser diferente da admin)
        // Por padrão, vamos usar a mesma, mas preparada para ser MASTER_PWD
        const hash = await sha256(password)
        const stored = localStorage.getItem(HASH_KEY) // Aqui poderíamos usar um MASTER_HASH_KEY
        
        // Para o usuário, a "master password" solicitada
        if (password === 'master2026' || hash === stored) {
          set(s => ({ isAuditMode: !s.isAuditMode }))
          return true
        }
        return false
      },

      async changePassword(currentPwd, newPwd) {
        const curHash = await sha256(currentPwd)
        const stored = localStorage.getItem(HASH_KEY)
        if (curHash !== stored) return false
        const newHash = await sha256(newPwd)
        localStorage.setItem(HASH_KEY, newHash)
        return true
      },
    }),
    {
      name: 'anc_auth',
      // Só persiste isAdmin na sessão via sessionStorage
      storage: {
        getItem: (key) => {
          const val = sessionStorage.getItem(key)
          return val ? JSON.parse(val) : null
        },
        setItem: (key, val) => sessionStorage.setItem(key, JSON.stringify(val)),
        removeItem: (key) => sessionStorage.removeItem(key),
      },
      partialize: (state) => ({ isAdmin: state.isAdmin }),
    }
  )
)
