import { useState, useMemo, useEffect } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useRankingData } from '../hooks/useRankingData'
import { useAuthStore } from '../store/authStore'
import { fmtPontos, fmtNumero, numCSV, downloadCSV } from '../utils/helpers'
import { getTier, TIERS_ORDER, normalizeBaseName, compareNome, ordenarItens } from '../lib/ranking'

function anoAtual() { return new Date().getFullYear() }


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
          {fmtPontos(item.pontos)} <span style={{ fontSize: 12, opacity: 0.7 }}>{labelPts}</span>
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


// Agrupa os itens por faixa, já ordenados dentro de cada faixa.
// A faixa é SEMPRE definida pela pontuação da base, nunca pela soma do
// agrupamento: uma região/distrito/igreja aparece em cada faixa em que tem
// bases, listando (e somando) só as bases daquela faixa.
function agruparPorFaixa(items, ordem) {
  const grouped = {}
  TIERS_ORDER.forEach(t => { grouped[t.nome] = [] })
  items.forEach(item => {
    if (!Array.isArray(item.basesList)) {
      grouped[getTier(item.pontos, item.isSoul).nome].push(item)
      return
    }
    const basesPorFaixa = {}
    item.basesList.forEach(base => {
      const faixa = getTier(base.pontos, item.isSoul).nome
      if (!basesPorFaixa[faixa]) basesPorFaixa[faixa] = []
      basesPorFaixa[faixa].push(base)
    })
    Object.entries(basesPorFaixa).forEach(([faixa, lista]) => {
      const pontos = Math.round(lista.reduce((s, b) => s + b.pontos, 0) * 10) / 10
      grouped[faixa].push({
        ...item,
        id: `${item.id}|${faixa}`,
        pontos,
        bases: lista.length,
        basesList: lista,
        tier: getTier(lista[0].pontos, item.isSoul),
        extra: `${lista.length} ${lista.length === 1 ? 'base' : 'bases'}`,
      })
    })
  })
  Object.keys(grouped).forEach(tierName => {
    grouped[tierName] = ordenarItens(grouped[tierName], ordem)
  })
  return grouped
}

const ORDENS = [
  { key: 'alfabetica', label: '🔤 Alfabética' },
  { key: 'pontuacao',  label: '🏅 Pontuação' },
]

// Novo layout em 4 colunas por tier (para view de bases)
function BaseRankingByTiers({ items, showPoints, isAdmin = false, onSelect, tierFilter, onTierFilterChange, ordem, onOrdemChange }) {
  const [abertos, setAbertos] = useState({})
  const itemsByTier = useMemo(() => agruparPorFaixa(items, ordem), [items, ordem])
  const mostrarPosicao = ordem === 'pontuacao'

  function toggleAberto(id) {
    setAbertos(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="tier-filter" role="group" aria-label="Filtrar bases por faixa">
          <button type="button" className={tierFilter === 'Todas' ? 'active' : ''} onClick={() => onTierFilterChange('Todas')}>Todas</button>
          {TIERS_ORDER.map(tier => (
            <button key={tier.nome} type="button" className={tierFilter === tier.nome ? 'active' : ''} onClick={() => onTierFilterChange(tier.nome)}>
              {tier.icon} {tier.nome}
            </button>
          ))}
        </div>
        {isAdmin && onOrdemChange && (
          <div className="tier-filter" role="group" aria-label="Ordenar dentro de cada faixa">
            <span style={{ fontSize: 12, opacity: 0.6, alignSelf: 'center', fontWeight: 600 }}>Ordenar:</span>
            {ORDENS.map(o => (
              <button key={o.key} type="button" className={ordem === o.key ? 'active' : ''} onClick={() => onOrdemChange(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, paddingTop: 12 }}>
      {TIERS_ORDER.map(tier => {
        const basesNoTier = itemsByTier[tier.nome] ?? []
        if (tierFilter !== 'Todas' && tierFilter !== tier.nome) return null
        if (basesNoTier.length === 0) return null
        const isParticipando = tier.nome === 'Participando'
        // Sanfona com a composição dos agrupamentos é exclusiva do admin
        const saoGrupos = isAdmin && Array.isArray(basesNoTier[0]?.basesList)

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
                {basesNoTier.length} {saoGrupos
                  ? (basesNoTier.length === 1 ? 'entrada' : 'entradas')
                  : (basesNoTier.length === 1 ? 'base' : 'bases')}
              </div>
            </div>

            {/* Lista de bases (ou agrupamentos com sanfona das bases que os compõem) */}
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {basesNoTier.map((item, idx) => {
                const isGrupo = saoGrupos && Array.isArray(item.basesList)
                const aberto = isGrupo && !!abertos[item.id]
                const cardStyle = {
                  padding: isParticipando ? '8px 12px' : '10px 12px',
                  borderRadius: 8,
                  background: `${tier.cor}${isParticipando ? '0a' : '12'}`,
                  border: `1px solid ${tier.cor}${isParticipando ? '22' : '33'}`,
                  color: 'inherit', textAlign: 'left', cursor: (isGrupo || onSelect) ? 'pointer' : 'default', width: '100%',
                }
                const conteudo = (
                  <>
                    <div style={{
                      display: 'flex', alignItems: 'baseline', gap: 6,
                      fontWeight: isParticipando ? 500 : 700,
                      fontSize: isParticipando ? 13 : 14,
                      marginBottom: item.sub ? 2 : 0,
                      opacity: isParticipando ? 0.85 : 1,
                    }}>
                      {mostrarPosicao && <span style={{ color: tier.cor, fontWeight: 900, minWidth: 26 }}>{item.posicao}º</span>}
                      <span style={{ flex: 1 }}>{item.nome}</span>
                      {isGrupo && <span aria-hidden="true" style={{ fontSize: 11, opacity: 0.6 }}>{aberto ? '▾' : '▸'}</span>}
                    </div>
                    {item.sub && (
                      <div style={{ fontSize: 11, opacity: 0.5 }}>
                        {item.sub}
                      </div>
                    )}
                    {isGrupo && (
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                        {item.extra} · {aberto ? 'ocultar' : 'ver'} composição
                      </div>
                    )}
                    {(showPoints || isAdmin) && (
                      <div style={{ marginTop: 4, textAlign: 'right', fontWeight: 800, color: tier.cor, fontSize: 12 }}>
                        {fmtPontos(item.pontos ?? 0)} pts
                      </div>
                    )}
                    {isAdmin && !isGrupo && Number.isFinite(Number(item.notaMedia)) && (
                      <div style={{ marginTop: 2, textAlign: 'right', fontSize: 11, opacity: 0.65 }}>
                        notas: {fmtPontos(item.notaMedia)}
                      </div>
                    )}
                  </>
                )

                if (!isGrupo) {
                  return (
                    <button key={item.id ?? item.nome ?? idx} type="button" onClick={() => onSelect?.(item.id)} title={onSelect ? 'Ver resumo e histórico da base' : undefined} style={cardStyle}>
                      {conteudo}
                    </button>
                  )
                }

                const composicao = ordenarItens(item.basesList, ordem)
                return (
                  <div key={item.id ?? item.nome ?? idx}>
                    <button type="button" onClick={() => toggleAberto(item.id)} aria-expanded={aberto} title="Ver as bases que compõem a pontuação" style={cardStyle}>
                      {conteudo}
                    </button>
                    {aberto && (
                      <div style={{
                        margin: '4px 0 0 10px', paddingLeft: 10,
                        borderLeft: `2px solid ${tier.cor}55`,
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}>
                        {composicao.map(base => (
                          <button
                            key={base.id}
                            type="button"
                            onClick={() => onSelect?.(base.id)}
                            title={onSelect ? 'Ver resumo e histórico da base' : undefined}
                            style={{
                              display: 'flex', alignItems: 'baseline', gap: 6,
                              padding: '6px 8px', borderRadius: 6, width: '100%', textAlign: 'left',
                              background: `${base.tier?.cor ?? tier.cor}10`,
                              border: `1px solid ${base.tier?.cor ?? tier.cor}2a`,
                              color: 'inherit', cursor: onSelect ? 'pointer' : 'default', fontSize: 12,
                            }}
                          >
                            {mostrarPosicao && <span style={{ fontWeight: 800, opacity: 0.7, minWidth: 24 }}>{base.posicao}º</span>}
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 600 }}>{base.nome}</span>
                              {base.tier && <span style={{ marginLeft: 4, fontSize: 10 }} title={base.tier.nome}>{base.tier.icon}</span>}
                            </span>
                            {(showPoints || isAdmin) && (
                              <span style={{ fontWeight: 700, color: base.tier?.cor ?? tier.cor, flexShrink: 0 }}>
                                {fmtPontos(base.pontos ?? 0)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      </div>
    </>
  )
}

// Versão para impressão: tabelas simples, respeitando nível, filtros,
// faixa e ordenação escolhidos. Agrupamentos saem sempre expandidos.
function RankingPrint({ view, items, tierFilter, ordem, titulo, filtrosDescricao, colunaNome }) {
  const emitidoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const mostrarPosicao = view === 'alunos' || ordem === 'pontuacao'

  function linhasFaixa(lista) {
    return lista.flatMap(item => {
      const linhas = [(
        <tr key={item.id}>
          {mostrarPosicao && <td><strong>{item.posicao}º</strong></td>}
          <td><strong>{item.nome}</strong>{item.basesList ? ` (${item.extra})` : ''}</td>
          <td>{item.sub || '—'}</td>
          <td><strong>{fmtPontos(item.pontos)}</strong></td>
        </tr>
      )]
      if (item.basesList) {
        ordenarItens(item.basesList, ordem).forEach(base => linhas.push(
          <tr key={`${item.id}-${base.id}`}>
            {mostrarPosicao && <td style={{ paddingLeft: 16 }}>{base.posicao}º</td>}
            <td style={{ paddingLeft: 16 }}>↳ {base.nome} <small>({base.tier?.nome})</small></td>
            <td>{base.sub || '—'}</td>
            <td>{fmtPontos(base.pontos)}</td>
          </tr>
        ))
      }
      return linhas
    })
  }

  const grupos = view === 'bases' ? agruparPorFaixa(items, ordem) : null

  return (
    <div className="ranking-print">
      <h1 style={{ fontSize: '16pt', margin: '0 0 4px' }}>{titulo}</h1>
      <div style={{ fontSize: '9pt', marginBottom: 2 }}>{filtrosDescricao}</div>
      <div style={{ fontSize: '8pt', marginBottom: 12 }}>Emitido em {emitidoEm}</div>

      {view === 'alunos' ? (
        <table>
          <thead><tr><th style={{ width: 50 }}>Pos.</th><th>Aluno</th><th>Base</th><th style={{ width: 90 }}>Provas</th><th style={{ width: 80 }}>Pontos</th></tr></thead>
          <tbody>
            {ordenarItens(items, 'pontuacao').map(item => (
              <tr key={item.id}>
                <td>{item.posicao}º</td><td>{item.nome}</td><td>{item.base || '—'}</td><td>{item.count}</td><td>{fmtPontos(item.pontos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        TIERS_ORDER
          .filter(tier => (tierFilter === 'Todas' || tierFilter === tier.nome) && grupos[tier.nome].length > 0)
          .map(tier => (
            <section key={tier.nome} className="ranking-print-faixa">
              <h2 style={{ fontSize: '12pt', margin: '14px 0 6px' }}>
                {tier.icon} {tier.nome} — {grupos[tier.nome].length} {grupos[tier.nome].length === 1 ? 'entrada' : 'entradas'}
              </h2>
              <table>
                <thead><tr>
                  {mostrarPosicao && <th style={{ width: 50 }}>Pos.</th>}
                  <th>{colunaNome}</th><th>Localização</th><th style={{ width: 80 }}>Pontos</th>
                </tr></thead>
                <tbody>{linhasFaixa(grupos[tier.nome])}</tbody>
              </table>
            </section>
          ))
      )}
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
                {fmtPontos(item.pontos)} {labelPts}
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
                  {fmtPontos(item.pontos)} {labelPts}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BasePerformanceDetail({ score, notas, isSoul, type, standalone = false, bases = [], onChangeBase, onBack }) {
  if (!score) return null

  const tier = getTier(score.pontos, isSoul)
  const tierIndex = TIERS_ORDER.findIndex(item => item.nome === tier.nome)
  const nextTier = tierIndex > 0 ? TIERS_ORDER[tierIndex - 1] : null
  const pointsToNext = nextTier ? Math.max(0, nextTier.min - score.pontos) : 0
  const components = [
    { label: 'Desafios', value: score.componentes.desafios },
    { label: 'Média das notas', value: score.componentes.notas },
    { label: 'Discípulos', value: score.componentes.discipulos },
    { label: 'Batismos', value: score.componentes.batismos },
  ]
  const reportAccent = isSoul ? '#FF8F00' : '#22D3EE'
  const reportLabel = isSoul ? 'Soul+' : 'G148 Teen'

  return (
    <div className={`${standalone ? 'base-report-page' : 'card section fade-in'} ${isSoul ? 'report-soul' : 'report-teen'}`} style={standalone ? undefined : { borderLeft: `4px solid ${tier.cor}` }}>
      <div className="base-report-actions no-print">
        <button className={`btn btn-outline report-print-button ${isSoul ? 'report-print-button-soul' : 'report-print-button-teen'}`} onClick={() => window.print()}>🖨️ Imprimir / PDF</button>
        {standalone && <button className="btn btn-outline report-back-button" onClick={onBack}>← Voltar ao ranking</button>}
        {!standalone && <button className="btn btn-outline" onClick={() => onChangeBase?.(score.id)}>↗ Abrir página completa</button>}
      </div>
      {standalone && bases.length > 0 && (
        <div className="base-report-selector no-print">
          <div className="base-report-filter-field">
            <label htmlFor="base-report-tier-select">Faixa de classificação</label>
            <select
              id="base-report-tier-select"
              value={tier.nome}
              onChange={e => {
                const firstBase = bases
                  .filter(base => getTier(base.pontos, isSoul).nome === e.target.value)
                  .sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR', { sensitivity: 'base' }))[0]
                if (firstBase) onChangeBase?.(firstBase.id)
              }}
            >
              {TIERS_ORDER.map(item => <option key={item.nome} value={item.nome}>{item.icon} {item.nome}</option>)}
            </select>
          </div>
          <div className="base-report-filter-field">
            <label htmlFor="base-report-select">Base em conferência</label>
            <select id="base-report-select" value={score.id} onChange={e => onChangeBase?.(e.target.value)}>
              {bases
                .filter(base => getTier(base.pontos, isSoul).nome === tier.nome)
                .sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR', { sensitivity: 'base' }))
                .map(base => <option key={base.id} value={base.id}>{base.nome}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="base-report-heading" style={{ borderColor: reportAccent }}>
        <div className="base-report-brand" style={{ color: reportAccent }}>{reportLabel}</div>
        <div className="base-report-document-title">Relatório Oficial de Desempenho</div>
        <div className="base-report-document-subtitle">Premiação e acompanhamento da base · {score.ano}</div>
      </div>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="card-title">🔎 Desenvolvimento da base: {score.nome}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3 }}>
            {[score.igreja, score.distrito, score.regiao].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: tier.cor, fontWeight: 900, fontSize: 20 }}>{tier.icon} {tier.nome}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{fmtPontos(score.pontos)} pontos</div>
        </div>
      </div>

      {score.trimestresDetalhados.map(trimestre => (
        <section className="base-report-quarter" key={trimestre.trimestre}>
          <div className="base-report-quarter-heading">
            <div>
              <div className="base-report-quarter-title">{trimestre.trimestre}º Trimestre</div>
              <div className="base-report-quarter-period">{trimestre.periodo}</div>
            </div>
            <strong>{fmtPontos(trimestre.total)} pts</strong>
          </div>

          <h4>Desafios</h4>
          {trimestre.desafios.length === 0 ? <div className="base-report-empty">Nenhum desafio pontuado.</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Desafio</th><th>Categoria</th><th>Regra</th><th>Realizações</th><th>Pontos</th></tr></thead>
              <tbody>{trimestre.desafios.map((desafio, index) => <tr key={`${desafio.id}-${index}`}>
                <td>{desafio.nome}</td><td>{desafio.categoria || '—'}</td><td>{desafio.regra}</td><td>{desafio.realizacoes}</td><td><strong>{fmtPontos(desafio.pontos)}</strong></td>
              </tr>)}</tbody>
            </table></div>
          )}

          <h4>Notas</h4>
          {trimestre.notas.length === 0 ? <div className="base-report-empty">Nenhuma nota lançada.</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Data</th><th>Aluno</th><th>Prova</th><th>Nota</th></tr></thead>
              <tbody>{trimestre.notas.map((nota, index) => <tr key={nota.id ?? nota.id_form ?? `${nota.data}-${index}`}>
                <td>{String(nota.data ?? nota.Data ?? '').slice(0, 10)}</td><td>{nota.Membros ?? nota.nome_aluno ?? '—'}</td><td>{nota.titulo ?? nota.Titulo ?? '—'}</td><td><strong>{fmtPontos(nota.nota ?? nota.Nota)}</strong></td>
              </tr>)}</tbody>
            </table></div>
          )}

          <h4>Cards de discipulado</h4>
          {trimestre.cards.length === 0 ? <div className="base-report-empty">Nenhum card movimentado no trimestre.</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Membro</th><th>Início</th><th>Encerramento</th><th>Critério</th><th>Pontos</th></tr></thead>
              <tbody>{trimestre.cards.map((card, index) => <tr key={card.id ?? index}>
                <td>{card.nome}</td><td>{card.data_inicio || '—'}</td><td>{card.data_fim || 'Em andamento'}</td><td>{card.data_fim ? 'Card concluído' : 'Card ativado'}</td><td><strong>{fmtPontos(card.pontos)}</strong></td>
              </tr>)}</tbody>
            </table></div>
          )}

          <h4>Batismos</h4>
          {trimestre.batismos.length === 0 ? <div className="base-report-empty">Nenhum batismo registrado.</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Data</th><th>Nome</th><th>Pontos</th></tr></thead>
              <tbody>{trimestre.batismos.map((batismo, index) => <tr key={batismo.id ?? index}>
                <td>{batismo.data || `Mês ${batismo.mes}`}</td><td>{batismo.nome || '—'}</td><td><strong>{fmtPontos(batismo.pontos)}</strong></td>
              </tr>)}</tbody>
            </table></div>
          )}

          <div className="base-report-quarter-total">Fechamento do {trimestre.trimestre}º trimestre: <strong>{fmtPontos(trimestre.total)} pontos</strong></div>
        </section>
      ))}

      <div className="stats-grid" style={{ marginBottom: 18 }}>
        {components.map(component => (
          <div key={component.label} className="stat-card c1" style={{ padding: '12px 10px' }}>
            <div className="stat-num" style={{ fontSize: 22 }}>{fmtPontos(component.value)}</div>
            <div className="stat-label">{component.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 12px', marginBottom: 18, borderRadius: 8, background: `${tier.cor}12`, border: `1px solid ${tier.cor}33`, fontSize: 13 }}>
        {nextTier
          ? <>A base está na faixa <strong style={{ color: tier.cor }}>{tier.nome}</strong> porque acumulou <strong>{fmtPontos(score.pontos)} pontos</strong>. Faltam <strong>{fmtPontos(pointsToNext)} pontos</strong> para {nextTier.icon} <strong>{nextTier.nome}</strong> ({fmtNumero(nextTier.min)} pontos).</>
          : <>A base está na faixa máxima, <strong style={{ color: tier.cor }}>{tier.nome}</strong>, com <strong>{fmtPontos(score.pontos)} pontos</strong>.</>}
      </div>

      <div className="base-report-closing">
        <h3>Fechamento anual</h3>
        <div className="base-report-closing-grid">
          {components.map(component => <div key={component.label}><span>{component.label}</span><strong>{fmtPontos(component.value)}</strong></div>)}
          <div className="base-report-closing-total"><span>Total geral</span><strong>{fmtPontos(score.pontos)} pontos</strong></div>
        </div>
      </div>
      <div className="base-report-signatures">
        {['Professor(a)', 'Coordenador(a)', 'Responsável ANC'].map(label => <div key={label} className="base-report-signature"><div className="base-report-signature-line" /><span>{label}</span><small>Assinatura e data</small></div>)}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────
export default function Ranking() {
  const { type } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentTipo = type === 'soul' ? 'Soul+' : 'G148 Teen'
  const reportBaseId = searchParams.get('relatorio') === 'base' ? searchParams.get('base') : ''
  const reportYear = Number(searchParams.get('ano')) || anoAtual()

  const isAdmin = useAuthStore(s => s.isAdmin)
  const canSeePoints = isAdmin

  const [ano, setAno]                 = useState(reportYear)

  const [view, setView]               = useState('bases')   // 'bases' | 'alunos'
  const [nivel, setNivel]             = useState('geral')
  const [filtroRegiao, setFiltroRegiao]       = useState('')
  const [filtroDistrito, setFiltroDistrito]   = useState('')
  const [filtroIgreja, setFiltroIgreja]       = useState('')
  const [filtroBase, setFiltroBase]           = useState('')
  const [tierFilter, setTierFilter]           = useState('Todas')
  const [ordemBases, setOrdemBases]           = useState('alfabetica') // 'alfabetica' | 'pontuacao' (só admin)
  // Público sempre vê em ordem alfabética; a ordenação por pontuação é exclusiva do admin
  const ordemEfetiva = isAdmin ? ordemBases : 'alfabetica'
  const {
    regioes, distritos, igrejas, basesFiltradas,
    todasNotas, basePorAluno, scoresPorBase, rankingAlunos, isLoading,
  } = useRankingData(type, ano)

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
      extra: b.notaMedia > 0 ? `média notas: ${fmtPontos(b.notaMedia)}` : null,
      tier: getTier(b.pontos, type === 'soul'),
      isSoul: type === 'soul',
    }))

    // Soma as bases por agrupamento e guarda a lista (basesList) que compõe
    // o total, exibida na sanfona e na impressão.
    const agrupar = (lista, keyFn, subFn) => {
      const map = {}
      lista.forEach(b => {
        const key = keyFn(b)
        if (!map[key]) map[key] = { id: key, nome: key, pontos: 0, bases: 0, sub: subFn(b), basesList: [] }
        map[key].pontos += b.pontos
        map[key].bases++
        map[key].basesList.push(b)
      })
      return Object.values(map)
        .map(r => {
          const pontos = Math.round(r.pontos * 10) / 10
          return { ...r, pontos, tier: null, isSoul: type === 'soul', extra: `${r.bases} ${r.bases === 1 ? 'base' : 'bases'}` }
        })
        .sort((a, b) => b.pontos - a.pontos)
    }

    if (nivel === 'regional' && filtroRegiao) {
      items = items.filter(b => b.regiao_id === filtroRegiao)
    } else if (nivel === 'regional') {
      items = agrupar(items, b => b.regiao || '(sem região)', () => null)
    } else if (nivel === 'distrital') {
      items = agrupar(
        items.filter(b => !filtroRegiao || b.regiao_id === filtroRegiao),
        b => b.distrito || '(sem distrito)',
        b => b.regiao,
      )
    } else if (nivel === 'igreja') {
      items = agrupar(
        items
          .filter(b => !filtroRegiao   || b.regiao_id   === filtroRegiao)
          .filter(b => !filtroDistrito || b.distrito_id === filtroDistrito),
        b => b.igreja || '(sem igreja)',
        b => [b.distrito, b.regiao].filter(Boolean).join(' · '),
      )
    } else if (nivel === 'base') {
      if (filtroRegiao)   items = items.filter(b => b.regiao_id   === filtroRegiao)
      if (filtroDistrito) items = items.filter(b => b.distrito_id === filtroDistrito)
      if (filtroIgreja)   items = items.filter(b => b.igreja_id   === filtroIgreja)
    }

    return items
  }, [scoresPorBase, nivel, filtroRegiao, filtroDistrito, filtroIgreja, type])

  const scoreBaseDetalhada = useMemo(() =>
    scoresPorBase.find(base => String(base.id) === String(reportBaseId)) ?? null,
    [scoresPorBase, reportBaseId]
  )

  const notasBaseDetalhada = useMemo(() => {
    if (!scoreBaseDetalhada) return []
    return todasNotas
      .filter(nota => {
        const rowBaseId = String(nota.id_base ?? nota.base_id ?? '').trim()
        const studentKey = nota.id_membros ?? (rowBaseId + '|' + (nota.Membros ?? nota.nome_aluno ?? ''))
        return String(basePorAluno[studentKey]?.baseId ?? rowBaseId) === String(scoreBaseDetalhada.id)
      })
      .filter(nota => Number.isFinite(Number(nota.nota ?? nota.Nota)))
      .sort((a, b) => String(b.data ?? b.Data ?? '').localeCompare(String(a.data ?? a.Data ?? '')))
  }, [todasNotas, basePorAluno, scoreBaseDetalhada])

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

  // Cabeçalho da impressão: descreve exatamente o recorte que está na tela
  const nomePorId = (lista, idKeys, nomeKeys, id) => {
    const item = lista.find(x => idKeys.some(k => String(x[k] ?? '') === String(id)))
    return item ? (nomeKeys.map(k => item[k]).find(Boolean) ?? id) : id
  }
  const filtrosDescricao = [
    `Visão: ${view === 'alunos' ? 'Alunos' : 'Bases'}`,
    `Nível: ${nomeNivel}`,
    filtroRegiao   && `Região: ${nomePorId(regioes,   ['id_regiao', 'id'],    ['Regiao', 'nome'],    filtroRegiao)}`,
    filtroDistrito && `Distrito: ${nomePorId(distritos, ['id_distritos', 'id'], ['Distritos', 'nome'], filtroDistrito)}`,
    filtroIgreja   && `Igreja: ${nomePorId(igrejas,   ['id_igrejas', 'id'],   ['Igrejas', 'nome'],   filtroIgreja)}`,
    showBaseFilter && filtroBase && `Base: ${nomePorId(basesFiltradas, ['id_base', 'id'], ['Base', 'nome'], filtroBase)}`,
    view === 'bases' && `Faixa: ${tierFilter}`,
    view === 'bases' && `Ordenação: ${ordemEfetiva === 'pontuacao' ? 'por pontuação' : 'alfabética'}`,
  ].filter(Boolean).join(' · ')
  const colunaNomePrint = view === 'alunos' ? 'Aluno'
    : nivel === 'regional' && !filtroRegiao ? 'Região'
    : nivel === 'distrital' ? 'Distrito'
    : nivel === 'igreja' ? 'Igreja'
    : 'Base'

  // CSV com o mesmo recorte da impressão: visão, nível, filtros, faixa e ordenação
  function exportarCSV() {
    let linhas
    if (view === 'alunos') {
      linhas = ordenarItens(listAtual, 'pontuacao').map(a => ({
        'Posição': a.posicao, 'Aluno': a.nome, 'Base': a.base, 'Igreja': a.igreja, 'Distrito': a.distrito, 'Região': a.regiao,
        'Provas lançadas': a.count, 'Pontos (média)': numCSV(a.pontos),
      }))
    } else {
      // Sempre uma linha por base (nos níveis agrupados, as bases que compõem
      // cada região/distrito/igreja), com a pontuação esmiuçada por componente.
      // A posição é sempre a colocação por pontos dentro da faixa, mesmo
      // quando as linhas saem em ordem alfabética.
      const basesDoRecorte = listAtual.flatMap(item => item.basesList ?? [item])
      const grupos = agruparPorFaixa(basesDoRecorte, 'pontuacao')
      const naOrdemDaTela = lista => ordemEfetiva === 'pontuacao' ? lista : [...lista].sort(compareNome)
      linhas = TIERS_ORDER
        .filter(tier => tierFilter === 'Todas' || tierFilter === tier.nome)
        .flatMap(tier => naOrdemDaTela(grupos[tier.nome]).map(b => ({
          'Posição na faixa': b.posicao,
          'Base': b.nome, 'Faixa': tier.nome,
          'Região': b.regiao, 'Distrito': b.distrito, 'Igreja': b.igreja,
          'Pontos': numCSV(b.pontos), 'Desafios': numCSV(b.componentes?.desafios), 'Notas': numCSV(b.componentes?.notas),
          'Discipulado': numCSV(b.componentes?.discipulos), 'Batismos': numCSV(b.componentes?.batismos),
        })))
    }
    if (!linhas.length) return toast.error('Nada para exportar com os filtros atuais.')
    const slug = normalizeBaseName(`${currentTipo}_${view}_${nomeNivel}`).replace(/[^a-z0-9]+/g, '_')
    downloadCSV(linhas, `ranking_${slug}_${ano}`)
  }

  if (reportBaseId && !isAdmin) return <Navigate to="/admin/login" replace />

  if (reportBaseId) {
    return (
      <div className="base-report-shell">
        {isLoading ? <div className="card empty-state"><div className="spinner" /></div> : (
          <BasePerformanceDetail
            score={scoreBaseDetalhada}
            notas={notasBaseDetalhada}
            isSoul={type === 'soul'}
            type={type}
            bases={scoresPorBase}
            onChangeBase={baseId => navigate(`/${type || 'teen'}/ranking?relatorio=base&base=${encodeURIComponent(baseId)}&ano=${ano}`, { replace: true })}
            onBack={() => navigate(`/${type || 'teen'}/ranking`)}
            standalone
          />
        )}
      </div>
    )
  }

  return (
    <div>
      {isAdmin && !isLoading && listAtual.length > 0 && (
        <RankingPrint
          view={view}
          items={listAtual}
          tierFilter={tierFilter}
          ordem={ordemEfetiva}
          titulo={`🏆 Ranking ${currentTipo} — ${ano}`}
          filtrosDescricao={filtrosDescricao}
          colunaNome={colunaNomePrint}
        />
      )}
      <div className="ranking-screen">
      {/* ── Header ── */}
      <div className="card section" style={{
        background: 'linear-gradient(135deg,rgba(124,58,237,.15) 0%,rgba(251,113,133,.1) 100%)',
        borderColor: 'rgba(124,58,237,.3)',
      }}>
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ fontSize: 22 }}>🏆 Ranking {currentTipo}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => window.print()}
                disabled={isLoading || listAtual.length === 0}
                title="Imprime o ranking com os filtros, faixa e ordenação atuais"
              >
                🖨️ Imprimir
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={exportarCSV}
                disabled={isLoading || listAtual.length === 0}
                title="Baixa o ranking em CSV com os filtros, faixa e ordenação atuais"
              >
                📥 CSV
              </button>
            )}
            <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ width: 92 }}>
              {[anoAtual() - 1, anoAtual(), anoAtual() + 1].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
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
            💡 Pontuação = soma das médias trimestrais (notas ÷ provas previstas no trimestre) + provas bônus
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
            <BaseRankingByTiers
              items={listAtual}
              showPoints={canSeePoints}
              isAdmin={isAdmin}
              tierFilter={tierFilter}
              onTierFilterChange={setTierFilter}
              ordem={ordemEfetiva}
              onOrdemChange={isAdmin ? setOrdemBases : undefined}
              onSelect={isAdmin ? (id) => {
                navigate(`/${type || 'teen'}/ranking?relatorio=base&base=${encodeURIComponent(id)}&ano=${ano}`)
              } : undefined}
            />
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
    </div>
  )
}
