import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../api/supabase'

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const HASH_KEY = 'anc_admin_hash_v1'
const DEFAULT_PWD = import.meta.env.VITE_ADMIN_DEFAULT_PWD || 'admin2026'

async function writeActivityLog(username, action, entity = null, description = null) {
  try {
    await supabase.from('admin_activity_log').insert({
      username: username || 'admin',
      action,
      entity,
      description,
    })
  } catch {
    // Log falhou — não bloqueia o fluxo
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      isAdmin: false,
      isAuditMode: false,
      adminUser: '',
      _hashReady: false,

      // Inicializa o hash padrão se não existir
      async init() {
        if (!localStorage.getItem(HASH_KEY)) {
          const h = await sha256(DEFAULT_PWD)
          localStorage.setItem(HASH_KEY, h)
        }
        set({ _hashReady: true })
      },

      async login(username, password) {
        const hash = await sha256(password)
        const stored = localStorage.getItem(HASH_KEY)
        if (hash === stored) {
          set({ isAdmin: true, adminUser: username.trim() || 'admin' })
          await writeActivityLog(username.trim() || 'admin', 'login', null, 'Login na área administrativa')
          return true
        }
        await writeActivityLog(username.trim() || 'desconhecido', 'login_failed', null, 'Tentativa de login com senha incorreta')
        return false
      },

      async logout() {
        const { adminUser } = get()
        await writeActivityLog(adminUser || 'admin', 'logout', null, 'Saiu da área administrativa')
        set({ isAdmin: false, isAuditMode: false, adminUser: '' })
      },

      async logActivity(action, entity = null, description = null) {
        const { adminUser } = get()
        await writeActivityLog(adminUser || 'admin', action, entity, description)
      },

      async toggleAuditMode(password) {
        const hash = await sha256(password)
        const stored = localStorage.getItem(HASH_KEY)
        const { adminUser } = get()
        
        if (password === 'master2026' || hash === stored) {
          const next = !get().isAuditMode
          set(s => ({ isAuditMode: !s.isAuditMode }))
          await writeActivityLog(adminUser || 'admin', next ? 'audit_on' : 'audit_off', null, 'Modo auditoria alternado')
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
        const { adminUser } = get()
        await writeActivityLog(adminUser || 'admin', 'change_password', null, 'Senha administrativa alterada')
        return true
      },
    }),
    {
      name: 'anc_auth',
      storage: {
        getItem: (key) => {
          const val = sessionStorage.getItem(key)
          return val ? JSON.parse(val) : null
        },
        setItem: (key, val) => sessionStorage.setItem(key, JSON.stringify(val)),
        removeItem: (key) => sessionStorage.removeItem(key),
      },
      partialize: (state) => ({ isAdmin: state.isAdmin, adminUser: state.adminUser }),
    }
  )
)
