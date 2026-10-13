import { supabase } from '../api/supabase'
import { useAuthStore } from '../store/authStore'

// ================================================================
// Trava de lançamentos por região (coluna Regiao.bloqueio_lancamentos)
// Enquanto a região está travada, o portal público não grava nada das
// bases dela; o administrativo (isAdmin) continua liberado.
// Liga/desliga em Configurações Gerais → Regiões.
// ================================================================

export class LancamentoBloqueadoError extends Error {
  constructor(nomeRegiao) {
    super(mensagemTravaRegiao(nomeRegiao))
    this.name = 'LancamentoBloqueadoError'
    this.regiao = nomeRegiao
  }
}

export function mensagemTravaRegiao(nomeRegiao) {
  return `Os lançamentos da região ${nomeRegiao || ''} estão travados no momento. Alterações só podem ser feitas pelo administrativo.`.replace(/\s+/g, ' ')
}

export function isLancamentoBloqueado(err) {
  return err?.name === 'LancamentoBloqueadoError'
}

function texto(value) {
  return String(value ?? '').trim()
}

// Lê do banco na hora de gravar (sem cache), pra trava valer assim que o
// admin liga/desliga. Sem a coluna no banco (migração não aplicada), não trava.
async function nomeSeRegiaoTravada(id_regiao) {
  const { data, error } = await supabase
    .from('Regiao')
    .select('id_regiao, Regiao, bloqueio_lancamentos')
    .eq('id_regiao', id_regiao)
    .maybeSingle()
  if (error || !data?.bloqueio_lancamentos) return null
  return data.Regiao || id_regiao
}

async function regiaoDaBase(id_base) {
  const { data } = await supabase
    .from('vw_bases')
    .select('id_regiao')
    .eq('id_base', id_base)
    .maybeSingle()
  return texto(data?.id_regiao)
}

async function regiaoDaIgreja(id_igrejas) {
  const { data: igreja } = await supabase
    .from('Igrejas')
    .select('id_distritos')
    .eq('id_igrejas', id_igrejas)
    .maybeSingle()
  if (!igreja?.id_distritos) return ''
  const { data: distrito } = await supabase
    .from('Distritos')
    .select('id_regiao')
    .eq('id_distritos', igreja.id_distritos)
    .maybeSingle()
  return texto(distrito?.id_regiao)
}

// Lança LancamentoBloqueadoError se alguma das bases/regiões informadas
// estiver numa região travada. Admin nunca é barrado.
export async function garantirLancamentoLiberado({ id_regiao, id_base, id_bases, id_igrejas } = {}) {
  if (useAuthStore.getState().isAdmin) return

  const regioes = new Set()
  if (texto(id_regiao)) regioes.add(texto(id_regiao))

  const bases = new Set([id_base, ...(id_bases || [])].map(texto).filter(Boolean))
  for (const b of bases) {
    const r = await regiaoDaBase(b)
    if (r) regioes.add(r)
  }

  if (texto(id_igrejas)) {
    const r = await regiaoDaIgreja(texto(id_igrejas))
    if (r) regioes.add(r)
  }

  for (const r of regioes) {
    const nome = await nomeSeRegiaoTravada(r)
    if (nome) throw new LancamentoBloqueadoError(nome)
  }
}

// Para gravações que só recebem o id do registro (editar/excluir): descobre
// a base do registro antes de checar a trava.
export async function garantirRegistroLiberado(table, pk, id, baseCol = 'base_id') {
  if (useAuthStore.getState().isAdmin || id === undefined || id === null || id === '') return
  const { data } = await supabase
    .from(table)
    .select(baseCol)
    .eq(pk, id)
    .limit(1)
    .maybeSingle()
  await garantirLancamentoLiberado({ id_base: data?.[baseCol] })
}
