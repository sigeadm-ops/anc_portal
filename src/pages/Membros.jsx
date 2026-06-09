import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import { today, fmtDate, toInputDate, buildBaseLabel, findDuplicateBaseGroups, formatBaseId } from '../utils/helpers'

const EMPTY_HEADER = {
  // UI — controle de cascata e tema
  Tipo: '',
  id_regiao: '',
  id_distritos: '',
  id_igrejas: '',
  // FK que vai para o banco
  id_base: '',
  Status: 'Ativo',
}

const newRow = () => ({
  _rid: crypto.randomUUID(),
  Membros: '', Responsavel: '', Email: '',
  Endereco: '', RG: '', Camiseta: '',
})

export default function Membros() {
  const { type } = useParams()
  const currentTipo = type === 'soul' ? 'Soul+' : 'G148 Teen'

  const { data, isLoading, insert, update, remove } = useTable('Membros', 'MEMBROS')
  const { data: bases } = useTable('Bases')

  const [header, setHeader] = useState({ ...EMPTY_HEADER, Tipo: currentTipo })
  const [staging, setStaging] = useState([newRow()])
  const [search, setSearch] = useState('')
  const [editingMembro, setEditingMembro] = useState(null)
  const [saving, setSaving] = useState(false)

  // Atualiza o tipo no cabeçalho se o parâmetro da URL mudar
  useEffect(() => {
    setHeader(h => ({ ...h, Tipo: currentTipo }))
  }, [currentTipo])

  const setH = (k, v) => setHeader(h => ({ ...h, [k]: v }))

  const duplicateBaseGroups = useMemo(() => findDuplicateBaseGroups(bases, { byTipo: true }), [bases])

  const baseById = useMemo(() => {
    return new Map((bases || []).map((base) => [String(base.id_base), base]))
  }, [bases])

  // Bases filtradas apenas pelo tipo da URL (sem cascata manual)
  const basesFiltradas = (bases || [])
    .filter(b => b.Tipo === currentTipo)
    .sort((a, b) => (a.Base || '').localeCompare(b.Base || ''))

  // Ao selecionar uma base, preenche geo automaticamente
  function handleSelectBase(id_base) {
    const base = (bases || []).find(b => String(b.id_base) === String(id_base))
    if (base) {
      setHeader(h => ({
        ...h,
        id_base,
        id_regiao: base.id_regiao || '',
        id_distritos: base.id_distritos || '',
        id_igrejas: base.id_igrejas || '',
      }))
    } else {
      setHeader(h => ({ ...h, id_base: '', id_regiao: '', id_distritos: '', id_igrejas: '' }))
    }
  }

  function addRows(n = 1) {
    setStaging(s => [...s, ...Array.from({ length: n }, newRow)])
  }
  function removeRow(rid) {
    setStaging(s => s.filter(r => r._rid !== rid))
  }
  function updateRow(rid, k, v) {
    setStaging(s => s.map(r => r._rid === rid ? { ...r, [k]: v } : r))
  }

  const validRows = staging.filter(r => r.Membros.trim().length > 0)
  const headerOk = !!header.id_base

  async function handleSaveAll() {
    if (!headerOk) { toast.error('Selecione a Base.'); return }
    if (!validRows.length) { toast.error('Preencha o nome de ao menos 1 membro.'); return }
    setSaving(true)
    let saved = 0
    for (const row of validRows) {
      try {
        await insert.mutateAsync({
          id_base: header.id_base,
          Status: 'Ativo',
          DataCad: today(),
          Membros: row.Membros.trim(),
          Responsavel: row.Responsavel.trim() || null,
          Email: row.Email.trim() || null,
          Endereco: row.Endereco.trim() || null,
          RG: row.RG.trim() || null,
          Camiseta: row.Camiseta || null,
          Tipo: header.Tipo,
        })
        saved++
      } catch { /* toast já exibido pelo hook */ }
    }
    setSaving(false)
    if (saved > 0) {
      toast.success(`${saved} membro${saved !== 1 ? 's' : ''} cadastrado${saved !== 1 ? 's' : ''}!`)
      setStaging([newRow()])
    }
  }

  async function handleDelete(id, nome) {
    if (!confirm(`Excluir membro "${nome}"?`)) return
    try {
      await remove.mutateAsync(id)
      toast.success('Membro excluído.')
    } catch {
      // erro tratado pelo onError do useTable (modal global)
    }
  }

  async function handleUpdate() {
    if (!editingMembro) return
    const { id_membros, id_base, Membros, Responsavel, Email, Endereco, RG, Camiseta, Status, DataCad, _originalStatus } = editingMembro
    const statusMudou = (Status || 'Ativo') !== (_originalStatus || 'Ativo')
    // Sempre salva em ISO (yyyy-mm-dd) para consistência no banco
    const dataCadFinal = statusMudou ? today() : (toInputDate(DataCad) || today())
    await update.mutateAsync({ id: id_membros, data: { id_base, Membros, Responsavel, Email, Endereco, RG, Camiseta, Status, DataCad: dataCadFinal } })
    toast.success('Membro atualizado!')
    setEditingMembro(null)
  }

  const basesEdicao = useMemo(() => {
    const tipoAtual = String(editingMembro?.Tipo || '').trim()
    const rows = (bases || []).filter((base) => !tipoAtual || base.Tipo === tipoAtual)
    return rows.sort((a, b) => buildBaseLabel(a).localeCompare(buildBaseLabel(b)))
  }, [bases, editingMembro])

  // data vem de vw_membros: nome_base, nome_igreja são texto derivado
  const filtered = (data || [])
    .filter(m => {
      // Filtrar pelo tipo da base do membro (flexível)
      const baseMembro = baseById.get(String(m.id_base))
      if (baseMembro) {
        const bTipo = (baseMembro.Tipo || '').toLowerCase()
        const cTipo = currentTipo.toLowerCase()
        const matches = cTipo.includes('teen') ? (bTipo.includes('teen') || !bTipo) : bTipo.includes('soul')
        if (!matches) return false
      }
      
      return !search ||
      [m.Membros, m.Igrejas, m.Base]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase())
    })
    .sort((a, b) => (a.Membros || '').localeCompare(b.Membros || ''))

  return (
    <div>
      {/* ── Formulário de cadastro em massa ── */}
      <div className="card section">
        <div className="card-header">
          <div className="card-title">
            ➕ Cadastrar Membros
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 10px',
              borderRadius: 20, background: type === 'soul' ? 'var(--soul-amber)' : 'rgba(124,58,237,.12)',
              color: type === 'soul' ? 'var(--soul-brown)' : 'var(--c1)',
              border: `1px solid ${type === 'soul' ? 'var(--soul-brown)44' : 'var(--c1)44'}`
            }}>
              {currentTipo}
            </span>
          </div>
        </div>

        <div style={{ padding: '20px 20px 0' }}>
          {duplicateBaseGroups.length > 0 && (
            <div className="status-bar warn" style={{ marginBottom: 14 }}>
              ⚠️ Existem {duplicateBaseGroups.length} nome{duplicateBaseGroups.length > 1 ? 's' : ''} de base repetido{duplicateBaseGroups.length > 1 ? 's' : ''} no mesmo tipo. Para evitar mistura, selecione sempre pela opção com igreja + id da base.
            </div>
          )}

          <div className="form-grid" style={{ gridTemplateColumns: '1fr', marginBottom: 16 }}>
            <div className="form-group" style={{ maxWidth: 500 }}>
              <label>Base *</label>
              <select
                value={header.id_base}
                onChange={e => handleSelectBase(e.target.value)}
              >
                <option value="">Selecione a base…</option>
                {basesFiltradas.map(b => {
                  const label = [b.Base, b.Igreja_Nome || b.Igrejas].filter(Boolean).join(' — ')
                  return <option key={b.id_base} value={b.id_base}>{label}</option>
                })}
              </select>
            </div>

            {/* Info chips da base selecionada */}
            {header.id_base && (() => {
              const base = basesFiltradas.find(b => String(b.id_base) === String(header.id_base))
              if (!base) return null
              return (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -8 }}>
                  {[base.Regiao_Nome || base.Regiao, base.Distrito_Nome || base.Distritos, base.Igreja_Nome || base.Igrejas]
                    .filter(Boolean)
                    .map((info, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 20,
                        background: 'var(--bg-alt)', border: '1px solid var(--border)',
                        color: 'var(--text-secondary)'
                      }}>{info}</span>
                    ))}
                </div>
              )
            })()}
          </div>

          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: type === 'soul' ? 'var(--soul-brown)' : 'var(--muted)' }}>
              {staging.length} membro{staging.length !== 1 ? 's' : ''} na fila · {validRows.length} válido{validRows.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => addRows(1)}>+ 1 linha</button>
              <button className="btn btn-outline btn-sm" onClick={() => addRows(5)}>+ 5 linhas</button>
            </div>
          </div>
        </div>

        <div className="table-wrap staging-table" style={{ marginBottom: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ minWidth: 200 }}>Nome Completo *</th>
                <th style={{ minWidth: 220 }}>Responsavel - Nome Completo *</th>
                <th style={{ width: 90 }}>Camiseta</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {staging.map((row, i) => (
                <tr key={row._rid}>
                  <td><span className="row-num">{String(i + 1).padStart(2, '0')}</span></td>
                  <td><input value={row.Membros} onChange={e => updateRow(row._rid, 'Membros', e.target.value)} placeholder="Nome completo" style={{ minWidth: 170 }} /></td>
                  <td><input value={row.Responsavel} onChange={e => updateRow(row._rid, 'Responsavel', e.target.value)} placeholder="Nome completo do responsável" style={{ minWidth: 190 }} /></td>
                  <td>
                    <select value={row.Camiseta} onChange={e => updateRow(row._rid, 'Camiseta', e.target.value)}>
                      <option value="">—</option>
                      {['P', 'M', 'G', 'GG', 'XG'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><button className="btn-icon danger" onClick={() => removeRow(row._rid)}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px' }}>
          <button className="btn btn-outline" onClick={() => { setStaging([newRow()]); setHeader({ ...EMPTY_HEADER, Tipo: currentTipo }) }}>Limpar tudo</button>
          <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving || !headerOk || !validRows.length}>
            {saving
              ? <><span className="spinner" /> Salvando…</>
              : `💾 Salvar ${validRows.length} membro${validRows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* ── Lista ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            👥 Membros Cadastrados
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>
              {filtered.length} de {data.length}
            </span>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar..." style={{ width: 220 }} />
        </div>

        {isLoading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>{search ? 'Nenhum resultado.' : 'Nenhum membro cadastrado ainda.'}</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ minWidth: 840 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Nome</th>
                  <th style={{ minWidth: 160 }}>Base</th>
                  <th style={{ minWidth: 130 }}>Igreja</th>
                  <th style={{ width: 110 }}>Data Cad.</th>
                  <th style={{ width: 90 }}>Status</th>
                  <th style={{ width: 80 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id_membros}>
                    <td><strong>{m.Membros}</strong></td>
                    <td>
                      {baseById.has(String(m.id_base))
                        ? buildBaseLabel(baseById.get(String(m.id_base)), { includeId: true })
                        : `${m.Base || '—'} · ${formatBaseId(m.id_base)}`}
                    </td>
                    <td>
                      <span className="chip chip-muted">
                        {m.Igrejas || baseById.get(String(m.id_base))?.Igreja_Nome || '—'}
                      </span>
                    </td>
                    <td>{fmtDate(m.DataCad)}</td>
                    <td><span className={`chip ${m.Status === 'Ativo' ? 'chip-good' : 'chip-muted'}`}>{m.Status}</span></td>
                    <td>
                      <div className="td-actions">
                        <button className="btn-icon" onClick={() => setEditingMembro({ ...m, _originalStatus: m.Status || 'Ativo' })}>✏️</button>
                        <button className="btn-icon danger" onClick={() => handleDelete(m.id_membros, m.Membros)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de edição ── */}
      {editingMembro && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditingMembro(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">✏️ Editar Membro</div>
              <button className="btn-icon" onClick={() => setEditingMembro(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                {[
                  ['Membros', 'Nome Completo *', 'text'],
                  ['Responsavel', 'Responsavel - Nome Completo *', 'text'],
                  ['Email', 'E-mail', 'email'],
                  ['Endereco', 'Endereço', 'text'],
                  ['RG', 'RG', 'text'],
                ].map(([k, lbl, type]) => (
                  <div key={k} className="form-group">
                    <label>{lbl}</label>
                    <input type={type} value={editingMembro[k] || ''} onChange={e => setEditingMembro(m => ({ ...m, [k]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group">
                  <label>Camiseta</label>
                  <select value={editingMembro.Camiseta || ''} onChange={e => setEditingMembro(m => ({ ...m, Camiseta: e.target.value }))}>
                    <option value="">—</option>
                    {['P', 'M', 'G', 'GG', 'XG'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Base (igreja + id)</label>
                  <select value={editingMembro.id_base || ''} onChange={e => setEditingMembro(m => ({ ...m, id_base: e.target.value }))}>
                    <option value="">Selecione…</option>
                    {basesEdicao.map(base => (
                      <option key={base.id_base} value={base.id_base}>
                        {buildBaseLabel(base, { includeTipo: true })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={editingMembro.Status || 'Ativo'} onChange={e => setEditingMembro(m => ({ ...m, Status: e.target.value }))}>
                    <option>Ativo</option><option>Inativo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Data de Status (automática)</label>
                  <input type="date" value={toInputDate(editingMembro.DataCad)} readOnly disabled />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingMembro(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleUpdate} disabled={update.isPending}>
                {update.isPending ? <span className="spinner" /> : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
