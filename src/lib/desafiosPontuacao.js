// Funções de pontuação compartilhadas entre Ranking.jsx e Desafios.jsx.
// Extraídas para um único lugar para evitar que as duas telas fiquem
// divergentes quando a regra de negócio muda (já aconteceu antes).

export function gerarSabados(primeiro, ultimo) {
  const sabados = []
  let d = new Date(primeiro + 'T12:00:00')
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  const fim = new Date(ultimo + 'T12:00:00')
  while (d <= fim) {
    sabados.push(d.toISOString().slice(0, 10))
    d = new Date(d)
    d.setDate(d.getDate() + 7)
  }
  return sabados
}

// Nº de meses distintos cobertos pelos sábados de um trimestre.
// Usado como divisor para desafios/provas de cadência mensal (ex.: Soul+,
// que só tem 1 prova por mês, ao contrário do G148 que tem 1 por semana).
export function contarMesesDistintos(sabados) {
  return new Set((sabados ?? []).map((s) => String(s).slice(0, 7))).size
}

// Divisor de pontuação para um desafio de rastreamento 'semanal' num trimestre:
// - cadência 'mensal': nº de meses do trimestre (~3) — desafio que só pode
//   acontecer 1x/mês de verdade
// - cadência 'semanal' (padrão, inclui Assiduidade/Comunhão do Soul+, que têm
//   lançamento em todo sábado — "Registro Semanal" ou "Prova"): nº de
//   sábados do trimestre (~13)
export function divisorCadencia(desafio, sabadosTrimestre) {
  if (desafio?.cadencia === 'mensal') {
    return contarMesesDistintos(sabadosTrimestre) || 1
  }
  return sabadosTrimestre.length || 1
}

// Uma prova "bônus" (ex.: "Prova Bônus - ID7 - Abril") não é uma prova
// regular do calendário: conta À PARTE — a nota não entra na média (nem na
// soma, nem no nº de provas previstas) e é somada por fora onde há pontuação.
export function isProvaBonus(titulo) {
  const t = String(titulo ?? '')
  return /b[ôo]nus/i.test(t) || /\bid\s*\d+\b/i.test(t)
}

// No Soul+ cada sábado tem um lançamento — "Registro Semanal" (só
// Comunhão/Verso/Discipulado/300, sem nota) ou "NN Prova Soul+" (com nota,
// 1x/mês). Só o segundo tipo conta pra média de notas do aluno.
export function isProvaTitulo(titulo) {
  return /prova/i.test(String(titulo ?? ''))
}

// ── Média de notas ──────────────────────────────────────────────
// Regra: média = soma das notas das provas regulares do aluno no período
// (bônus fica de fora, conta à parte) ÷ nº de provas PREVISTAS para o período
// — e não pelo nº de notas que o aluno tem lançadas. Prova não feita conta
// como zero.

const isTipoSoul = (tipo) => /soul/i.test(String(tipo ?? ''))

// Sábados de referência do período [inicio, fim] (ISO). Havendo trimestres
// configurados para o(s) ano(s) do período, só contam os sábados dentro de
// algum trimestre (ex.: 2026 = 6 + 13 + 13 + 13 = 45).
function sabadosDeReferencia(inicio, fim, trimestresConfig) {
  if (!inicio || !fim || inicio > fim) return []
  const sabados = gerarSabados(inicio, fim)
  const cfgs = (trimestresConfig ?? []).filter((tc) =>
    tc.primeiro_sabado && tc.ultimo_sabado &&
    String(tc.primeiro_sabado).slice(0, 4) <= fim.slice(0, 4) &&
    String(tc.ultimo_sabado).slice(0, 4) >= inicio.slice(0, 4)
  )
  if (!cfgs.length) return sabados
  return sabados.filter((s) => cfgs.some((tc) => s >= tc.primeiro_sabado && s <= tc.ultimo_sabado))
}

// Nº de provas previstas (divisor da média) no período [inicio, fim]:
// - G148 Teen: uma prova por sábado de referência.
// - Soul+: só os sábados com "NN Prova Soul+" programada no cadastro de
//   Provas (ex.: 11 no ano de 2026). Sem cadastro carregado, cai no nº de
//   meses do período (1 prova/mês).
export function provasPrevistas({ tipo, inicio, fim, trimestresConfig = [], provas = [] }) {
  if (!inicio || !fim || inicio > fim) return 0
  if (!isTipoSoul(tipo)) return sabadosDeReferencia(inicio, fim, trimestresConfig).length

  const datasProvaSoul = (provas ?? [])
    .filter((p) => {
      const nome = p.Provas ?? p.nome
      return isTipoSoul(p.Tipo ?? p.tipo) && isProvaTitulo(nome) && !isProvaBonus(nome)
    })
    .map((p) => String(p.Data ?? p.data ?? '').slice(0, 10))
    .filter(Boolean)
  if (!datasProvaSoul.length) {
    return contarMesesDistintos(sabadosDeReferencia(inicio, fim, trimestresConfig))
  }
  return new Set(datasProvaSoul.filter((d) => d >= inicio && d <= fim)).size
}

// Como a média passa a ser soma ÷ divisor fixo, um lançamento duplicado
// (mesmo aluno + mesma prova) inflaria a soma. Mantém só o mais recente de
// cada chave; linhas sem chave (keyOf → null) são todas mantidas.
export function descartarNotasDuplicadas(rows, { keyOf, ordemOf }) {
  const maisRecente = new Map()
  rows.forEach((row) => {
    const chave = keyOf(row)
    if (!chave) return
    const atual = maisRecente.get(chave)
    if (!atual || String(ordemOf(row) ?? '') >= String(ordemOf(atual) ?? '')) maisRecente.set(chave, row)
  })
  return rows.filter((row) => {
    const chave = keyOf(row)
    return !chave || maisRecente.get(chave) === row
  })
}

// Desafio anual de batismo: marcado só pelo sistema (db.syncBatismoDesafio)
// quando a base registra um batismo na aba Batismos. Vale uma vez no ano —
// batismos seguintes não somam mais pontos.
export function isDesafioBatismo(desafio) {
  return Boolean(desafio) && desafio.periodicidade === 'anual' && /batismo/i.test(desafio.nome ?? '')
}
