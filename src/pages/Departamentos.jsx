import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { db } from '../api/db'
import { useAuthStore } from '../store/authStore'

export default function Departamentos() {
  const qc = useQueryClient()
  const isAdmin = useAuthStore(s => s.isAdmin)
  const canEdit = isAdmin

  const [form, setForm] = useState({ nome: '', ativo: true })
  const [editingId, setEditingId] = useState(null)

  const { data: departamentos = [], isLoading } = useQuery({
    queryKey: ['discipulado_departamentos'],
    queryFn: () => db.getDiscipuladoDepartamentos(false),
  })

  const sorted = useMemo(() => {
    return [...departamentos].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))
  }, [departamentos])

  const upsert = useMutation({
    mutationFn: (payload) => db.upsertDiscipuladoDepartamento(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discipulado_departamentos'] })
      qc.invalidateQueries({ queryKey: ['discipulado_departamentos_ativos'] })
      toast.success(editingId ? 'Departamento atualizado!' : 'Departamento criado!')
      setForm({ nome: '', ativo: true })
      setEditingId(null)
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  const remove = useMutation({
    mutationFn: (id) => db.deleteDiscipuladoDepartamento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discipulado_departamentos'] })
      qc.invalidateQueries({ queryKey: ['discipulado_departamentos_ativos'] })
      toast.success('Departamento removido!')
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  function onSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('Informe o nome do departamento.')
      return
    }

    upsert.mutate({
      id: editingId ?? undefined,
      nome: form.nome,
      ativo: form.ativo,
    })
  }

  function onEdit(dep) {
    setEditingId(dep.id)
    setForm({ nome: dep.nome, ativo: dep.ativo !== false })
  }

  function onCancel() {
    setEditingId(null)
    setForm({ nome: '', ativo: true })
  }

  return (
    <div className="fade-in">
      <div className="card section">
        <div className="card-header">
          <div className="card-title">🧭 Departamentos do Discipulado</div>
          {!canEdit && <span className="chip chip-warn">Faça login admin para editar</span>}
        </div>
        <div className="card-body">
          <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
            Página exclusiva para cadastrar departamentos usados nos cartões do discipulado (G148 e Soul+).
          </p>

          <form onSubmit={onSubmit}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 140px auto', alignItems: 'end' }}>
              <div className="form-group">
                <label>Nome do Departamento *</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Ministério da Música"
                  disabled={!canEdit}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={form.ativo ? 'ativo' : 'inativo'}
                  onChange={(e) => setForm(f => ({ ...f, ativo: e.target.value === 'ativo' }))}
                  disabled={!canEdit}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={!canEdit || upsert.isPending}>
                  {upsert.isPending ? <span className="spinner" /> : (editingId ? 'Atualizar' : 'Adicionar')}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-outline" onClick={onCancel}>
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Código</th>
                  <th>Departamento</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Status</th>
                  <th style={{ width: 100 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center' }}><span className="spinner" /></td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', opacity: 0.6 }}>Nenhum departamento cadastrado.</td></tr>
                ) : sorted.map(dep => (
                  <tr key={dep.id}>
                    <td><span className="chip chip-muted">{dep.codigo ?? '—'}</span></td>
                    <td>{dep.nome}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`chip ${dep.ativo ? 'chip-good' : 'chip-muted'}`}>
                        {dep.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="td-actions">
                        <button className="btn-icon" onClick={() => onEdit(dep)} disabled={!canEdit} title="Editar">✏️</button>
                        <button
                          className="btn-icon danger"
                          onClick={() => canEdit && confirm(`Remover departamento "${dep.nome}"?`) && remove.mutate(dep.id)}
                          disabled={!canEdit || remove.isPending}
                          title="Excluir"
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
