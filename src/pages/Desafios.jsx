import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTable } from '../hooks/useTable'
import { useAuthStore } from '../store/authStore'
import { db } from '../api/db'

// ── Utilitários ──────────────────────────────────────────────────
function gerarSabados(primeiro, ultimo) {
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

function fmtDataCurta(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function fmtDataBR(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function ultimoSabadoDoMes(ano, mes) {
  const d = new Date(ano, mes, 0) // último dia do mês
  while (d.getDay() !== 6) d.setDate(d.getDate() - 1)
  return d
}

function anoAtual() {
  return new Date().getFullYear()
}

// Retorna os 3 meses (1-12) de um trimestre
function mesesDoTrimestre(trim) {
  const base = (trim - 1) * 3 + 1
  return [base, base + 1, base + 2]
}

const NOMES_TRIM = { 1: '1º Trim', 2: '2º Trim', 3: '3º Trim', 4: '4º Trim' }
const NOMES_MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const NOMES_MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const MAIN_TABS = [
  { id: 'desafios',    icon: '🏅', label: 'Desafios' },
  { id: 'comparativo', icon: '📊', label: 'Comparativo' },
  { id: 'discipulos',  icon: '📖', label: 'Discípulos' },
  { id: 'batismos',   icon: '🕊️', label: 'Batismos' },
  { id: 'fotos',      icon: '🖼️', label: 'Fotos' },
]

const CATEGORIA_COR = {
  admin:  'var(--c2)',
  da:     'var(--c5)',
  estudo: 'var(--good)',
  midia:  'var(--c1)',
  missao: 'var(--c3)',
}

const CAT_LABEL = {
  admin:  'Administrativo',
  da:     'Desafio da Associação',
  estudo: 'Estudo',
  midia:  'Mídia',
  missao: 'Missão',
}

function isCategoriaAutoAdministrativa(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === 'admin' || raw === 'da'
}

// ── Componente principal ─────────────────────────────────────────
export default function Desafios() {
  const { type } = useParams()
  const currentTipo = type === 'soul' ? 'Soul+' : 'G148 Teen'

  const { isAdmin, isAuditMode } = useAuthStore()
  const { data: bases = [] }    = useTable('Bases')
  const { data: regioes = [] }  = useTable('Regiao')
  const { data: distritos = [] } = useTable('Distritos')
  const qc = useQueryClient()

  const [ano, setAno]           = useState(anoAtual())
  const [trimestre, setTrimestre] = useState(1)
  const [regiaoId, setRegiaoId] = useState('')
  const [distritoId, setDistritoId] = useState('')
  const [baseId, setBaseId]     = useState('')
  const [selectedBase, setSelectedBase] = useState(null)
  const [savingCells, setSavingCells]   = useState(new Set())
  const [mainTab, setMainTab]   = useState('desafios')


  // ── Filtros geográficos ──────────────────────────────────────
  const distritosOpts = useMemo(
    () => distritos.filter(d => !regiaoId || (d.id_regiao ?? d.regiao_id) === regiaoId),
    [distritos, regiaoId]
  )

  const basesOpts = useMemo(() =>
    bases
      .filter(b => {
        const bTipo = (b.Tipo || '').toLowerCase()
        const cTipo = currentTipo.toLowerCase()
        const matches = cTipo.includes('teen') ? (bTipo.includes('teen') || !bTipo) : bTipo.includes('soul')
        if (!matches) return false

        if (regiaoId   && b.id_regiao   !== regiaoId)   return false
        if (distritoId && (b.id_distritos ?? b.distrito_id) !== distritoId) return false
        return true
      })
      .sort((a, b) => (a.Base ?? a.nome ?? '').localeCompare(b.Base ?? b.nome ?? '')),
    [bases, regiaoId, distritoId, currentTipo]
  )

  function handleBaseChange(e) {
    const id = e.target.value
    setBaseId(id)
    setSelectedBase(basesOpts.find(b => (b.id_base ?? b.id) === id) ?? null)
  }

  function handleRegiaoChange(e) {
    setRegiaoId(e.target.value); setDistritoId(''); setBaseId(''); setSelectedBase(null)
  }
  function handleDistritoChange(e) {
    setDistritoId(e.target.value); setBaseId(''); setSelectedBase(null)
  }

  // ── Catálogo e config do trimestre ───────────────────────────
  const { data: catalogo = [] } = useQuery({
    queryKey: ['desafios_catalogo', currentTipo],
    queryFn:  () => db.getDesafiosCatalogo(currentTipo),
    staleTime: 10 * 60 * 1000,
  })

  const { data: trimestresConfig = [] } = useQuery({
    queryKey: ['configuracao_trimestres', ano],
    queryFn:  () => db.getConfiguracaoTrimestres(ano),
  })

  const cfgTrim    = trimestresConfig.find(t => t.trimestre === trimestre)
  const hojeStr    = hoje()
  const sabados    = useMemo(() => cfgTrim ? gerarSabados(cfgTrim.primeiro_sabado, cfgTrim.ultimo_sabado) : [], [cfgTrim])
  const numSabados = sabados.length
  const mesesTrim  = mesesDoTrimestre(trimestre)

  const ptsPorSabado = useCallback(
    (pts) => numSabados > 0 ? pts / numSabados : 0,
    [numSabados]
  )

  // ── Trava de trimestre encerrado ─────────────────────────────
  const isPastTrimestre = Boolean(cfgTrim && cfgTrim.ultimo_sabado < hojeStr)
  const mesAtual = new Date().getMonth() + 1
  const isTeenTrim1AbrilMaioOverride = currentTipo === 'G148 Teen' && trimestre === 1 && (mesAtual === 4 || mesAtual === 5)
  const isSoulTrim1AbrilMaioOverride  = currentTipo === 'Soul+' && trimestre === 1 && (mesAtual === 4 || mesAtual === 5)
  const isLocked = isPastTrimestre && !isAuditMode && !isAdmin && !isTeenTrim1AbrilMaioOverride && !isSoulTrim1AbrilMaioOverride

  // ── Dados da base ────────────────────────────────────────────
  const { data: registros = [] } = useQuery({
    queryKey: ['desafios_registros', baseId, cfgTrim?.primeiro_sabado, cfgTrim?.ultimo_sabado],
    queryFn:  () => db.getDesafiosRegistros(baseId, cfgTrim.primeiro_sabado, cfgTrim.ultimo_sabado),
    enabled:  Boolean(baseId && cfgTrim),
  })

  // Notas do trimestre — carregadas sempre (não só ao abrir o Comparativo)
  const { data: notasTrim = [] } = useQuery({
    queryKey: ['notas_trimestre_comparativo', currentTipo, baseId, selectedBase?.Base ?? '', cfgTrim?.primeiro_sabado, cfgTrim?.ultimo_sabado],
    queryFn: () => {
      const isSoul = currentTipo.toLowerCase().includes('soul')
      return isSoul
        ? db.getNotasSoulPorBaseETrimestre(baseId, cfgTrim.primeiro_sabado, cfgTrim.ultimo_sabado, selectedBase?.Base ?? '')
        : db.getNotasTeenPorBaseETrimestre(baseId, cfgTrim.primeiro_sabado, cfgTrim.ultimo_sabado, selectedBase?.Base ?? '')
    },
    enabled: Boolean(baseId && cfgTrim),
    staleTime: 2 * 60 * 1000,
  })

  // Auto-sync desafios administrativos sempre que notas forem carregadas
  useEffect(() => {
    if (!baseId || !cfgTrim || !catalogo?.length) return

    let cancelled = false

    async function syncAdminDesafios() {
      const notasByDate = {}
      notasTrim.forEach(n => {
        const date = String(n.data || n.Data || '').slice(0, 10)
        if (!date) return
        if (!notasByDate[date]) notasByDate[date] = []
        notasByDate[date].push(n)
      })

      const tasks = []
      sabados.forEach(sab => {
        const notasDia = notasByDate[sab] ?? []
        tasks.push(
          db.syncDesafiosAdministrativosFromNotas({
            base_id: baseId,
            tipo: currentTipo,
            data_sabado: sab,
            rows: notasDia,
            responsavel: null,
            catalogo,
          })
        )
      })

      if (tasks.length > 0) {
        const results = await Promise.allSettled(tasks)
        const syncFailures = results.filter((result) => result.status === 'rejected')

        if (syncFailures.length > 0) {
          console.warn('[Desafios] Falhas ao sincronizar desafios administrativos a partir das notas.', syncFailures)
        }

        if (!cancelled) {
          qc.invalidateQueries({ queryKey: ['desafios_registros', baseId, cfgTrim.primeiro_sabado, cfgTrim.ultimo_sabado] })
          qc.invalidateQueries({ queryKey: ['desafios_registros_ano', baseId, ano] })
        }
      }
    }

    syncAdminDesafios()
    return () => { cancelled = true }
  }, [baseId, currentTipo, catalogo, notasTrim, sabados, cfgTrim, qc, ano])

  // Registros do ano inteiro para o acumulado
  const { data: registrosAno = [] } = useQuery({
    queryKey: ['desafios_registros_ano', baseId, ano],
    queryFn:  () => db.getDesafiosRegistrosPorAno(baseId, ano),
    enabled:  Boolean(baseId),
  })

  const { data: marcos = [] } = useQuery({
    queryKey: ['desafios_marcos', baseId, ano],
    queryFn:  () => db.getDesafiosMarcos(baseId, ano),
    enabled:  Boolean(baseId),
  })

  // ── Mutations ────────────────────────────────────────────────
  const registrosKey = ['desafios_registros', baseId, cfgTrim?.primeiro_sabado, cfgTrim?.ultimo_sabado]
  const marcosKey    = ['desafios_marcos', baseId, ano]

  const toggleRegistro = useMutation({
    mutationFn: ({ desafio_id, data_sabado, realizado }) =>
      db.upsertRegistro({ base_id: baseId, desafio_id, data_sabado, realizado }),
    onMutate: ({ desafio_id, data_sabado }) => {
      const key = `${desafio_id}-${data_sabado}`
      setSavingCells(s => new Set(s).add(key))
      return { key }
    },
    onSettled: (_, __, ___, ctx) => {
      if (ctx?.key) setSavingCells(s => { const n = new Set(s); n.delete(ctx.key); return n })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: registrosKey }),
    onError:   (e) => toast.error('Erro ao salvar: ' + e.message),
  })

  const salvarMarco = useMutation({
    mutationFn: (payload) => db.upsertMarco(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: marcosKey }),
    onError:    (e) => toast.error('Erro: ' + e.message),
  })

  const toggleMarcoMensal = useMutation({
    mutationFn: (payload) => db.upsertMarco(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: marcosKey }),
    onError:    (e) => toast.error('Erro ao salvar: ' + e.message),
  })

  // ── Helpers de cálculo ───────────────────────────────────────
  function realizadosNoTrim(desafio_id) {
    return registros.filter(r => r.desafio_id === desafio_id && r.realizado).length
  }

  function registrado(desafio_id, data_sabado) {
    return registros.find(r => r.desafio_id === desafio_id && r.data_sabado === data_sabado)?.realizado ?? false
  }

  function getMarco(desafio_id, trim) {
    return marcos.find(m =>
      m.desafio_id === desafio_id &&
      (trim == null ? m.trimestre == null : m.trimestre === trim) &&
      m.mes == null
    )
  }

  // Marco de desafio mensal — busca pelo mes_ref fixo do desafio
  function getMarcoMensal(desafio_id, mes_ref) {
    return marcos.find(m => m.desafio_id === desafio_id && m.mes === mes_ref)
  }

  function ptsSemanal(desafio) {
    return (realizadosNoTrim(desafio.id) * ptsPorSabado(desafio.pontos_total)).toFixed(1)
  }

  function ptsPontualTrim(desafio) {
    const meses = mesesDoTrimestre(trimestre)
    const completed = meses.filter(mes =>
      marcos.find(m => m.desafio_id === desafio.id && m.mes === mes && m.realizado)
    ).length
    return completed * (Number(desafio.pontos_total) / 3)
  }

  // Mensal: cada desafio pontua individualmente pelo seu mes_ref
  function ptsMensal(desafio) {
    return getMarcoMensal(desafio.id, desafio.mes_ref)?.realizado
      ? Number(desafio.pontos_total)
      : 0
  }

  function ptsPontualAnual(desafio) {
    return getMarco(desafio.id, null)?.realizado ? Number(desafio.pontos_total) : 0
  }

  function sortMensais(list) {
    return [...list].sort((a, b) => {
      const mesCmp = Number(a.mes_ref ?? 99) - Number(b.mes_ref ?? 99)
      if (mesCmp !== 0) return mesCmp

      const dataA = a.data_ocorrencia || '9999-12-31'
      const dataB = b.data_ocorrencia || '9999-12-31'
      const dataCmp = dataA.localeCompare(dataB)
      if (dataCmp !== 0) return dataCmp

      const ordemCmp = Number(a.ordem ?? 99) - Number(b.ordem ?? 99)
      if (ordemCmp !== 0) return ordemCmp

      return String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR')
    })
  }

  // ── Grupos do catálogo ───────────────────────────────────────
  const desafiosPontuaisTrim = catalogo.filter(d => d.rastreamento === 'pontual' && d.periodicidade === 'trimestral')
  // Mensais: apenas os do trimestre atual (derivado de mes_ref)
  const desafiosMensais = sortMensais(
    catalogo.filter(d => d.periodicidade === 'mensal' && d.mes_ref && Math.ceil(d.mes_ref / 3) === trimestre)
  )
  // Todos os mensais do ano (para acumulado)
  const desafiosMensaisAno = sortMensais(
    catalogo.filter(d => d.periodicidade === 'mensal' && d.mes_ref)
  )
  const desafiosSemanais = catalogo.filter(d => d.rastreamento === 'semanal' && d.periodicidade === 'trimestral')
  const desafiosAnuais   = catalogo.filter(d => d.periodicidade === 'anual')

  // Agrupa catálogo por categoria, ordenado pelo menor `ordem` do grupo
  const desafiosPorCategoria = useMemo(() => {
    const groups = {}
    catalogo.forEach(d => {
      const cat = d.categoria ?? 'outros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(d)
    })
    return Object.entries(groups).sort(([catA], [catB]) => {
      const labelA = CAT_LABEL[catA] ?? catA
      const labelB = CAT_LABEL[catB] ?? catB
      return labelA.localeCompare(labelB, 'pt-BR')
    })
  }, [catalogo])

  // ── Totalizadores do trimestre atual ─────────────────────────
  const totalPontuaisTrim = desafiosPontuaisTrim.reduce((s, d) => s + ptsPontualTrim(d), 0)
  const maxPontuaisTrim   = desafiosPontuaisTrim.reduce((s, d) => s + Number(d.pontos_total), 0)
  const totalMensaisTrim  = desafiosMensais.reduce((s, d) => s + ptsMensal(d), 0)
  const maxMensaisTrim    = desafiosMensais.reduce((s, d) => s + Number(d.pontos_total), 0)
  const totalSemanaisTrim = desafiosSemanais.reduce((s, d) => s + Number(ptsSemanal(d)), 0)
  const maxSemanaisTrim   = desafiosSemanais.reduce((s, d) => s + Number(d.pontos_total), 0)
  const totalAnuais       = desafiosAnuais.reduce((s, d) => s + ptsPontualAnual(d), 0)
  const maxAnuais         = desafiosAnuais.reduce((s, d) => s + Number(d.pontos_total), 0)

  // ── Totalizadores acumulados do ano inteiro ───────────────────
  // Pontuais: soma meses completados (mes != null) × pts/3
  const totalPontuaisAno = desafiosPontuaisTrim.reduce((s, d) => {
    const completed = marcos.filter(m => m.desafio_id === d.id && m.mes != null && m.realizado).length
    return s + completed * (Number(d.pontos_total) / 3)
  }, 0)
  const maxPontuaisAno = desafiosPontuaisTrim.reduce((s, d) => s + Number(d.pontos_total) * 4, 0)

  // Mensais: soma todos os meses do ano (marcos já contém o ano todo)
  const totalMensaisAno = desafiosMensaisAno.reduce((s, d) => s + ptsMensal(d), 0)
  const maxMensaisAno   = desafiosMensaisAno.reduce((s, d) => s + Number(d.pontos_total), 0)

  // Semanais: soma todos os trimestres configurados usando registrosAno
  const totalSemanaisAno = trimestresConfig.reduce((total, tc) => {
    const sabadosTc = gerarSabados(tc.primeiro_sabado, tc.ultimo_sabado)
    const numSabs = sabadosTc.length
    if (numSabs === 0) return total
    return total + desafiosSemanais.reduce((s, d) => {
      const realizados = registrosAno.filter(r =>
        r.desafio_id === d.id && r.realizado && sabadosTc.includes(r.data_sabado)
      ).length
      return s + realizados * (Number(d.pontos_total) / numSabs)
    }, 0)
  }, 0)
  const maxSemanaisAno = desafiosSemanais.reduce((s, d) => s + Number(d.pontos_total) * trimestresConfig.length, 0)

  const totalGeralAno = totalPontuaisAno + totalMensaisAno + totalSemanaisAno + totalAnuais
  const maxGeralAno   = maxPontuaisAno + maxMensaisAno + maxSemanaisAno + maxAnuais

  function pct(val, max) {
    return max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0
  }

  const geoInfo = selectedBase
    ? [selectedBase.Regiao, selectedBase.Distritos, selectedBase.Igrejas].filter(Boolean).join(' › ')
    : null

  // ── Render ───────────────────────────────────────────────────
  return (
    <div>

      {/* ── Seleção ── */}
      <div className="card section">
        <div className="card-header">
          <div className="card-title">🏅 Desafios {currentTipo}</div>
          {isLocked && (
            <span className="chip chip-warn">🔒 Trimestre encerrado — ative 🔓 Auditoria para editar</span>
          )}
        </div>

        <div className="form-grid" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label>Ano</label>
            <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ width: 90 }}>
              {[anoAtual() - 1, anoAtual(), anoAtual() + 1].map(a =>
                <option key={a} value={a}>{a}</option>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>Trimestre</label>
            <select value={trimestre} onChange={e => setTrimestre(Number(e.target.value))}>
              {[1, 2, 3, 4].map(t => <option key={t} value={t}>{NOMES_TRIM[t]}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Base ({currentTipo}) *</label>
            <select value={baseId} onChange={handleBaseChange}>
              <option value="">Selecione a base…</option>
              {basesOpts.map(b => (
                <option key={b.id_base ?? b.id} value={b.id_base ?? b.id}>{b.Base ?? b.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 11, opacity: type === 'soul' ? 0.8 : 0.55, marginBottom: 6, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: type === 'soul' ? 'var(--soul-brown)' : 'inherit' }}>
          Região / Distrito (opcional)
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Região</label>
            <select value={regiaoId} onChange={handleRegiaoChange}>
              <option value="">Todas…</option>
              {regioes.map(r => (
                <option key={r.id_regiao ?? r.id} value={r.id_regiao ?? r.id}>{r.Regiao ?? r.nome}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Distrito</label>
            <select value={distritoId} onChange={handleDistritoChange} disabled={!regiaoId}>
              <option value="">Todos…</option>
              {distritosOpts.map(d => (
                <option key={d.id_distritos ?? d.id} value={d.id_distritos ?? d.id}>{d.Distritos ?? d.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {geoInfo && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: 'rgba(124,58,237,.08)', borderRadius: 8,
            fontSize: 12, borderLeft: '3px solid var(--c1)',
          }}>
            📍 {geoInfo}
          </div>
        )}
      </div>

      {/* ── Tab bar principal (visível quando base selecionada) ── */}
      {baseId && (
        <div className="card" style={{ padding: 0, marginBottom: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid ' + (type === 'soul' ? 'rgba(62,32,0,.1)' : 'rgba(255,255,255,.08)'), overflowX: 'auto' }}>
            {MAIN_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setMainTab(t.id)}
                style={{
                  padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                  color: mainTab === t.id ? (type === 'soul' ? 'var(--soul-brown)' : 'var(--c1)') : (type === 'soul' ? 'rgba(62,32,0,.6)' : 'var(--text)'),
                  borderBottom: mainTab === t.id ? `2px solid ${type === 'soul' ? 'var(--soul-brown)' : 'var(--c1)'}` : '2px solid transparent',
                  fontWeight: mainTab === t.id ? 800 : 500,
                  fontSize: 13, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all .15s',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Discípulos ── */}
      {mainTab === 'discipulos' && (
        <DiscipulosTab baseId={baseId} ano={ano} tipo={currentTipo} isAdmin={isAdmin} isAuditMode={isAuditMode} qc={qc} isSoul={type === 'soul'} />
      )}

      {/* ── Tab: Batismos ── */}
      {mainTab === 'batismos' && (
        <BatismosTab baseId={baseId} ano={ano} tipo={currentTipo} isAdmin={isAdmin} isAuditMode={isAuditMode} isSoul={type === 'soul'} />
      )}

      {/* ── Tab: Comparativo ── */}
      {mainTab === 'comparativo' && (
        <ComparativoTab
          baseId={baseId}
          baseNome={selectedBase?.Base ?? selectedBase?.nome ?? ''}
          tipo={currentTipo}
          cfgTrim={cfgTrim}
          sabados={sabados}
          catalogo={catalogo}
          registros={registros}
        />
      )}

      {/* ── Tab: Fotos ── */}
      {mainTab === 'fotos' && (
        <FotosTab baseId={baseId} isAdmin={isAdmin} isAuditMode={isAuditMode} />
      )}

      {/* ── Tab: Desafios ── */}
      {mainTab === 'desafios' && (
        <>

      {/* ── Estados vazios ── */}
      {!baseId && (
        <div className="card empty-state">
          <div className="empty-icon">🏅</div>
          <p>Selecione uma base para visualizar e lançar desafios.</p>
        </div>
      )}

      {baseId && !cfgTrim && (
        <div className="card" style={{ padding: 24, textAlign: 'center', opacity: 0.7 }}>
          <p>⚠️ Trimestre não configurado. Acesse <strong>Admin → Trimestres</strong> para definir os sábados do {NOMES_TRIM[trimestre]}.</p>
        </div>
      )}

      {baseId && cfgTrim && (
        <>
          {/* ── Banner de trava ── */}
          {isLocked && (
            <div className="card" style={{
              padding: '14px 20px', marginBottom: 0,
              background: 'rgba(255,180,0,.08)', borderColor: 'var(--warn)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 20 }}>🔒</span>
              <div>
                <strong style={{ color: 'var(--warn)' }}>Trimestre encerrado em {fmtDataBR(cfgTrim.ultimo_sabado)}</strong>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Somente leitura. Para corrigir lançamentos, ative o modo 🔓 Auditoria (requer senha).
                </div>
              </div>
            </div>
          )}

          {/* ── Totalizador ── */}
          <div className="card section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14 }}>
              <StatCard label={`Semanais ${NOMES_TRIM[trimestre]}`} valor={totalSemanaisTrim} max={maxSemanaisTrim} cor="var(--good)" isSoul={type === 'soul'} />
              {desafiosMensais.length > 0 && (
                <StatCard label={`Mensais ${NOMES_TRIM[trimestre]}`} valor={totalMensaisTrim} max={maxMensaisTrim} cor="var(--c5)" isSoul={type === 'soul'} />
              )}
              <StatCard label={`Pontuais ${NOMES_TRIM[trimestre]}`} valor={totalPontuaisTrim} max={maxPontuaisTrim} cor="var(--c2)" isSoul={type === 'soul'} />
              <StatCard label="Anuais (acum.)"                      valor={totalAnuais}       max={maxAnuais}       cor="var(--c3)" isSoul={type === 'soul'} />
              <StatCard label="Total Geral (ano)"                   valor={totalGeralAno}     max={maxGeralAno}     cor="var(--c1)" destaque isSoul={type === 'soul'} />
            </div>
            <div style={{ marginTop: 8, fontSize: 11, opacity: type === 'soul' ? 0.8 : 0.5, fontWeight: type === 'soul' ? 600 : 400 }}>
              {numSabados} sábados no {NOMES_TRIM[trimestre]}
              {numSabados > 0 && ` · ≈ ${ptsPorSabado(50).toFixed(2)} pts/sáb p/ desafio de 50 pts`}
              {isLocked && ' · 🔒 somente leitura'}
            </div>
          </div>

          {/* ── Seções por Categoria ── */}
          {desafiosPorCategoria.map(([cat, desafios]) => {
            const semanaisCat   = desafios.filter(d => d.rastreamento === 'semanal' && d.periodicidade === 'trimestral')
            const pontuaisTCat  = desafios.filter(d => d.rastreamento === 'pontual' && d.periodicidade === 'trimestral')
            const mensaisCat    = sortMensais(
              desafios.filter(d => d.periodicidade === 'mensal' && d.mes_ref && Math.ceil(d.mes_ref / 3) === trimestre)
            )
            const anuaisCat     = desafios.filter(d => d.periodicidade === 'anual')
            const tiposCount    = [semanaisCat, pontuaisTCat, mensaisCat, anuaisCat].filter(g => g.length > 0).length
            const cor           = CATEGORIA_COR[cat] ?? 'var(--muted)'

            return (
              <div className="card section" key={cat}>
                <div className="card-header" style={{ borderLeft: `3px solid ${cor}`, paddingLeft: 14 }}>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {CAT_LABEL[cat] ?? cat}
                  </div>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>
                    {isLocked ? '🔒 Somente leitura'
                     : cat === 'admin' ? '⚡ preenchido automaticamente via notas'
                     : 'salvo automaticamente ao clicar'}
                  </span>
                </div>

                {/* Semanais */}
                {semanaisCat.length > 0 && (
                  <>
                    <div className="table-wrap">
                      <table style={{ minWidth: 400 + numSabados * 48 }}>
                        <thead>
                          <tr>
                            <th style={{ minWidth: 200 }}>Desafio</th>
                            <th style={{ width: 55, textAlign: 'center' }}>Pts/Tri</th>
                            {sabados.map(s => (
                              <th key={s} style={{ width: 46, textAlign: 'center', fontSize: 10, padding: '6px 2px' }}>
                                {fmtDataCurta(s)}
                              </th>
                            ))}
                            <th style={{ width: 70, textAlign: 'center' }}>Acum.</th>
                            <th style={{ width: 50, textAlign: 'center' }}>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {semanaisCat.map(d => {
                            const real      = realizadosNoTrim(d.id)
                            const pts       = Number(ptsSemanal(d))
                            const pctVal    = pct(real, numSabados)
                            const isAutoOnly = isCategoriaAutoAdministrativa(d.categoria) &&
                              (d.periodicidade === 'semanal' || d.rastreamento === 'semanal')
                            return (
                              <tr key={d.id}>
                                <td><span style={{ fontWeight: 500 }}>{d.nome}</span></td>
                                <td style={{ textAlign: 'center' }}>
                                  <strong style={{ color: type === 'soul' ? 'var(--soul-brown)' : 'var(--c2)' }}>{d.pontos_total}</strong>
                                </td>
                                {sabados.map(s => {
                                  const isFuturo  = s > hojeStr
                                  const checked   = registrado(d.id, s)
                                  const cellKey   = `${d.id}-${s}`
                                  const isSaving  = savingCells.has(cellKey)
                                  const bloqueado = isFuturo || isLocked || isAutoOnly
                                  return (
                                    <td key={s} style={{ textAlign: 'center', padding: 2 }}>
                                      <button
                                        onClick={() => {
                                          if (bloqueado || isSaving) return
                                          toggleRegistro.mutate({ desafio_id: d.id, data_sabado: s, realizado: !checked })
                                        }}
                                        style={{
                                          width: 32, height: 32, borderRadius: 6,
                                          border: '1px solid ' + (checked ? 'var(--good)' : (type === 'soul' ? 'rgba(62,32,0,.2)' : 'rgba(255,255,255,.15)')),
                                          background: checked ? 'rgba(56,242,163,.18)' : 'transparent',
                                          color: checked ? 'var(--good)' : (type === 'soul' ? 'var(--soul-brown)' : 'var(--muted)'),
                                          cursor: bloqueado ? 'not-allowed' : 'pointer',
                                          opacity: isAutoOnly ? (checked ? 1 : 0.35) : (bloqueado ? 0.3 : 1),
                                          fontSize: isSaving ? 10 : 16,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          transition: 'all .15s',
                                        }}
                                        title={
                                          isAutoOnly ? 'Preenchido automaticamente via lançamento de notas'
                                          : isLocked ? 'Trimestre encerrado'
                                          : isFuturo ? 'Sábado futuro'
                                          : checked ? 'Realizado — clique para desmarcar'
                                          : 'Não realizado — clique para marcar'
                                        }
                                        disabled={bloqueado}
                                      >
                                        {isSaving
                                          ? <span className="spinner" style={{ width: 12, height: 12 }} />
                                          : checked ? '✅' : '○'}
                                      </button>
                                    </td>
                                  )
                                })}
                                <td style={{ textAlign: 'center' }}>
                                  <strong style={{ color: pts > 0 ? 'var(--good)' : 'var(--muted)' }}>{pts} pts</strong>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`chip ${pctVal >= 80 ? 'chip-good' : pctVal >= 50 ? 'chip-warn' : 'chip-muted'}`}>
                                    {pctVal}%
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Pontuais trimestral (evolução mensal) */}
                {pontuaisTCat.length > 0 && (
                  <>
                    <div className="table-wrap">
                      <table style={{ minWidth: 680 }}>
                        <thead>
                          <tr>
                            <th style={{ minWidth: 200 }}>Desafio</th>
                            <th style={{ width: 90, textAlign: 'center' }}>Pontos</th>
                            <th>Meses — {ano}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pontuaisTCat.map(d => (
                            <TrPontualMensal
                              key={d.id}
                              desafio={d}
                              marcos={marcos}
                              ano={ano}
                              canEdit={isAdmin || isAuditMode}
                              onToggle={(mes, isDone) => toggleMarcoMensal.mutate({
                                base_id: baseId, desafio_id: d.id,
                                ano, trimestre: Math.ceil(mes / 3), mes,
                                realizado: isDone,
                                data_realizacao: isDone ? hoje() : null,
                                responsavel: null, obs: null,
                              })}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Mensais */}
                {mensaisCat.length > 0 && (
                  <>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: 110 }}>Mês</th>
                            <th>Desafio</th>
                            <th style={{ width: 70, textAlign: 'center' }}>Pts</th>
                            <th style={{ width: 120, textAlign: 'center' }}>Realizado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mensaisCat.map(d => {
                            const marco     = getMarcoMensal(d.id, d.mes_ref)
                            const checked   = marco?.realizado ?? false
                            const mesFuturo = d.mes_ref > new Date().getMonth() + 1 || ano > anoAtual()
                            const bloqueado = isLocked || mesFuturo
                            return (
                              <TrMensal
                                key={d.id}
                                desafio={d}
                                marco={marco}
                                mesLabel={NOMES_MESES[d.mes_ref - 1]}
                                bloqueado={bloqueado}
                                isLocked={isLocked}
                                isFuture={mesFuturo}
                                onToggle={() => toggleMarcoMensal.mutate({
                                  base_id: baseId, desafio_id: d.id,
                                  ano, trimestre: Math.ceil(d.mes_ref / 3), mes: d.mes_ref,
                                  realizado: !checked,
                                  data_realizacao: null, obs: null,
                                })}
                              />
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Anuais */}
                {anuaisCat.length > 0 && (
                  <>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Desafio</th>
                            <th style={{ width: 70, textAlign: 'center' }}>Pts</th>
                            <th style={{ width: 120, textAlign: 'center' }}>Realizado</th>
                            <th style={{ width: 130 }}>Data</th>
                            <th>Obs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {anuaisCat.map(d => (
                            <TrPontual
                              key={`${d.id}-anual`}
                              desafio={d}
                              marco={getMarco(d.id, null)}
                              isLocked={false}
                              onSalvar={({ realizado, data_realizacao, obs }) =>
                                salvarMarco.mutateAsync({
                                  base_id: baseId, desafio_id: d.id,
                                  ano, trimestre: null, mes: null, realizado, data_realizacao, obs,
                                })
                                  .then(() => toast.success('Salvo!'))
                                  .catch(e => toast.error(e.message))
                              }
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </>
      )}
      </>
    )}
    </div>
  )
}

// ── Sub-componente: linha de desafio mensal ──────────────────────
function TrMensal({ desafio, marco, mesLabel, bloqueado, isLocked, isFuture, onToggle }) {
  const [saving, setSaving] = useState(false)
  const checked = marco?.realizado ?? false
  const cor = CATEGORIA_COR[desafio.categoria] ?? 'var(--muted)'

  async function handleClick() {
    if (bloqueado || saving) return
    setSaving(true)
    try { await onToggle() }
    finally { setSaving(false) }
  }

  return (
    <tr style={{ opacity: bloqueado ? 0.6 : 1 }}>
      <td>
        <strong style={{ color: 'var(--c2)', fontSize: 13 }}>{mesLabel}</strong>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 500 }}>{desafio.nome}</div>
            {desafio.descricao && (
              <div style={{ fontSize: 11, opacity: 0.5, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.4 }} title={desafio.descricao}>
                {desafio.descricao}
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{ textAlign: 'center' }}>
        <strong style={{ color: checked ? 'var(--good)' : 'var(--muted)' }}>
          {checked ? desafio.pontos_total : 0}
        </strong>
      </td>
      <td style={{ textAlign: 'center' }}>
        <button
          onClick={handleClick}
          disabled={bloqueado}
          title={isLocked ? 'Trimestre encerrado' : isFuture ? 'Mês futuro' : checked ? 'Realizado — clique para desmarcar' : 'Não realizado — clique para marcar'}
          style={{
            padding: '4px 14px', borderRadius: 6, border: '1px solid',
            borderColor: checked ? 'var(--good)' : 'rgba(255,255,255,.2)',
            background: checked ? 'rgba(56,242,163,.18)' : 'transparent',
            color: checked ? 'var(--good)' : 'var(--muted)',
            cursor: bloqueado ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13,
            minWidth: 80, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all .15s',
          }}
        >
          {saving
            ? <span className="spinner" style={{ width: 14, height: 14 }} />
            : checked ? '✅ Sim' : '❌ Não'}
        </button>
      </td>
    </tr>
  )
}

// ── Sub-componente: linha pontual com 12 colunas mensais ────────
function TrPontualMensal({ desafio, marcos, ano, canEdit, onToggle }) {
  const [saving, setSaving] = useState(null)
  const cor = CATEGORIA_COR[desafio.categoria] ?? 'var(--muted)'
  const today = new Date()

  const months = NOMES_MESES.map((nome, i) => {
    const mes = i + 1
    const marco = marcos.find(m => m.desafio_id === desafio.id && m.mes === mes)
    const ultimoSab = ultimoSabadoDoMes(ano, mes)
    const isEnabled = ultimoSab <= today || canEdit
    const isDone = marco?.realizado ?? false
    return { mes, nome, isEnabled, isDone }
  })

  const completedCount = months.filter(m => m.isDone).length
  const ptsPorMes = Number(desafio.pontos_total) / 3
  const ptsTotal = completedCount * ptsPorMes

  async function handleClick(mes, isDone) {
    if (saving === mes) return
    if (!months[mes - 1].isEnabled) return
    setSaving(mes)
    try { await onToggle(mes, !isDone) }
    finally { setSaving(null) }
  }

  return (
    <tr>
      <td style={{ verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 500 }}>{desafio.nome}</div>
            {desafio.descricao && (
              <div style={{ fontSize: 11, opacity: 0.55, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.4 }}>
                {desafio.descricao}
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: ptsTotal > 0 ? 'var(--c2)' : 'var(--muted)' }}>
          {ptsTotal % 1 === 0 ? ptsTotal : ptsTotal.toFixed(1)}
        </div>
        <div style={{ fontSize: 10, opacity: 0.5 }}>{completedCount}/12 meses</div>
      </td>
      <td style={{ verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {months.map(({ mes, nome, isEnabled, isDone }, i) => (
            <button
              key={mes}
              onClick={() => handleClick(mes, isDone)}
              disabled={!isEnabled}
              title={
                !isEnabled ? `${nome} — disponível após o último sábado do mês`
                : isDone ? `${nome} — realizado! Clique para desmarcar`
                : `${nome} — clique para marcar`
              }
              style={{
                width: 36, height: 46, borderRadius: 6, padding: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 1,
                marginLeft: i > 0 && i % 3 === 0 ? 5 : 0,
                border: '1px solid ' + (isDone ? 'var(--good)' : isEnabled ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.07)'),
                background: isDone ? 'rgba(56,242,163,.16)' : 'transparent',
                color: isDone ? 'var(--good)' : isEnabled ? 'var(--text)' : 'rgba(255,255,255,.3)',
                cursor: isEnabled ? 'pointer' : 'not-allowed',
                opacity: isEnabled || isDone ? 1 : 0.45,
                transition: 'all .15s',
              }}
            >
              {saving === mes
                ? <span className="spinner" style={{ width: 10, height: 10 }} />
                : <>
                    <span style={{ fontSize: isDone ? 13 : 8, fontWeight: 700, lineHeight: 1 }}>
                      {isDone ? '✓' : nome.slice(0, 3)}
                    </span>
                    <span style={{ fontSize: 8, opacity: 0.6 }}>{mes}</span>
                  </>
              }
            </button>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ── Sub-componente: linha de desafio pontual ─────────────────────
function TrPontual({ desafio, marco, isLocked, onSalvar }) {
  const [local, setLocal] = useState({
    realizado:       marco?.realizado       ?? false,
    data_realizacao: marco?.data_realizacao ?? '',
    obs:             marco?.obs             ?? '',
  })
  const [dirty, setDirty]   = useState(false)
  const [saving, setSaving] = useState(false)

  // Sincroniza quando marco do servidor muda (sem sobrescrever edições locais)
  useEffect(() => {
    if (!dirty) {
      setLocal({
        realizado:       marco?.realizado       ?? false,
        data_realizacao: marco?.data_realizacao ?? '',
        obs:             marco?.obs             ?? '',
      })
    }
  }, [marco?.id, marco?.realizado, marco?.data_realizacao, marco?.obs])

  function update(k, v) { setLocal(l => ({ ...l, [k]: v })); setDirty(true) }

  async function salvar() {
    setSaving(true)
    try { await onSalvar(local); setDirty(false) }
    finally { setSaving(false) }
  }

  const cor = CATEGORIA_COR[desafio.categoria] ?? 'var(--muted)'

  return (
    <tr style={{ opacity: isLocked ? 0.7 : 1 }}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 500 }}>{desafio.nome}</div>
            {desafio.descricao && (
              <div style={{ fontSize: 11, opacity: 0.55, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.4 }} title={desafio.descricao}>
                {desafio.descricao}
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{ textAlign: 'center' }}>
        <strong style={{ color: local.realizado ? 'var(--good)' : 'var(--muted)' }}>
          {local.realizado ? desafio.pontos_total : 0}
        </strong>
      </td>
      <td style={{ textAlign: 'center' }}>
        <button
          onClick={() => !isLocked && update('realizado', !local.realizado)}
          disabled={isLocked}
          style={{
            padding: '4px 14px', borderRadius: 6, border: '1px solid',
            borderColor: local.realizado ? 'var(--good)' : 'rgba(255,255,255,.2)',
            background: local.realizado ? 'rgba(56,242,163,.18)' : 'transparent',
            color: local.realizado ? 'var(--good)' : 'var(--muted)',
            cursor: isLocked ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13,
            transition: 'all .15s',
          }}
        >
          {local.realizado ? '✅ Sim' : '❌ Não'}
        </button>
      </td>
      <td>
        <input
          type="date"
          value={local.data_realizacao}
          onChange={e => update('data_realizacao', e.target.value)}
          disabled={!local.realizado || isLocked}
          style={{ width: '100%', opacity: local.realizado && !isLocked ? 1 : 0.3 }}
        />
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={local.obs}
            onChange={e => update('obs', e.target.value)}
            placeholder="Observação..."
            disabled={isLocked}
            style={{ flex: 1, minWidth: 120, opacity: isLocked ? 0.4 : 1 }}
          />
          {dirty && !isLocked && (
            <button
              className="btn btn-primary"
              style={{ padding: '4px 12px', fontSize: 12, whiteSpace: 'nowrap' }}
              onClick={salvar}
              disabled={saving}
            >
              {saving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '💾'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Sub-componente: card de stat ─────────────────────────────────
function StatCard({ label, valor, max, cor, destaque, isSoul }) {
  const p = max > 0 ? Math.min(100, Math.round((valor / max) * 100)) : 0
  return (
    <div style={{
      background: destaque 
        ? (isSoul ? 'rgba(255,143,0,.15)' : 'rgba(124,58,237,.12)') 
        : (isSoul ? 'rgba(62,32,0,.05)' : 'rgba(255,255,255,.04)'),
      border: '1px solid ' + (destaque ? (isSoul ? 'rgba(255,143,0,.3)' : 'var(--c1)') : (isSoul ? 'rgba(62,32,0,.1)' : 'rgba(255,255,255,.08)')),
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, opacity: isSoul ? 0.8 : 0.6, marginBottom: 4, fontWeight: isSoul ? 700 : 400, color: isSoul ? 'var(--soul-brown)' : 'inherit' }}>{label}</div>
      <div style={{ fontSize: destaque ? 22 : 18, fontWeight: 900, color: isSoul && !destaque ? 'var(--soul-chocolate)' : cor }}>
        {Number.isInteger(valor) ? valor : Number(valor).toFixed(1)}{' '}
        <span style={{ fontSize: 11, opacity: 0.5 }}>/ {max} pts</span>
      </div>
      <div style={{ marginTop: 8, height: 4, background: isSoul ? 'rgba(62,32,0,.08)' : 'rgba(255,255,255,.08)', borderRadius: 2 }}>
        <div style={{ width: p + '%', height: '100%', background: cor, borderRadius: 2, transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right', fontWeight: 700 }}>{p}%</div>
    </div>
  )
}

// ── DISCÍPULOS TAB ───────────────────────────────────────────────
function DiscipulosTab({ baseId, ano, tipo, isAdmin, isAuditMode, qc, isSoul }) {
  const { data: allMembros = [] } = useTable('Membros')
  const membros = useMemo(() =>
    allMembros.filter(m => {
      const mbBaseId = m.id_base ?? m.base_id
      return String(mbBaseId) === String(baseId) && (m.Status ?? m.status) !== 'Inativo'
    }).sort((a, b) => (a.Membros ?? a.nome ?? '').localeCompare(b.Membros ?? b.nome ?? '')),
    [allMembros, baseId]
  )

  const { data: catalogo = [] } = useQuery({
    queryKey: ['discipulos_catalogo'],
    queryFn: () => db.getDiscipulosRequisitoCatalogo(),
  })

  const { data: registros = [], isLoading: loadingRegs } = useQuery({
    queryKey: ['discipulos_registros', baseId, ano, tipo],
    queryFn: () => db.getDiscipulosRegistros(baseId, ano, tipo),
    enabled: Boolean(baseId),
  })

  const { data: cartoes = [], isLoading: loadingCartoes } = useQuery({
    queryKey: ['discipulos_cartoes', baseId, ano, tipo],
    queryFn: () => db.getDiscipulosCartoes(baseId, ano, tipo),
    enabled: Boolean(baseId),
  })

  const { data: departamentosCatalogo = [] } = useQuery({
    queryKey: ['discipulado_departamentos_ativos'],
    queryFn: () => db.getDiscipuladoDepartamentosAtivos(),
    staleTime: 10 * 60 * 1000,
  })

  const [expanded, setExpanded] = useState({})
  const [metaCartao, setMetaCartao] = useState({})
  // Rascunhos locais (não salvos no DB): { [membroId]: [{_draftId, nome, departamento, data_inicio, data_fim, observacoes_professor}] }
  const [draftCartoes, setDraftCartoes] = useState({})

  const DEPARTAMENTOS_SUGERIDOS = useMemo(() => {
    if (departamentosCatalogo.length > 0) return departamentosCatalogo.map(d => d.nome)
    return [
      'Música', 'Mídia', 'Recepção', 'Infantil', 'Sonoplastia', 'Ação Solidária',
      'Evangelismo', 'Escola Sabatina', 'Mordomia', 'Desbravadores', 'Aventureiros',
    ]
  }, [departamentosCatalogo])

  useEffect(() => {
    const next = {}
    cartoes.forEach(c => {
      next[c.id] = {
        nome: c.nome ?? `Cartão ${c.ordem ?? 1}`,
        departamento: c.departamento ?? '',
        descricao: c.descricao ?? '',
        data_inicio: c.data_inicio ?? '',
        data_fim: c.data_fim ?? '',
        observacoes_professor: c.observacoes_professor ?? '',
      }
    })
    setMetaCartao(next)
  }, [cartoes])

  const cartoesByMembro = useMemo(() => {
    const map = {}
    cartoes.forEach(c => {
      if (!map[c.membro_id]) map[c.membro_id] = []
      map[c.membro_id].push(c)
    })
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)))
    return map
  }, [cartoes])

  const registrosByCartao = useMemo(() => {
    const map = {}
    registros.forEach(r => {
      if (!map[r.card_id]) map[r.card_id] = {}
      map[r.card_id][r.requisito_id] = r
    })
    return map
  }, [registros])

  const hasAnyDrafts = useMemo(
    () => Object.values(draftCartoes).some(arr => arr.length > 0),
    [draftCartoes]
  )

  // Avisa navegador ao fechar/recarregar aba com rascunhos não salvos
  useEffect(() => {
    if (!hasAnyDrafts) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasAnyDrafts])

  function updateDraft(membroId, draftId, field, value) {
    setDraftCartoes(prev => ({
      ...prev,
      [membroId]: (prev[membroId] || []).map(d =>
        d._draftId === draftId ? { ...d, [field]: value } : d
      ),
    }))
  }

  function handleAddCartao(membroId, savedCount, draftCount) {
    const ordem = savedCount + draftCount + 1
    setDraftCartoes(prev => ({
      ...prev,
      [membroId]: [...(prev[membroId] || []), {
        _draftId: crypto.randomUUID(),
        nome: `Cartão ${ordem}`,
        departamento: '',
        descricao: '',
        data_inicio: '',
        data_fim: '',
        observacoes_professor: '',
      }],
    }))
  }

  function handleToggleMembro(membroId) {
    const isOpen = expanded[membroId]
    const drafts = draftCartoes[membroId] || []
    if (isOpen && drafts.length > 0) {
      if (!window.confirm(`Este aluno tem ${drafts.length} cartão(ões) não salvo(s). Ao fechar, os rascunhos serão descartados. Deseja continuar?`)) {
        return
      }
      setDraftCartoes(prev => ({ ...prev, [membroId]: [] }))
    }
    setExpanded(e => ({ ...e, [membroId]: !e[membroId] }))
  }

  function isRegLocked(reg) {
    return Boolean(reg?.realizado && reg?.data_realizacao && reg?.responsavel)
  }

  function pontosDoCartao(cartaoId) {
    const regs = registrosByCartao[cartaoId] ?? {}
    return catalogo.reduce((sum, req) => {
      const reg = regs[req.id]
      return isRegLocked(reg) ? sum + Number(req.pontos ?? 0) : sum
    }, 0)
  }

  function completosDoCartao(cartaoId) {
    const regs = registrosByCartao[cartaoId] ?? {}
    return catalogo.filter(req => isRegLocked(regs[req.id])).length
  }

  const upsertReg = useMutation({
    mutationFn: (payload) => db.upsertDiscipuloRegistro(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discipulos_registros', baseId, ano, tipo] }),
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  // Salva rascunho: cria no DB pela primeira vez
  const saveDraftCartao = useMutation({
    mutationFn: ({ membroId, draft }) => db.createDiscipulosCartao({
      membro_id: membroId,
      base_id: baseId,
      ano,
      tipo,
      nome: draft.nome,
      departamento: draft.departamento,
      descricao: draft.descricao || null,
      data_inicio: draft.data_inicio,
      data_fim: draft.data_fim || null,
      observacoes_professor: draft.observacoes_professor || null,
    }),
    onSuccess: (_, { membroId, draft }) => {
      qc.invalidateQueries({ queryKey: ['discipulos_cartoes', baseId, ano, tipo] })
      setDraftCartoes(prev => ({
        ...prev,
        [membroId]: (prev[membroId] || []).filter(d => d._draftId !== draft._draftId),
      }))
      toast.success('Cartão salvo com sucesso!')
    },
    onError: (e) => toast.error('Erro ao salvar cartão: ' + e.message),
  })

  // Atualiza cartão já existente no DB
  const saveMetaCartao = useMutation({
    mutationFn: (payload) => db.updateDiscipulosCartao(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discipulos_cartoes', baseId, ano, tipo] })
      toast.success('Cartão atualizado com sucesso!')
    },
    onError: (e) => toast.error('Erro ao atualizar cartão: ' + e.message),
  })

  const deleteCartao = useMutation({
    mutationFn: (id) => db.deleteDiscipulosCartao(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discipulos_cartoes', baseId, ano, tipo] })
      qc.invalidateQueries({ queryKey: ['discipulos_registros', baseId, ano, tipo] })
      toast.success('Cartão excluído.')
    },
    onError: (e) => toast.error('Erro ao excluir cartão: ' + e.message),
  })

  if (!baseId) return (
    <div className="card empty-state">
      <div className="empty-icon">📖</div>
      <p>Selecione uma base para ver os cartões dos discípulos.</p>
    </div>
  )

  if (loadingRegs || loadingCartoes) return <div className="card empty-state"><div className="spinner" /></div>

  if (membros.length === 0) return (
    <div className="card empty-state">
      <div className="empty-icon">👤</div>
      <p>Nenhum membro ativo encontrado para esta base.</p>
    </div>
  )

  return (
    <div>
      <div style={{ padding: '10px 0 4px', fontSize: 11, opacity: isSoul ? 0.8 : 0.55, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: isSoul ? 'var(--soul-brown)' : 'inherit' }}>
        {membros.length} aluno(s) · ano {ano} · clique no nome para expandir
      </div>
      {membros.map(membro => {
        const membroId = membro.id_membros ?? membro.id
        const isOpen = Boolean(expanded[membroId])
        const cards = cartoesByMembro[membroId] ?? []
        const drafts = draftCartoes[membroId] ?? []
        const pts = cards.reduce((sum, c) => sum + pontosDoCartao(c.id), 0)
        const completos = cards.reduce((sum, c) => sum + completosDoCartao(c.id), 0)
        const totalReqs = catalogo.length
        const maxReqMembro = totalReqs * cards.length

        return (
          <div key={membroId} className="card" style={{ marginBottom: 10 }}>
              <button
                onClick={() => handleToggleMembro(membroId)}
                style={{
                  width: '100%', padding: '14px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, color: 'inherit',
                }}
              >
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: 'var(--c1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {(membro.Membros ?? membro.nome ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>{membro.Membros ?? membro.nome}</div>
                <div style={{ fontSize: 11, opacity: isSoul ? 0.75 : 0.6, fontWeight: isSoul ? 600 : 400 }}>
                  {cards.length} cartão(ões)
                  {drafts.length > 0 && (
                    <span style={{ color: 'var(--warn)', marginLeft: 4, fontWeight: 700 }}>
                      · {drafts.length} rascunho(s) não salvo(s)
                    </span>
                  )}
                  {maxReqMembro > 0 && <span> · {completos}/{maxReqMembro} requisitos</span>}
                  {pts > 0 && <span style={{ color: isSoul ? 'var(--soul-brown)' : 'var(--c2)', marginLeft: 6 }}>· {pts} pts</span>}
                </div>
              </div>
              {cards.length > 0 && completos === maxReqMembro && maxReqMembro > 0 && (
                <span className="chip chip-good" style={{ fontSize: 11 }}>🏆 Completo</span>
              )}
              <span style={{ opacity: 0.4, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {maxReqMembro > 0 && (
              <div style={{ height: 3, background: isSoul ? 'rgba(62,32,0,.08)' : 'rgba(255,255,255,.07)' }}>
                <div style={{
                  width: `${(completos / maxReqMembro) * 100}%`, height: '100%',
                  background: completos === maxReqMembro ? 'var(--good)' : 'var(--c1)',
                  transition: 'width .4s',
                }} />
              </div>
            )}

            {isOpen && (
              <div style={{ borderTop: '1px solid ' + (isSoul ? 'rgba(62,32,0,.1)' : 'rgba(255,255,255,.08)'), padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Cada cartão possui progresso e pontuação independentes. Preencha departamento e data de início e salve para valer nas notas.</div>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAddCartao(membroId, cards.length, drafts.length)}
                    style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0, marginLeft: 12 }}
                  >
                    ➕ Adicionar cartão
                  </button>
                </div>

                {cards.length === 0 && drafts.length === 0 && (
                  <div className="empty-state" style={{ padding: 12 }}>
                    <p style={{ margin: 0 }}>Nenhum cartão criado ainda para este aluno.</p>
                  </div>
                )}

                {cards.map((card, idx) => {
                  const regsCard = registrosByCartao[card.id] ?? {}
                  const completosCard = completosDoCartao(card.id)
                  const pontosCard = pontosDoCartao(card.id)
                  const pctCard = totalReqs > 0 ? Math.round((completosCard / totalReqs) * 100) : 0
                  const cardMeta = metaCartao[card.id] ?? {
                    nome: card.nome ?? `Cartão ${idx + 1}`,
                    departamento: card.departamento ?? '',
                    descricao: card.descricao ?? '',
                    data_inicio: card.data_inicio ?? '',
                    data_fim: card.data_fim ?? '',
                    observacoes_professor: card.observacoes_professor ?? '',
                  }
                  const podeSalvarMeta = Boolean(cardMeta.departamento?.trim() && cardMeta.data_inicio)
                  const podeEncerrar = completosCard === totalReqs || Boolean(cardMeta.observacoes_professor?.trim())
                  const tentantoEncerrarSemPermissao = Boolean(cardMeta.data_fim && !podeEncerrar)

                  return (
                    <div key={card.id} className="card" style={{ marginBottom: 10 }}>
                      <div style={{ padding: 12, borderBottom: '1px solid ' + (isSoul ? 'rgba(62,32,0,.1)' : 'rgba(255,255,255,.08)') }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto', gap: 8 }}>
                          <input
                            value={cardMeta.nome}
                            onChange={(e) => setMetaCartao(m => ({ ...m, [card.id]: { ...cardMeta, nome: e.target.value } }))}
                            placeholder={`Cartão ${idx + 1}`}
                          />
                          <input
                            value={cardMeta.departamento}
                            onChange={(e) => setMetaCartao(m => ({ ...m, [card.id]: { ...cardMeta, departamento: e.target.value } }))}
                            list={`deps-${card.id}`}
                            placeholder="Departamento / discipulado"
                          />
                          <input
                            type="date"
                            value={cardMeta.data_inicio}
                            onChange={(e) => setMetaCartao(m => ({ ...m, [card.id]: { ...cardMeta, data_inicio: e.target.value } }))}
                            placeholder="Data de início"
                          />
                          <input
                            type="date"
                            value={cardMeta.data_fim}
                            onChange={(e) => setMetaCartao(m => ({ ...m, [card.id]: { ...cardMeta, data_fim: e.target.value } }))}
                            placeholder="Data final"
                            disabled={!podeEncerrar && !cardMeta.data_fim}
                          />
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              if (!podeSalvarMeta) {
                                toast.error('Preencha departamento e data de início para salvar o cartão.')
                                return
                              }
                              if (tentantoEncerrarSemPermissao) {
                                toast.error('A data final só pode ser usada após concluir todos os itens ou registrar observação do professor.')
                                return
                              }
                              saveMetaCartao.mutate({
                                id: card.id,
                                nome: cardMeta.nome,
                                departamento: cardMeta.departamento,
                                descricao: cardMeta.descricao,
                                data_inicio: cardMeta.data_inicio,
                                data_fim: cardMeta.data_fim,
                                observacoes_professor: cardMeta.observacoes_professor,
                              })
                            }}
                            disabled={saveMetaCartao.isPending}
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            {saveMetaCartao.isPending ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Salvar cartão'}
                          </button>
                          <button
                            className="btn-icon danger"
                            title="Excluir cartão"
                            disabled={deleteCartao.isPending}
                            onClick={() => {
                              if (!window.confirm(`Excluir "${card.nome ?? `Cartão ${idx + 1}`}"? Todos os registros deste cartão serão removidos e esta ação não pode ser desfeita.`)) return
                              deleteCartao.mutate(card.id)
                            }}
                          >
                            {deleteCartao.isPending ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '🗑️'}
                          </button>
                          <datalist id={`deps-${card.id}`}>
                            {DEPARTAMENTOS_SUGERIDOS.map(dep => <option key={dep} value={dep} />)}
                          </datalist>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <input
                            value={cardMeta.descricao}
                            onChange={(e) => setMetaCartao(m => ({ ...m, [card.id]: { ...cardMeta, descricao: e.target.value } }))}
                            placeholder="Descrição (área de atuação, foco do discipulado…)"
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <textarea
                            value={cardMeta.observacoes_professor}
                            onChange={(e) => setMetaCartao(m => ({ ...m, [card.id]: { ...cardMeta, observacoes_professor: e.target.value } }))}
                            placeholder="Observações do professor / motivo de encerramento antecipado"
                            rows={2}
                            style={{ width: '100%', resize: 'vertical' }}
                          />
                        </div>

                        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
                          {completosCard}/{totalReqs} requisitos · {pontosCard} pts · {pctCard}%
                          {card.departamento && card.data_inicio && <span> · válido para discipulado nas notas</span>}
                          {tentantoEncerrarSemPermissao && <span style={{ color: 'var(--warn)' }}> · data final exige conclusão ou observação</span>}
                        </div>
                      </div>

                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: 32, textAlign: 'center' }}>#</th>
                              <th>Requisito</th>
                              <th style={{ width: 95, textAlign: 'center' }}>Sim/Não</th>
                              <th style={{ width: 120 }}>Data</th>
                              <th style={{ minWidth: 150 }}>Responsável</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catalogo.map(req => (
                              <DiscipuloReqRow
                                key={`${card.id}-${req.id}`}
                                req={req}
                                reg={regsCard[req.id]}
                                isAdmin={isAdmin}
                                isAuditMode={isAuditMode}
                                onSave={(vals) => upsertReg.mutateAsync({
                                  membro_id: membroId,
                                  base_id: baseId,
                                  card_id: card.id,
                                  requisito_id: req.id,
                                  ano,
                                  ...vals,
                                })}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}

                {/* Cartões rascunho (não salvos no banco) */}
                {drafts.map((draft, draftIdx) => {
                  const podeSalvarDraft = Boolean(draft.departamento?.trim() && draft.data_inicio)
                  const ordemVisual = cards.length + draftIdx + 1
                  return (
                    <div key={draft._draftId} className="card" style={{ marginBottom: 10, border: '2px dashed var(--warn)' }}>
                      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,190,0,.06)', borderBottom: '1px solid rgba(255,190,0,.2)' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)' }}>⚠️ Rascunho — não salvo</span>
                        <span style={{ fontSize: 11, opacity: 0.65 }}>Preencha departamento e data de início para salvar.</span>
                      </div>
                      <div style={{ padding: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto', gap: 8 }}>
                          <input
                            value={draft.nome}
                            onChange={e => updateDraft(membroId, draft._draftId, 'nome', e.target.value)}
                            placeholder={`Cartão ${ordemVisual}`}
                          />
                          <input
                            value={draft.departamento}
                            onChange={e => updateDraft(membroId, draft._draftId, 'departamento', e.target.value)}
                            list={`deps-draft-${draft._draftId}`}
                            placeholder="Departamento * (obrigatório)"
                            style={{ borderColor: !draft.departamento?.trim() ? 'var(--warn)' : undefined }}
                          />
                          <input
                            type="date"
                            value={draft.data_inicio}
                            onChange={e => updateDraft(membroId, draft._draftId, 'data_inicio', e.target.value)}
                            style={{ borderColor: !draft.data_inicio ? 'var(--warn)' : undefined }}
                          />
                          <input
                            type="date"
                            value={draft.data_fim}
                            onChange={e => updateDraft(membroId, draft._draftId, 'data_fim', e.target.value)}
                            placeholder="Data final"
                          />
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              if (!podeSalvarDraft) {
                                toast.error('Preencha departamento e data de início para salvar o cartão.')
                                return
                              }
                              saveDraftCartao.mutate({ membroId, draft })
                            }}
                            disabled={saveDraftCartao.isPending}
                            style={{ padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                          >
                            {saveDraftCartao.isPending ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '💾 Salvar'}
                          </button>
                          <button
                            className="btn-icon danger"
                            onClick={() => {
                              setDraftCartoes(prev => ({
                                ...prev,
                                [membroId]: (prev[membroId] || []).filter(d => d._draftId !== draft._draftId),
                              }))
                              toast('Rascunho descartado.', { icon: '🗑️' })
                            }}
                            title="Descartar rascunho"
                          >
                            🗑️
                          </button>
                          <datalist id={`deps-draft-${draft._draftId}`}>
                            {DEPARTAMENTOS_SUGERIDOS.map(dep => <option key={dep} value={dep} />)}
                          </datalist>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <input
                            value={draft.descricao}
                            onChange={e => updateDraft(membroId, draft._draftId, 'descricao', e.target.value)}
                            placeholder="Descrição (área de atuação, foco do discipulado…)"
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <textarea
                            value={draft.observacoes_professor}
                            onChange={e => updateDraft(membroId, draft._draftId, 'observacoes_professor', e.target.value)}
                            placeholder="Observações do professor"
                            rows={2}
                            style={{ width: '100%', resize: 'vertical' }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DiscipuloReqRow({ req, reg, isAdmin, isAuditMode, onSave }) {
  const locked = Boolean(reg?.realizado && reg?.data_realizacao && reg?.responsavel)
  const editable = !locked || isAdmin || isAuditMode

  const [local, setLocal] = useState({
    realizado: reg?.realizado ?? false,
    data_realizacao: reg?.data_realizacao ?? '',
    responsavel: reg?.responsavel ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!saving) {
      setLocal({
        realizado: reg?.realizado ?? false,
        data_realizacao: reg?.data_realizacao ?? '',
        responsavel: reg?.responsavel ?? '',
      })
    }
  }, [reg?.id, reg?.realizado, reg?.data_realizacao, reg?.responsavel])

  async function save(vals) {
    setSaving(true)
    try { await onSave(vals) }
    catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleToggle() {
    if (!editable || saving) return
    const vals = { ...local, realizado: !local.realizado }
    setLocal(vals)
    await save(vals)
  }

  async function handleBlur() {
    if (saving) return
    await save(local)
  }

  return (
    <tr style={{ opacity: locked && !editable ? 0.7 : 1 }}>
      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13 }}>{req.numero}</td>
      <td>
        <div style={{ fontSize: 12, lineHeight: 1.45 }}>
          {req.descricao.length > 140 ? req.descricao.slice(0, 137) + '…' : req.descricao}
        </div>
        {Number(req.pontos) > 0 && (
          <span style={{ fontSize: 10, color: 'var(--c2)', opacity: 0.75 }}>+{req.pontos} pts</span>
        )}
      </td>
      <td style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <button
            onClick={handleToggle}
            disabled={!editable || saving}
            style={{
              padding: '3px 10px', borderRadius: 6, border: '1px solid',
              borderColor: local.realizado ? 'var(--good)' : 'rgba(255,255,255,.2)',
              background: local.realizado ? 'rgba(56,242,163,.18)' : 'transparent',
              color: local.realizado ? 'var(--good)' : 'var(--muted)',
              cursor: editable ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 12,
              minWidth: 58, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {saving
              ? <span className="spinner" style={{ width: 10, height: 10 }} />
              : local.realizado ? '✅ Sim' : '❌ Não'}
          </button>
          {locked && <span title="Bloqueado — todos campos preenchidos" style={{ fontSize: 13 }}>🔒</span>}
        </div>
      </td>
      <td>
        <input
          type="date"
          value={local.data_realizacao}
          onChange={e => setLocal(l => ({ ...l, data_realizacao: e.target.value }))}
          onBlur={handleBlur}
          disabled={!editable || !local.realizado}
          style={{ width: '100%', opacity: editable && local.realizado ? 1 : 0.35 }}
        />
      </td>
      <td>
        <input
          value={local.responsavel}
          onChange={e => setLocal(l => ({ ...l, responsavel: e.target.value }))}
          onBlur={handleBlur}
          placeholder="Responsável..."
          disabled={!editable}
          style={{ width: '100%', opacity: editable ? 1 : 0.35 }}
        />
      </td>
    </tr>
  )
}

// ── BATISMOS TAB ──────────────────────────────────────────────────
function BatismosTab({ baseId, ano, tipo, isAdmin, isAuditMode, isSoul }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ nome: '', mes: '', obs: '' })
  const [fileInput, setFileInput] = useState(null)
  const [uploading, setUploading] = useState(false)

  const { data: batismos = [], isLoading } = useQuery({
    queryKey: ['batismos', baseId, ano],
    queryFn: () => db.getBatismos(baseId, ano),
    enabled: Boolean(baseId),
  })

  async function syncDesafioBatismo() {
    if (!baseId || !ano || !tipo) return
    try {
      await db.syncBatismoDesafio(baseId, ano, tipo)
      qc.invalidateQueries({ queryKey: ['desafios_marcos', baseId, ano] })
      qc.invalidateQueries({ queryKey: ['desafios_registros_ano', baseId, ano] })
    } catch {
      // sync não-crítico: falha silenciosa
    }
  }

  const upsert = useMutation({
    mutationFn: async ({ id, nome, mes, obs, file }) => {
      let foto_url = editItem?.foto_url ?? null
      if (file) {
        const path = `batismos/${baseId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        foto_url = await db.uploadArquivo('anc-media', path, file)
      }
      return db.upsertBatismo({ id, base_id: baseId, nome, mes: mes || null, ano, foto_url, obs })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batismos', baseId, ano] })
      toast.success(editItem ? 'Batismo atualizado!' : 'Batismo registrado!')
      setShowForm(false); setEditItem(null)
      setForm({ nome: '', mes: '', obs: '' }); setFileInput(null)
      syncDesafioBatismo()
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  const del = useMutation({
    mutationFn: (id) => db.deleteBatismo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batismos', baseId, ano] })
      toast.success('Removido.')
      syncDesafioBatismo()
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  function handleEditar(item) {
    setEditItem(item)
    setForm({ nome: item.nome, mes: item.mes ? String(item.mes) : '', obs: item.obs ?? '' })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome) { toast.error('Informe o nome do batizado.'); return }
    setUploading(true)
    try {
      await upsert.mutateAsync({ id: editItem?.id, ...form, file: fileInput })
    } finally {
      setUploading(false)
    }
  }

  if (!baseId) return (
    <div className="card empty-state">
      <div className="empty-icon">🕊️</div>
      <p>Selecione uma base para ver e registrar batismos.</p>
    </div>
  )

  return (
    <div>
      {/* Formulário */}
      {(showForm || !baseId) ? null : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 0 4px' }}>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => { setShowForm(true); setEditItem(null); setForm({ nome: '', mes: '', obs: '' }) }}>
            + Registrar Batismo
          </button>
        </div>
      )}

      {showForm && (
        <div className="card section">
          <div className="card-header">
            <div className="card-title">{editItem ? '✏️ Editar Batismo' : '🕊️ Novo Batismo'}</div>
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => { setShowForm(false); setEditItem(null) }}>✕</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Nome do Batizado *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div className="form-group">
                  <label>Mês</label>
                  <select value={form.mes} onChange={e => setForm(f => ({ ...f, mes: e.target.value }))}>
                    <option value="">Selecione…</option>
                    {NOMES_MESES_FULL.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Foto (PNG/JPG)</label>
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={e => setFileInput(e.target.files[0] ?? null)}
                    style={{ fontSize: 12 }}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Observação</label>
                  <input value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} placeholder="Observação opcional" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditItem(null) }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={upsert.isPending || uploading}>
                  {(upsert.isPending || uploading) ? <span className="spinner" /> : '💾 Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="card empty-state"><div className="spinner" /></div>
      ) : batismos.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">🕊️</div>
          <p>Nenhum batismo registrado para {ano}.</p>
          {!showForm && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Registrar Batismo</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, paddingTop: 10 }}>
          {batismos.map(b => (
            <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {b.foto_url ? (
                <img
                  src={b.foto_url}
                  alt={b.nome}
                  style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              ) : (
                <div style={{ height: 80, background: isSoul ? 'rgba(255,143,0,.15)' : 'rgba(124,58,237,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🕊️</div>
              )}
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{b.nome}</div>
                {b.mes && (
                  <div style={{ fontSize: 12, color: isSoul ? 'var(--soul-brown)' : 'var(--c2)', marginTop: 2, fontWeight: isSoul ? 700 : 400 }}>
                    {NOMES_MESES_FULL[b.mes - 1]} de {b.ano}
                  </div>
                )}
                {b.obs && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{b.obs}</div>}
                <div className="td-actions" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                  <button className="btn-icon" onClick={() => handleEditar(b)} title="Editar">✏️</button>
                  <button className="btn-icon danger" onClick={() => confirm('Excluir registro?') && del.mutate(b.id)} title="Excluir">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── BIBLIOTECA TAB ────────────────────────────────────────────────
function FotosTab({ baseId, isAdmin, isAuditMode }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ titulo: '', data_upload: new Date().toISOString().split('T')[0], observacao: '' })
  const [fileInput, setFileInput] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  const { data: imagens = [], isLoading } = useQuery({
    queryKey: ['biblioteca', baseId],
    queryFn: () => db.getBibliotecaImagens(baseId),
    enabled: Boolean(baseId),
  })

  const upsert = useMutation({
    mutationFn: async ({ id, titulo, data_upload, observacao, file }) => {
      let url = editItem?.url ?? ''
      if (file) {
        const path = `biblioteca/${baseId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        url = await db.uploadArquivo('anc-media', path, file)
      }
      if (!url) throw new Error('Selecione uma imagem.')
      return db.upsertBibliotecaImagem({ id, base_id: baseId, titulo, url, data_upload, observacao })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['biblioteca', baseId] })
      toast.success(editItem ? 'Imagem atualizada!' : 'Imagem adicionada!')
      setShowForm(false); setEditItem(null)
      setForm({ titulo: '', data_upload: new Date().toISOString().split('T')[0], observacao: '' })
      setFileInput(null)
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  const del = useMutation({
    mutationFn: (id) => db.deleteBibliotecaImagem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['biblioteca', baseId] })
      toast.success('Imagem removida.')
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.titulo) { toast.error('Informe o título.'); return }
    if (!fileInput && !editItem?.url) { toast.error('Selecione uma imagem.'); return }
    setUploading(true)
    try {
      await upsert.mutateAsync({ id: editItem?.id, ...form, file: fileInput })
    } finally {
      setUploading(false)
    }
  }

  if (!baseId) return (
    <div className="card empty-state">
      <div className="empty-icon">🖼️</div>
      <p>Selecione uma base para ver e gerenciar a biblioteca de imagens.</p>
    </div>
  )

  return (
    <div>
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,.88)', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 20,
          }}
        >
          <img
            src={lightbox.url}
            alt={lightbox.titulo}
            style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ color: '#fff', marginTop: 14, fontSize: 14, textAlign: 'center' }}>
            <strong>{lightbox.titulo}</strong>
            {lightbox.observacao && <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>{lightbox.observacao}</div>}
            <div style={{ opacity: 0.4, fontSize: 11, marginTop: 4 }}>{lightbox.data_upload}</div>
          </div>
          <button style={{ marginTop: 16, color: '#fff', background: 'none', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, padding: '6px 18px', cursor: 'pointer' }} onClick={() => setLightbox(null)}>Fechar</button>
        </div>
      )}

      {/* Botão adicionar */}
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 0 4px' }}>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => { setShowForm(true); setEditItem(null) }}>
            + Adicionar Imagem
          </button>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="card section">
          <div className="card-header">
            <div className="card-title">{editItem ? '✏️ Editar Imagem' : '🖼️ Nova Imagem'}</div>
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => { setShowForm(false); setEditItem(null) }}>✕</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Título *</label>
                  <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião de Líderes — Março" />
                </div>
                <div className="form-group">
                  <label>Data</label>
                  <input type="date" value={form.data_upload} onChange={e => setForm(f => ({ ...f, data_upload: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Arquivo (PNG/JPG) {!editItem && '*'}</label>
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={e => setFileInput(e.target.files[0] ?? null)}
                    style={{ fontSize: 12 }}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Descrição</label>
                  <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Breve descrição da imagem (opcional)" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditItem(null) }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={upsert.isPending || uploading}>
                  {(upsert.isPending || uploading) ? <span className="spinner" /> : '💾 Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Galeria */}
      {isLoading ? (
        <div className="card empty-state"><div className="spinner" /></div>
      ) : imagens.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">🖼️</div>
          <p>Nenhuma imagem na biblioteca desta base.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, paddingTop: 10 }}>
          {imagens.map(img => (
            <div key={img.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{ cursor: 'pointer', position: 'relative' }}
                onClick={() => setLightbox(img)}
              >
                <img
                  src={img.url}
                  alt={img.titulo}
                  style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'all .2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(0,0,0,.35)' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = 0; e.currentTarget.style.background = 'rgba(0,0,0,0)' }}
                >
                  <span style={{ fontSize: 28 }}>🔍</span>
                </div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{img.titulo}</div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{img.data_upload}</div>
                {img.observacao && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3 }}>{img.observacao}</div>}
                <div className="td-actions" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                  <button className="btn-icon" onClick={() => { setEditItem(img); setForm({ titulo: img.titulo, data_upload: img.data_upload, observacao: img.observacao ?? '' }); setShowForm(true) }} title="Editar">✏️</button>
                  <button className="btn-icon danger" onClick={() => confirm('Excluir imagem?') && del.mutate(img.id)} title="Excluir">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── COMPARATIVO TAB ───────────────────────────────────────────────
function ComparativoTab({ baseId, baseNome, tipo, cfgTrim, sabados, catalogo, registros }) {
  const qc = useQueryClient()
  const { data: provasCatalogo = [] } = useTable('Provas')
  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas_trimestre_comparativo', tipo, baseId, baseNome, cfgTrim?.primeiro_sabado, cfgTrim?.ultimo_sabado],
    queryFn: () => {
      const isSoul = String(tipo ?? '').toLowerCase().includes('soul')
      return isSoul
        ? db.getNotasSoulPorBaseETrimestre(baseId, cfgTrim.primeiro_sabado, cfgTrim.ultimo_sabado, baseNome)
        : db.getNotasTeenPorBaseETrimestre(baseId, cfgTrim.primeiro_sabado, cfgTrim.ultimo_sabado, baseNome)
    },
    enabled: Boolean(baseId && cfgTrim),
  })

  const comunhaoDesafio = useMemo(() =>
    catalogo.find(d =>
      isCategoriaAutoAdministrativa(d.categoria) &&
      (d.periodicidade === 'semanal' || d.rastreamento === 'semanal') &&
      /comunh[aã]o/i.test(d.nome)
    ),
    [catalogo]
  )
  const assiduidadeDesafio = useMemo(() =>
    catalogo.find(d =>
      isCategoriaAutoAdministrativa(d.categoria) &&
      (d.periodicidade === 'semanal' || d.rastreamento === 'semanal') &&
      /assiduidade/i.test(d.nome)
    ),
    [catalogo]
  )

  const notasByDate = useMemo(() => {
    function normalizeDateOnly(value) {
      if (!value) return ''
      const raw = String(value).trim()
      if (!raw) return ''

      // ISO (yyyy-mm-dd ou timestamp)
      const isoLike = raw.slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(isoLike)) return isoLike

      // BR (dd/mm/yyyy)
      const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (br) return `${br[3]}-${br[2]}-${br[1]}`

      return ''
    }

    const map = {}
    notas.forEach(n => {
      const date = normalizeDateOnly(n.Data ?? n.data)
      if (!date) return
      if (!map[date]) map[date] = []
      map[date].push(n)
    })
    return map
  }, [notas])

  const provasByDate = useMemo(() => {
    const set = new Set()
    provasCatalogo
      .filter(p => p.tipo === tipo)
      .forEach(p => {
        const date = String(p.data || p.Data || '').slice(0, 10)
        if (date && /\bprova\b/i.test(p.nome || '')) set.add(date)
      })
    return set
  }, [provasCatalogo, tipo])

  function getRegistro(desafioId, dataSabado) {
    return registros.find(r => r.desafio_id === desafioId && r.data_sabado === dataSabado)
  }

  function hasAnsweredValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== ''
  }

  function notaTemComunhaoSim(nota) {
    const valor = String(nota?.comunhao ?? nota?.Comunhao ?? '').trim().toLowerCase()
    return valor === 'sim' || valor === 's' || valor === 'true' || valor === '1' || valor === 'yes' || valor === 'x'
  }

  const statusBySabado = useMemo(() => {
    const entries = sabados.map((sab) => {
      const notasDia = notasByDate[sab] ?? []
      const temNotas = notasDia.length > 0
      const comunhaoAuto = temNotas && notasDia.every(notaTemComunhaoSim)
      const assidAuto = temNotas
      // Manual só conta se houver notas lançadas — sem notas não há como validar assiduidade/comunhão.
      const comunhaoManual = temNotas && comunhaoDesafio ? Boolean(getRegistro(comunhaoDesafio.id, sab)?.realizado) : false
      const assidManual = temNotas && assiduidadeDesafio ? Boolean(getRegistro(assiduidadeDesafio.id, sab)?.realizado) : false

      return [sab, {
        notasDia,
        temNotas,
        comunhaoOk: comunhaoManual || comunhaoAuto,
        assidOk: assidManual || assidAuto,
        comunhaoAuto,
        assidAuto,
      }]
    })

    return Object.fromEntries(entries)
  }, [sabados, notasByDate, comunhaoDesafio, assiduidadeDesafio, registros])

  useEffect(() => {
    if (!baseId || !catalogo?.length || !notas.length) return

    let cancelled = false

    async function syncAutomaticos() {
      const tasks = []

      sabados.forEach((sab) => {
        const status = statusBySabado[sab]
        if (!status?.temNotas) return

        const needsAssid = assiduidadeDesafio && status.assidAuto && !getRegistro(assiduidadeDesafio.id, sab)?.realizado
        const needsComunhao = comunhaoDesafio && status.comunhaoAuto && !getRegistro(comunhaoDesafio.id, sab)?.realizado

        if (!needsAssid && !needsComunhao) return

        tasks.push(
          db.syncDesafiosAdministrativosFromNotas({
            base_id: baseId,
            tipo: catalogo[0]?.tipo || 'G148 Teen',
            data_sabado: sab,
            rows: status.notasDia,
            responsavel: null,
            catalogo,
          })
        )
      })

      if (tasks.length === 0) return

      await Promise.all(tasks)
      if (!cancelled) {
        qc.invalidateQueries({ queryKey: ['desafios_registros', baseId, cfgTrim?.primeiro_sabado, cfgTrim?.ultimo_sabado] })
      }
    }

    syncAutomaticos()
    return () => { cancelled = true }
  }, [baseId, catalogo, notas, sabados, statusBySabado, assiduidadeDesafio, comunhaoDesafio, registros, qc, cfgTrim?.primeiro_sabado, cfgTrim?.ultimo_sabado])

  if (!baseId || !cfgTrim) return (
    <div className="card empty-state">
      <div className="empty-icon">📊</div>
      <p>Selecione uma base e configure o trimestre para ver o comparativo.</p>
    </div>
  )

  if (isLoading) return <div className="card empty-state"><div className="spinner" /></div>

  const totNotas  = sabados.filter(s => statusBySabado[s]?.temNotas).length
  const totComunhao = sabados.filter(s => statusBySabado[s]?.comunhaoOk).length
  const totAssid  = sabados.filter(s => statusBySabado[s]?.assidOk).length

  return (
    <div className="card section">
      <div className="card-header">
        <div className="card-title">📊 Comparativo — Provas vs. Desafios Administrativos</div>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 18px', minWidth: 140 }}>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>Provas lançadas</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c2)' }}>{totNotas} <span style={{ fontSize: 12, opacity: 0.5 }}>/ {sabados.length} sáb.</span></div>
          </div>
          {totComunhao !== null && (
            <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 18px', minWidth: 140 }}>
              <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>Comunhão diária</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--good)' }}>{totComunhao} <span style={{ fontSize: 12, opacity: 0.5 }}>/ {sabados.length}</span></div>
            </div>
          )}
          {totAssid !== null && (
            <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 18px', minWidth: 140 }}>
              <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>Assiduidade / Portal</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--good)' }}>{totAssid} <span style={{ fontSize: 12, opacity: 0.5 }}>/ {sabados.length}</span></div>
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Sábado</th>
                <th style={{ textAlign: 'center' }}>Provas lançadas</th>
                <th style={{ textAlign: 'center' }}>COMUNHÃO DIÁRIA</th>
                <th style={{ textAlign: 'center' }}>Assiduidade e Portal ANC</th>
              </tr>
            </thead>
            <tbody>
              {sabados.map(sab => {
                const status = statusBySabado[sab] ?? {}
                const notasDia = status.notasDia ?? []
                const temNotas = Boolean(status.temNotas)
                const comunhaoOk = Boolean(status.comunhaoOk)
                const assidOk  = Boolean(status.assidOk)
                const allOk    = temNotas && comunhaoOk && assidOk
                const nenhum   = !temNotas && !comunhaoOk && !assidOk

                return (
                  <tr key={sab} style={{ background: allOk ? 'rgba(56,242,163,.04)' : nenhum ? 'rgba(255,80,80,.03)' : undefined }}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{fmtDataBR(sab)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {temNotas
                        ? <span style={{ color: 'var(--good)', fontSize: 13 }}>✅ {notasDia.length} nota(s)</span>
                        : provasByDate.has(sab)
                          ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>❌ Sem prova</span>
                          : <span style={{ opacity: 0.35, fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {comunhaoOk
                        ? <span style={{ color: 'var(--good)', fontSize: 13 }}>✅ Sim</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 13 }}>❌ Não</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {assidOk
                        ? <span style={{ color: 'var(--good)', fontSize: 13 }}>✅ Sim</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 13 }}>❌ Não</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
