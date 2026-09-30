import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import { db } from '../api/db'
import { gerarSabados, divisorCadencia } from '../lib/desafiosPontuacao'
import { META_PERCENTUAL, avaliarMetaDiscipulado, isDesafioDiscipulado, membroContaNaBase, situacaoCartao } from '../lib/discipuladoMeta'

// ── Relatório de Validação de Lançamentos (admin) ─────────────────
// Lista as bases que têm cartões de discípulos e/ou desafios de Mídia
// lançados, para o admin conferir se o sistema pontua certo e se as bases
// estão lançando corretamente, sem precisar abrir base por base.
//
// Discipulado: o desafio anual "Discípulo Teen (40% ativos)" é marcado
// automaticamente pelo sistema (db.syncDiscipuladoDesafio) conforme a meta
// da regra em lib/discipuladoMeta.js. O relatório recalcula a meta e aponta
// divergências com o que está marcado (ex.: marcações manuais antigas).
// Mídia: pontos por desafio, com as mesmas regras do Ranking (Ranking.jsx).

function anoAtual() { return new Date().getFullYear() }

const META_LABEL = `${META_PERCENTUAL}%`

const MINISTERIOS = [
  { key: 'G148 Teen', label: '🎒 G148 Teen' },
  { key: 'Soul+',     label: '🔥 Soul+' },
]

const CONTEUDOS = [
  { key: 'tudo',    label: 'Cartões + Mídia' },
  { key: 'cartoes', label: 'Só cartões de discípulos' },
  { key: 'midia',   label: 'Só desafios de Mídia' },
]

const FILTROS_CARTOES = [
  { key: 'todos',      label: 'Todos os cartões' },
  { key: 'iniciados',  label: 'Só em andamento/concluídos' },
  { key: 'pendentes',  label: 'Só sem data de início (pendências)' },
]

const FILTROS_META = [
  { key: 'todas',        label: 'Todas' },
  { key: 'atingida',     label: `Meta de ${META_LABEL} atingida` },
  { key: 'nao_atingida', label: `Meta de ${META_LABEL} não atingida` },
  { key: 'divergente',   label: 'Divergência com o desafio marcado' },
]

const SITUACAO_META = {
  ok:            { texto: 'Meta atingida · desafio marcado',          cor: '#15803d' },
  nao_marcado:   { texto: 'Meta atingida, mas desafio NÃO marcado',   cor: '#b45309' },
  marcado_sem:   { texto: 'Desafio marcado SEM atingir a meta',       cor: '#b91c1c' },
  nao_atingida:  { texto: 'Meta não atingida',                        cor: '#6b7280' },
  atingida:      { texto: 'Meta atingida',                            cor: '#15803d' },
}

function fmtData(value) {
  const s = String(value ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function fmtPts(value) {
  return Number(value ?? 0).toFixed(1)
}

function fmtPct(value) {
  return `${Math.round((value ?? 0) * 100)}%`
}

function compareTexto(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { sensitivity: 'base' })
}

function baseDoTipo(base, tipo) {
  const bTipo = (base.Tipo || '').toLowerCase()
  if (tipo.toLowerCase().includes('teen')) return bTipo.includes('teen') || !bTipo
  return bTipo.includes('soul')
}

const SITUACAO_CARTAO_LABEL = {
  concluido: 'Concluído',
  andamento: 'Em andamento',
  pendente:  'Sem data de início',
}

// Pontos de um desafio de Mídia para a base, pelas regras do Ranking.
// Retorna também quantos lançamentos realizados existem e quantos pontuam.
function avaliarDesafioMidia(d, baseId, { registros, marcos, trimestres }) {
  const valor = Number(d.pontos_total ?? 0)
  const numTrimestres = trimestres.length || 4
  let lancamentos = 0
  let pontuam = 0
  let pontos = 0
  let regra = ''

  if (d.rastreamento === 'semanal' && d.periodicidade === 'trimestral') {
    const sabadosPorTrimestre = trimestres.map(tc => gerarSabados(tc.primeiro_sabado, tc.ultimo_sabado))
    registros
      .filter(r => r.base_id === baseId && r.desafio_id === d.id && r.realizado)
      .forEach(r => {
        lancamentos++
        const sabados = sabadosPorTrimestre.find(s => s.includes(r.data_sabado))
        if (sabados) {
          pontuam++
          pontos += valor / divisorCadencia(d, sabados)
        }
      })
    regra = `Semanal · ${fmtPts(valor)} pts por trimestre`
  } else {
    let conta = () => false
    let pontosPorLancamento = valor
    const unico = d.periodicidade === 'mensal' || d.periodicidade === 'anual'
    if (d.periodicidade === 'mensal' && d.mes_ref) {
      conta = m => Number(m.mes) === Number(d.mes_ref)
      regra = `Mensal · mês ${d.mes_ref} · ${fmtPts(valor)} pts`
    } else if (d.rastreamento === 'pontual' && d.periodicidade === 'trimestral') {
      conta = m => m.mes != null
      pontosPorLancamento = valor / numTrimestres
      regra = `Pontual · ${fmtPts(valor)} pts ÷ ${numTrimestres} trimestres`
    } else if (d.periodicidade === 'anual') {
      conta = m => m.trimestre == null && m.mes == null
      regra = `Anual · ${fmtPts(valor)} pts`
    }
    marcos
      .filter(m => m.base_id === baseId && m.desafio_id === d.id && m.realizado)
      .forEach(m => {
        lancamentos++
        // Mensal e anual pontuam uma única vez, mesmo com lançamentos repetidos
        if (conta(m) && !(unico && pontuam > 0)) {
          pontuam++
          pontos += pontosPorLancamento
        }
      })
  }

  return { id: d.id, nome: d.nome, regra, lancamentos, pontuam, pontos: Math.round(pontos * 10) / 10 }
}

export default function ValidacaoLancamentos() {
  const [ano, setAno]                       = useState(anoAtual())
  const [tipo, setTipo]                     = useState('G148 Teen')
  const [conteudo, setConteudo]             = useState('tudo')
  const [filtroCartoes, setFiltroCartoes]   = useState('todos')
  const [filtroMeta, setFiltroMeta]         = useState('todas')
  const [filtroRegiao, setFiltroRegiao]     = useState('')
  const [filtroDistrito, setFiltroDistrito] = useState('')
  const [filtroBase, setFiltroBase]         = useState('')
  const [sincronizando, setSincronizando]   = useState(false)
  const qc = useQueryClient()

  const { data: bases = [], isLoading: loadingBases } = useTable('Bases')
  const { data: regioes = [] }   = useTable('Regiao')
  const { data: distritos = [] } = useTable('Distritos')
  const { data: membros = [], isLoading: loadingMembros } = useTable('Membros')

  const { data: catalogo = [], isLoading: loadingCat } = useQuery({
    queryKey: ['desafios_catalogo', tipo],
    queryFn: () => db.getDesafiosCatalogo(tipo),
    staleTime: 10 * 60 * 1000,
  })
  const { data: trimestres = [] } = useQuery({
    queryKey: ['configuracao_trimestres', ano],
    queryFn: () => db.getConfiguracaoTrimestres(ano),
  })
  const { data: registros = [], isLoading: loadingReg } = useQuery({
    queryKey: ['ranking_registros', ano],
    queryFn: () => db.getAllRegistrosPorAno(ano),
  })
  const { data: marcos = [], isLoading: loadingMar } = useQuery({
    queryKey: ['ranking_marcos', ano],
    queryFn: () => db.getAllMarcosPorAno(ano),
  })
  const { data: cartoes = [], isLoading: loadingCards } = useQuery({
    queryKey: ['all_discipulos_cartoes', ano],
    queryFn: () => db.getAllDiscipulosCartoesPorAno(ano),
  })
  const { data: discipulosConfig = null } = useQuery({
    queryKey: ['discipulos_config'],
    queryFn: () => db.getDiscipulosConfig(),
    staleTime: 10 * 60 * 1000,
  })

  const isLoading = loadingBases || loadingMembros || loadingCat || loadingReg || loadingMar || loadingCards
  const isSoul = tipo === 'Soul+'
  // Pontuação por cartão (Admin → Configurações). Hoje está em 0; a coluna
  // de pontos por cartão só aparece se ela for configurada.
  const ptsPorCartao = Number(discipulosConfig?.pontos_por_cartao ?? 0)

  // Desafio anual de discipulado ("Discípulo Teen (40% ativos)")
  const desafioDiscipulado = useMemo(() => catalogo.find(isDesafioDiscipulado) ?? null, [catalogo])

  const nomeMembro = useMemo(() => {
    const map = {}
    membros.forEach(m => { map[String(m.id_membros ?? m.id)] = m.Membros ?? m.nome })
    return map
  }, [membros])

  // Ids dos alunos cadastrados por base (desconsidera quem está Inativo)
  const cadastradosPorBase = useMemo(() => {
    const map = {}
    membros.forEach(m => {
      if (!membroContaNaBase(m)) return
      const baseId = String(m.id_base ?? m.base_id ?? '')
      if (!baseId) return
      if (!map[baseId]) map[baseId] = []
      map[baseId].push(m.id_membros ?? m.id)
    })
    return map
  }, [membros])

  const basesDoTipo = useMemo(() => bases.filter(b => baseDoTipo(b, tipo)), [bases, tipo])

  const distritosOpts = useMemo(() =>
    distritos.filter(d => !filtroRegiao || String(d.id_regiao ?? d.regiao_id) === filtroRegiao),
    [distritos, filtroRegiao]
  )

  const basesOpts = useMemo(() =>
    basesDoTipo
      .filter(b => !filtroRegiao   || String(b.id_regiao ?? b.regiao_id) === filtroRegiao)
      .filter(b => !filtroDistrito || String(b.id_distritos ?? b.distrito_id) === filtroDistrito)
      .sort((a, b) => compareTexto(a.Base, b.Base)),
    [basesDoTipo, filtroRegiao, filtroDistrito]
  )

  const relatorio = useMemo(() => {
    const desafiosMidia = catalogo.filter(d => d.categoria === 'midia')

    // Pontuação por cartão (se configurada): só o 1º cartão de cada aluno conta
    const primeiroCartao = {}
    cartoes.forEach(card => {
      const key = `${card.base_id}|${card.membro_id}`
      if (!primeiroCartao[key] || (card.ordem ?? 999) < (primeiroCartao[key].ordem ?? 999)) primeiroCartao[key] = card
    })

    return basesOpts
      .filter(b => !filtroBase || String(b.id_base ?? b.id) === filtroBase)
      .map(base => {
        const baseId = base.id_base ?? base.id
        const cartoesDaBase = cartoes.filter(card => card.base_id === baseId)

        const { cadastrados, metaAlunos, alunosAndamento, alunosConcluidos, percentual, metaAtingida } =
          avaliarMetaDiscipulado(cadastradosPorBase[String(baseId)] ?? [], cartoesDaBase)

        const marcado = !!desafioDiscipulado && marcos.some(m =>
          m.base_id === baseId && m.desafio_id === desafioDiscipulado.id && m.realizado && m.trimestre == null && m.mes == null
        )
        const situacaoMeta = !desafioDiscipulado
          ? (metaAtingida ? 'atingida' : 'nao_atingida')
          : metaAtingida ? (marcado ? 'ok' : 'nao_marcado') : (marcado ? 'marcado_sem' : 'nao_atingida')
        const pontosDiscipulado = marcado ? Number(desafioDiscipulado.pontos_total ?? 0) : 0

        const cards = conteudo === 'midia' ? [] : cartoesDaBase
          .map(card => {
            const sit = situacaoCartao(card)
            const ehPrimeiro = primeiroCartao[`${card.base_id}|${card.membro_id}`]?.id === card.id
            const pontos = !ehPrimeiro || sit === 'pendente' ? 0 : sit === 'concluido' ? ptsPorCartao : ptsPorCartao / 2
            return {
              id: card.id,
              aluno: nomeMembro[String(card.membro_id)] ?? card.nome_membro ?? card.membro_id,
              cartao: card.nome,
              departamento: card.departamento,
              inicio: card.data_inicio,
              fim: card.data_fim,
              foto: card.foto_url,
              situacao: sit,
              pontos,
            }
          })
          .filter(card =>
            filtroCartoes === 'todos' ||
            (filtroCartoes === 'iniciados' && card.situacao !== 'pendente') ||
            (filtroCartoes === 'pendentes' && card.situacao === 'pendente')
          )
          .sort((a, b) => compareTexto(a.aluno, b.aluno) || compareTexto(a.cartao, b.cartao))

        const midia = conteudo === 'cartoes' ? [] : desafiosMidia
          .map(d => avaliarDesafioMidia(d, baseId, { registros, marcos, trimestres }))
          .filter(d => d.lancamentos > 0)

        const pontosCartoes = Math.round(cards.reduce((s, c) => s + c.pontos, 0) * 10) / 10
        const pontosMidia = Math.round(midia.reduce((s, d) => s + d.pontos, 0) * 10) / 10
        return {
          id: baseId,
          nome: base.Base ?? base.nome ?? 'Base',
          regiao: base.Regiao ?? '',
          distrito: base.Distritos ?? '',
          igreja: base.Igrejas ?? base.Igreja_Nome ?? '',
          temCartoes: cartoesDaBase.length > 0,
          // Entra na conferência de discipulado quem tem cartão OU marcou o desafio
          temDiscipulado: cartoesDaBase.length > 0 || marcado,
          cadastrados, metaAlunos, alunosAndamento, alunosConcluidos, percentual, metaAtingida, marcado, situacaoMeta,
          pontosDiscipulado, pontosCartoes, pontosMidia,
          cards, midia,
        }
      })
      .filter(b => (conteudo !== 'midia' && b.temDiscipulado) || b.midia.length > 0)
      .filter(b => {
        if (conteudo === 'midia' || filtroMeta === 'todas') return true
        if (filtroMeta === 'atingida') return b.metaAtingida
        if (filtroMeta === 'nao_atingida') return b.temDiscipulado && !b.metaAtingida
        return b.situacaoMeta === 'nao_marcado' || b.situacaoMeta === 'marcado_sem'
      })
      .sort((a, b) => compareTexto(a.regiao, b.regiao) || compareTexto(a.distrito, b.distrito) || compareTexto(a.nome, b.nome))
  }, [basesOpts, filtroBase, conteudo, filtroCartoes, filtroMeta, cartoes, catalogo, registros, marcos, trimestres, ptsPorCartao, nomeMembro, cadastradosPorBase, desafioDiscipulado])

  const totais = useMemo(() => relatorio.reduce((acc, b) => ({
    bases: acc.bases + 1,
    cadastrados: acc.cadastrados + (b.temDiscipulado ? b.cadastrados : 0),
    andamento: acc.andamento + b.alunosAndamento,
    concluidos: acc.concluidos + b.alunosConcluidos,
    metaAtingida: acc.metaAtingida + (b.metaAtingida ? 1 : 0),
    divergencias: acc.divergencias + (b.situacaoMeta === 'nao_marcado' || b.situacaoMeta === 'marcado_sem' ? 1 : 0),
    pontosDiscipulado: acc.pontosDiscipulado + b.pontosDiscipulado + b.pontosCartoes,
    pontosMidia: acc.pontosMidia + b.pontosMidia,
  }), { bases: 0, cadastrados: 0, andamento: 0, concluidos: 0, metaAtingida: 0, divergencias: 0, pontosDiscipulado: 0, pontosMidia: 0 }), [relatorio])

  const mostraCartoes = conteudo !== 'midia'
  const mostraMidia = conteudo !== 'cartoes'

  const nomeRegiao = regioes.find(r => String(r.id_regiao ?? r.id) === filtroRegiao)
  const nomeDistrito = distritos.find(d => String(d.id_distritos ?? d.id) === filtroDistrito)
  const nomeBase = basesOpts.find(b => String(b.id_base ?? b.id) === filtroBase)
  const filtrosDescricao = [
    tipo,
    `Ano ${ano}`,
    filtroRegiao && `Região: ${nomeRegiao?.Regiao ?? nomeRegiao?.nome ?? filtroRegiao}`,
    filtroDistrito && `Distrito: ${nomeDistrito?.Distritos ?? nomeDistrito?.nome ?? filtroDistrito}`,
    filtroBase && `Base: ${nomeBase?.Base ?? filtroBase}`,
    CONTEUDOS.find(c => c.key === conteudo)?.label,
    mostraCartoes && filtroCartoes !== 'todos' && FILTROS_CARTOES.find(f => f.key === filtroCartoes)?.label,
    mostraCartoes && filtroMeta !== 'todas' && FILTROS_META.find(f => f.key === filtroMeta)?.label,
  ].filter(Boolean).join(' · ')

  function baixarCSV() {
    const num = v => fmtPts(v).replace('.', ',') // vírgula decimal para o Excel pt-BR
    const linhas = []
    relatorio.forEach(b => {
      const geo = {
        'Região': b.regiao, 'Distrito': b.distrito, 'Igreja': b.igreja, 'Base': b.nome,
        'Alunos cadastrados': b.temDiscipulado ? b.cadastrados : '',
        'Alunos em andamento': b.temDiscipulado ? b.alunosAndamento : '',
        'Alunos concluídos': b.temDiscipulado ? b.alunosConcluidos : '',
        [`Meta ${META_LABEL} (alunos)`]: b.temDiscipulado ? b.metaAlunos : '',
        '% com cartão ativado': b.temDiscipulado ? fmtPct(b.percentual) : '',
        [`Meta ${META_LABEL}`]: b.temDiscipulado ? SITUACAO_META[b.situacaoMeta].texto : '',
      }
      if (mostraCartoes && b.temDiscipulado && desafioDiscipulado) linhas.push({
        ...geo, 'Tipo': 'Discipulado (resumo da base)',
        'Aluno / Desafio': desafioDiscipulado.nome, 'Detalhe': b.marcado ? 'Desafio marcado' : 'Desafio não marcado',
        'Início': '', 'Encerramento': '', 'Foto': '', 'Situação': SITUACAO_META[b.situacaoMeta].texto,
        'Lançamentos': '', 'Pontos': num(b.pontosDiscipulado),
      })
      b.cards.forEach(c => linhas.push({
        ...geo, 'Tipo': 'Cartão de discípulo',
        'Aluno / Desafio': c.aluno, 'Detalhe': [c.cartao, c.departamento].filter(Boolean).join(' · '),
        'Início': c.inicio ? fmtData(c.inicio) : '', 'Encerramento': c.fim ? fmtData(c.fim) : '',
        'Foto': c.foto ? 'Sim' : 'Não', 'Situação': SITUACAO_CARTAO_LABEL[c.situacao],
        'Lançamentos': '', 'Pontos': ptsPorCartao > 0 ? num(c.pontos) : '',
      }))
      b.midia.forEach(d => linhas.push({
        ...geo, 'Tipo': 'Desafio de Mídia',
        'Aluno / Desafio': d.nome, 'Detalhe': d.regra,
        'Início': '', 'Encerramento': '', 'Foto': '',
        'Situação': d.pontuam < d.lancamentos ? `${d.lancamentos - d.pontuam} lançamento(s) não pontuam` : '',
        'Lançamentos': d.lancamentos, 'Pontos': num(d.pontos),
      }))
    })
    if (!linhas.length) return
    const headers = Object.keys(linhas[0])
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = '﻿' + [headers.map(escape).join(';'), ...linhas.map(l => headers.map(h => escape(l[h])).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `validacao-lancamentos-${tipo.replace(/\W+/g, '').toLowerCase()}-${ano}.csv`)
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const semDados = !isLoading && relatorio.length === 0

  // Bases (dentro dos filtros atuais) em que o desafio marcado não bate com a meta
  const divergentes = relatorio.filter(b => b.situacaoMeta === 'nao_marcado' || b.situacaoMeta === 'marcado_sem')

  // Acerta de uma vez o desafio das bases divergentes (marcações manuais
  // antigas). Daqui pra frente o sistema mantém sozinho, a cada cartão ou
  // membro salvo/excluído.
  async function sincronizarDivergentes() {
    if (!divergentes.length) return
    const marcar = divergentes.filter(b => b.situacaoMeta === 'nao_marcado')
    const desmarcar = divergentes.filter(b => b.situacaoMeta === 'marcado_sem')
    const lista = (itens) => itens.map(b => `  • ${b.nome}`).join('\n')
    const msg = [
      `Sincronizar o desafio "${desafioDiscipulado?.nome}" (${ano}) com a meta de ${META_LABEL}?`,
      '',
      marcar.length ? `MARCAR (+${fmtPts(desafioDiscipulado?.pontos_total)} pts) em ${marcar.length} base(s):\n${lista(marcar)}` : '',
      desmarcar.length ? `DESMARCAR (−${fmtPts(desafioDiscipulado?.pontos_total)} pts) em ${desmarcar.length} base(s):\n${lista(desmarcar)}` : '',
      '',
      'Isso altera a pontuação dessas bases no Ranking.',
    ].filter((linha, i, arr) => linha !== '' || arr[i - 1] !== '').join('\n')
    if (!window.confirm(msg)) return

    setSincronizando(true)
    let ok = 0
    const falhas = []
    for (const b of divergentes) {
      try {
        await db.syncDiscipuladoDesafio(b.id, ano)
        ok++
      } catch (error) {
        console.error(`Erro ao sincronizar discipulado da base ${b.nome}:`, error)
        falhas.push(b.nome)
      }
    }
    setSincronizando(false)
    qc.invalidateQueries({ queryKey: ['ranking_marcos', ano] })
    qc.invalidateQueries({ queryKey: ['desafios_marcos'] })
    if (falhas.length) toast.error(`${ok} base(s) sincronizada(s); falhou em: ${falhas.join(', ')}`)
    else toast.success(`${ok} base(s) sincronizada(s) com a meta de discipulado.`)
  }

  const resumo = [
    { label: 'Bases listadas', value: totais.bases },
    mostraCartoes && { label: 'Alunos cadastrados', value: totais.cadastrados },
    mostraCartoes && { label: 'Alunos em andamento', value: totais.andamento },
    mostraCartoes && { label: 'Alunos concluídos', value: totais.concluidos },
    mostraCartoes && { label: `Bases com meta ${META_LABEL}`, value: totais.metaAtingida },
    mostraCartoes && desafioDiscipulado && { label: 'Divergências', value: totais.divergencias },
    mostraMidia && { label: 'Pts Mídia', value: fmtPts(totais.pontosMidia) },
  ].filter(Boolean)

  return (
    <div className="base-report-shell validacao-shell">
      {/* ── Filtros (não saem na impressão) ── */}
      <div className="card section no-print">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title">🔎 Validação de Lançamentos</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`btn btn-outline report-print-button ${isSoul ? 'report-print-button-soul' : 'report-print-button-teen'}`} onClick={() => window.print()} disabled={isLoading || semDados}>
              🖨️ Imprimir / PDF
            </button>
            <button type="button" className="btn btn-outline" onClick={baixarCSV} disabled={isLoading || semDados}>
              ⬇️ Baixar CSV
            </button>
            {desafioDiscipulado && conteudo !== 'midia' && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={sincronizarDivergentes}
                disabled={isLoading || sincronizando || divergentes.length === 0}
                title="Marca/desmarca o desafio de discipulado das bases divergentes conforme a meta"
              >
                {sincronizando ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '🔄'} Sincronizar divergências ({divergentes.length})
              </button>
            )}
          </div>
        </div>

        <div className="tier-filter" role="group" aria-label="Ministério" style={{ marginBottom: 12 }}>
          {MINISTERIOS.map(m => (
            <button key={m.key} type="button" className={tipo === m.key ? 'active' : ''} onClick={() => { setTipo(m.key); setFiltroBase('') }}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="form-grid" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label>Ano</label>
            <select value={ano} onChange={e => setAno(Number(e.target.value))}>
              {[anoAtual() - 1, anoAtual(), anoAtual() + 1].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Região</label>
            <select value={filtroRegiao} onChange={e => { setFiltroRegiao(e.target.value); setFiltroDistrito(''); setFiltroBase('') }}>
              <option value="">Todas…</option>
              {regioes.map(r => <option key={r.id_regiao ?? r.id} value={r.id_regiao ?? r.id}>{r.Regiao ?? r.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Distrito</label>
            <select value={filtroDistrito} onChange={e => { setFiltroDistrito(e.target.value); setFiltroBase('') }}>
              <option value="">Todos…</option>
              {distritosOpts.map(d => <option key={d.id_distritos ?? d.id} value={d.id_distritos ?? d.id}>{d.Distritos ?? d.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Base</label>
            <select value={filtroBase} onChange={e => setFiltroBase(e.target.value)}>
              <option value="">Todas…</option>
              {basesOpts.map(b => <option key={b.id_base ?? b.id} value={b.id_base ?? b.id}>{b.Base ?? b.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Conteúdo</label>
            <select value={conteudo} onChange={e => setConteudo(e.target.value)}>
              {CONTEUDOS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Meta de discipulado</label>
            <select value={filtroMeta} onChange={e => setFiltroMeta(e.target.value)} disabled={!mostraCartoes}>
              {FILTROS_META.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Cartões</label>
            <select value={filtroCartoes} onChange={e => setFiltroCartoes(e.target.value)} disabled={!mostraCartoes}>
              {FILTROS_CARTOES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.55 }}>
          💡 Só aparecem bases com ao menos um cartão de discípulo ou desafio de Mídia lançado. Meta de discipulado: alunos com cartão ativado (em andamento ou concluído) ≥ {META_LABEL} dos alunos cadastrados na base, arredondado para cima (ex.: 7 alunos × {META_LABEL} = 2,8 → 3 alunos)
          {desafioDiscipulado ? <> — o desafio “{desafioDiscipulado.nome}” ({fmtPts(desafioDiscipulado.pontos_total)} pts) é marcado automaticamente a cada cartão ou membro salvo; divergências indicam marcações antigas a sincronizar.</> : '.'}
        </div>
      </div>

      {isLoading && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 14px' }} />
          <p style={{ opacity: 0.6 }}>Carregando lançamentos…</p>
        </div>
      )}

      {semDados && (
        <div className="card empty-state">
          <div className="empty-icon">🔎</div>
          <p>Nenhuma base com lançamentos para os filtros escolhidos.</p>
        </div>
      )}

      {!isLoading && relatorio.length > 0 && (
        <div className={`base-report-page ${isSoul ? 'report-soul' : 'report-teen'}`}>
          <div className="base-report-heading" style={{ borderColor: isSoul ? '#FF8F00' : '#22D3EE' }}>
            <div className="base-report-brand" style={{ color: isSoul ? '#FF8F00' : '#22D3EE' }}>{isSoul ? 'Soul+' : 'G148 Teen'}</div>
            <div className="base-report-document-title">Relatório de Validação de Lançamentos</div>
            <div className="base-report-document-subtitle">Cartões de discípulos e desafios de Mídia · {filtrosDescricao}</div>
            <div className="base-report-document-subtitle">Emitido em {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
          </div>

          <div className="stats-grid" style={{ margin: '18px 0' }}>
            {resumo.map(s => (
              <div key={s.label} className="stat-card c1" style={{ padding: '12px 10px' }}>
                <div className="stat-num" style={{ fontSize: 22 }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {relatorio.map(base => {
            const meta = SITUACAO_META[base.situacaoMeta]
            return (
              <section className="base-report-quarter validacao-base" key={base.id}>
                <div className="base-report-quarter-heading" style={{ flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px' }}>
                    <div className="base-report-quarter-title">{base.nome}</div>
                    <div className="base-report-quarter-period">{[base.igreja, base.distrito, base.regiao].filter(Boolean).join(' · ')}</div>
                  </div>
                  {mostraCartoes && base.temDiscipulado && (
                    <div className="validacao-contagem">
                      <span>👥 <b>{base.cadastrados}</b> cadastrados</span>
                      <span>🟢 <b>{base.alunosAndamento}</b> em andamento</span>
                      <span title="Alunos com cartão concluído — também contam para a meta">✅ <b>{base.alunosConcluidos}</b> concluídos</span>
                      <span style={{ color: meta.cor, borderColor: meta.cor }}>
                        🎯 meta <b>{base.metaAlunos}</b> · <b>{fmtPct(base.percentual)}</b> com cartão · {meta.texto}
                      </span>
                    </div>
                  )}
                </div>

                {mostraCartoes && base.temDiscipulado && (
                  <>
                    <h4>Cartões de discípulos</h4>
                    {base.cards.length === 0 ? <div className="base-report-empty">{base.temCartoes ? 'Nenhum cartão para o filtro escolhido.' : 'Nenhum cartão de discípulo cadastrado na base.'}</div> : (
                      <div className="table-wrap"><table>
                        <thead><tr>
                          <th>Aluno</th><th>Cartão / Departamento</th><th>Início</th><th>Encerramento</th><th>Foto</th><th>Situação</th>
                          {ptsPorCartao > 0 && <th>Pontos</th>}
                        </tr></thead>
                        <tbody>{base.cards.map(c => (
                          <tr key={c.id}>
                            <td>{c.aluno}</td>
                            <td>{[c.cartao, c.departamento].filter(Boolean).join(' · ') || '—'}</td>
                            <td>{c.inicio ? fmtData(c.inicio) : '—'}</td>
                            <td>{c.fim ? fmtData(c.fim) : '—'}</td>
                            <td>{c.foto ? <a href={c.foto} target="_blank" rel="noopener noreferrer">Ver</a> : 'Sem foto'}</td>
                            <td style={{ color: c.situacao === 'pendente' ? '#b45309' : undefined }}>{SITUACAO_CARTAO_LABEL[c.situacao]}</td>
                            {ptsPorCartao > 0 && <td><strong>{fmtPts(c.pontos)}</strong></td>}
                          </tr>
                        ))}</tbody>
                      </table></div>
                    )}
                  </>
                )}

                {mostraMidia && (
                  <>
                    <h4>Desafios de Mídia</h4>
                    {base.midia.length === 0 ? <div className="base-report-empty">Nenhum desafio de Mídia lançado.</div> : (
                      <div className="table-wrap"><table>
                        <thead><tr><th>Desafio</th><th>Regra</th><th>Lançamentos</th><th>Pontos</th></tr></thead>
                        <tbody>{base.midia.map(d => (
                          <tr key={d.id}>
                            <td><strong>{d.nome}</strong></td>
                            <td>{d.regra}</td>
                            <td>
                              {d.lancamentos}
                              {d.pontuam < d.lancamentos && <span style={{ color: '#b45309' }}> ({d.lancamentos - d.pontuam} não pontua{d.lancamentos - d.pontuam === 1 ? '' : 'm'})</span>}
                            </td>
                            <td><strong>{fmtPts(d.pontos)}</strong></td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                    )}
                  </>
                )}

                <div className="base-report-quarter-total">
                  {mostraCartoes && base.temDiscipulado && desafioDiscipulado && (
                    <>Discipulado: <strong>{fmtPts(base.pontosDiscipulado + base.pontosCartoes)} pts</strong> ({base.marcado ? 'desafio marcado' : 'desafio não marcado'})</>
                  )}
                  {mostraCartoes && base.temDiscipulado && desafioDiscipulado && mostraMidia && ' · '}
                  {mostraMidia && <>Mídia: <strong>{fmtPts(base.pontosMidia)} pts</strong></>}
                </div>
              </section>
            )
          })}

          <div className="base-report-closing">
            <h3>Fechamento</h3>
            <div className="base-report-closing-grid">
              {resumo.map(s => <div key={s.label}><span>{s.label}</span><strong>{s.value}</strong></div>)}
              {mostraCartoes && desafioDiscipulado && <div><span>Pts discipulado</span><strong>{fmtPts(totais.pontosDiscipulado)}</strong></div>}
              <div className="base-report-closing-total">
                <span>Total conferido</span>
                <strong>{fmtPts((mostraCartoes ? totais.pontosDiscipulado : 0) + (mostraMidia ? totais.pontosMidia : 0))} pontos</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
