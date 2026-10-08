import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useRankingData } from '../hooks/useRankingData'
import { getTier, TIERS_ORDER, ordenarItens } from '../lib/ranking'
import { fmtPontos } from '../utils/helpers'

function anoAtual() { return new Date().getFullYear() }

const VISOES = [
  { key: 'bases',  label: '⛪ Bases' },
  { key: 'alunos', label: '🎒 Alunos' },
]

const MEDALHAS = { 1: '👑', 2: '🥈', 3: '🥉' }

function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

const CONFETES = ['🎉', '✨', '🎊', '⭐', '🏆']

// Chuva de confetes ao revelar o 1º lugar (some sozinha ao fim da animação).
function Confetes() {
  return (
    <div className="podio-confetes" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.18}s`, fontSize: `${18 + (i % 4) * 8}px` }}>
          {CONFETES[i % CONFETES.length]}
        </span>
      ))}
    </div>
  )
}

// Degrau do pódio. Sem participante na posição, o degrau aparece em branco.
// `oculto`: revelação com suspense — o vencedor ainda não foi mostrado.
function Degrau({ item, lugar, labelPts, oculto = false }) {
  if (item && oculto) {
    return (
      <div className={`podio-degrau lugar-${lugar} oculto`}>
        <div className="podio-medalha" aria-hidden="true" />
        <div className="podio-avatar">?</div>
        <div className="podio-nome">? ? ?</div>
        <div className="podio-sub">{'\u00A0'}</div>
        <div className="podio-pontos">{'\u00A0'}</div>
        <div className="podio-plataforma"><span>{lugar}º</span></div>
      </div>
    )
  }
  return (
    <div className={`podio-degrau lugar-${lugar} ${item ? 'revelado' : 'vazio'}`}>
      <div className="podio-medalha" aria-hidden="true">{item ? MEDALHAS[lugar] : ''}</div>
      <div className="podio-avatar">{item ? iniciais(item.nome) : ''}</div>
      <div className="podio-nome" title={item?.nome}>{item ? item.nome : '—'}</div>
      <div className="podio-sub">{item?.sub || ' '}</div>
      <div className="podio-pontos">
        {item ? <>{fmtPontos(item.pontos)} <small>{labelPts}</small></> : ' '}
      </div>
      {item?.tier && (
        <div className="podio-faixa" style={{ color: item.tier.cor, background: item.tier.bg, borderColor: `${item.tier.cor}55` }}>
          {item.tier.icon} {item.tier.nome}
        </div>
      )}
      <div className="podio-plataforma"><span>{lugar}º</span></div>
    </div>
  )
}

// Telão de premiação: pódio dos 3 primeiros + classificação completa.
// Página exclusiva do admin, fora do layout com menu, pensada para projeção.
export default function Podio() {
  const { type: typeParam } = useParams()
  const type = typeParam === 'soul' ? 'soul' : 'teen'
  const isSoul = type === 'soul'
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const ano      = Number(params.get('ano')) || anoAtual()
  const visao    = params.get('visao') === 'alunos' ? 'alunos' : 'bases'
  const regiao   = params.get('regiao') ?? ''
  const distrito = params.get('distrito') ?? ''
  const faixa    = params.get('faixa') ?? ''

  const [apresentando, setApresentando] = useState(false)
  // Revelação com suspense: quantos lugares do pódio já foram mostrados
  // (a ordem é 3º → 2º → 1º). Fora do suspense fica em 3.
  const [suspense, setSuspense] = useState(false)
  const [revelados, setRevelados] = useState(3)

  const { regioes, distritos, scoresPorBase, rankingAlunos, isLoading } = useRankingData(type, ano)

  // Os filtros ficam na URL: sobrevivem a um recarregamento no meio do evento.
  function setFiltros(mudancas) {
    const next = new URLSearchParams(params)
    Object.entries(mudancas).forEach(([k, v]) => next.set(k, v))
    setParams(next, { replace: true })
  }

  // Foco inicial no Celebra Teen da região Oeste: se a URL não traz região,
  // a página abre já filtrada nela (basta trocar para "Todas" para ver o geral).
  const regiaoPadraoAplicada = useRef(false)
  useEffect(() => {
    if (regiaoPadraoAplicada.current || !regioes.length) return
    regiaoPadraoAplicada.current = true
    if (params.has('regiao')) return
    const oeste = regioes.find(r => /oeste/i.test(r.Regiao ?? r.nome ?? ''))
    if (oeste) setFiltros({ regiao: String(oeste.id_regiao ?? oeste.id) })
  }, [regioes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setApresentando(false) }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function iniciarApresentacao(comSuspense = false) {
    setApresentando(true)
    setSuspense(comSuspense)
    // Posições sem participante já contam como reveladas
    setRevelados(comSuspense ? 3 - Math.min(3, classificacao.length) : 3)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  function encerrarApresentacao() {
    setApresentando(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  const distritosOpts = useMemo(() =>
    distritos.filter(d => !regiao || String(d.id_regiao ?? d.regiao_id ?? '') === regiao),
    [distritos, regiao]
  )

  const classificacao = useMemo(() => {
    const noRecorte = x =>
      (!regiao || String(x.regiao_id ?? '') === regiao) &&
      (!distrito || String(x.distrito_id ?? '') === distrito)

    const itens = visao === 'alunos'
      ? rankingAlunos.filter(noRecorte).map(a => ({ ...a, sub: a.base }))
      : scoresPorBase
          .filter(noRecorte)
          .map(b => ({
            ...b,
            tier: getTier(b.pontos, isSoul),
            sub: [...new Set([b.igreja, b.distrito].filter(Boolean))].join(' · '),
          }))
          .filter(b => !faixa || b.tier.nome === faixa)

    return ordenarItens(itens, 'pontuacao')
  }, [visao, rankingAlunos, scoresPorBase, regiao, distrito, faixa, isSoul])

  const [primeiro, segundo, terceiro] = classificacao
  const emSuspense = apresentando && suspense
  const lugarOculto = lugar => emSuspense && lugar <= 3 - revelados
  const proximoLugar = emSuspense && revelados < 3 ? 3 - revelados : null

  // Avança com clique no palco, Espaço, Enter ou →; volta com ←
  useEffect(() => {
    if (!emSuspense) return
    const onKey = e => {
      if ([' ', 'Enter', 'ArrowRight', 'PageDown'].includes(e.key)) {
        e.preventDefault()
        setRevelados(r => Math.min(3, r + 1))
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        const minimo = 3 - Math.min(3, classificacao.length)
        setRevelados(r => Math.max(minimo, r - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [emSuspense, classificacao.length])
  const labelPts = visao === 'alunos' ? 'média' : 'pts'
  const media = classificacao.length
    ? classificacao.reduce((s, x) => s + x.pontos, 0) / classificacao.length
    : 0

  const nomeRegiao = regioes.find(r => String(r.id_regiao ?? r.id) === regiao)
  const nomeDistrito = distritos.find(d => String(d.id_distritos ?? d.id) === distrito)
  const recorte = [
    regiao && `Região ${nomeRegiao?.Regiao ?? nomeRegiao?.nome ?? ''}`.trim(),
    distrito && `Distrito ${nomeDistrito?.Distritos ?? nomeDistrito?.nome ?? ''}`.trim(),
    !regiao && !distrito && 'Classificação geral',
    visao === 'bases' && faixa && `Faixa ${faixa}`,
    ano,
  ].filter(Boolean).join(' · ')

  return (
    <div className={`podio-page ${isSoul ? 'theme-soul' : ''} ${apresentando ? 'apresentando' : ''}`}>
      <header className="podio-topo">
        <div className="podio-titulo">
          <span className="podio-trofeu" aria-hidden="true">🏆</span>
          <div>
            <h1>Ranking {isSoul ? 'Soul+' : 'G148 Teen'} <em>{visao === 'alunos' ? 'Alunos' : 'Bases'}</em></h1>
            <p>{recorte}</p>
          </div>
        </div>
        {apresentando ? (
          <button type="button" className="podio-sair" onClick={encerrarApresentacao} title="Sair da apresentação (Esc)">✕</button>
        ) : (
          <div className="podio-acoes">
            <button type="button" className="btn btn-outline" onClick={() => navigate(`/${type}/ranking`)}>← Voltar</button>
            <button type="button" className="btn btn-outline" onClick={() => iniciarApresentacao(true)} title="Tela cheia com o pódio escondido: revela 3º, 2º e 1º a cada clique">🎭 Apresentar com suspense</button>
            <button type="button" className="btn btn-primary" onClick={() => iniciarApresentacao(false)}>▶ Apresentar em tela cheia</button>
          </div>
        )}
      </header>

      {!apresentando && (
        <div className="podio-filtros">
          <div className="podio-seg" role="group" aria-label="Ministério">
            <button type="button" className={!isSoul ? 'active' : ''} onClick={() => navigate(`/admin/podio/teen?${params}`, { replace: true })}>⚡ G148 Teen</button>
            <button type="button" className={isSoul ? 'active' : ''} onClick={() => navigate(`/admin/podio/soul?${params}`, { replace: true })}>☀️ Soul+</button>
          </div>
          <div className="podio-seg" role="group" aria-label="Visão">
            {VISOES.map(v => (
              <button key={v.key} type="button" className={visao === v.key ? 'active' : ''} onClick={() => setFiltros({ visao: v.key })}>{v.label}</button>
            ))}
          </div>
          <label>
            <span>Região</span>
            <select value={regiao} onChange={e => setFiltros({ regiao: e.target.value, distrito: '' })}>
              <option value="">Todas</option>
              {regioes.map(r => (
                <option key={r.id_regiao ?? r.id} value={r.id_regiao ?? r.id}>{r.Regiao ?? r.nome}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Distrito</span>
            <select value={distrito} onChange={e => setFiltros({ distrito: e.target.value })}>
              <option value="">Todos</option>
              {distritosOpts.map(d => (
                <option key={d.id_distritos ?? d.id} value={d.id_distritos ?? d.id}>{d.Distritos ?? d.nome}</option>
              ))}
            </select>
          </label>
          {visao === 'bases' && (
            <label>
              <span>Faixa</span>
              <select value={faixa} onChange={e => setFiltros({ faixa: e.target.value })}>
                <option value="">Todas</option>
                {TIERS_ORDER.map(t => <option key={t.nome} value={t.nome}>{t.icon} {t.nome}</option>)}
              </select>
            </label>
          )}
          <label>
            <span>Ano</span>
            <select value={ano} onChange={e => setFiltros({ ano: e.target.value })}>
              {[anoAtual() - 1, anoAtual(), anoAtual() + 1].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="podio-carregando">
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <p>Calculando ranking…</p>
        </div>
      ) : (
        <div className="podio-corpo">
          <section
            className={`podio-painel podio-palco ${proximoLugar ? 'clicavel' : ''}`}
            onClick={proximoLugar ? () => setRevelados(r => Math.min(3, r + 1)) : undefined}
          >
            {emSuspense && revelados === 3 && primeiro && <Confetes />}
            <div className="podio-numeros">
              <div><strong>{classificacao.length}</strong><span>{visao === 'alunos' ? 'alunos' : 'bases'} participantes</span></div>
              <div><strong>{!primeiro ? '—' : lugarOculto(1) ? '?' : fmtPontos(primeiro.pontos)}</strong><span>maior pontuação</span></div>
              <div><strong>{classificacao.length ? fmtPontos(media) : '—'}</strong><span>média do recorte</span></div>
            </div>
            <div className="podio-degraus">
              <Degrau item={segundo}  lugar={2} labelPts={labelPts} oculto={lugarOculto(2)} />
              <Degrau item={primeiro} lugar={1} labelPts={labelPts} oculto={lugarOculto(1)} />
              <Degrau item={terceiro} lugar={3} labelPts={labelPts} oculto={lugarOculto(3)} />
            </div>
            {proximoLugar && (
              <button type="button" className="podio-revelar">▶ Revelar o {proximoLugar}º lugar</button>
            )}
          </section>

          <section className="podio-painel podio-lista">
            <div className="podio-lista-cab">
              <span>Pos.</span>
              <span>{visao === 'alunos' ? 'Aluno' : 'Base'}</span>
              <span>Pontos</span>
            </div>
            {classificacao.length === 0 ? (
              <div className="podio-vazio">Nenhum participante neste recorte.</div>
            ) : (
              <ol>
                {classificacao.map((item, idx) => lugarOculto(idx + 1) ? (
                  <li key={item.id} className="oculto">
                    <span className="podio-pos">{idx + 1}º</span>
                    <span className="podio-quem"><strong>? ? ?</strong></span>
                  </li>
                ) : (
                  <li key={item.id} className={item.posicao <= 3 ? `top top-${item.posicao}` : ''}>
                    <span className="podio-pos">{item.posicao}º</span>
                    <span className="podio-quem">
                      <strong>{item.nome}</strong>
                      {item.sub && <small>{item.sub}</small>}
                    </span>
                    {item.tier && <span className="podio-tier" title={item.tier.nome}>{item.tier.icon}</span>}
                    <span className="podio-pts">{fmtPontos(item.pontos)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
