// Regras compartilhadas do ranking: faixas de classificação e ordenação.
// Usadas pela página de Ranking e pelo telão de premiação (Pódio).

export function normalizeBaseName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function getTier(score, isSoul = false) {
  if (score >= 1400) return { nome: 'Sou Mega',    cor: '#FFD700', bg: isSoul ? 'rgba(141,82,0,.15)' : 'rgba(255,215,0,.15)',   icon: '🥇' }
  if (score >= 850)  return { nome: 'Sou Master',  cor: isSoul ? '#757575' : '#C0C0C0', bg: isSoul ? 'rgba(117,117,117,.13)' : 'rgba(192,192,192,.13)', icon: '🥈' }
  if (score >= 500)  return { nome: 'Tô Dentro',   cor: isSoul ? '#92400E' : '#CD7F32', bg: isSoul ? 'rgba(146,64,14,.13)' : 'rgba(205,127,50,.13)',  icon: '🥉' }
  if (score >= 200)  return { nome: 'Faço Parte',  cor: isSoul ? '#5B21B6' : '#7B68EE', bg: isSoul ? 'rgba(91,33,182,.13)' : 'rgba(123,104,238,.13)', icon: '⭐' }
  return         { nome: 'Participando', cor: '#6B7280', bg: 'rgba(107,114,128,.1)',  icon: '🚩' }
}

export const TIERS_ORDER = [
  { min: 1400, max: Infinity, nome: 'Sou Mega',    cor: '#FFD700', icon: '🥇' },
  { min: 850,  max: 1399,    nome: 'Sou Master',  cor: '#C0C0C0', icon: '🥈' },
  { min: 500,  max: 849,     nome: 'Tô Dentro',   cor: '#CD7F32', icon: '🥉' },
  { min: 200,  max: 499,     nome: 'Faço Parte',  cor: '#7B68EE', icon: '⭐' },
  { min: 0,    max: 199,     nome: 'Participando', cor: '#6B7280', icon: '🚩' },
]

export function compareNome(a, b) {
  return String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR', { sensitivity: 'base' })
}

// Ordena por nome ou por pontuação (maior → menor, empate por nome) e
// atribui a colocação com empate compartilhado (1º, 2º, 2º, 4º…).
export function ordenarItens(lista, ordem) {
  const ordenados = [...lista].sort((a, b) =>
    ordem === 'pontuacao' ? (b.pontos - a.pontos) || compareNome(a, b) : compareNome(a, b)
  )
  let posAnterior = 0
  return ordenados.map((item, idx) => {
    const posicao = idx > 0 && ordenados[idx - 1].pontos === item.pontos ? posAnterior : idx + 1
    posAnterior = posicao
    return { ...item, posicao }
  })
}
