// ── Detecção de lançamentos duplicados ──────────────────────────
// Duplicidade = mesma base + mesma criança + mesmo registro de prova,
// mesmo que os demais dados (nota, observação etc.) sejam diferentes.
// O lançamento mais recente recebe um vermelho mais intenso que os
// lançamentos anteriores, para facilitar a correção rápida.

const COR_BASE = '255, 77, 109' // var(--bad) em rgb

export function marcarDuplicados(itens, { keyOf, timeOf, dataOf }) {
  const grupos = new Map()

  itens.forEach(item => {
    const chave = keyOf(item)
    if (!chave) return
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(item)
  })

  return itens.map(item => {
    const chave = keyOf(item)
    const grupo = chave ? grupos.get(chave) : null

    if (!grupo || grupo.length < 2) {
      return { ...item, isDuplicado: false, duplicidadeIntensidade: 0, duplicidadeTotal: 1, duplicidadeMaisRecente: false }
    }

    const ordenado = [...grupo].sort((a, b) => {
      const ta = String(timeOf(a) || dataOf(a) || '')
      const tb = String(timeOf(b) || dataOf(b) || '')
      return ta.localeCompare(tb)
    })

    const idx = ordenado.indexOf(item)
    const total = ordenado.length
    // Escala de 0.22 (mais antigo) a 0.62 (mais recente) — visível mas
    // sem esconder o texto da linha.
    const intensidade = total > 1 ? 0.22 + (idx / (total - 1)) * 0.40 : 0

    return {
      ...item,
      isDuplicado: true,
      duplicidadeIntensidade: intensidade,
      duplicidadeTotal: total,
      duplicidadeMaisRecente: idx === total - 1,
    }
  })
}

export function corDuplicidade(intensidade) {
  if (!intensidade) return undefined
  return `rgba(${COR_BASE}, ${intensidade.toFixed(2)})`
}
