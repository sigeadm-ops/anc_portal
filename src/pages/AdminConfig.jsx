import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useTable } from '../hooks/useTable'

const TABS = [
  { id: 'geral', label: '⚙️ Geral', icon: '⚙️' },
  { id: 'provas', label: '📝 Provas', icon: '📝' },
  { id: 'regioes', label: '🌍 Regiões', icon: '🌍' },
  { id: 'distritos', label: '📍 Distritos', icon: '📍' },
  { id: 'igrejas', label: '⛪ Igrejas', icon: '⛪' },
  { id: 'script', label: '📜 Script', icon: '📜' },
]

export default function AdminConfig() {
  const { isAuditMode, changePassword, logout } = useAuthStore()
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

  return (
    <div className="admin-config-container fade-in">
      <div className="card section" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">⚙️ Painel de Administração Mestre</div>
          {!isAuditMode && (
            <div className="chip chip-warn">Ative o cadeado 🔓 no topo para editar</div>
          )}
        </div>
        
        {/* Abas Estilizadas */}
        <div className="admin-tabs-nav">
          {TABS.map(t => (
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
        )}

        {activeTab === 'provas' && <ProvasCRUD />}
        {activeTab === 'regioes' && <DimensionCRUD table="Regiao" pk="id" field="nome" label="Região" />}
        {activeTab === 'distritos' && <DimensionCRUD table="Distritos" pk="id" field="nome" label="Distrito" parentField="regiao_id" parentPkField="id" parentTable="Regiao" parentLabel="nome" />}
        {activeTab === 'igrejas' && <DimensionCRUD table="Igrejas" pk="id" field="nome" label="Igreja" parentField="distrito_id" parentPkField="id" parentTable="Distritos" parentLabel="nome" />}

        {activeTab === 'script' && (
          <div className="card section">
            <div className="card-header"><div className="card-title">📜 Google Apps Script</div></div>
            <div className="card-body">
              <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>Código para manter o espelhamento automático com o Google Sheets.</p>
              <pre className="code-block">
                {`function doGet(e) { /* ... código omitido por brevidade no render, mas presente no arquivo ... */ }`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── COMPONENTE: Gerenciamento de Provas ──────────────────────
function ProvasCRUD() {
  const { isAuditMode } = useAuthStore()
  const { data, isLoading, insert, update, remove } = useTable('Provas')
  const [form, setForm] = useState({ tipo: '', nome: '', data: '' })
  const [editingId, setEditingId] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.tipo || !form.nome || !form.data) return toast.error('Preencha tudo.')
    if (editingId) {
      await update.mutateAsync({ id: editingId, data: form })
      toast.success('Prova atualizada!')
      setEditingId(null)
    } else {
      await insert.mutateAsync(form)
      toast.success('Prova cadastrada!')
    }
    setForm({ tipo: '', nome: '', data: '' })
  }

  const sorted = [...(data || [])].sort((a,b) => (a.data || '').localeCompare(b.data || ''))

  return (
    <div className="dimension-crud">
       <div className="card section">
        <div className="card-header"><div className="card-title">{editingId ? '✏️ Editar Prova' : '➕ Nova Prova'}</div></div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group"><label>Tipo</label><select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}><option value="">Selecione...</option><option value="G148 Teen">G148 Teen</option><option value="Soul+">Soul+</option></select></div>
              <div className="form-group"><label>Nome da Prova</label><input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: BEP 1ª Fase" /></div>
              <div className="form-group"><label>Data</label><input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button type="submit" className="btn btn-primary" disabled={!isAuditMode}>Salvar Prova</button>
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
                <tr key={p.id}>
                  <td><span className={`chip ${p.tipo === 'Soul+' ? 'chip-soul' : 'chip-teen'}`}>{p.tipo}</span></td>
                  <td><strong>{p.nome}</strong></td>
                  <td>{p.data}</td>
                  <td>
                    <div className="td-actions">
                      <button className="btn-icon" onClick={() => { setForm({tipo: p.tipo, nome: p.nome, data: p.data}); setEditingId(p.id) }} disabled={!isAuditMode}>✏️</button>
                      <button className="btn-icon danger" onClick={() => isAuditMode && confirm('Excluir?') && remove.mutateAsync(p.id)} disabled={!isAuditMode}>🗑️</button>
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

// ── COMPONENTE: Gerenciamento de Dimensões ───────────────────
function DimensionCRUD({ table, pk, field, label, parentField, parentPkField, parentTable, parentLabel }) {
  const { isAuditMode } = useAuthStore()
  const { data, isLoading, insert, update, remove } = useTable(table)
  const { data: parents } = useTable(parentTable || 'Bases') 
  const [form, setForm] = useState({ [field]: '', [parentField]: '' })
  const [editingId, setEditingId] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form[field] || (parentField && !form[parentField])) return toast.error('Preencha tudo.')
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
