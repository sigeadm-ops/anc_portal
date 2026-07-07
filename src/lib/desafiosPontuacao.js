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

// Uma prova "bônus" (ex.: "Prova Bônus - ID7 - Abril") soma seu valor
// diretamente à média do trimestre, sem entrar na divisão pelo nº de
// provas esperadas — não deve puxar a média pra baixo por não ser uma
// prova regular do calendário.
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
