import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../api/supabase'
import { db } from '../api/db'
import { criarLote, registrarEvento, idsParaBuscar, mesclarLinhas } from '../lib/sincronizacaoIncremental'

// Eventos seguidos (ex.: as 30 notas de uma turma salvas de uma vez) são
// agrupados e processados juntos: espera esse tempo sem novidade, mas nunca
// mais que o limite máximo.
const AGRUPAR_MS = 1500
const ESPERA_MAX_MS = 6000

const anoDe = (valor) => String(valor ?? '').slice(0, 4)
const mesmoAno = (campo) => (linha, queryKey) => anoDe(linha[campo]) === String(queryKey[1])

function regraNotas(tabela, tipo) {
  return {
    pk: 'id',
    listas: [
      {
        chave: 'ranking_notas',
        // ['ranking_notas', ano, 'soul'] é Soul+; sem tipo ou 'teen' é G148 Teen.
        serve: (queryKey) => (queryKey[2] === 'soul') === (tipo === 'soul'),
        buscar: (ids) => db.getNotasRankingPorIds(tipo, ids),
        pertence: mesmoAno('data'),
      },
      { chave: tabela, buscar: (ids) => db.getPorIds(tabela, ids), novasNoInicio: true },
    ],
    invalidar: ['notas_por_base', 'notas_existentes', 'notas_300_status', 'notas_trimestre_comparativo'],
  }
}

// O que fazer quando cada tabela muda:
// - `listas`: cargas grandes (tabela ou ano inteiro) que ficam em cache.
//   Em vez de baixar tudo de novo, relê só as linhas alteradas e mescla.
// - `invalidar`: consultas pequenas (de uma base só), que são refeitas.
// Tabela fora deste mapa (cadastros e configurações, que mudam pouco)
// invalida tudo, como era antes.
const REGRAS = {
  Notas_Teen: regraNotas('Notas_Teen', 'teen'),
  Notas_Soul: regraNotas('Notas_Soul', 'soul'),
  Membros: {
    pk: 'id_membros',
    listas: [{ chave: 'Membros', buscar: (ids) => db.getPorIds('Membros', ids), novasNoInicio: true }],
    invalidar: [],
  },
  desafios_registros: {
    pk: 'id',
    listas: [{
      chave: 'ranking_registros',
      buscar: (ids) => db.getLinhasPorIds('desafios_registros', ids),
      pertence: mesmoAno('data_sabado'),
    }],
    invalidar: ['desafios_registros', 'desafios_registros_ano'],
  },
  desafios_marcos: {
    pk: 'id',
    listas: [{
      chave: 'ranking_marcos',
      buscar: (ids) => db.getLinhasPorIds('desafios_marcos', ids),
      pertence: mesmoAno('ano'),
    }],
    invalidar: ['desafios_marcos'],
  },
  discipulos_cartoes: {
    pk: 'id',
    listas: [{
      chave: 'all_discipulos_cartoes',
      buscar: (ids) => db.getLinhasPorIds('discipulos_cartoes', ids),
      pertence: mesmoAno('ano'),
    }],
    invalidar: ['discipulos_cartoes', 'discipulos_cartoes_notas'],
  },
  batismos_registros: {
    pk: 'id',
    listas: [{
      chave: 'all_batismos',
      buscar: (ids) => db.getLinhasPorIds('batismos_registros', ids),
      pertence: mesmoAno('ano'),
    }],
    invalidar: ['batismos'],
  },
  discipulos_registros: { pk: 'id', listas: [], invalidar: ['discipulos_cartoes', 'discipulos_cartoes_notas'] },
  biblioteca_imagens: { pk: 'id', listas: [], invalidar: ['biblioteca'] },
}

function invalidarLista(queryClient, queries) {
  queries.forEach(query => queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true }))
}

async function sincronizarLista(queryClient, regra, lista, lote) {
  const queries = queryClient.getQueryCache()
    .findAll({ queryKey: [lista.chave] })
    .filter(query => !lista.serve || lista.serve(query.queryKey))

  // Carga completa em andamento pode ter lido parte das páginas antes da
  // mudança: espera terminar e mescla por cima, em vez de baixar de novo.
  await Promise.allSettled(
    queries.filter(query => query.state.fetchStatus === 'fetching').map(query => query.promise)
  )

  // Só mescla em cache íntegro. Consulta sem dados ou já marcada para
  // recarregar segue o caminho normal de recarga completa.
  const podeMesclar = (query) =>
    Array.isArray(query.state.data) && query.state.fetchStatus === 'idle' && !query.state.isInvalidated
  const mesclaveis = queries.filter(podeMesclar)
  invalidarLista(queryClient, queries.filter(query => !podeMesclar(query)))
  if (!mesclaveis.length) return

  let linhas = []
  try {
    const ids = idsParaBuscar(lote)
    if (ids.length) linhas = await lista.buscar(ids)
  } catch (error) {
    console.error(`[realtime] Falha ao reler ${lista.chave}; recarregando a lista inteira:`, error)
    invalidarLista(queryClient, mesclaveis)
    return
  }

  mesclaveis.forEach(query => {
    // Mudou de estado enquanto relia as linhas: deixa a recarga completa valer.
    if (!podeMesclar(query)) return
    const novas = lista.pertence ? linhas.filter(linha => lista.pertence(linha, query.queryKey)) : linhas
    queryClient.setQueryData(
      query.queryKey,
      (atual) => Array.isArray(atual)
        ? mesclarLinhas(atual, { pk: regra.pk, tocados: lote.tocados, novas, novasNoInicio: lista.novasNoInicio })
        : atual,
      // Mantém a idade original: a mescla não conta como recarga completa.
      { updatedAt: query.state.dataUpdatedAt }
    )
  })
}

async function processarLotes(queryClient, lotes) {
  if (Object.keys(lotes).some(tabela => !REGRAS[tabela])) {
    await queryClient.invalidateQueries()
    return
  }

  await Promise.all(Object.entries(lotes).map(async ([tabela, lote]) => {
    const regra = REGRAS[tabela]
    regra.invalidar.forEach(chave => queryClient.invalidateQueries({ queryKey: [chave] }))

    if (lote.semChave) {
      // Evento sem PK (não dá pra saber qual linha mudou): recarrega as listas.
      regra.listas.forEach(lista => queryClient.invalidateQueries({ queryKey: [lista.chave] }))
      return
    }
    await Promise.all(regra.listas.map(lista => sincronizarLista(queryClient, regra, lista, lote)))
  }))
}

/**
 * Mantém o cache do React Query em dia com as mudanças do schema public.
 * Quando alguém altera um dado, cada cliente conectado atualiza só o que
 * mudou — as cargas grandes recebem apenas as linhas alteradas (ver REGRAS).
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let lotes = {}
    let timer = null
    let primeiroEvento = 0
    let conectouAntes = false
    let perdeuConexao = false

    const processar = () => {
      clearTimeout(timer)
      timer = null
      const pendentes = lotes
      lotes = {}
      processarLotes(queryClient, pendentes).catch(error => {
        console.error('[realtime] Falha na sincronização; recarregando tudo:', error)
        queryClient.invalidateQueries()
      })
    }

    const channel = supabase
      .channel('global-db-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (evento) => {
          const lote = (lotes[evento.table] ??= criarLote())
          registrarEvento(lote, evento, REGRAS[evento.table]?.pk ?? 'id')

          const agora = Date.now()
          if (!timer) primeiroEvento = agora
          clearTimeout(timer)
          timer = setTimeout(processar, Math.max(0, Math.min(AGRUPAR_MS, primeiroEvento + ESPERA_MAX_MS - agora)))
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          if (conectouAntes) perdeuConexao = true
          return
        }
        // Eventos emitidos enquanto a conexão esteve fora não chegam mais:
        // ao reconectar, recarrega tudo uma vez pra não ficar com dado velho.
        if (perdeuConexao) {
          perdeuConexao = false
          clearTimeout(timer)
          timer = null
          lotes = {}
          queryClient.invalidateQueries()
        }
        conectouAntes = true
      })

    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
