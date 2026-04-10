import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import { useIgrejas } from '../hooks/useIgrejas'
import { today, fmtDate, chipClass } from '../utils/helpers'

const EMPTY = {
  regiao_id: '', distrito_id: '', igreja_id: '',
  data: today(), tipo: '', pontos: '', status: 'Pendente', obs: '',
}

const STATUS_CYCLE = { 'Pendente': 'Aprovado', 'Aprovado': 'Rejeitado', 'Rejeitado': 'Pendente' }

export default function Pontuacoes() {
  const { data, isLoading, insert, update, remove } = useTable('pontuacoes', 'PONTUACOES')
  const geo = useIgrejas()

  const [form, setForm] = useState(EMPTY)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const distritosOpts = geo.getDistritos(form.regiao_id)
  const igrejasOpts   = geo.getIgrejas(form.distrito_id)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.igreja_id || !form.tipo || !form.pontos || !form.data) {
      toast.error('Preencha: Igreja, Data, Tipo e Pontos.'); return
    }
    await insert.mutateAsync({
      igreja_id: form.igreja_id,
      data:      form.data,
      tipo:      form.tipo,
      pontos:    form.pontos,
      status:    form.status,
      obs:       form.obs,
    })
    toast.success('Pontuação registrada!')
    setForm(EMPTY)
  }

  async function handleToggleStatus(item) {
    const newStatus = STATUS_CYCLE[item.status] || 'Pendente'
    await update.mutateAsync({ id: item.id, data: { status: newStatus } })
    toast.success(`Status: ${newStatus}`)
  }

  async function handleDelete(id) {
    if (!confirm('Excluir pontuação?')) return
    await remove.mutateAsync(id)
    toast.success('Pontuação excluída.')
  }

  return (
    <div>
      {/* Formulário */}
      <div className="card section">
        <div className="card-header">
          <div className="card-title">🏆 Registrar Pontuação</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Região</label>
              <select value={form.regiao_id} onChange={e => { set('regiao_id', e.target.value); set('distrito_id', ''); set('igreja_id', '') }}>
                <option value="">Selecione…</option>
                {geo.regioes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Distrito</label>
              <select value={form.distrito_id} onChange={e => { set('distrito_id', e.target.value); set('igreja_id', '') }} disabled={!form.regiao_id}>
                <option value="">Selecione…</option>
                {distritosOpts.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Igreja *</label>
              <select value={form.igreja_id} onChange={e => set('igreja_id', e.target.value)} required disabled={!form.distrito_id}>
                <option value="">Selecione…</option>
                {igrejasOpts.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Data *</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Tipo de Pontuação *</label>
              <input value={form.tipo} onChange={e => set('tipo', e.target.value)} placeholder="Ex: Missão, Evento…" required />
            </div>
            <div className="form-group">
              <label>Pontos *</label>
              <input type="number" value={form.pontos} onChange={e => set('pontos', e.target.value)} placeholder="0" required />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option>Pendente</option><option>Aprovado</option><option>Rejeitado</option>
              </select>
            </div>
            <div className="form-group full">
              <label>Observações</label>
              <input value={form.obs} onChange={e => set('obs', e.target.value)} placeholder="Descrição opcional" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn btn-outline" onClick={() => setForm(EMPTY)}>Limpar</button>
            <button type="submit" className="btn btn-primary" disabled={insert.isPending}>
              {insert.isPending ? <span className="spinner" /> : '💾 Registrar'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🏆 Pontuações <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{data.length} registros</span></div>
        </div>
        {isLoading ? (
          <div className="empty-state"><div className="spinner spinner-dark" /></div>
        ) : data.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🏆</div><p>Nenhuma pontuação registrada.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Igreja</th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Pontos</th>
                  <th>Obs</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map(p => (
                  <tr key={p.id}>
                    {/* nome_igreja vem de vw_pontuacoes */}
                    <td><span className="chip chip-muted">{p.nome_igreja || '—'}</span></td>
                    <td>{fmtDate(p.data)}</td>
                    <td>{p.tipo}</td>
                    <td><strong style={{ color: 'var(--accent)', fontSize: 15 }}>{p.pontos}</strong></td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.obs || '—'}</td>
                    <td>
                      <span
                        className={`chip ${chipClass(p.status)}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleStatus(p)}
                        title="Clique para alternar status"
                      >
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-icon danger" onClick={() => handleDelete(p.id)}>🗑️</button>
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
