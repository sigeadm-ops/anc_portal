// Regra da meta de discipulado, compartilhada entre o relatório de validação
// (ValidacaoLancamentos.jsx) e a sincronização automática do desafio anual
// "Discípulo Teen (40% ativos)" (db.syncDiscipuladoDesafio).
//
// Regra definida pela cliente:
// - Conta o aluno que tem ao menos um cartão ATIVADO (com data de início),
//   esteja em andamento ou já concluído. Só deixa de contar se o cartão for
//   apagado do sistema.
// - Meta = 40% dos alunos cadastrados na base (status diferente de Inativo),
//   em pessoas e arredondada para cima: 7 × 40% = 2,8 → 3 alunos.

export const META_PERCENTUAL = 40

// Conta com inteiros para evitar erro de ponto flutuante
// (15 × 0.4 = 6.000000000000001 viraria 7 com Math.ceil).
export function metaEmAlunos(cadastrados) {
  return Math.ceil((cadastrados * META_PERCENTUAL) / 100)
}

export function membroContaNaBase(membro) {
  return String(membro?.Status ?? membro?.status ?? '').toLowerCase() !== 'inativo'
}

export function situacaoCartao(card) {
  if (card?.data_fim) return 'concluido'
  if (card?.data_inicio) return 'andamento'
  return 'pendente'
}

export function isDesafioDiscipulado(desafio) {
  if (!desafio) return false
  if (desafio.codigo === 'discipulo_teen') return true
  return desafio.periodicidade === 'anual' && /disc[ií]pulo/i.test(desafio.nome ?? '')
}

// cadastradosIds: ids dos alunos que contam na base (não inativos)
// cartoes: cartões da base no ano
export function avaliarMetaDiscipulado(cadastradosIds, cartoes) {
  const ids = new Set((cadastradosIds ?? []).map(String))

  // Situação do aluno: "andamento" se tiver algum cartão ativo; senão
  // "concluido" se já encerrou algum; senão "pendente" (sem data de início).
  // Só entram alunos cadastrados na base, para numerador e denominador
  // olharem para o mesmo grupo de pessoas.
  const porAluno = {}
  ;(cartoes ?? []).forEach(card => {
    const id = String(card.membro_id)
    if (!ids.has(id)) return
    const sit = situacaoCartao(card)
    const atual = porAluno[id]
    if (!atual || sit === 'andamento' || (sit === 'concluido' && atual === 'pendente')) porAluno[id] = sit
  })

  const situacoes = Object.values(porAluno)
  const alunosAndamento = situacoes.filter(s => s === 'andamento').length
  const alunosConcluidos = situacoes.filter(s => s === 'concluido').length
  const alunosComCartao = alunosAndamento + alunosConcluidos
  const cadastrados = ids.size
  const metaAlunos = metaEmAlunos(cadastrados)

  return {
    cadastrados,
    alunosAndamento,
    alunosConcluidos,
    alunosComCartao,
    metaAlunos,
    percentual: cadastrados > 0 ? alunosComCartao / cadastrados : 0,
    metaAtingida: cadastrados > 0 && alunosComCartao >= metaAlunos,
  }
}
