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

// Pontos no padrão brasileiro: ponto no milhar, vírgula no decimal (1.234,50)
export function fmtPontos(value, casas = 2) {
  const n = Number(value)
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

// Igual a fmtPontos, mas valor inteiro sai sem casas decimais (200 → "200", 12.5 → "12,50")
export function fmtNumero(value, casas = 2) {
  const n = Number(value)
  return Number.isInteger(n) ? fmtPontos(n, 0) : fmtPontos(n, casas)
}

// Número para célula de CSV: vírgula decimal e sem ponto de milhar, que é o
// formato que o Excel pt-BR lê como número.
export function numCSV(value, casas = 2) {
  const n = Number(value)
  return (Number.isFinite(n) ? n : 0).toFixed(casas).replace('.', ',')
}

// Baixa uma lista de objetos como CSV (separador ';' e BOM UTF-8 para o Excel).
// As colunas vêm das chaves da primeira linha.
export function downloadCSV(rows, filename) {
  if (!rows.length) return
  const cel = v => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const colunas = Object.keys(rows[0])
  const csv = '\uFEFF' + [colunas.map(cel).join(';'), ...rows.map(r => colunas.map(c => cel(r[c])).join(';'))].join('\r\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  link.download = filename + '.csv'
  link.click()
  URL.revokeObjectURL(link.href)
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

export function normalizeBaseName(value) {
  return String(value || '').trim().toLowerCase()
}

export function formatBaseId(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'sem-id'
  return `#${raw.slice(-6).toUpperCase()}`
}

export function buildBaseLabel(base, options = {}) {
  const { includeTipo = false, includeId = true } = options
  const nome = String(base?.Base || '').trim() || 'Base sem nome'
  const igreja = String(base?.Igreja_Nome || base?.Igrejas || '').trim() || 'Sem igreja'
  const tipo = String(base?.Tipo || '').trim()

  const parts = [nome, igreja]
  if (includeTipo && tipo) parts.push(tipo)
  if (includeId) parts.push(formatBaseId(base?.id_base))

  return parts.join(' · ')
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function tokenMatches(a, b) {
  if (a === b) return true
  const short = a.length <= b.length ? a : b
  const long = a.length <= b.length ? b : a
  // Abreviação de sobrenome/nome do meio: "r" combina com "rodrigues"
  return short.length === 1 && long.startsWith(short)
}

// Compara dois nomes tolerando abreviações/nomes do meio omitidos, mantendo a ordem
// dos tokens (ex: "Roseane Rodrigues Crispim" ~ "Roseane R Crispim" ~ "Roseane Crispim").
// Exige que o primeiro nome bata exatamente e que ambos tenham ao menos 2 palavras,
// para não gerar falso positivo em primeiros nomes comuns.
export function namesLikelySamePerson(nameA, nameB) {
  const a = normalizeText(nameA).split(' ').filter(Boolean)
  const b = normalizeText(nameB).split(' ').filter(Boolean)
  if (a.length < 2 || b.length < 2) return false
  if (a[0] !== b[0]) return false

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  let li = 1
  for (let si = 1; si < shorter.length; si++) {
    let found = false
    while (li < longer.length) {
      if (tokenMatches(shorter[si], longer[li])) { found = true; li++; break }
      li++
    }
    if (!found) return false
  }
  return true
}

export function findDuplicateBaseGroups(bases, options = {}) {
  const { byTipo = false } = options
  const groups = new Map()

  for (const base of bases || []) {
    const nomeKey = normalizeBaseName(base?.Base)
    const tipoKey = String(base?.Tipo || '').trim()
    if (!nomeKey) continue

    const key = byTipo ? `${tipoKey}::${nomeKey}` : nomeKey
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(base)
  }

  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      nome: String(items[0]?.Base || '').trim(),
      tipo: String(items[0]?.Tipo || '').trim(),
      total: items.length,
      bases: items,
    }))
    .sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo)
      return a.nome.localeCompare(b.nome)
    })
}
