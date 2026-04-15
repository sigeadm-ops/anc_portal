import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import { useIgrejas } from '../hooks/useIgrejas'
import { today, buildBaseLabel, findDuplicateBaseGroups, formatBaseId, normalizeBaseName } from '../utils/helpers'

const EMPTY = {
  Tipo: '', Base: '',
  id_regiao: '', id_distritos: '', id_igrejas: '',
  Coord: '', Coord_Fone: '', Coord_Email: '',
  Prof: '', Prof_Fone: '', Prof_Email: '',
  Midia: '', Midia_Fone: '', Midia_Email: '',
  Data_Cad: today(), Status: 'Ativo',
}

export default function Bases() {
  const { data, isLoading, insert, update, remove } = useTable('Bases', 'BASES')
  const geo = useIgrejas()

  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Tema Soul+ aplicado dinamicamente no #main ─────────────────
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    if (form.Tipo === 'Soul+') {
      main.classList.add('theme-soul')
    } else {
      main.classList.remove('theme-soul')
    }
    return () => main.classList.remove('theme-soul')
  }, [form.Tipo])

  // Cascata por IDs
  const distritosOpts = geo.getDistritos(form.id_regiao)
  const igrejasOpts = geo.getIgrejas(form.id_distritos)
  const duplicateBaseGroups = useMemo(() => findDuplicateBaseGroups(data, { byTipo: true }), [data])

  const duplicateLookup = useMemo(() => {
    const map = new Set()
    for (const group of duplicateBaseGroups) {
      map.add(group.key)
    }
    return map
  }, [duplicateBaseGroups])

  const isCurrentNameDuplicated = useMemo(() => {
    const key = `${String(form.Tipo || '').trim()}::${normalizeBaseName(form.Base)}`
    if (!key) return false
    return (data || []).some((base) => {
      if (editingId && base.id_base === editingId) return false
      return `${String(base.Tipo || '').trim()}::${normalizeBaseName(base.Base)}` === key
    })
  }, [data, form.Tipo, form.Base, editingId])

  function handleRegiaoChange(v) {
    set('id_regiao', v); set('id_distritos', ''); set('id_igrejas', '')
  }
  function handleDistritoChange(v) {
    set('id_distritos', v); set('id_igrejas', '')
  }

  function startEdit(base) {
    setForm({ ...EMPTY, ...base })
    setEditingId(base.id_base)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setForm(EMPTY)
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.Tipo || !form.Base || !form.id_regiao || !form.id_distritos || !form.id_igrejas) {
      toast.error('Preencha: Tipo, Nome, Região, Distrito e Igreja.')
      return
    }
    if (isCurrentNameDuplicated) {
      toast('Atenção: já existe outra base com esse mesmo nome. Confira igreja e ID antes de salvar.', {
        icon: '⚠️',
      })
    }
    const payload = {
      Tipo: form.Tipo,
      Base: form.Base,
      id_igrejas: form.id_igrejas,
      Coord: form.Coord,
      Coord_Fone: form.Coord_Fone,
      Coord_Email: form.Coord_Email,
      Prof: form.Prof,
      Prof_Fone: form.Prof_Fone,
      Prof_Email: form.Prof_Email,
      Midia: form.Midia,
      Midia_Fone: form.Midia_Fone,
      Midia_Email: form.Midia_Email,
      Data_Cad: form.Data_Cad,
      Status: form.Status,
    }
    if (editingId) {
      await update.mutateAsync({ id: editingId, data: payload })
      toast.success('Base atualizada!')
      cancelEdit()
    } else {
      await insert.mutateAsync(payload)
      toast.success('Base cadastrada!')
      setForm(EMPTY)
    }
  }

  async function handleDelete(id, nome) {
    if (!confirm(`Excluir base "${nome}"?`)) return
    await remove.mutateAsync(id)
    toast.success('Base excluída.')
    if (editingId === id) cancelEdit()
  }

  const filtered = data
    .filter(b =>
      (!tipoFiltro || b.Tipo === tipoFiltro) &&
      (!search ||
        [b.Base, b.Igreja_Nome, b.Igrejas, b.Distrito_Nome, b.Distritos, b.Regiao_Nome, b.Regiao, b.Coord]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()))
    )
    .sort((a, b) => (a.Base || '').localeCompare(b.Base || ''))

  const inconsistentGeoBases = useMemo(() => {
    return (data || []).filter(b => !b.id_regiao || !b.id_distritos || !b.id_igrejas)
  }, [data])

  const inconsistentGeoCount = inconsistentGeoBases.length

  return (
    <div>
      {/* ── Formulário ── */}
      <div
        className="card section"
        style={editingId ? { borderColor: 'var(--c2)', borderWidth: 2 } : {}}
      >
        <div className="card-header">
          <div className="card-title">
            {editingId ? '✏️ Editando Base' : '➕ Nova Base'}
            {editingId && (
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>
                {editingId}
              </span>
            )}
          </div>
          {editingId && (
            <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>
              Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {duplicateBaseGroups.length > 0 && (
            <div className="status-bar warn" style={{ marginBottom: 14 }}>
              ⚠️ Foram encontrados {duplicateBaseGroups.length} nome{duplicateBaseGroups.length > 1 ? 's' : ''} de base repetido{duplicateBaseGroups.length > 1 ? 's' : ''} no mesmo tipo.<br />
              {duplicateBaseGroups.slice(0, 3).map((group) => `${group.tipo}: ${group.nome} (${group.total}x)`).join(' · ')}
              {duplicateBaseGroups.length > 3 ? ' · ...' : ''}
            </div>
          )}

          {inconsistentGeoCount > 0 && (
            <div className="status-bar err" style={{ marginBottom: 14 }}>
              🚨 Existem {inconsistentGeoCount} base{inconsistentGeoCount > 1 ? 's' : ''} sem vínculo completo de região/distrito/igreja. Isso indica registro legado inconsistente e precisa correção.
              <br />
              {inconsistentGeoBases.slice(0, 5).map((b) => buildBaseLabel(b, { includeTipo: true })).join(' · ')}
              {inconsistentGeoCount > 5 ? ' · ...' : ''}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>Tipo *</label>
              <select value={form.Tipo} onChange={e => set('Tipo', e.target.value)} required>
                <option value="">Selecione…</option>
                <option value="G148 Teen">G148 Teen</option>
                <option value="Soul+">Soul+</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nome da Base *</label>
              <input
                value={form.Base}
                onChange={e => set('Base', e.target.value)}
                placeholder="Ex: Base Águias"
                required
              />
              {isCurrentNameDuplicated && (
                <small style={{ color: 'var(--warn)', fontWeight: 600 }}>
                  Nome repetido detectado no mesmo tipo. Diferencie sempre por igreja e {formatBaseId(editingId || 'novo-id')}.
                </small>
              )}
            </div>
            <div className="form-group">
              <label>Região</label>
              <select value={form.id_regiao} onChange={e => handleRegiaoChange(e.target.value)}>
                <option value="">Selecione…</option>
                {geo.regioes.map(r => <option key={r.id_regiao} value={r.id_regiao}>{r.Regiao}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Distrito *</label>
              <select
                value={form.id_distritos}
                onChange={e => handleDistritoChange(e.target.value)}
                disabled={!form.id_regiao}
                required
              >
                <option value="">Selecione…</option>
                {distritosOpts.map(d => <option key={d.id_distritos} value={d.id_distritos}>{d.Distritos}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Igreja / Congregação *</label>
              <select
                value={form.id_igrejas}
                onChange={e => set('id_igrejas', e.target.value)}
                disabled={!form.id_distritos}
                required
              >
                <option value="">Selecione…</option>
                {igrejasOpts.map(i => <option key={i.id_igrejas} value={i.id_igrejas}>{i.Igrejas}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.Status} onChange={e => set('Status', e.target.value)}>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
            <div className="form-group">
              <label>Data de Cadastro</label>
              <input
                type="date"
                value={form.Data_Cad}
                onChange={e => set('Data_Cad', e.target.value)}
              />
            </div>
          </div>

          <hr className="divider" />
          <div className="section-label">Responsáveis</div>

          <div className="form-grid">
            <div className="form-group">
              <label>Coordenador</label>
              <input value={form.Coord} onChange={e => set('Coord', e.target.value)} placeholder="Nome" />
            </div>
            <div className="form-group">
              <label>Fone Coord.</label>
              <input value={form.Coord_Fone} onChange={e => set('Coord_Fone', e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="form-group">
              <label>E-mail Coord.</label>
              <input type="email" value={form.Coord_Email} onChange={e => set('Coord_Email', e.target.value)} placeholder="email@..." />
            </div>
            <div className="form-group">
              <label>Professor</label>
              <input value={form.Prof} onChange={e => set('Prof', e.target.value)} placeholder="Nome" />
            </div>
            <div className="form-group">
              <label>Fone Prof.</label>
              <input value={form.Prof_Fone} onChange={e => set('Prof_Fone', e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="form-group">
              <label>E-mail Prof.</label>
              <input type="email" value={form.Prof_Email} onChange={e => set('Prof_Email', e.target.value)} placeholder="email@..." />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setForm(EMPTY); setEditingId(null) }}
            >
              Limpar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={insert.isPending || update.isPending}
            >
              {(insert.isPending || update.isPending)
                ? <span className="spinner" />
                : (editingId ? 'Atualizar Base' : 'Salvar Base')}
            </button>
          </div>
        </form>
      </div>

      {/* ── Lista ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            ⛪ Bases Cadastradas
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>
              {filtered.length} de {data.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} style={{ width: 140 }}>
              <option value="">Todos os tipos</option>
              <option value="G148 Teen">G148 Teen</option>
              <option value="Soul+">Soul+</option>
            </select>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar base..."
              style={{ width: 220 }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⛪</div>
            <p>{search ? 'Nenhuma base encontrada.' : 'Nenhuma base cadastrada ainda.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Base</th>
                  <th>Distrito</th>
                  <th>Igreja</th>
                  <th>Coord.</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id_base}>
                    <td>
                      <span className={`chip ${b.Tipo === 'G148 Teen' ? 'chip-teen' : 'chip-soul'}`}>
                        {b.Tipo}
                      </span>
                    </td>
                    <td>
                      <strong>{b.Base}</strong>
                      {duplicateLookup.has(`${String(b.Tipo || '').trim()}::${normalizeBaseName(b.Base)}`) && (
                        <span className="chip chip-warn" style={{ marginLeft: 8 }}>Nome repetido</span>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                        {buildBaseLabel(b, { includeId: true, includeTipo: false })}
                      </div>
                    </td>
                    <td>{b.Distrito_Nome || b.Distritos || '—'}</td>
                    <td>{b.Igreja_Nome || b.Igrejas || '—'}</td>
                    <td>{b.Coord || '—'}</td>
                    <td>
                      <span className={`chip ${b.Status === 'Ativo' ? 'chip-good' : 'chip-muted'}`}>
                        {b.Status}
                      </span>
                    </td>
                    <td>
                      <div className="td-actions">
                        <button className="btn-icon" onClick={() => startEdit(b)} title="Editar">✏️</button>
                        <button className="btn-icon danger" onClick={() => handleDelete(b.id_base, b.Base)} title="Excluir">🗑️</button>
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
