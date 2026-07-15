import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { useTable } from '../hooks/useTable'
import { db } from '../api/db'
import { useUIStore } from '../store/uiStore'
import { parseError } from '../lib/errorMessages'
import { supabase } from '../api/supabase'

function fmtDataBR(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const TABS = [
  { id: 'provas',     label: '📝 Provas',     icon: '📝' },
  { id: 'desafios',   label: '🏅 Desafios',   icon: '🏅' },
  { id: 'geral',      label: '⚙️ Geral',      icon: '⚙️' },
  { id: 'trimestres', label: '📅 Trimestres', icon: '📅' },
  { id: 'regioes',    label: '🌍 Regiões',    icon: '🌍' },
  { id: 'distritos',  label: '📍 Distritos',  icon: '📍' },
  { id: 'igrejas',    label: '⛪ Igrejas',    icon: '⛪' },
  { id: 'disciplos',  label: '📖 Discípulos', icon: '📖' },
  { id: 'diagnostico', label: '📊 Diagnóstico', icon: '🛡️' },
  { id: 'logs',        label: '📋 Logs de Acesso', icon: '📋' },
]

export default function AdminConfig() {
  const { min } = useParams()
  const { isAdmin, isAuditMode, changePassword, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState('provas') // Inicia em Provas que é o mais comum
  const [pwd, setPwd] = useState({ cur: '', novo: '', conf: '' })

  async function handleChangePwd(e) {
    e.preventDefault()
    if (!pwd.cur || !pwd.novo || !pwd.conf) { toast.error('Preencha tudo.'); return }
    if (pwd.novo !== pwd.conf) { toast.error('Senhas não coincidem.'); return }
    const ok = await changePassword(pwd.cur, pwd.novo)
    if (ok) { toast.success('Senha alterada!'); setPwd({ cur: '', novo: '', conf: '' }) } 
    else { toast.error('Senha atual incorreta.') }
  }

  const currentMin = min === 'soul' ? 'Soul+' : min === 'teen' ? 'G148 Teen' : null

  const filteredTabs = useMemo(() => {
    // Se estiver no contexto de um ministério específico
    if (min === 'soul') {
      return TABS.filter(t => ['provas', 'desafios'].includes(t.id))
    }
    if (min === 'teen') {
      return TABS.filter(t => ['provas', 'desafios', 'disciplos'].includes(t.id))
    }
    // Se for Configurações Gerais (/admin/config)
    return TABS.filter(t => !['provas', 'desafios', 'disciplos'].includes(t.id))
    // logs só aparece em /admin/config geral
  }, [min])

  // Ajusta a aba ativa se ela não existir no contexto atual
  useEffect(() => {
    const validSoul = ['provas', 'desafios']
    const validTeen = ['provas', 'desafios', 'disciplos']
    const validGeral = ['geral', 'trimestres', 'regioes', 'distritos', 'igrejas', 'diagnostico', 'logs']
    if (min === 'soul' && !validSoul.includes(activeTab)) {
      setActiveTab('provas')
    } else if (min === 'teen' && !validTeen.includes(activeTab)) {
      setActiveTab('provas')
    } else if (!min && !validGeral.includes(activeTab)) {
      setActiveTab('geral')
    }
  }, [min, activeTab])

  return (
    <div className={`admin-config-container fade-in ${min === 'soul' ? 'theme-soul' : ''}`}>
      {currentMin && (
        <div className="status-bar ok" style={{ marginBottom: 15, borderRadius: 12, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, background: min === 'soul' ? 'var(--soul-amber)' : 'rgba(124,58,237,.1)', color: min === 'soul' ? 'var(--soul-brown)' : 'var(--c1)', border: '1px solid currentColor' }}>
          <span style={{ fontSize: 20 }}>{min === 'soul' ? '☀️' : '⚡'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Configurações — {currentMin}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Você está editando apenas dados deste ministério.</div>
          </div>
        </div>
      )}

      <div className="card section" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">⚙️ Painel de Administração Mestre</div>
          {!isAdmin && !isAuditMode && (
            <div className="chip chip-warn">Ative o cadeado 🔓 no topo para editar</div>
          )}
        </div>
        
        {/* Abas Estilizadas */}
        <div className="admin-tabs-nav">
          {filteredTabs.map(t => (
            <button 
              key={t.id} 
              className={`admin-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-text">{t.label.split(' ')[1]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-tab-content">
        {activeTab === 'geral' && (
          <>
            <div className="card section">
              <div className="card-header"><div className="card-title">🔒 Segurança da Conta</div></div>
              <div className="card-body">
                <form onSubmit={handleChangePwd}>
                  <div className="form-grid" style={{ maxWidth: 400 }}>
                    <div className="form-group"><label>Senha Atual</label><input type="password" value={pwd.cur} onChange={e => setPwd(p => ({ ...p, cur: e.target.value }))} /></div>
                    <div className="form-group"><label>Nova Senha</label><input type="password" value={pwd.novo} onChange={e => setPwd(p => ({ ...p, novo: e.target.value }))} /></div>
                    <div className="form-group"><label>Repetir Nova Senha</label><input type="password" value={pwd.conf} onChange={e => setPwd(p => ({ ...p, conf: e.target.value }))} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                    <button type="submit" className="btn btn-primary">Alterar Senha</button>
                    <button type="button" className="btn btn-outline danger" onClick={() => confirm('Sair do Admin?') && logout()}>Sair do Admin</button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {activeTab === 'provas' && <ProvasCRUD filterMin={currentMin} />}
        {activeTab === 'trimestres' && <TrimestresConfig />}
        {activeTab === 'desafios' && <DesafiosCatalogoConfig filterMin={currentMin} />}
        {activeTab === 'disciplos' && <DiscipulosConfig />}
        {activeTab === 'regioes' && <DimensionCRUD table="Regiao" pk="id_regiao" field="Regiao" label="Região" />}
        {activeTab === 'distritos' && <DimensionCRUD table="Distritos" pk="id_distritos" field="Distritos" label="Distrito" parentField="id_regiao" parentPkField="id_regiao" parentTable="Regiao" parentLabel="Regiao" />}
        {activeTab === 'igrejas' && <DimensionCRUD table="Igrejas" pk="id_igrejas" field="Igrejas" label="Igreja" parentField="id_distritos" parentPkField="id_distritos" parentTable="Distritos" parentLabel="Distritos" />}
        {activeTab === 'diagnostico' && <DiagnosticoConfig />}
        {activeTab === 'logs' && <ActivityLogPanel />}

      </div>
    </div>
  )
}

// ── COMPONENTE: Gerenciamento de Provas ──────────────────────
function ProvasCRUD({ filterMin }) {
  const showError = useUIStore(s => s.showError)
  const { isAdmin, isAuditMode } = useAuthStore()
  const { data, isLoading, insert, update, remove } = useTable('Provas')
  const [form, setForm] = useState({ tipo: filterMin || '', nome: '', data: '' })
  const [editingId, setEditingId] = useState(null)

  const canCrud = isAdmin || isAuditMode

  useEffect(() => {
    setForm({ tipo: filterMin || '', nome: '', data: '' })
    setEditingId(null)
  }, [filterMin])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.tipo || !form.nome || !form.data) return showError('Formulário Incompleto', 'Preencha o tipo, nome e data da prova.')
    if (editingId) {
      await update.mutateAsync({ id: editingId, data: form })
      toast.success('Prova atualizada!')
      setEditingId(null)
    } else {
      await insert.mutateAsync(form)
      toast.success('Prova cadastrada!')
    }
    setForm({ tipo: filterMin || '', nome: '', data: '' })
  }

  const sorted = [...(data || [])]
    .filter(p => !filterMin || p.tipo === filterMin)
    .sort((a,b) => (a.data || '').localeCompare(b.data || ''))

  function getProvaId(p) {
    return p?.id ?? p?.id_provas
  }

  return (
    <div className="dimension-crud">
       <div className="card section">
        <div className="card-header"><div className="card-title">{editingId ? '✏️ Editar Prova' : '➕ Nova Prova'}</div></div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Tipo</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} disabled={Boolean(filterMin)}>
                  <option value="">Selecione...</option>
                  <option value="G148 Teen">G148 Teen</option>
                  <option value="Soul+">Soul+</option>
                </select>
              </div>
              <div className="form-group"><label>Nome da Prova</label><input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: BEP 1ª Fase" /></div>
              <div className="form-group"><label>Data</label><input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button type="submit" className="btn btn-primary" disabled={!canCrud}>Salvar Prova</button>
            </div>
          </form>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Nome</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody>
              {sorted.map(p => (
                <tr key={getProvaId(p)}>
                  <td><span className={`chip ${p.tipo === 'Soul+' ? 'chip-soul' : 'chip-teen'}`}>{p.tipo}</span></td>
                  <td><strong>{p.nome}</strong></td>
                  <td>{fmtDataBR(p.data)}</td>
                  <td>
                    <div className="td-actions">
                      <button className="btn-icon" onClick={() => { setForm({tipo: p.tipo, nome: p.nome, data: p.data}); setEditingId(getProvaId(p)) }} disabled={!canCrud}>✏️</button>
                      <button className="btn-icon danger" onClick={() => canCrud && confirm('Excluir?') && remove.mutateAsync(getProvaId(p))} disabled={!canCrud}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── COMPONENTE: Configuração de Trimestres ───────────────────
function TrimestresConfig() {
  const showError = useUIStore(s => s.showError)
  const { isAuditMode } = useAuthStore()
  const qc = useQueryClient()
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const [form, setForm] = useState({ trimestre: '', primeiro_sabado: '', ultimo_sabado: '' })
  const [editingId, setEditingId] = useState(null)

  const { data: trimestres = [], isLoading } = useQuery({
    queryKey: ['configuracao_trimestres', ano],
    queryFn: () => db.getConfiguracaoTrimestres(ano),
  })

  const upsert = useMutation({
    mutationFn: (payload) => db.upsertConfiguracaoTrimestre(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuracao_trimestres', ano] })
      toast.success('Trimestre salvo!')
      setForm({ trimestre: '', primeiro_sabado: '', ultimo_sabado: '' })
      setEditingId(null)
    },
    onError: (e) => {
      const { title, message, technicalInfo = null, contactAdmin = false } = parseError(e, 'configuracao_trimestres', 'insert')
      showError(title, message, technicalInfo, contactAdmin)
    },
  })

  const del = useMutation({
    mutationFn: (id) => db.deleteConfiguracaoTrimestre(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuracao_trimestres', ano] })
      toast.success('Removido.')
    },
  })

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

  const preview = useMemo(() => {
    if (!form.primeiro_sabado || !form.ultimo_sabado) return null
    try {
      const s = gerarSabados(form.primeiro_sabado, form.ultimo_sabado)
      return s.length
    } catch { return null }
  }, [form.primeiro_sabado, form.ultimo_sabado])

  const NOMES = { 1: '1º Trimestre', 2: '2º Trimestre', 3: '3º Trimestre', 4: '4º Trimestre' }

  function handleSalvar(e) {
    e.preventDefault()
    if (!form.trimestre || !form.primeiro_sabado || !form.ultimo_sabado) {
      showError('Dados Incompletos', 'Selecione o trimestre e as datas de início/fim.'); return
    }
    upsert.mutate({ ano, trimestre: Number(form.trimestre), primeiro_sabado: form.primeiro_sabado, ultimo_sabado: form.ultimo_sabado })
  }

  function handleEditar(cfg) {
    setForm({
      trimestre: String(cfg.trimestre),
      primeiro_sabado: cfg.primeiro_sabado,
      ultimo_sabado: cfg.ultimo_sabado
    })
    setEditingId(cfg.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelar() {
    setForm({ trimestre: '', primeiro_sabado: '', ultimo_sabado: '' })
    setEditingId(null)
  }

  return (
    <div className="dimension-crud">
      <div className="card section">
        <div className="card-header">
          <div className="card-title">📅 {editingId ? '✏️ Editar Trimestre' : '📅 Configuração de Trimestres — Sábados'}</div>
          {editingId && (
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={handleCancelar}>
              ✕ Cancelar
            </button>
          )}
        </div>
        <div className="card-body">
          <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>
            Defina o primeiro e o último sábado de cada trimestre. O sistema gerará automaticamente
            todos os sábados do período para rastreamento dos desafios semanais.
          </p>
          <div className="form-grid" style={{ gridTemplateColumns: 'auto 1fr 1fr 1fr auto', alignItems: 'end' }}>
            <div className="form-group">
              <label>Ano</label>
              <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ width: 90 }}>
                {[anoAtual - 1, anoAtual, anoAtual + 1].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Trimestre *</label>
              <select value={form.trimestre} onChange={e => setForm(f => ({ ...f, trimestre: e.target.value }))} disabled={Boolean(editingId)}>
                <option value="">Selecione…</option>
                {[1, 2, 3, 4].map(t => <option key={t} value={t}>{NOMES[t]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>1º Sábado *</label>
              <input type="date" value={form.primeiro_sabado} onChange={e => setForm(f => ({ ...f, primeiro_sabado: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Último Sábado *</label>
              <input type="date" value={form.ultimo_sabado} onChange={e => setForm(f => ({ ...f, ultimo_sabado: e.target.value }))} />
            </div>
            <div className="form-group">
              <label style={{ visibility: 'hidden' }}>–</label>
              <button className="btn btn-primary" onClick={handleSalvar} disabled={upsert.isPending}>
                {upsert.isPending ? <span className="spinner" /> : (editingId ? '💾 Atualizar' : '💾 Salvar')}
              </button>
            </div>
          </div>
          {preview !== null && (
            <div className="status-bar ok" style={{ marginTop: 8 }}>
              {preview} sábados no período · {preview > 0 ? (50 / preview).toFixed(2) : '—'} pts/sáb (ex. desafio de 50 pts)
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Trimestres Configurados — {ano}</div></div>
        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Trimestre</th>
                  <th>1º Sábado</th>
                  <th>Último Sábado</th>
                  <th>Sábados</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map(t => {
                  const cfg = trimestres.find(x => x.trimestre === t)
                  const numSab = cfg ? gerarSabados(cfg.primeiro_sabado, cfg.ultimo_sabado).length : null
                  return (
                    <tr key={t}>
                      <td><strong>{NOMES[t]}</strong></td>
                      <td>{fmtDataBR(cfg?.primeiro_sabado)}</td>
                      <td>{fmtDataBR(cfg?.ultimo_sabado)}</td>
                      <td>{numSab != null ? <span className="chip chip-good">{numSab} sáb.</span> : '—'}</td>
                      <td>
                        {cfg
                          ? <span className="chip chip-good">Configurado</span>
                          : <span className="chip chip-warn">Pendente</span>}
                      </td>
                      <td>
                        {cfg && (
                          <div className="td-actions">
                            <button className="btn-icon" onClick={() => handleEditar(cfg)} title="Editar">✏️</button>
                            <button
                              className="btn-icon danger"
                              onClick={() => confirm(`Remover config do ${NOMES[t]}?`) && del.mutate(cfg.id)}
                              title="Remover"
                            >🗑️</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── COMPONENTE: Catálogo de Desafios ────────────────────────
const CATEGORIAS   = ['admin', 'da', 'estudo', 'midia', 'missao']
const CAT_LABEL    = { admin: 'Administrativo', da: 'Desafio DA', estudo: 'Estudo', midia: 'Mídia', missao: 'Missão' }
const CAT_PREFIX   = { admin: 'ADM', da: 'DA', estudo: 'EST', midia: 'MID', missao: 'MIS' }
const RASTREAMENTOS = ['pontual', 'semanal']
const PERIODICIDADES = ['trimestral', 'mensal', 'anual']

const NOMES_MESES_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function emptyDesafio(tipo = 'G148 Teen') {
  return {
    codigo: '',
    nome: '',
    descricao: '',
    categoria: 'admin',
    rastreamento: 'pontual',
    periodicidade: 'trimestral',
    cadencia: 'semanal',
    pontos_total: '',
    ativo: true,
    mes_ref: '',
    data_ocorrencia: '',
    tipo,
  }
}

function nextCodigoByCategoria(desafios, categoria, editingId = null) {
  const prefix = CAT_PREFIX[categoria] ?? 'DES'
  const regex = new RegExp(`^${prefix}_(\\d+)$`, 'i')
  const maxNum = (desafios ?? [])
    .filter(d => d.id !== editingId)
    .reduce((acc, d) => {
      const m = String(d.codigo ?? '').match(regex)
      if (!m) return acc
      return Math.max(acc, Number(m[1]))
    }, 0)
  return `${prefix}_${String(maxNum + 1).padStart(2, '0')}`
}

function computeOrdemByDate(desafios, dataOcorrencia, editingId = null) {
  if (!dataOcorrencia) return 99

  const all = (desafios ?? [])
    .filter(d => d.id !== editingId)
    .map(d => ({
      id: d.id,
      data_ocorrencia: d.data_ocorrencia || null,
      ordem: Number(d.ordem ?? 99),
    }))

  all.push({ id: '__new__', data_ocorrencia: dataOcorrencia, ordem: 99 })

  all.sort((a, b) => {
    const aDate = a.data_ocorrencia || '9999-12-31'
    const bDate = b.data_ocorrencia || '9999-12-31'
    const cmpDate = aDate.localeCompare(bDate)
    if (cmpDate !== 0) return cmpDate
    return a.ordem - b.ordem
  })

  const idx = all.findIndex(i => i.id === '__new__')
  return idx >= 0 ? idx + 1 : 99
}

function DesafiosCatalogoConfig({ filterMin }) {
  const qc = useQueryClient()
  const showError = useUIStore(s => s.showError)
  const { data: desafios = [], isLoading } = useQuery({
    queryKey: ['desafios_catalogo_all'],
    queryFn: () => db.getDesafiosCatalogoAll(),
  })
  const [form, setForm] = useState(emptyDesafio(filterMin || 'G148 Teen'))
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')

  const codigoSugerido = useMemo(() => {
    if (editingId) return form.codigo
    return nextCodigoByCategoria(desafios, form.categoria)
  }, [desafios, form.categoria, form.codigo, editingId])

  const ordemAutomatica = useMemo(() => {
    return computeOrdemByDate(desafios, form.data_ocorrencia, editingId)
  }, [desafios, form.data_ocorrencia, editingId])

  const upsert = useMutation({
    mutationFn: (payload) => db.upsertDesafioCatalogo(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['desafios_catalogo_all'] })
      qc.invalidateQueries({ queryKey: ['desafios_catalogo'] })
      toast.success(editingId ? 'Desafio atualizado!' : 'Desafio criado!')
      setForm(emptyDesafio(filterMin || 'G148 Teen'))
      setEditingId(null)
    },
    onError: (e) => {
      if (e.message.includes('tipo')) {
        showError(
          'Estrutura do Banco Incompleta',
          'A coluna "tipo" ainda não existe na tabela "desafios_catalogo" no seu banco de dados Supabase.',
          'Execute o SQL: ALTER TABLE desafios_catalogo ADD COLUMN tipo TEXT DEFAULT \'G148 Teen\';'
        )
      } else {
        const { title, message, technicalInfo = null, contactAdmin = false } = parseError(e, 'desafios_catalogo', 'insert')
        showError(title, message, technicalInfo, contactAdmin)
      }
    },
  })

  const del = useMutation({
    mutationFn: (id) => db.deleteDesafioCatalogo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['desafios_catalogo_all'] })
      qc.invalidateQueries({ queryKey: ['desafios_catalogo'] })
      toast.success('Desafio removido.')
    },
    onError: (e) => {
      const { title, message, technicalInfo = null, contactAdmin = false } = parseError(e, 'desafios_catalogo', 'delete')
      showError(title, message, technicalInfo, contactAdmin)
    },
  })

  const toggleAtivo = useMutation({
    mutationFn: ({ id, ...rest }) => db.upsertDesafioCatalogo({ id, ...rest }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['desafios_catalogo_all'] })
      qc.invalidateQueries({ queryKey: ['desafios_catalogo'] })
    },
    onError: (e) => {
      const { title, message, technicalInfo = null, contactAdmin = false } = parseError(e, 'desafios_catalogo', 'update')
      showError(title, message, technicalInfo, contactAdmin)
    },
  })

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleEditar(d) {
    setForm({
      codigo: d.codigo, nome: d.nome, descricao: d.descricao ?? '',
      categoria: d.categoria ?? 'admin', rastreamento: d.rastreamento,
      periodicidade: d.periodicidade, cadencia: d.cadencia || 'semanal',
      pontos_total: String(d.pontos_total),
      ativo: d.ativo, mes_ref: d.mes_ref ? String(d.mes_ref) : '',
      data_ocorrencia: d.data_ocorrencia ?? '',
      tipo: d.tipo || 'G148 Teen'
    })
    setEditingId(d.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSalvar() {
    const codigoFinal = editingId ? form.codigo : codigoSugerido
    if (!codigoFinal || !form.nome || !form.pontos_total) {
      toast.error('Preencha tipo de desafio, nome e pontuação.'); return
    }
    if (form.periodicidade === 'mensal' && !form.mes_ref) {
      toast.error('Para desafio mensal, defina o Mês de referência.'); return
    }
    upsert.mutate({
      id: editingId ?? undefined,
      ...form,
      codigo: codigoFinal,
      ordem: ordemAutomatica,
    })
  }

  function handleCancelar() { setForm(emptyDesafio(filterMin || 'G148 Teen')); setEditingId(null) }

  const filtered = useMemo(() => {
    const searchNorm = search.trim().toLowerCase()

    const base = desafios.filter(d => !filterMin || (d.tipo || 'G148 Teen') === filterMin)

    const found = !searchNorm
      ? base
      : base.filter(d => {
          const cat = CAT_LABEL[d.categoria] ?? d.categoria ?? ''
          const dataBr = fmtDataBR(d.data_ocorrencia)
          const text = [
            d.codigo,
            d.nome,
            d.descricao,
            d.tipo,
            d.periodicidade,
            d.rastreamento,
            cat,
            dataBr,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return text.includes(searchNorm)
        })

    return found.sort((a, b) => {
      const aDate = a.data_ocorrencia || '9999-12-31'
      const bDate = b.data_ocorrencia || '9999-12-31'
      const cmpDate = aDate.localeCompare(bDate)
      if (cmpDate !== 0) return cmpDate
      return Number(a.ordem ?? 99) - Number(b.ordem ?? 99)
    })
  }, [desafios, filterMin, search])

  return (
    <div className="dimension-crud">
      {/* Formulário */}
      <div className="card section">
        <div className="card-header">
          <div className="card-title">{editingId ? '✏️ Editar Desafio' : '➕ Novo Desafio'}</div>
          {editingId && (
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={handleCancelar}>
              ✕ Cancelar
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Tipo de Desafio *</label>
              <select value={form.categoria} onChange={e => setF('categoria', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Código automático</label>
              <input value={codigoSugerido} disabled />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Nome *</label>
              <input value={form.nome} onChange={e => setF('nome', e.target.value)} placeholder="Nome do desafio" />
            </div>
            <div className="form-group">
              <label>Tipo (Ministério)</label>
              <select value={form.tipo} onChange={e => setF('tipo', e.target.value)} disabled={Boolean(filterMin)}>
                <option value="G148 Teen">G148 Teen</option>
                <option value="Soul+">Soul+</option>
              </select>
            </div>
            <div className="form-group">
              <label>Data da ocorrência</label>
              <input type="date" value={form.data_ocorrencia} onChange={e => setF('data_ocorrencia', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Rastreamento</label>
              <select value={form.rastreamento} onChange={e => setF('rastreamento', e.target.value)}>
                {RASTREAMENTOS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {form.rastreamento === 'semanal' && (
              <div className="form-group">
                <label>Cadência esperada</label>
                <select value={form.cadencia} onChange={e => setF('cadencia', e.target.value)}>
                  <option value="semanal">Semanal (1x/semana — ex.: G148 Teen)</option>
                  <option value="mensal">Mensal (1x/mês — ex.: Soul+)</option>
                </select>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                  Define o divisor usado pra calcular os pontos: semanal divide pelo nº de sábados
                  do trimestre, mensal divide pelo nº de meses. Use mensal para desafios cuja
                  frequência real de lançamento é ~1x por mês.
                </div>
              </div>
            )}
            <div className="form-group">
              <label>Periodicidade</label>
              <select value={form.periodicidade} onChange={e => { setF('periodicidade', e.target.value); if (e.target.value !== 'mensal') setF('mes_ref', '') }}>
                {PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {form.periodicidade === 'mensal' && (
              <div className="form-group">
                <label>Mês de referência *</label>
                <select value={form.mes_ref} onChange={e => setF('mes_ref', e.target.value)}>
                  <option value="">Selecione o mês…</option>
                  {NOMES_MESES_FULL.map((nome, i) => (
                    <option key={i + 1} value={i + 1}>{nome} (Trim {Math.ceil((i + 1) / 3)})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Pontos *</label>
              <input type="number" min="0" step="0.01" value={form.pontos_total} onChange={e => setF('pontos_total', e.target.value)} placeholder="200" />
            </div>
            <div className="form-group">
              <label>Posição automática</label>
              <input type="number" value={ordemAutomatica} disabled style={{ width: 80 }} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Descrição</label>
              <input value={form.descricao} onChange={e => setF('descricao', e.target.value)} placeholder="Descrição detalhada do desafio (opcional)" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            {editingId && <button className="btn btn-outline" onClick={handleCancelar}>Cancelar</button>}
            <button className="btn btn-primary" onClick={handleSalvar} disabled={upsert.isPending}>
              {upsert.isPending ? <span className="spinner" /> : (editingId ? '💾 Atualizar' : '➕ Criar Desafio')}
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Catálogo de Desafios ({filtered.length})</div>
        </div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Pesquisar desafio</label>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, nome, tipo, categoria ou data (dd/mm/aaaa)..."
            />
          </div>
        </div>
        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Ocorrência</th>
                  <th>Categoria</th>
                  <th>Rastreamento</th>
                  <th>Periodicidade</th>
                  <th style={{ width: 70, textAlign: 'center' }}>Pts</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Ativo</th>
                  <th style={{ width: 90 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className={!d.ativo ? 'row-inactive' : ''}>
                    <td style={{ textAlign: 'center', fontSize: 11, opacity: 0.5 }}>{d.ordem}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{d.nome}</div>
                      <div style={{ fontSize: 11, opacity: 0.5 }}>{d.codigo}</div>
                    </td>
                    <td>
                      <span className={`chip ${d.tipo === 'Soul+' ? 'chip-warn' : 'chip-teen'}`} style={{ fontSize: 10 }}>
                        {d.tipo || 'G148 Teen'}
                      </span>
                    </td>
                    <td>{fmtDataBR(d.data_ocorrencia)}</td>
                    <td><span className="chip chip-muted">{CAT_LABEL[d.categoria] ?? d.categoria}</span></td>
                    <td>
                      <span className={`chip ${d.rastreamento === 'semanal' ? 'chip-good' : 'chip-warn'}`}>{d.rastreamento}</span>
                      {d.rastreamento === 'semanal' && (
                        <span className="chip chip-muted" style={{ marginLeft: 4, fontSize: 10 }}>{d.cadencia || 'semanal'}</span>
                      )}
                    </td>
                    <td>
                      <span className="chip chip-muted">{d.periodicidade}</span>
                      {d.mes_ref && (
                        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                          {NOMES_MESES_FULL[d.mes_ref - 1]} · Trim {Math.ceil(d.mes_ref / 3)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--c2)' }}>{d.pontos_total}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className={`chip ${d.ativo ? 'chip-good' : 'chip-muted'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => toggleAtivo.mutate({ ...d, ativo: !d.ativo })}
                        title={d.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {d.ativo ? '✓ Ativo' : '✗ Inativo'}
                      </button>
                    </td>
                    <td>
                      <div className="td-actions">
                        <button className="btn-icon" onClick={() => handleEditar(d)} title="Editar">✏️</button>
                        <button
                          className="btn-icon danger"
                          title="Excluir permanentemente"
                          onClick={() => {
                            if (!confirm(`Excluir desafio "${d.nome}"? Esta ação remove também todos os registros!`)) return
                            del.mutate(d.id)
                          }}
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── COMPONENTE: Discípulos Teen — pontos por cartão e por batismo ──
function DiscipulosConfig() {
  const showError = useUIStore(s => s.showError)
  const { isAuditMode } = useAuthStore()
  const qc = useQueryClient()

  const { data: discipulosCfg, isLoading: loadingDisc } = useQuery({
    queryKey: ['discipulos_config'],
    queryFn: () => db.getDiscipulosConfig(),
  })

  const { data: batismosCfg, isLoading: loadingBat } = useQuery({
    queryKey: ['batismos_config'],
    queryFn: () => db.getBatismosConfig(),
  })

  const [pontosCartao, setPontosCartao] = useState('')
  const [pontosBatismo, setPontosBatismo] = useState('')

  useEffect(() => {
    if (discipulosCfg) setPontosCartao(String(discipulosCfg.pontos_por_cartao ?? 0))
  }, [discipulosCfg])

  useEffect(() => {
    if (batismosCfg) setPontosBatismo(String(batismosCfg.pontos_por_batismo ?? 0))
  }, [batismosCfg])

  const upsertDiscipulos = useMutation({
    mutationFn: (payload) => db.upsertDiscipulosConfig(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discipulos_config'] })
      toast.success('Pontos por cartão salvos!')
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  const upsertBatismos = useMutation({
    mutationFn: (payload) => db.upsertBatismosConfig(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batismos_config'] })
      toast.success('Pontos por batismo salvos!')
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  if (loadingDisc || loadingBat) {
    return <div className="empty-state"><div className="spinner" /></div>
  }

  return (
    <div className="dimension-crud">
      {/* Pontos por Cartão de Discipulado */}
      <div className="card section">
        <div className="card-header">
          <div className="card-title">📖 Cartão Discípulo — Pontos por Cartão</div>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 14 }}>
            Pontos totais que cada cartão de discipulado pode gerar para a base. A pontuação é
            dividida em duas etapas: <strong>metade ao ativar</strong> (data de início preenchida) e
            a <strong>outra metade ao encerrar</strong> (data final preenchida). Apenas o
            primeiro cartão de cada membro conta para o ranking.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 320 }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label>Pontos totais por cartão</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pontosCartao}
                onChange={e => setPontosCartao(e.target.value)}
                disabled={!isAuditMode}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => upsertDiscipulos.mutate({ pontos_por_cartao: Number(pontosCartao) })}
              disabled={!isAuditMode || upsertDiscipulos.isPending}
            >
              {upsertDiscipulos.isPending ? <span className="spinner" /> : '💾 Salvar'}
            </button>
          </div>
          {Number(pontosCartao) > 0 && (
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
              ½ ao ativar = <strong>{(Number(pontosCartao) / 2).toFixed(2)} pts</strong> &nbsp;·&nbsp;
              completo = <strong>{Number(pontosCartao).toFixed(2)} pts</strong>
            </p>
          )}
        </div>
      </div>

      {/* Pontos por Batismo */}
      <div className="card section">
        <div className="card-header">
          <div className="card-title">🕊️ Pontos por Batismo</div>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 14 }}>
            Cada batismo registrado na seção Batismos vai gerar esta pontuação para a base.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 320 }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label>Pontos por batismo</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pontosBatismo}
                onChange={e => setPontosBatismo(e.target.value)}
                disabled={!isAuditMode}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => upsertBatismos.mutate({ pontos_por_batismo: Number(pontosBatismo) })}
              disabled={!isAuditMode || upsertBatismos.isPending}
            >
              {upsertBatismos.isPending ? <span className="spinner" /> : '💾 Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── COMPONENTE: Gerenciamento de Dimensões ───────────────────
function DimensionCRUD({ table, pk, field, label, parentField, parentPkField, parentTable, parentLabel }) {
  const showError = useUIStore(s => s.showError)
  const { isAuditMode } = useAuthStore()
  const { data, isLoading, insert, update, remove } = useTable(table)
  const { data: parents } = useTable(parentTable || 'Bases') 
  const [form, setForm] = useState({ [field]: '', [parentField]: '' })
  const [editingId, setEditingId] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form[field] || (parentField && !form[parentField])) return showError('Campos Obrigatórios', `Informe o nome do/a ${label}${parentField ? ` e o/a ${parentLabel}` : ''}.`)
    if (editingId) {
      await update.mutateAsync({ id: editingId, data: form })
      toast.success(`${label} atualizado!`)
      setEditingId(null)
    } else {
      await insert.mutateAsync(form)
      toast.success(`${label} cadastrado!`)
    }
    setForm({ [field]: '', [parentField]: '' })
  }

  return (
    <div className="dimension-crud">
      <div className="card section">
        <div className="card-header"><div className="card-title">{editingId ? `✏️ Editar ${label}` : `➕ Novo ${label}`}</div></div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {parentField && (
                <div className="form-group">
                  <label>{parentLabel} *</label>
                  <select value={form[parentField]} onChange={e => setForm(f => ({ ...f, [parentField]: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {(parents || []).map(p => (
                      <option key={p[parentPkField]} value={p[parentPkField]}>{p[parentLabel] || p.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group"><label>Nome do/a {label} *</label><input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} placeholder={`Ex: ${label} Central`} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button type="submit" className="btn btn-primary" disabled={!isAuditMode}>{editingId ? 'Atualizar' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th>{parentField && <th>{parentLabel}</th>}<th>{label}</th><th>Ações</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={4} className="center">Carregando...</td></tr> : (data || []).map(item => (
                <tr key={item[pk]}>
                  <td><code style={{ fontSize: 11, opacity: 0.6 }}>{item[pk]}</code></td>
                  {parentField && (
                    <td>{parents?.find(p => p[parentPkField] == item[parentField])?.[parentLabel] || item[parentField]}</td>
                  )}
                  <td><strong>{item[field]}</strong></td>
                  <td>
                    <div className="td-actions">
                      <button className="btn-icon" onClick={() => { setForm({[field]: item[field], [parentField]: item[parentField]}); setEditingId(item[pk]) }} disabled={!isAuditMode}>✏️</button>
                      <button className="btn-icon danger" onClick={() => isAuditMode && confirm('Excluir?') && remove.mutateAsync(item[pk])} disabled={!isAuditMode}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DiagnosticoConfig() {
  const showError = useUIStore(s => s.showError)
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState([])

  async function runChecks() {
    setChecking(true)
    const res = []
    try {
      // Check 1: Coluna 'tipo' em desafios_catalogo
      try {
        await db.getDesafiosCatalogo('Soul+')
        res.push({ id: 1, label: 'Coluna "tipo" em desafios_catalogo', status: 'ok', msg: 'Coluna presente e funcional.' })
      } catch (e) {
        if (e.message.includes('column "tipo"')) {
          res.push({ 
            id: 1, label: 'Coluna "tipo" em desafios_catalogo', status: 'err', 
            msg: 'Coluna ausente. Necessário para separar Soul+ de Teen.',
            fix: "ALTER TABLE desafios_catalogo ADD COLUMN tipo TEXT DEFAULT 'G148 Teen';"
          })
        } else {
          res.push({ id: 1, label: 'Coluna "tipo" em desafios_catalogo', status: 'err', msg: 'Erro ao verificar: ' + e.message })
        }
      }

      // Check 2: Tabelas de Notas
      try {
        await db.getAll('Notas_Teen')
        res.push({ id: 2, label: 'Tabela Notas_Teen', status: 'ok', msg: 'Tabela acessível.' })
      } catch (e) {
        res.push({ id: 2, label: 'Tabela Notas_Teen', status: 'err', msg: 'Falha ao acessar: ' + e.message })
      }

      try {
        await db.getAll('Notas_Soul')
        res.push({ id: 3, label: 'Tabela Notas_Soul', status: 'ok', msg: 'Tabela acessível.' })
      } catch (e) {
        res.push({ id: 3, label: 'Tabela Notas_Soul', status: 'err', msg: 'Falha ao acessar: ' + e.message })
      }

    } catch (e) {
      showError('Erro no Diagnóstico', 'Não foi possível concluir a verificação do sistema. Entre em contato com o administrador.', e.message, true)
    } finally {
      setChecking(false)
      setResults(res)
    }
  }

  return (
    <div className="card section">
      <div className="card-header">
        <div className="card-title">🛡️ Diagnóstico do Sistema</div>
        <button className="btn btn-primary" onClick={runChecks} disabled={checking}>
          {checking ? '⏳ Analisando...' : '🔍 Executar Análise'}
        </button>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 20 }}>
          Esta ferramenta verifica a integridade do banco de dados e identifica colunas ou tabelas ausentes que podem causar erros no portal.
        </p>

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {results.map(r => (
              <div key={r.id} className={`status-bar ${r.status}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                  <span>{r.status === 'ok' ? '✅' : '❌'}</span>
                  <span>{r.label}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{r.msg}</div>
                {r.fix && (
                  <div style={{ 
                    marginTop: 8, padding: 12, background: 'rgba(0,0,0,0.2)', 
                    borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                    fontFamily: 'monospace', fontSize: 11
                  }}>
                    <div style={{ marginBottom: 4, fontWeight: 700, color: 'var(--warn)' }}>SQL PARA CORREÇÃO:</div>
                    {r.fix}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!checking && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
            Clique no botão acima para iniciar a verificação.
          </div>
        )}
      </div>
    </div>
  )
}

// ── COMPONENTE: Log de Atividades ────────────────────────────
function ActivityLogPanel() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState({ username: '', action: '' })
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  async function loadLogs() {
    setLoading(true)
    try {
      let q = supabase
        .from('admin_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (filter.username) q = q.ilike('username', `%${filter.username}%`)
      if (filter.action) q = q.eq('action', filter.action)
      const { data, error } = await q
      if (error) throw error
      setLogs(data || [])
    } catch (e) {
      toast.error('Erro ao carregar logs: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLogs() }, [page, filter])

  function fmtDt(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
  }

  const ACTION_LABELS = {
    login: { label: 'Login', color: 'var(--ok)' },
    login_failed: { label: 'Falha Login', color: 'var(--bad)' },
    logout: { label: 'Logout', color: 'var(--text-secondary)' },
    audit_on: { label: 'Auditoria ON', color: 'var(--warn)' },
    audit_off: { label: 'Auditoria OFF', color: 'var(--text-muted)' },
    change_password: { label: 'Senha alterada', color: 'var(--accent)' },
    create: { label: 'Criou', color: 'var(--ok)' },
    update: { label: 'Editou', color: 'var(--warn)' },
    delete: { label: 'Excluiu', color: 'var(--bad)' },
  }

  function actionChip(action) {
    const cfg = ACTION_LABELS[action] || { label: action, color: 'var(--text-secondary)' }
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 20,
        fontSize: 11, fontWeight: 700, background: cfg.color + '22', color: cfg.color,
        border: `1px solid ${cfg.color}44`
      }}>
        {cfg.label}
      </span>
    )
  }

  return (
    <div className="card section">
      <div className="card-header">
        <div className="card-title">📋 Log de Atividades</div>
        <button className="btn btn-outline" onClick={() => { setPage(0); loadLogs() }} disabled={loading}>
          {loading ? '⏳' : '🔄 Atualizar'}
        </button>
      </div>
      <div className="card-body">

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 11 }}>Usuário</label>
            <input
              value={filter.username}
              onChange={e => { setFilter(f => ({ ...f, username: e.target.value })); setPage(0) }}
              placeholder="Filtrar por usuário"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 11 }}>Ação</label>
            <select
              value={filter.action}
              onChange={e => { setFilter(f => ({ ...f, action: e.target.value })); setPage(0) }}
            >
              <option value="">Todas as ações</option>
              <option value="login">Login</option>
              <option value="login_failed">Falha Login</option>
              <option value="logout">Logout</option>
              <option value="audit_on">Auditoria ON</option>
              <option value="audit_off">Auditoria OFF</option>
              <option value="change_password">Senha alterada</option>
              <option value="create">Criou</option>
              <option value="update">Editou</option>
              <option value="delete">Excluiu</option>
            </select>
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', opacity: 0.5 }}>Carregando logs...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', opacity: 0.5 }}>Nenhum log encontrado.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDt(log.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{log.username}</td>
                    <td>{actionChip(log.action)}</td>
                    <td style={{ fontSize: 12, opacity: 0.8 }}>{log.entity || '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button className="btn btn-outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}>
            ← Anterior
          </button>
          <span style={{ alignSelf: 'center', fontSize: 13 }}>Página {page + 1}</span>
          <button className="btn btn-outline" onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE || loading}>
            Próxima →
          </button>
        </div>
      </div>
    </div>
  )
}
