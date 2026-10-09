import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTable } from './useTable'
import { db } from '../api/db'
import { gerarSabados, divisorCadencia, isProvaBonus, isProvaTitulo, provasPrevistas, descartarNotasDuplicadas, isDesafioBatismo } from '../lib/desafiosPontuacao'
import { isDesafioDiscipulado } from '../lib/discipuladoMeta'
import { normalizeBaseName } from '../lib/ranking'

// Carrega os dados e calcula a pontuação do ranking (bases e alunos) de um
// ministério ('soul' | 'teen') em um ano. Fonte única dos números exibidos
// na página de Ranking e no telão de premiação.
export function useRankingData(type, ano) {
  const currentTipo = type === 'soul' ? 'Soul+' : 'G148 Teen'
  // Rede de segurança apenas: mudanças chegam na hora pelo useRealtimeSync.
  // Intervalo curto aqui estoura a cota de egress do Supabase.
  const LIVE_REFRESH_MS = 2 * 60 * 1000

  const { data: bases = [] }     = useTable('Bases')
  const { data: regioes = [] }   = useTable('Regiao')
  const { data: distritos = [] } = useTable('Distritos')
  const { data: igrejas = [] }   = useTable('Igrejas')
  const { data: provas = [] }    = useTable('Provas')

  const { data: catalogo = [] } = useQuery({
    queryKey: ['desafios_catalogo', currentTipo],
    queryFn: () => db.getDesafiosCatalogo(currentTipo),
    staleTime: 10 * 60 * 1000,
  })

  const { data: trimestresConfig = [] } = useQuery({
    queryKey: ['configuracao_trimestres', ano],
    queryFn: () => db.getConfiguracaoTrimestres(ano),
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

  const { data: todosRegistros = [], isLoading: loadingReg } = useQuery({
    queryKey: ['ranking_registros', ano],
    queryFn: () => db.getAllRegistrosPorAno(ano),
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

  const { data: todosMarcos = [], isLoading: loadingMar } = useQuery({
    queryKey: ['ranking_marcos', ano],
    queryFn: () => db.getAllMarcosPorAno(ano),
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

  const { data: todasNotas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['ranking_notas', ano, type],
    queryFn: () => type === 'soul' ? db.getAllNotasSoulPorAno(ano) : db.getAllNotasTeenPorAno(ano),
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

  const { data: discipulosCartoes = [], isLoading: loadingDisc } = useQuery({
    queryKey: ['all_discipulos_cartoes', ano],
    queryFn: () => db.getAllDiscipulosCartoesPorAno(ano),
    staleTime: 2 * 60 * 1000,
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

  const { data: discipulosConfig = null } = useQuery({
    queryKey: ['discipulos_config'],
    queryFn: () => db.getDiscipulosConfig(),
    staleTime: 10 * 60 * 1000,
  })

  const { data: batismosRegs = [], isLoading: loadingBat } = useQuery({
    queryKey: ['all_batismos', ano],
    queryFn: () => db.getAllBatismosPorAno(ano),
    staleTime: 2 * 60 * 1000,
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

  const { data: batismosConfig = null } = useQuery({
    queryKey: ['batismos_config'],
    queryFn: () => db.getBatismosConfig(),
    staleTime: 10 * 60 * 1000,
  })

  const isLoading = loadingReg || loadingMar || loadingNotas || loadingDisc || loadingBat

  const basesFiltradas = useMemo(() =>
    bases.filter(b => {
      const bTipo = (b.Tipo || '').toLowerCase()
      const cTipo = currentTipo.toLowerCase()
      if (cTipo.includes('teen')) return bTipo.includes('teen') || !bTipo
      return bTipo.includes('soul') || bTipo.includes('soul+')
    }),
    [bases, currentTipo]
  )

  // Base "dominante" de cada aluno: a que mais aparece entre TODAS as notas
  // do aluno no ano (maioria simples). Existe uma inconsistência de dados
  // conhecida em produção — um lançamento isolado às vezes grava o id_base
  // de outra base (nome da base correto, só o ID errado, provavelmente um
  // bug pontual de gravação) — usar a maioria evita que 1-2 notas fora do
  // padrão desloquem o aluno (e sua nota) pra base/região/distrito errados.
  const basePorAluno = useMemo(() => {
    const tally = {} // studentKey -> { baseId: count }
    const info = {}  // studentKey -> { baseId: {base, regiao, regiao_id, distrito, distrito_id, igreja, igreja_id} }
    todasNotas.forEach(r => {
      const nome = r.Membros ?? r.nome_aluno ?? ''
      const baseId = String(r.id_base ?? r.base_id ?? '').trim()
      if (!nome.trim() || !baseId) return
      const studentKey = r.id_membros ?? (baseId + '|' + nome)
      if (!tally[studentKey]) { tally[studentKey] = {}; info[studentKey] = {} }
      tally[studentKey][baseId] = (tally[studentKey][baseId] ?? 0) + 1
      if (!info[studentKey][baseId]) {
        info[studentKey][baseId] = {
          base: r.Base ?? '',
          regiao: r.Regiao ?? '',
          regiao_id: r.id_regiao ?? '',
          distrito: r.Distritos ?? '',
          distrito_id: r.id_distritos ?? '',
          igreja: r.Igrejas ?? '',
          igreja_id: r.id_igrejas ?? '',
        }
      }
    })
    const result = {}
    Object.keys(tally).forEach(key => {
      const baseId = Object.entries(tally[key]).sort((a, b) => b[1] - a[1])[0][0]
      result[key] = { baseId, ...info[key][baseId] }
    })
    return result
  }, [todasNotas])

  // Notas por base seguindo a regra:
  // - Média do dia = soma das notas ÷ alunos que fizeram AQUELA prova (não o total da turma)
  // - Pontos da base = soma das médias diárias dos sábados lançados
  const notasMediaPorBase = useMemo(() => {
    // Agrupa notas por base por ID e por NOME normalizado
    // Isso evita perder pontuação quando há divergência entre IDs legados e UUIDs.
    const mapById = {}   // base_id -> { 'YYYY-MM-DD' -> { sum, count } }
    const mapByName = {} // base_nome_normalizado -> { 'YYYY-MM-DD' -> { sum, count } }

    todasNotas.forEach(r => {
      const nome = r.Membros ?? r.nome_aluno ?? ''
      const rowBaseId = String(r.id_base ?? r.base_id ?? '').trim()
      const studentKey = r.id_membros ?? (rowBaseId + '|' + nome)
      // Usa a base dominante do aluno em vez da base gravada nessa linha
      // específica, pra não perder/desviar pontos por um id_base incorreto
      // isolado (ver comentário de basePorAluno acima).
      const baseId = basePorAluno[studentKey]?.baseId ?? rowBaseId
      const baseNameNorm = normalizeBaseName(basePorAluno[studentKey]?.base ?? r.Base ?? r.base ?? '')
      const nota = Number(r.nota ?? r.Nota)
      const dataRaw = r.data ?? r.Data
      const data = dataRaw ? String(dataRaw).slice(0, 10) : null
      if (!Number.isFinite(nota) || !data || (!baseId && !baseNameNorm)) return

      if (baseId) {
        if (!mapById[baseId]) mapById[baseId] = {}
        if (!mapById[baseId][data]) mapById[baseId][data] = { sum: 0, count: 0 }
        mapById[baseId][data].sum += nota
        mapById[baseId][data].count += 1
      }

      if (baseNameNorm) {
        if (!mapByName[baseNameNorm]) mapByName[baseNameNorm] = {}
        if (!mapByName[baseNameNorm][data]) mapByName[baseNameNorm][data] = { sum: 0, count: 0 }
        mapByName[baseNameNorm][data].sum += nota
        mapByName[baseNameNorm][data].count += 1
      }
    })

    const sumDailyAverages = (byDate) => Object.values(byDate).reduce((acc, { sum, count }) => {
      return acc + (count > 0 ? sum / count : 0)
    }, 0)

    const byId = {}
    Object.entries(mapById).forEach(([baseId, byDate]) => {
      // Soma as médias diárias (dias sem prova = 0 implícito)
      byId[baseId] = sumDailyAverages(byDate)
    })

    const byName = {}
    Object.entries(mapByName).forEach(([baseName, byDate]) => {
      byName[baseName] = sumDailyAverages(byDate)
    })

    return { byId, byName }
  }, [todasNotas, basePorAluno])

  // Pontos de discípulos por base:
  // — só o primeiro cartão (ordem = 1) de cada membro conta
  // — metade dos pontos ao ativar (data_inicio preenchida)
  // — pontos completos ao encerrar (data_fim preenchida)
  const discipulosPtsPorBase = useMemo(() => {
    const ptsPorCartao = Number(discipulosConfig?.pontos_por_cartao ?? 0)
    if (!ptsPorCartao || !discipulosCartoes.length) return {}

    // Primeiro cartão por membro (menor ordem)
    const primeiros = {}
    discipulosCartoes.forEach(card => {
      const key = `${card.base_id}|${card.membro_id}`
      if (!primeiros[key] || (card.ordem ?? 999) < (primeiros[key].ordem ?? 999)) {
        primeiros[key] = card
      }
    })

    const map = {}
    Object.values(primeiros).forEach(card => {
      if (!card.data_inicio) return
      const pts = card.data_fim ? ptsPorCartao : ptsPorCartao / 2
      map[card.base_id] = (map[card.base_id] ?? 0) + pts
    })
    return map
  }, [discipulosCartoes, discipulosConfig])

  // Mapa de pontos de batismos por base
  const batismosPtsPorBase = useMemo(() => {
    const ptsPorBatismo = Number(batismosConfig?.pontos_por_batismo ?? 0)
    if (!ptsPorBatismo || !batismosRegs.length) return {}
    const map = {}
    batismosRegs.forEach(r => {
      map[r.base_id] = (map[r.base_id] ?? 0) + ptsPorBatismo
    })
    return map
  }, [batismosRegs, batismosConfig])

  // Score total por base (desafios + média notas + discípulos + batismos)
  const scoresPorBase = useMemo(() => {
    if (!catalogo.length || !basesFiltradas.length) return []

    const desafiosSemanais = catalogo.filter(d => d.rastreamento === 'semanal'  && d.periodicidade === 'trimestral')
    const desafiosMensais  = catalogo.filter(d => d.periodicidade === 'mensal'  && d.mes_ref)
    const desafiosPontuais = catalogo.filter(d => d.rastreamento === 'pontual'  && d.periodicidade === 'trimestral')
    const desafiosAnuais   = catalogo.filter(d => d.periodicidade === 'anual')

    return basesFiltradas.map(base => {
      const baseId = base.id_base ?? base.id

      const weeklyPts = trimestresConfig.reduce((total, tc) => {
        const sabadosTc = gerarSabados(tc.primeiro_sabado, tc.ultimo_sabado)
        if (!sabadosTc.length) return total
        return total + desafiosSemanais.reduce((s, d) => {
          const divisor = divisorCadencia(d, sabadosTc)
          const n = todosRegistros.filter(r =>
            r.base_id === baseId && r.desafio_id === d.id && r.realizado && sabadosTc.includes(r.data_sabado)
          ).length
          return s + n * (Number(d.pontos_total) / divisor)
        }, 0)
      }, 0)

      const mensaisPts = desafiosMensais.reduce((s, d) => {
        const done = todosMarcos.some(m =>
          m.base_id === baseId && m.desafio_id === d.id && m.mes === d.mes_ref && m.realizado
        )
        return s + (done ? Number(d.pontos_total) : 0)
      }, 0)

      const pontuaisPts = desafiosPontuais.reduce((s, d) => {
        const n = todosMarcos.filter(m =>
          m.base_id === baseId && m.desafio_id === d.id && m.mes != null && m.realizado
        ).length
        return s + n * (Number(d.pontos_total) / (trimestresConfig.length || 4))
      }, 0)

      const anuaisPts = desafiosAnuais.reduce((s, d) => {
        const done = todosMarcos.some(m =>
          m.base_id === baseId && m.desafio_id === d.id && m.trimestre == null && m.mes == null && m.realizado
        )
        return s + (done ? Number(d.pontos_total) : 0)
      }, 0)

      const desafiosDetalhados = []
      trimestresConfig.forEach(tc => {
        const sabadosTc = gerarSabados(tc.primeiro_sabado, tc.ultimo_sabado)
        desafiosSemanais.forEach(d => {
          const divisor = divisorCadencia(d, sabadosTc)
          const realizacoes = todosRegistros.filter(r =>
            r.base_id === baseId && r.desafio_id === d.id && r.realizado && sabadosTc.includes(r.data_sabado)
          ).length
          if (realizacoes > 0) desafiosDetalhados.push({
            id: `${d.id}-${tc.trimestre}`, nome: d.nome, categoria: d.categoria,
            regra: `Semanal · ${realizacoes} ÷ ${divisor} do trimestre`, realizacoes,
            pontos: realizacoes * (Number(d.pontos_total) / divisor),
          })
        })
      })
      desafiosMensais.forEach(d => {
        const done = todosMarcos.some(m => m.base_id === baseId && m.desafio_id === d.id && m.mes === d.mes_ref && m.realizado)
        if (done) desafiosDetalhados.push({
          id: d.id, nome: d.nome, categoria: d.categoria,
          regra: `Mensal · mês ${d.mes_ref}`, realizacoes: 1, pontos: Number(d.pontos_total),
        })
      })
      desafiosPontuais.forEach(d => {
        const divisor = trimestresConfig.length || 4
        const realizacoes = todosMarcos.filter(m => m.base_id === baseId && m.desafio_id === d.id && m.mes != null && m.realizado).length
        if (realizacoes > 0) desafiosDetalhados.push({
          id: d.id, nome: d.nome, categoria: d.categoria,
          regra: `Pontual · dividido por ${divisor} trimestres`, realizacoes,
          pontos: realizacoes * (Number(d.pontos_total) / divisor),
        })
      })
      desafiosAnuais.forEach(d => {
        const done = todosMarcos.some(m => m.base_id === baseId && m.desafio_id === d.id && m.trimestre == null && m.mes == null && m.realizado)
        if (done) desafiosDetalhados.push({
          id: d.id, nome: d.nome, categoria: d.categoria,
          regra: 'Anual · realizado', realizacoes: 1, pontos: Number(d.pontos_total),
        })
      })

      const baseNameNorm = normalizeBaseName(base.Base ?? base.nome ?? '')
      const notaMedia     = notasMediaPorBase.byId?.[String(baseId)] ?? notasMediaPorBase.byName?.[baseNameNorm] ?? 0
      const discipulosPts = discipulosPtsPorBase[baseId] ?? 0
      const batismosPts   = batismosPtsPorBase[baseId]  ?? 0
      const pontos = Math.round((weeklyPts + mensaisPts + pontuaisPts + anuaisPts + notaMedia + discipulosPts + batismosPts) * 10) / 10

      // Batismo e discipulado pontuam por desafio anual do catálogo. No
      // detalhamento esses pontos saem de "Desafios" e vão para as colunas
      // próprias — o total da base não muda.
      const anualRealizadoPts = (filtro) => desafiosAnuais.filter(filtro).reduce((s, d) => {
        const done = todosMarcos.some(m =>
          m.base_id === baseId && m.desafio_id === d.id && m.trimestre == null && m.mes == null && m.realizado
        )
        return s + (done ? Number(d.pontos_total) : 0)
      }, 0)
      const batismoDesafioPts    = anualRealizadoPts(isDesafioBatismo)
      const discipuloDesafioPts  = anualRealizadoPts(d => isDesafioDiscipulado(d) && !isDesafioBatismo(d))

      const componentes = {
        desafios: Math.round((weeklyPts + mensaisPts + pontuaisPts + anuaisPts - batismoDesafioPts - discipuloDesafioPts) * 10) / 10,
        notas: Math.round(notaMedia * 10) / 10,
        discipulos: Math.round((discipulosPts + discipuloDesafioPts) * 10) / 10,
        batismos: Math.round((batismosPts + batismoDesafioPts) * 10) / 10,
      }

      const primeirosCartoes = {}
      const ptsPorCartao = Number(discipulosConfig?.pontos_por_cartao ?? 0)
      const ptsPorBatismo = Number(batismosConfig?.pontos_por_batismo ?? 0)
      discipulosCartoes.forEach(card => {
        const key = `${card.base_id}|${card.membro_id}`
        if (!primeirosCartoes[key] || (card.ordem ?? 999) < (primeirosCartoes[key].ordem ?? 999)) primeirosCartoes[key] = card
      })

      const trimestresDetalhados = trimestresConfig.map(tc => {
        const sabadosTc = gerarSabados(tc.primeiro_sabado, tc.ultimo_sabado)
        const desafios = []
        desafiosSemanais.forEach(d => {
          const divisor = divisorCadencia(d, sabadosTc)
          const realizacoes = todosRegistros.filter(r => r.base_id === baseId && r.desafio_id === d.id && r.realizado && sabadosTc.includes(r.data_sabado)).length
          if (realizacoes) desafios.push({ id: d.id, nome: d.nome, categoria: d.categoria, regra: `Semanal · ${realizacoes} ÷ ${divisor}`, realizacoes, pontos: realizacoes * (Number(d.pontos_total) / divisor) })
        })
        desafiosMensais.filter(d => Number(d.mes_ref) >= Number(String(tc.primeiro_sabado).slice(5, 7)) && Number(d.mes_ref) <= Number(String(tc.ultimo_sabado).slice(5, 7))).forEach(d => {
          const realizado = todosMarcos.some(m => m.base_id === baseId && m.desafio_id === d.id && m.mes === d.mes_ref && m.realizado)
          if (realizado) desafios.push({ id: d.id, nome: d.nome, categoria: d.categoria, regra: `Mensal · mês ${d.mes_ref}`, realizacoes: 1, pontos: Number(d.pontos_total) })
        })
        desafiosPontuais.forEach(d => {
          const realizacoes = todosMarcos.filter(m => m.base_id === baseId && m.desafio_id === d.id && m.mes != null && m.realizado && Number(m.mes) >= Number(String(tc.primeiro_sabado).slice(5, 7)) && Number(m.mes) <= Number(String(tc.ultimo_sabado).slice(5, 7))).length
          const divisor = trimestresConfig.length || 4
          if (realizacoes) desafios.push({ id: d.id, nome: d.nome, categoria: d.categoria, regra: `Pontual · ÷ ${divisor} trimestres`, realizacoes, pontos: realizacoes * (Number(d.pontos_total) / divisor) })
        })
        if (tc.trimestre === trimestresConfig[trimestresConfig.length - 1]?.trimestre) desafiosAnuais.forEach(d => {
          const realizado = todosMarcos.some(m => m.base_id === baseId && m.desafio_id === d.id && m.trimestre == null && m.mes == null && m.realizado)
          if (realizado) desafios.push({ id: d.id, nome: d.nome, categoria: d.categoria, regra: 'Anual · fechamento', realizacoes: 1, pontos: Number(d.pontos_total) })
        })

        const notasDoTrimestre = todasNotas.filter(r => {
          const rowBaseId = String(r.id_base ?? r.base_id ?? '').trim()
          const studentKey = r.id_membros ?? (rowBaseId + '|' + (r.Membros ?? r.nome_aluno ?? ''))
          const nota = Number(r.nota ?? r.Nota)
          const data = String(r.data ?? r.Data ?? '').slice(0, 10)
          const info = basePorAluno[studentKey]
          return Number.isFinite(nota) && data >= tc.primeiro_sabado && data <= tc.ultimo_sabado && String(info?.baseId ?? rowBaseId) === String(baseId)
        })
        const notasPorDia = {}
        notasDoTrimestre.forEach(r => {
          const data = String(r.data ?? r.Data ?? '').slice(0, 10)
          const nota = Number(r.nota ?? r.Nota)
          if (!notasPorDia[data]) notasPorDia[data] = { sum: 0, count: 0 }
          notasPorDia[data].sum += nota
          notasPorDia[data].count += 1
        })
        const notaPts = Object.values(notasPorDia).reduce((sum, day) => sum + day.sum / day.count, 0)
        const cards = Object.values(primeirosCartoes).filter(card => card.base_id === baseId && card.data_inicio >= tc.primeiro_sabado && card.data_inicio <= tc.ultimo_sabado).map(card => ({
          ...card, nome: card.nome_membro ?? card.membro_nome ?? card.membro_id ?? 'Membro', pontos: card.data_fim ? ptsPorCartao : ptsPorCartao / 2,
        }))
        const batismos = batismosRegs.filter(item => item.base_id === baseId && Number(item.mes) >= Number(String(tc.primeiro_sabado).slice(5, 7)) && Number(item.mes) <= Number(String(tc.ultimo_sabado).slice(5, 7))).map(item => ({ ...item, pontos: ptsPorBatismo }))
        const desafiosPts = desafios.reduce((sum, item) => sum + item.pontos, 0)
        const cardsPts = cards.reduce((sum, item) => sum + item.pontos, 0)
        const batismosPts = batismos.reduce((sum, item) => sum + item.pontos, 0)
        return {
          trimestre: tc.trimestre,
          periodo: `${tc.primeiro_sabado} a ${tc.ultimo_sabado}`,
          desafios, notas: notasDoTrimestre, cards, batismos,
          desafiosPts: Math.round(desafiosPts * 10) / 10,
          notasPts: Math.round(notaPts * 10) / 10,
          cardsPts: Math.round(cardsPts * 10) / 10,
          batismosPts: Math.round(batismosPts * 10) / 10,
          total: Math.round((desafiosPts + notaPts + cardsPts + batismosPts) * 10) / 10,
        }
      })

      return {
        id: baseId,
        nome: base.Base ?? base.nome ?? 'Base',
        regiao: base.Regiao ?? '',
        regiao_id: base.id_regiao ?? base.regiao_id ?? '',
        distrito: base.Distritos ?? '',
        distrito_id: base.id_distritos ?? base.distrito_id ?? '',
        igreja: base.Igrejas ?? base.Igreja_Nome ?? '',
        igreja_id: base.id_igrejas ?? base.igreja_id ?? '',
        pontos,
        notaMedia: Math.round(notaMedia * 10) / 10,
        discipulosPts: Math.round(discipulosPts * 10) / 10,
        batismosPts:   Math.round(batismosPts   * 10) / 10,
        componentes,
        ano,
        trimestresDetalhados,
        desafiosDetalhados,
      }
    }).sort((a, b) => b.pontos - a.pontos)
  }, [basesFiltradas, catalogo, trimestresConfig, todosRegistros, todosMarcos, todasNotas, basePorAluno, notasMediaPorBase, discipulosCartoes, discipulosConfig, batismosRegs, batismosConfig, discipulosPtsPorBase, batismosPtsPorBase])

  // Ranking individual de alunos:
  // pontos = soma das médias trimestrais do aluno. Cada trimestre pontua
  // (soma das notas regulares do trimestre ÷ nº de provas PREVISTAS naquele
  // trimestre) + soma das provas bônus (somadas direto, fora da divisão).
  // O nº de provas previstas é fixo por trimestre — sábados de referência no
  // G148 Teen (ex.: 6/13/13/13) ou provas programadas no Soul+ (ex.: 1/3/3/3)
  // — e não o nº de provas que o aluno realmente fez: prova não feita conta
  // como zero.
  const rankingAlunos = useMemo(() => {
    const isSoul = currentTipo === 'Soul+'
    const divisorPorTrimestre = {}

    const findTrimestre = (dataStr) =>
      trimestresConfig.find(tc => dataStr >= tc.primeiro_sabado && dataStr <= tc.ultimo_sabado) ?? null

    const getDivisor = (tc) => {
      const key = tc ? `${tc.ano}-${tc.trimestre}` : 'sem-trimestre'
      if (divisorPorTrimestre[key] != null) return divisorPorTrimestre[key]
      const divisor = tc
        ? provasPrevistas({ tipo: currentTipo, inicio: tc.primeiro_sabado, fim: tc.ultimo_sabado, trimestresConfig, provas }) || 1
        : (isSoul ? 3 : 13) // fallback p/ notas fora de qualquer trimestre configurado
      divisorPorTrimestre[key] = divisor
      return divisor
    }

    // Lançamento duplicado (mesmo aluno + mesma prova) não conta em dobro:
    // só o mais recente entra na soma.
    const notasValidas = descartarNotasDuplicadas(
      todasNotas.filter(r => {
        if (!Number.isFinite(Number(r.nota ?? r.Nota))) return false
        // No Soul+, só "NN Prova Soul+" tem nota de verdade — "Registro Semanal"
        // (Comunhão/Verso/Discipulado/300, sem nota) não conta pra média.
        if (isSoul && !isProvaTitulo(r.titulo ?? r.Titulo)) return false
        return Boolean((r.Membros ?? r.nome_aluno ?? '').trim())
      }),
      {
        keyOf: r => (r.id_membros && r.id_provas) ? `${r.id_membros}|${r.id_provas}` : null,
        ordemOf: r => r.lancado_em,
      }
    )

    const map = {}
    notasValidas.forEach(r => {
      const nota = Number(r.nota ?? r.Nota)
      const nome = r.Membros ?? r.nome_aluno ?? ''
      const rowBaseId = String(r.id_base ?? '').trim()
      const studentKey = r.id_membros ?? (rowBaseId + '|' + nome)
      if (!map[studentKey]) {
        map[studentKey] = { id: studentKey, nome, count: 0, porTrimestre: {} }
      }
      const student = map[studentKey]
      student.count++

      const data = String(r.data ?? r.Data ?? '').slice(0, 10)
      const tc = findTrimestre(data)
      const key = tc ? `${tc.ano}-${tc.trimestre}` : 'sem-trimestre'
      if (!student.porTrimestre[key]) {
        student.porTrimestre[key] = { tc, regularSum: 0, bonusSum: 0 }
      }
      const bucket = student.porTrimestre[key]
      if (isProvaBonus(r.titulo ?? r.Titulo)) {
        bucket.bonusSum += nota
      } else {
        bucket.regularSum += nota
      }
    })

    return Object.values(map)
      .filter(s => s.count > 0)
      .map(s => {
        // base_id/geo vêm de basePorAluno (base mais frequente entre TODAS
        // as notas do aluno) — não da nota que criou essa entrada — pra não
        // deslocar o aluno pra base errada por causa de 1 lançamento com bug.
        const infoBase = basePorAluno[s.id] ?? {}
        const pontos = Object.values(s.porTrimestre).reduce((acc, bucket) => {
          const divisor = getDivisor(bucket.tc)
          return acc + (bucket.regularSum / divisor) + bucket.bonusSum
        }, 0)
        return {
          id: s.id,
          nome: s.nome,
          count: s.count,
          base_id: infoBase.baseId ?? '',
          base: infoBase.base ?? '',
          regiao: infoBase.regiao ?? '',
          regiao_id: infoBase.regiao_id ?? '',
          distrito: infoBase.distrito ?? '',
          distrito_id: infoBase.distrito_id ?? '',
          igreja: infoBase.igreja ?? '',
          igreja_id: infoBase.igreja_id ?? '',
          pontos: Math.round(pontos * 10) / 10,
          sub: infoBase.base ?? '',
          extra: `${s.count} ${s.count === 1 ? 'prova lançada' : 'provas lançadas'}`,
        }
      })
      .sort((a, b) => (b.pontos - a.pontos) || a.nome.localeCompare(b.nome))
  }, [todasNotas, trimestresConfig, provas, currentTipo, basePorAluno])

  return {
    regioes, distritos, igrejas, basesFiltradas,
    todasNotas, basePorAluno, scoresPorBase, rankingAlunos, isLoading,
  }
}
