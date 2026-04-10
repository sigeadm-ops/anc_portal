// ================================================================
// SheetsAPI — espelhamento para Google Sheets via Apps Script
// Mantido para manter compatibilidade com o backend existente.
// O Supabase é o banco principal; Sheets é espelho opcional.
// ================================================================

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || ''

async function _req(payload) {
  if (!APPS_SCRIPT_URL) return { ok: false, error: 'Apps Script URL não configurada' }
  try {
    const url = APPS_SCRIPT_URL + '?d=' + encodeURIComponent(JSON.stringify(payload))
    const res = await fetch(url)
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return await res.json()
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export const SheetsAPI = {
  get configured() { return !!APPS_SCRIPT_URL },

  async ping() {
    try {
      const r = await _req({ action: 'ping' })
      return r.ok === true
    } catch { return false }
  },

  async insert(sheet, data) {
    return _req({ action: 'insert', sheet, data })
  },

  async update(sheet, data) {
    return _req({ action: 'update', sheet, data })
  },

  async delete(sheet, id) {
    return _req({ action: 'delete', sheet, data: { id } })
  },

  async getAll(sheet) {
    const r = await _req({ action: 'get_all', sheet })
    return r.ok ? r.data : null
  },

  // Espelha uma operação do Supabase no Sheets (fire-and-forget)
  async mirror(action, sheet, data) {
    try {
      await _req({ action, sheet, data })
    } catch {
      // Espelhamento silencioso — não bloqueia operação principal
    }
  },
}
