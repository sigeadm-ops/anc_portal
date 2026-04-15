import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import { useIgrejas } from '../hooks/useIgrejas'
import { today, fmtDate, formatCPF, buildBaseLabel, findDuplicateBaseGroups, formatBaseId } from '../utils/helpers'

const EMPTY_HEADER = {
  // UI — controle de cascata e tema
  Tipo: '',
  id_regiao: '',
  id_distritos: '',
  id_igrejas: '',
  // FK que vai para o banco
  id_base: '',
  Status: 'Ativo',
  DataCad: today(),
}

const newRow = () => ({
  _rid: crypto.randomUUID(),
  Membros: '', Nasc: '', Fone: '', Email: '',
  Endereco: '', Responsavel: '', CPF: '', RG: '', Camiseta: '',
})

export default function Membros() {
  const { data, isLoading, insert, update, remove } = useTable('Membros', 'MEMBROS')
  const { data: bases } = useTable('Bases')
  const geo = useIgrejas()

  const [header, setHeader] = useState(EMPTY_HEADER)
  const [staging, setStaging] = useState([newRow()])
  const [search, setSearch] = useState('')
  const [editingMembro, setEditingMembro] = useState(null)
  const [saving, setSaving] = useState(false)

  const setH = (k, v) => setHeader(h => ({ ...h, [k]: v }))

  // ── Tema Soul+ ────────────────────────────────────────────────
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    if (header.Tipo === 'Soul+') {
      main.classList.add('theme-soul')
    } else {
      main.classList.remove('theme-soul')
    }
    return () => main.classList.remove('theme-soul')
  }, [header.Tipo])

  // Cascata por IDs
  const distritosOpts = geo.getDistritos(header.id_regiao)
  const igrejasOpts = geo.getIgrejas(header.id_distritos)
  const duplicateBaseGroups = useMemo(() => findDuplicateBaseGroups(bases, { byTipo: true }), [bases])

  const baseById = useMemo(() => {
    return new Map((bases || []).map((base) => [String(base.id_base), base]))
  }, [bases])

  // Bases filtradas pelo Tipo e pela igreja selecionada
  const basesFiltradas = bases
    .filter(b =>
      (!header.Tipo || b.Tipo === header.Tipo) &&
      (!header.id_igrejas || b.id_igrejas === header.id_igrejas)
    )
    .sort((a, b) => (a.Base || '').localeCompare(b.Base || ''))

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
          Status: header.Status,
          DataCad: header.DataCad,
          Membros: row.Membros.trim(),
          Nasc: row.Nasc || null,
          Fone: row.Fone.trim() || null,
          Email: row.Email.trim() || null,
          Endereco: row.Endereco.trim() || null,
          Responsavel: row.Responsavel.trim() || null,
          CPF: row.CPF.trim() || null,
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
    await remove.mutateAsync(id)
    toast.success('Membro excluído.')
  }

  async function handleUpdate() {
    if (!editingMembro) return
    const { id_membros, id_base, Membros, Nasc, Fone, Email, Endereco, Responsavel, CPF, RG, Camiseta, Status } = editingMembro
    await update.mutateAsync({ id: id_membros, data: { id_base, Membros, Nasc, Fone, Email, Endereco, Responsavel, CPF, RG, Camiseta, Status } })
    toast.success('Membro atualizado!')
    setEditingMembro(null)
  }

  const basesEdicao = useMemo(() => {
    const tipoAtual = String(editingMembro?.Tipo || '').trim()
    const rows = (bases || []).filter((base) => !tipoAtual || base.Tipo === tipoAtual)
    return rows.sort((a, b) => buildBaseLabel(a).localeCompare(buildBaseLabel(b)))
  }, [bases, editingMembro])

  // data vem de vw_membros: nome_base, nome_igreja são texto derivado
  const filtered = data
    .filter(m =>
      !search ||
      [m.Membros, m.Igrejas, m.Base, m.CPF, m.Responsavel, m.Fone]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => (a.Membros || '').localeCompare(b.Membros || ''))

  return (
    <div>
      {/* ── Formulário de cadastro em massa ── */}
      <div className="card section">
        <div className="card-header">
          <div className="card-title">➕ Cadastrar Membros</div>
        </div>

        <div style={{ padding: '20px 20px 0' }}>
          {duplicateBaseGroups.length > 0 && (
            <div className="status-bar warn" style={{ marginBottom: 14 }}>
              ⚠️ Existem {duplicateBaseGroups.length} nome{duplicateBaseGroups.length > 1 ? 's' : ''} de base repetido{duplicateBaseGroups.length > 1 ? 's' : ''} no mesmo tipo. Para evitar mistura, selecione sempre pela opção com igreja + id da base.
            </div>
          )}

          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Tipo *</label>
              <select value={header.Tipo} onChange={e => setH('Tipo', e.target.value)}>
                <option value="">Selecione…</option>
                <option value="G148 Teen">G148 Teen</option>
                <option value="Soul+">Soul+</option>
              </select>
            </div>
            <div className="form-group">
              <label>Região</label>
              <select value={header.id_regiao} onChange={e => { setH('id_regiao', e.target.value); setH('id_distritos', ''); setH('id_igrejas', ''); setH('id_base', '') }}>
                <option value="">Selecione…</option>
                {geo.regioes.map(r => <option key={r.id_regiao} value={r.id_regiao}>{r.Regiao}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Distrito</label>
              <select value={header.id_distritos} onChange={e => { setH('id_distritos', e.target.value); setH('id_igrejas', ''); setH('id_base', '') }} disabled={!header.id_regiao}>
                <option value="">Selecione…</option>
                {distritosOpts.map(d => <option key={d.id_distritos} value={d.id_distritos}>{d.Distritos}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Igreja *</label>
              <select value={header.id_igrejas} onChange={e => { setH('id_igrejas', e.target.value); setH('id_base', '') }} disabled={!header.id_distritos}>
                <option value="">Selecione…</option>
                {igrejasOpts.map(i => <option key={i.id_igrejas} value={i.id_igrejas}>{i.Igrejas}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Base *</label>
              <select value={header.id_base} onChange={e => setH('id_base', e.target.value)}>
                <option value="">Selecione…</option>
                {basesFiltradas.map(b => <option key={b.id_base} value={b.id_base}>{buildBaseLabel(b, { includeTipo: true })}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={header.Status} onChange={e => setH('Status', e.target.value)}>
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </div>
            <div className="form-group">
              <label>Data de Cadastro</label>
              <input type="date" value={header.DataCad} onChange={e => setH('DataCad', e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
              {staging.length} membro{staging.length !== 1 ? 's' : ''} na fila · {validRows.length} válido{validRows.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => addRows(1)}>+ 1 linha</button>
              <button className="btn btn-outline btn-sm" onClick={() => addRows(5)}>+ 5 linhas</button>
            </div>
          </div>
        </div>

        <div className="table-wrap staging-table" style={{ marginBottom: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ minWidth: 180 }}>Nome *</th>
                <th style={{ minWidth: 130 }}>Nascimento</th>
                <th style={{ minWidth: 140 }}>Telefone</th>
                <th style={{ minWidth: 120 }}>CPF</th>
                <th style={{ minWidth: 80 }}>Camiseta</th>
                <th style={{ minWidth: 160 }}>Responsável</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staging.map((row, i) => (
                <tr key={row._rid}>
                  <td><span className="row-num">{String(i + 1).padStart(2, '0')}</span></td>
                  <td><input value={row.Membros} onChange={e => updateRow(row._rid, 'Membros', e.target.value)} placeholder="Nome completo" style={{ minWidth: 170 }} /></td>
                  <td><input type="date" value={row.Nasc} onChange={e => updateRow(row._rid, 'Nasc', e.target.value)} /></td>
                  <td><input value={row.Fone} onChange={e => updateRow(row._rid, 'Fone', e.target.value)} placeholder="(00) 00000-0000" /></td>
                  <td><input value={row.CPF} onChange={e => updateRow(row._rid, 'CPF', formatCPF(e.target.value))} placeholder="000.000.000-00" /></td>
                  <td>
                    <select value={row.Camiseta} onChange={e => updateRow(row._rid, 'Camiseta', e.target.value)}>
                      <option value="">—</option>
                      {['P', 'M', 'G', 'GG', 'XG'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><input value={row.Responsavel} onChange={e => updateRow(row._rid, 'Responsavel', e.target.value)} placeholder="Responsável" /></td>
                  <td><button className="btn-icon danger" onClick={() => removeRow(row._rid)}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px' }}>
          <button className="btn btn-outline" onClick={() => { setStaging([newRow()]); setHeader(EMPTY_HEADER) }}>Limpar tudo</button>
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Base</th>
                  <th>Igreja</th>
                  <th>Nascimento</th>
                  <th>CPF</th>
                  <th>Fone</th>
                  <th>Responsável</th>
                  <th>Status</th>
                  <th>Ações</th>
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
                    <td>{fmtDate(m.Nasc)}</td>
                    <td>{m.CPF || '—'}</td>
                    <td>{m.Fone || '—'}</td>
                    <td>{m.Responsavel || '—'}</td>
                    <td><span className={`chip ${m.Status === 'Ativo' ? 'chip-good' : 'chip-muted'}`}>{m.Status}</span></td>
                    <td>
                      <div className="td-actions">
                        <button className="btn-icon" onClick={() => setEditingMembro({ ...m })}>✏️</button>
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
                  ['Membros', 'Nome *', 'text'], ['Nasc', 'Nascimento', 'date'],
                  ['Fone', 'Telefone', 'tel'], ['Email', 'E-mail', 'email'],
                  ['Endereco', 'Endereço', 'text'], ['Responsavel', 'Responsável', 'text'],
                  ['RG', 'RG', 'text'],
                ].map(([k, lbl, type]) => (
                  <div key={k} className="form-group">
                    <label>{lbl}</label>
                    <input type={type} value={editingMembro[k] || ''} onChange={e => setEditingMembro(m => ({ ...m, [k]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group">
                  <label>CPF</label>
                  <input value={editingMembro.CPF || ''} onChange={e => setEditingMembro(m => ({ ...m, CPF: formatCPF(e.target.value) }))} />
                </div>
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
