// Utilitários gerais (migrados do utils.js original)

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function fmtDate(d) {
  if (!d) return '—'
  const s = String(d).trim()
  if (!s || s === '—') return '—'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) {
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${dt.getFullYear()}`
  }
  return s
}

export function toInputDate(d) {
  if (!d) return ''
  const s = String(d).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const dt = new Date(s)
  if (!isNaN(dt)) return dt.toISOString().slice(0, 10)
  return ''
}

export function nextCode(prefix, list) {
  const nums = list.map(r => {
    const m = String(r.code ?? r.id ?? '').match(/\d+$/)
    return m ? +m[0] : 0
  })
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return prefix + String(next).padStart(3, '0')
}

export function formatCPF(value) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3}\.\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3}\.\d{3}\.\d{3})(\d{1,2})/, '$1-$2')
}

export function chipClass(status) {
  const map = {
    'Ativo': 'chip-good',
    'Inativo': 'chip-muted',
    'Aprovado': 'chip-good',
    'Pendente': 'chip-warn',
    'Rejeitado': 'chip-danger',
    'G148 Teen': 'chip-teen',
    'Soul+': 'chip-soul',
  }
  return map[status] || 'chip-muted'
}
