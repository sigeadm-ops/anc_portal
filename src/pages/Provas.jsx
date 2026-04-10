import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import { today, toInputDate, chipClass } from '../utils/helpers'

const EMPTY = { tipo: '', nome: '', data: today() }

export default function Provas() {
  const { data, isLoading, insert, update, remove } = useTable('provas', 'TabProvas')
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.tipo || !form.nome || !form.data) {
      toast.error('Preencha todos os campos.'); return
    }
    if (editingId) {
      await update.mutateAsync({ id: editingId, data: form })
      toast.success('Prova atualizada!')
      cancelEdit()
    } else {
      const dup = data.some(p => p.tipo === form.tipo && p.nome.toLowerCase() === form.nome.toLowerCase())
      if (dup) { toast.error('Já existe uma prova com este nome e tipo.'); return }
      await insert.mutateAsync(form)
      toast.success('Prova cadastrada!')
      setForm(EMPTY)
    }
  }

  function startEdit(p) {
    setForm({ tipo: p.tipo, nome: p.nome, data: toInputDate(p.data) })
    setEditingId(p.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() { setForm(EMPTY); setEditingId(null) }

  async function handleDelete(id, nome) {
    if (!confirm(`Excluir prova "${nome}"?`)) return
    await remove.mutateAsync(id)
    toast.success('Prova excluída.')
    if (editingId === id) cancelEdit()
  }

  const sorted = [...data].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo)
    return (a.data || '').localeCompare(b.data || '')
  })

  return (
    <div>
      <div className="card section" style={editingId ? { borderColor: 'var(--accent)', borderWidth: 2 } : {}}>
        <div className="card-header">
          <div className="card-title">{editingId ? '✏️ Editando Prova' : '📝 Nova Prova'}</div>
          {editingId && <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancelar</button>}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid-3">
            <div className="form-group">
              <label>Tipo *</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} required>
                <option value="">Selecione…</option>
                <option value="G148 Teen">G148 Teen</option>
                <option value="Soul+">Soul+</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nome da Prova *</label>
              <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: BEP 1ª Fase" required />
            </div>
            <div className="form-group">
              <label>Data *</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn btn-outline" onClick={cancelEdit}>Limpar</button>
            <button type="submit" className="btn btn-primary" disabled={insert.isPending || update.isPending}>
              {(insert.isPending || update.isPending) ? <span className="spinner" /> : (editingId ? 'Atualizar' : 'Salvar')}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📝 Provas Cadastradas <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{data.length}</span></div>
        </div>
        {isLoading ? (
          <div className="empty-state"><div className="spinner spinner-dark" /></div>
        ) : sorted.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📝</div><p>Nenhuma prova cadastrada.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Nome</th><th>Data</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id} style={editingId === p.id ? { background: 'var(--accent-light)' } : {}}>
                    <td><span className={`chip ${p.tipo === 'G148 Teen' ? 'chip-teen' : 'chip-soul'}`}>{p.tipo}</span></td>
                    <td><strong>{p.nome}</strong></td>
                    <td>{p.data}</td>
                    <td>
                      <div className="td-actions">
                        <button className="btn-icon" onClick={() => startEdit(p)}>✏️</button>
                        <button className="btn-icon danger" onClick={() => handleDelete(p.id, p.nome)}>🗑️</button>
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
