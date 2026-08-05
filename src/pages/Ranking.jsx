import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTable } from '../hooks/useTable'
import { db } from '../api/db'
import { useAuthStore } from '../store/authStore'
import { gerarSabados, divisorCadencia, contarMesesDistintos, isProvaBonus, isProvaTitulo } from '../lib/desafiosPontuacao'

function anoAtual() { return new Date().getFullYear() }

function normalizeBaseName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getTier(score, isSoul = false) {
  if (score >= 1400) return { nome: 'Sou Mega',    cor: '#FFD700', bg: isSoul ? 'rgba(141,82,0,.15)' : 'rgba(255,215,0,.15)',   icon: '🥇' }
  if (score >= 850)  return { nome: 'Sou Master',  cor: isSoul ? '#757575' : '#C0C0C0', bg: isSoul ? 'rgba(117,117,117,.13)' : 'rgba(192,192,192,.13)', icon: '🥈' }
  if (score >= 500)  return { nome: 'Tô Dentro',   cor: isSoul ? '#92400E' : '#CD7F32', bg: isSoul ? 'rgba(146,64,14,.13)' : 'rgba(205,127,50,.13)',  icon: '🥉' }
  if (score >= 200)  return { nome: 'Faço Parte',  cor: isSoul ? '#5B21B6' : '#7B68EE', bg: isSoul ? 'rgba(91,33,182,.13)' : 'rgba(123,104,238,.13)', icon: '⭐' }
  return         { nome: 'Participando', cor: '#6B7280', bg: 'rgba(107,114,128,.1)',  icon: '🚩' }
}

const TIERS_ORDER = [
  { min: 1400, max: Infinity, nome: 'Sou Mega',    cor: '#FFD700', icon: '🥇' },
  { min: 850,  max: 1399,    nome: 'Sou Master',  cor: '#C0C0C0', icon: '🥈' },
  { min: 500,  max: 849,     nome: 'Tô Dentro',   cor: '#CD7F32', icon: '🥉' },
  { min: 200,  max: 499,     nome: 'Faço Parte',  cor: '#7B68EE', icon: '⭐' },
  { min: 0,    max: 199,     nome: 'Participando', cor: '#6B7280', icon: '🚩' },
]

const NIVEIS = [
  { key: 'geral',     label: 'Geral',       icon: '🌎' },
  { key: 'regional',  label: 'Regional',    icon: '🗺️' },
  { key: 'distrital', label: 'Distrital',   icon: '📍' },
  { key: 'igreja',    label: 'Por Igreja',  icon: '⛪' },
  { key: 'base',      label: 'Por Base',    icon: '🏠' },
]

const PODIUM_CFG = {
  1: {
    height: 110, avatarSize: 72,
    bg:          'linear-gradient(135deg,#FFD700 0%,#F59E0B 100%)',
    glow:        '0 0 28px rgba(255,215,0,.55)',
    platformBg:  (isSoul) => isSoul ? 'linear-gradient(180deg,rgba(141,82,0,.25) 0%,rgba(141,82,0,.08) 100%)' : 'linear-gradient(180deg,rgba(255,215,0,.22) 0%,rgba(255,215,0,.06) 100%)',
    border: '#FFD700', medal: '👑',
  },
  2: {
    height: 80, avatarSize: 60,
    bg:          'linear-gradient(135deg,#9BA3B5 0%,#6B7280 100%)',
    glow:        '0 0 18px rgba(155,163,181,.4)',
    platformBg:  (isSoul) => isSoul ? 'linear-gradient(180deg,rgba(117,117,117,.2) 0%,rgba(117,117,117,.08) 100%)' : 'linear-gradient(180deg,rgba(155,163,181,.18) 0%,rgba(155,163,181,.05) 100%)',
    border: '#9BA3B5', medal: '🥈',
  },
  3: {
    height: 60, avatarSize: 52,
    bg:          'linear-gradient(135deg,#CD7F32 0%,#92400E 100%)',
    glow:        '0 0 14px rgba(205,127,50,.4)',
    platformBg:  (isSoul) => isSoul ? 'linear-gradient(180deg,rgba(146,64,14,.2) 0%,rgba(146,64,14,.08) 100%)' : 'linear-gradient(180deg,rgba(205,127,50,.18) 0%,rgba(205,127,50,.05) 100%)',
    border: '#CD7F32', medal: '🥉',
  },
}

function PodiumSlot({ item, rank, showPoints, labelPts }) {
  if (!item) return <div style={{ flex: '0 1 180px', maxWidth: 200 }} />
  const cfg = PODIUM_CFG[rank]
  const initials = (item.nome || '?').slice(0, 2).toUpperCase()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 1 180px', maxWidth: 200, gap: 5 }}>
      <span style={{ fontSize: 26, filter: rank === 1 ? 'drop-shadow(0 0 10px rgba(255,215,0,.6))' : 'none' }}>
        {cfg.medal}
      </span>
      <div style={{
        width: cfg.avatarSize, height: cfg.avatarSize, borderRadius: '50%',
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: Math.round(cfg.avatarSize * 0.32), color: '#fff',
        boxShadow: cfg.glow, border: `3px solid ${cfg.border}`, letterSpacing: -1,
      }}>
        {initials}
      </div>
      <div style={{
        textAlign: 'center', fontWeight: 800, fontSize: rank === 1 ? 16 : 14,
        maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: 'inherit',
      }}>
        {item.nome}
      </div>
      {item.sub && (
        <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 500, textAlign: 'center', maxWidth: 150, lineHeight: 1.3 }}>
          {item.sub}
        </div>
      )}
      {showPoints && (
        <div style={{
          fontWeight: 900, color: cfg.border, fontSize: rank === 1 ? 22 : 18,
          textShadow: rank === 1 && !item.isSoul ? '0 0 12px rgba(255,215,0,.4)' : 'none',
        }}>
          {Number(item.pontos).toFixed(1)} <span style={{ fontSize: 12, opacity: 0.7 }}>{labelPts}</span>
        </div>
      )}
      {item.tier && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: item.tier.cor,
          padding: '3px 10px', borderRadius: 10,
          background: item.tier.bg, border: `1px solid ${item.tier.cor}33`,
        }}>
          {item.tier.icon} {item.tier.nome}
        </div>
      )}
      <div style={{
        width: '100%', height: cfg.height,
        background: typeof cfg.platformBg === 'function' ? cfg.platformBg(item.isSoul) : cfg.platformBg, 
        border: `1px solid ${cfg.border}${item.isSoul ? '55' : '33'}`,
        borderRadius: '10px 10px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 38, fontWeight: 900, color: cfg.border, opacity: item.isSoul ? 0.5 : 0.35 }}>{rank}°</span>
      </div>
    </div>
  )
}

function Podium({ top3, showPoints, labelPts = 'pts' }) {
  const [segundo, primeiro, terceiro] = [top3[1], top3[0], top3[2]]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6, padding: '8px 8px 0', maxWidth: 560, margin: '0 auto' }}>
      <PodiumSlot item={segundo}  rank={2} showPoints={showPoints} labelPts={labelPts} />
      <PodiumSlot item={primeiro} rank={1} showPoints={showPoints} labelPts={labelPts} />
      <PodiumSlot item={terceiro} rank={3} showPoints={showPoints} labelPts={labelPts} />
    </div>
  )
}

// Novo layout em 4 colunas por tier (para view de bases)
function BaseRankingByTiers({ items, showPoints, labelPts = 'pts', isAdmin = false }) {
  // Agrupa os itens por tier
  const itemsByTier = useMemo(() => {
    const grouped = {}
    TIERS_ORDER.forEach(t => { grouped[t.nome] = [] })
    items.forEach(item => {
      const tier = getTier(item.pontos, item.isSoul)
      grouped[tier.nome].push(item)
    })
    // Ordena alfabeticamente dentro de cada tier
    Object.keys(grouped).forEach(tierName => {
      grouped[tierName].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''))
    })
    return grouped
  }, [items])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, paddingTop: 12 }}>
      {TIERS_ORDER.map(tier => {
        const basesNoTier = itemsByTier[tier.nome] ?? []
        if (basesNoTier.length === 0) return null
        const isParticipando = tier.nome === 'Participando'

        return (
          <div key={tier.nome} style={{
            borderRadius: 12, overflow: 'hidden',
            border: `2px solid ${tier.cor}${isParticipando ? '60' : ''}`,
            background: `${tier.cor}${isParticipando ? '06' : '08'}`,
          }}>
            {/* Header da coluna */}
            <div style={{
              background: isParticipando
                ? `linear-gradient(135deg,${tier.cor}aa 0%,${tier.cor}88 100%)`
                : `linear-gradient(135deg,${tier.cor} 0%,${tier.cor}dd 100%)`,
              padding: '14px 16px', textAlign: 'center',
              color: '#fff',
            }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{tier.icon}</div>
              <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: '.5px', textTransform: 'uppercase' }}>
                {tier.nome}
              </div>
              {isParticipando && (
                <div style={{ fontSize: 11, opacity: 0.9, marginTop: 3, fontWeight: 500, fontStyle: 'italic' }}>
                  na linha de partida
                </div>
              )}
              <div style={{ fontSize: 12, opacity: 0.95, marginTop: 4, fontWeight: 600 }}>
                {basesNoTier.length} {basesNoTier.length === 1 ? 'base' : 'bases'}
              </div>
            </div>

            {/* Lista de bases */}
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {basesNoTier.map((item, idx) => (
                <div key={item.id ?? item.nome ?? idx} style={{
                  padding: isParticipando ? '8px 12px' : '10px 12px',
                  borderRadius: 8,
                  background: `${tier.cor}${isParticipando ? '0a' : '12'}`,
                  border: `1px solid ${tier.cor}${isParticipando ? '22' : '33'}`,
                }}>
                  <div style={{
                    fontWeight: isParticipando ? 500 : 700,
                    fontSize: isParticipando ? 13 : 14,
                    marginBottom: item.sub ? 2 : 0,
                    opacity: isParticipando ? 0.85 : 1,
                  }}>
                    {item.nome}
                  </div>
                  {item.sub && (
                    <div style={{ fontSize: 11, opacity: 0.5 }}>
                      {item.sub}
                    </div>
                  )}
                  {(showPoints || isAdmin) && (
                    <div style={{ marginTop: 4, textAlign: 'right', fontWeight: 800, color: tier.cor, fontSize: 12 }}>
                      {Number(item.pontos ?? 0).toFixed(1)} pts
                    </div>
                  )}
                  {isAdmin && Number.isFinite(Number(item.notaMedia)) && (
                    <div style={{ marginTop: 2, textAlign: 'right', fontSize: 11, opacity: 0.65 }}>
                      notas: {Number(item.notaMedia).toFixed(1)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RankingList({ items, startRank, showPoints, labelPts = 'pts' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => {
        const rank = startRank + i
        const isTop10 = rank <= 10
        const initials = (item.nome || '?').slice(0, 2).toUpperCase()
        return (
          <div key={item.id ?? item.nome ?? i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
            background: isTop10 ? (item.isSoul ? 'rgba(255,143,0,.08)' : 'rgba(124,58,237,.07)') : (item.isSoul ? 'rgba(62,32,0,.03)' : 'rgba(255,255,255,.03)'),
            borderRadius: 10,
            border: '1px solid ' + (isTop10 ? (item.isSoul ? 'rgba(255,143,0,.25)' : 'rgba(124,58,237,.15)') : (item.isSoul ? 'rgba(62,32,0,.05)' : 'rgba(255,255,255,.05)')),
          }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: isTop10 ? (item.isSoul ? 'rgba(255,143,0,.15)' : 'rgba(124,58,237,.2)') : (item.isSoul ? 'rgba(62,32,0,.06)' : 'rgba(255,255,255,.06)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13,
          color: isTop10 ? (item.isSoul ? 'var(--soul-brown)' : 'var(--c1)') : 'inherit',
        }}>
          {rank}
        </div>
            <div style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,var(--c1) 0%,var(--c3) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, color: '#fff',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.nome}
              </div>
              {item.sub && <div style={{ fontSize: 11, opacity: 0.5 }}>{item.sub}</div>}
            </div>
            {item.extra && <div style={{ fontSize: 11, opacity: 0.4, flexShrink: 0 }}>{item.extra}</div>}
            {item.tier && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 12, flexShrink: 0,
                background: `${item.tier.cor}18`, border: `1px solid ${item.tier.cor}44`,
                fontSize: 11, fontWeight: 700, color: item.tier.cor,
              }}>
                {item.tier.icon} {item.tier.nome}
              </div>
            )}
            {showPoints && (
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--c2)', flexShrink: 0 }}>
                {Number(item.pontos).toFixed(1)} {labelPts}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Top3Chips({ top3, showPoints, labelPts }) {
  return (
    <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {top3.map((item, i) => {
        const cfg = PODIUM_CFG[i + 1]
        return (
          <div key={item.id ?? i} style={{
            flex: 1, minWidth: 120, padding: '8px 12px', borderRadius: 10,
            background: `linear-gradient(135deg,${cfg.border}18 0%,${cfg.border}06 100%)`,
            border: `1px solid ${cfg.border}44`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>{cfg.medal}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.nome}
              </div>
              {showPoints && (
                <div style={{ fontSize: 12, color: cfg.border, fontWeight: 700 }}>
                  {Number(item.pontos).toFixed(1)} {labelPts}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────
export default function Ranking() {
  const { type } = useParams()
  const currentTipo = type === 'soul' ? 'Soul+' : 'G148 Teen'

  const isAdmin = useAuthStore(s => s.isAdmin)
  const canSeePoints = isAdmin

  const [ano, setAno]                 = useState(anoAtual())

  const [view, setView]               = useState('bases')   // 'bases' | 'alunos'
  const [nivel, setNivel]             = useState('geral')
  const [filtroRegiao, setFiltroRegiao]       = useState('')
  const [filtroDistrito, setFiltroDistrito]   = useState('')
  const [filtroIgreja, setFiltroIgreja]       = useState('')
  const [filtroBase, setFiltroBase]           = useState('')
  const LIVE_REFRESH_MS = 8000

  const { data: bases = [] }     = useTable('Bases')
  const { data: regioes = [] }   = useTable('Regiao')
  const { data: distritos = [] } = useTable('Distritos')
  const { data: igrejas = [] }   = useTable('Igrejas')

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

      const baseNameNorm = normalizeBaseName(base.Base ?? base.nome ?? '')
      const notaMedia     = notasMediaPorBase.byId?.[String(baseId)] ?? notasMediaPorBase.byName?.[baseNameNorm] ?? 0
      const discipulosPts = discipulosPtsPorBase[baseId] ?? 0
      const batismosPts   = batismosPtsPorBase[baseId]  ?? 0
      const pontos = Math.round((weeklyPts + mensaisPts + pontuaisPts + anuaisPts + notaMedia + discipulosPts + batismosPts) * 10) / 10

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
      }
    }).sort((a, b) => b.pontos - a.pontos)
  }, [basesFiltradas, catalogo, trimestresConfig, todosRegistros, todosMarcos, notasMediaPorBase, discipulosPtsPorBase, batismosPtsPorBase])

  // Ranking individual de alunos:
  // pontos = soma das médias trimestrais do aluno. Cada trimestre pontua
  // (soma das notas regulares do trimestre ÷ nº de provas esperadas naquele
  // trimestre) + soma das provas bônus (somadas direto, fora da divisão).
  // O nº de provas esperadas é fixo por trimestre — nº de sábados (G148 Teen,
  // ~13, uma prova por semana) ou nº de meses (Soul+, ~3, uma prova por mês) —
  // e não pelo nº de provas que o aluno realmente fez. Isso evita que o Soul+
  // (cadência mensal) fique artificialmente em desvantagem frente ao G148
  // (cadência semanal) só por ter menos oportunidades de prova no calendário.
  const rankingAlunos = useMemo(() => {
    const isSoul = currentTipo === 'Soul+'
    const divisorPorTrimestre = {}

    const findTrimestre = (dataStr) =>
      trimestresConfig.find(tc => dataStr >= tc.primeiro_sabado && dataStr <= tc.ultimo_sabado) ?? null

    const getDivisor = (tc) => {
      const key = tc ? `${tc.ano}-${tc.trimestre}` : 'sem-trimestre'
      if (divisorPorTrimestre[key] != null) return divisorPorTrimestre[key]
      const sabadosTc = tc ? gerarSabados(tc.primeiro_sabado, tc.ultimo_sabado) : []
      const divisor = tc
        ? (isSoul ? contarMesesDistintos(sabadosTc) : sabadosTc.length) || 1
        : (isSoul ? 3 : 13) // fallback p/ notas fora de qualquer trimestre configurado
      divisorPorTrimestre[key] = divisor
      return divisor
    }

    const map = {}
    todasNotas.forEach(r => {
      const nota = Number(r.nota ?? r.Nota)
      if (!Number.isFinite(nota)) return
      // No Soul+, só "NN Prova Soul+" tem nota de verdade — "Registro Semanal"
      // (Comunhão/Verso/Discipulado/300, sem nota) não conta pra média.
      if (isSoul && !isProvaTitulo(r.titulo ?? r.Titulo)) return
      const nome = r.Membros ?? r.nome_aluno ?? ''
      if (!nome.trim()) return
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
  }, [todasNotas, trimestresConfig, currentTipo, basePorAluno])

  // Número de bases G148 por igreja
  const basesPerIgreja = useMemo(() => {
    const map = {}
    basesFiltradas.forEach(b => {
      const key = b.id_igrejas ?? b.igreja_id ?? ''
      if (key) map[key] = (map[key] ?? 0) + 1
    })
    return map
  }, [basesFiltradas])

  // Opts filtrados por seleção atual
  const distritosOpts = useMemo(() =>
    distritos.filter(d => !filtroRegiao || (d.id_regiao ?? d.regiao_id) === filtroRegiao),
    [distritos, filtroRegiao]
  )

  const igrejasOpts = useMemo(() =>
    igrejas.filter(ig => !filtroDistrito || (ig.id_distritos ?? ig.distrito_id) === filtroDistrito),
    [igrejas, filtroDistrito]
  )

  const basesOpts = useMemo(() =>
    basesFiltradas
      .filter(b => {
        if (filtroRegiao   && (b.id_regiao ?? b.regiao_id)     !== filtroRegiao)   return false
        if (filtroDistrito && (b.id_distritos ?? b.distrito_id) !== filtroDistrito) return false
        if (filtroIgreja   && (b.id_igrejas ?? b.igreja_id)     !== filtroIgreja)   return false
        return true
      })
      .sort((a, b) => (a.Base ?? '').localeCompare(b.Base ?? '')),
    [basesFiltradas, filtroRegiao, filtroDistrito, filtroIgreja]
  )

  // Sumário de tiers (só para view=bases)
  const tierSummary = useMemo(() => {
    if (!scoresPorBase.length) return null
    const counts = {}
    TIERS_ORDER.forEach(t => { counts[t.nome] = 0 })
    scoresPorBase.forEach(b => {
      const t = getTier(b.pontos)
      counts[t.nome] = (counts[t.nome] ?? 0) + 1
    })
    return TIERS_ORDER.map(t => ({ ...t, count: counts[t.nome] ?? 0 })).filter(t => t.count > 0)
  }, [scoresPorBase])

  // Ranking de bases filtrado
  const rankingBasesFiltrado = useMemo(() => {
    let items = scoresPorBase.map(b => ({
      ...b,
      sub: [b.distrito, b.regiao].filter(Boolean).join(' · '),
      extra: b.notaMedia > 0 ? `média notas: ${b.notaMedia.toFixed(1)}` : null,
      tier: getTier(b.pontos, type === 'soul'),
      isSoul: type === 'soul',
    }))

    if (nivel === 'regional' && filtroRegiao) {
      items = items.filter(b => b.regiao_id === filtroRegiao)
    } else if (nivel === 'regional') {
      const map = {}
      scoresPorBase.forEach(b => {
        const key = b.regiao || '(sem região)'
        if (!map[key]) map[key] = { id: key, nome: key, pontos: 0, bases: 0, sub: null, extra: null }
        map[key].pontos += b.pontos
        map[key].bases++
      })
      items = Object.values(map)
        .sort((a, b) => b.pontos - a.pontos)
        .map(r => ({ ...r, tier: getTier(r.pontos, type === 'soul'), isSoul: type === 'soul', extra: `${r.bases} ${r.bases === 1 ? 'base' : 'bases'}` }))
    } else if (nivel === 'distrital') {
      const map = {}
      scoresPorBase
        .filter(b => !filtroRegiao || b.regiao_id === filtroRegiao)
        .forEach(b => {
          const key = b.distrito || '(sem distrito)'
          if (!map[key]) map[key] = { id: key, nome: key, pontos: 0, bases: 0, sub: b.regiao, extra: null }
          map[key].pontos += b.pontos
          map[key].bases++
        })
      items = Object.values(map)
        .sort((a, b) => b.pontos - a.pontos)
        .map(r => ({ ...r, tier: getTier(r.pontos, type === 'soul'), isSoul: type === 'soul', extra: `${r.bases} ${r.bases === 1 ? 'base' : 'bases'}` }))
    } else if (nivel === 'igreja') {
      const map = {}
      scoresPorBase
        .filter(b => !filtroRegiao   || b.regiao_id   === filtroRegiao)
        .filter(b => !filtroDistrito || b.distrito_id === filtroDistrito)
        .forEach(b => {
          const key = b.igreja || '(sem igreja)'
          if (!map[key]) map[key] = { id: key, nome: key, pontos: 0, bases: 0, sub: [b.distrito, b.regiao].filter(Boolean).join(' · '), extra: null }
          map[key].pontos += b.pontos
          map[key].bases++
        })
      items = Object.values(map)
        .sort((a, b) => b.pontos - a.pontos)
        .map(r => ({ ...r, tier: getTier(r.pontos, type === 'soul'), isSoul: type === 'soul', extra: `${r.bases} ${r.bases === 1 ? 'base' : 'bases'}` }))
    } else if (nivel === 'base') {
      if (filtroRegiao)   items = items.filter(b => b.regiao_id   === filtroRegiao)
      if (filtroDistrito) items = items.filter(b => b.distrito_id === filtroDistrito)
      if (filtroIgreja)   items = items.filter(b => b.igreja_id   === filtroIgreja)
    }

    return items
  }, [scoresPorBase, nivel, filtroRegiao, filtroDistrito, filtroIgreja])

  // Ranking de alunos filtrado
  const rankingAlunosFiltrado = useMemo(() => {
    let items = rankingAlunos.map(a => ({ ...a, isSoul: type === 'soul' }))

    if (nivel === 'regional') {
      if (filtroRegiao) items = items.filter(a => a.regiao_id === filtroRegiao)
    } else if (nivel === 'distrital') {
      if (filtroRegiao)   items = items.filter(a => a.regiao_id   === filtroRegiao)
      if (filtroDistrito) items = items.filter(a => a.distrito_id === filtroDistrito)
    } else if (nivel === 'igreja') {
      if (filtroRegiao)   items = items.filter(a => a.regiao_id   === filtroRegiao)
      if (filtroDistrito) items = items.filter(a => a.distrito_id === filtroDistrito)
      // Se a igreja tem apenas 1 base, não filtra por igreja (vai direto à base)
      if (filtroIgreja && (basesPerIgreja[filtroIgreja] ?? 0) > 1)
        items = items.filter(a => a.igreja_id === filtroIgreja)
      else if (filtroIgreja)
        items = items.filter(a => a.igreja_id === filtroIgreja)
    } else if (nivel === 'base') {
      if (filtroRegiao)   items = items.filter(a => a.regiao_id   === filtroRegiao)
      if (filtroDistrito) items = items.filter(a => a.distrito_id === filtroDistrito)
      if (filtroIgreja)   items = items.filter(a => a.igreja_id   === filtroIgreja)
      if (filtroBase)     items = items.filter(a => a.base_id     === filtroBase)
    }

    return items
  }, [rankingAlunos, nivel, filtroRegiao, filtroDistrito, filtroIgreja, filtroBase, basesPerIgreja])

  const listAtual    = view === 'bases' ? rankingBasesFiltrado : rankingAlunosFiltrado
  const top3         = listAtual.slice(0, 3)
  const resto        = listAtual.slice(3, 100)
  const nomeNivel    = NIVEIS.find(n => n.key === nivel)?.label ?? nivel
  const labelPts     = view === 'alunos' ? '(média)' : 'pts'
  const emptyLabel   = view === 'alunos' ? 'Nenhum aluno encontrado com notas registradas.' : 'Nenhuma base encontrada.'

  function changeNivel(key) {
    setNivel(key)
    setFiltroRegiao('')
    setFiltroDistrito('')
    setFiltroIgreja('')
    setFiltroBase('')
  }

  function changeView(v) {
    setView(v)
    setFiltroBase('')
  }

  const showGeoFilters = ['regional', 'distrital', 'igreja', 'base'].includes(nivel)
  const showBaseFilter = view === 'alunos' && nivel === 'base'

  return (
    <div>
      {/* ── Header ── */}
      <div className="card section" style={{
        background: 'linear-gradient(135deg,rgba(124,58,237,.15) 0%,rgba(251,113,133,.1) 100%)',
        borderColor: 'rgba(124,58,237,.3)',
      }}>
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ fontSize: 22 }}>🏆 Ranking {currentTipo}</div>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ width: 92 }}>
            {[anoAtual() - 1, anoAtual(), anoAtual() + 1].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* View: Bases / Alunos */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[
            { key: 'bases',  label: '⛪ Bases',  title: 'Ranking por base (desafios + média de notas)' },
            { key: 'alunos', label: '🎒 Alunos', title: 'Ranking individual por aluno (média das notas)' },
          ].map(({ key, label, title }) => (
            <button
              key={key}
              onClick={() => changeView(key)}
              title={title}
              style={{
                padding: '7px 18px', borderRadius: 20, border: '2px solid',
                borderColor: view === key ? 'var(--c3)' : 'rgba(255,255,255,.15)',
                background: view === key ? 'rgba(251,113,133,.2)' : 'transparent',
                color: view === key ? 'var(--c3)' : 'var(--muted)',
                cursor: 'pointer', fontWeight: view === key ? 700 : 400,
                fontSize: 14, transition: 'all .15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Nível */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: showGeoFilters ? 14 : 0 }}>
          {NIVEIS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => changeNivel(key)}
              style={{
                padding: '5px 13px', borderRadius: 20, border: '1px solid',
                borderColor: nivel === key ? 'var(--c1)' : 'rgba(62,32,0,.15)',
                background: nivel === key ? 'rgba(124,58,237,.2)' : 'transparent',
                color: nivel === key ? 'var(--c1)' : 'inherit',
                cursor: 'pointer', fontWeight: nivel === key ? 700 : 400,
                fontSize: 13, transition: 'all .15s',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Filtros geo */}
        {showGeoFilters && (
          <div className="form-grid" style={{ marginBottom: 0 }}>
            {nivel !== 'regional' && (
              <div className="form-group">
                <label>Região</label>
                <select value={filtroRegiao} onChange={e => { setFiltroRegiao(e.target.value); setFiltroDistrito(''); setFiltroIgreja(''); setFiltroBase('') }}>
                  <option value="">Todas…</option>
                  {regioes.map(r => (
                    <option key={r.id_regiao ?? r.id} value={r.id_regiao ?? r.id}>{r.Regiao ?? r.nome}</option>
                  ))}
                </select>
              </div>
            )}
            {['distrital', 'igreja', 'base'].includes(nivel) && (
              <div className="form-group">
                <label>Distrito</label>
                <select value={filtroDistrito} onChange={e => { setFiltroDistrito(e.target.value); setFiltroIgreja(''); setFiltroBase('') }} disabled={!filtroRegiao && nivel !== 'distrital'}>
                  <option value="">Todos…</option>
                  {distritosOpts.map(d => (
                    <option key={d.id_distritos ?? d.id} value={d.id_distritos ?? d.id}>{d.Distritos ?? d.nome}</option>
                  ))}
                </select>
              </div>
            )}
            {['igreja', 'base'].includes(nivel) && (
              <div className="form-group">
                <label>Igreja</label>
                <select value={filtroIgreja} onChange={e => { setFiltroIgreja(e.target.value); setFiltroBase('') }} disabled={!filtroDistrito}>
                  <option value="">Todas…</option>
                  {igrejasOpts.map(ig => (
                    <option key={ig.id_igrejas ?? ig.id} value={ig.id_igrejas ?? ig.id}>{ig.Igrejas ?? ig.nome}</option>
                  ))}
                </select>
              </div>
            )}
            {showBaseFilter && (
              <div className="form-group">
                <label>Base</label>
                <select value={filtroBase} onChange={e => setFiltroBase(e.target.value)}>
                  <option value="">Todas…</option>
                  {basesOpts.map(b => (
                    <option key={b.id_base ?? b.id} value={b.id_base ?? b.id}>{b.Base ?? b.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {view === 'bases' && (
          <div style={{ marginTop: 10, fontSize: 11, opacity: 0.5 }}>
            💡 Pontuação = desafios + média de notas + discípulos G148 + batismos
          </div>
        )}
        {view === 'alunos' && (
          <div style={{ marginTop: 10, fontSize: 11, opacity: 0.5 }}>
            💡 Pontuação = soma das médias trimestrais (notas ÷ provas esperadas no trimestre) + provas bônus
          </div>
        )}
      </div>

      {/* ── Sumário de tiers ── */}
      {!isLoading && view === 'bases' && tierSummary && tierSummary.length > 0 && (
        <div className="card section" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, opacity: 0.55, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            Classificação das Bases
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tierSummary.map(t => (
              <div key={t.nome} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: `${t.cor}18`, border: `1px solid ${t.cor}44`,
              }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: t.cor }}>{t.nome}</span>
                  <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 6 }}>
                    {t.count} {t.count === 1 ? 'base' : 'bases'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 14px' }} />
          <p style={{ opacity: 0.6 }}>Calculando ranking…</p>
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && listAtual.length === 0 && (
        <div className="card empty-state">
          <div className="empty-icon">🏆</div>
          <p>{emptyLabel}</p>
        </div>
      )}

      {/* ── Pódio (apenas para alunos) ── */}
      {!isLoading && view === 'alunos' && top3.length > 0 && (
        <div className="card section" style={{
          background: type === 'soul' 
            ? 'linear-gradient(180deg,rgba(255,143,0,.15) 0%,rgba(255,143,0,.05) 100%)'
            : 'linear-gradient(180deg,rgba(124,58,237,.13) 0%,rgba(251,113,133,.08) 55%,transparent 100%)',
          borderColor: type === 'soul' ? 'rgba(255,143,0,.40)' : 'rgba(124,58,237,.22)',
          overflow: 'hidden', position: 'relative',
        }}>
          {['⭐','✨','💫','⭐','✨','💫'].map((s, i) => (
            <span key={i} style={{
              position: 'absolute', fontSize: 12 + i * 4, opacity: type === 'soul' ? 0.6 + i * 0.05 : 0.12 + i * 0.03,
              top: `${10 + i * 14}%`, left: `${3 + i * 18}%`,
              pointerEvents: 'none', transform: `rotate(${i * 42}deg)`,
              color: type === 'soul' ? 'var(--soul-brown)' : 'inherit',
            }}>{s}</span>
          ))}
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 12, opacity: 0.55, fontWeight: 600, letterSpacing: '.6px', textTransform: 'uppercase' }}>
              ⚡ Top {nomeNivel} — {ano} {view === 'alunos' ? '· Alunos' : '· Bases'} ⚡
            </div>
          </div>
          <Podium top3={top3} showPoints={canSeePoints} labelPts={labelPts} />
        </div>
      )}

      {/* ── Lista completa ── */}
      {!isLoading && listAtual.length > 0 && (
        <div className="card section">
          <div className="card-header">
            <div className="card-title">
              📋 {view === 'alunos' ? 'Classificação de Alunos' : 'Classificação de Bases'} — {nomeNivel}
            </div>
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              {listAtual.length} {view === 'alunos' ? (listAtual.length === 1 ? 'aluno' : 'alunos') : (listAtual.length === 1 ? 'entrada' : 'entradas')}
              {listAtual.length > 100 ? ' · top 100' : ''}
            </span>
          </div>
          
          {/* Layout em 4 colunas para ranking de bases */}
          {view === 'bases' ? (
            <BaseRankingByTiers items={listAtual} showPoints={canSeePoints} labelPts={labelPts} isAdmin={isAdmin} />
          ) : (
            <>
              {top3.length > 0 && (
                <Top3Chips top3={top3} showPoints={canSeePoints} labelPts={labelPts} />
              )}
              {resto.length > 0 && (
                <RankingList items={resto} startRank={4} showPoints={canSeePoints} labelPts={labelPts} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
