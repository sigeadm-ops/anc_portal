import { useState, useMemo, useEffect } from 'react'
import { useTable } from '../hooks/useTable'
import { fmtDate, buildBaseLabel, formatBaseId } from '../utils/helpers'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../api/db'
import toast from 'react-hot-toast'

export default function Relatorios() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('geral') // 'geral', 'teen', 'soul'
  
  // Dados principais
  const { data: bases } = useTable('Bases')
  const { data: membros } = useTable('Membros')
  const { data: notasTeen } = useTable('Notas_Teen')
  const { data: notasSoul } = useTable('Notas_Soul')

  // Filtros Gerais
  const [filtros, setFiltros] = useState({ Tipo: '', Regiao: '', Distritos: '', Igrejas: '', id_base: '' })
  const [resultadoGeral, setResultadoGeral] = useState(null)
  
  // Filtros de Notas
  const [buscaNota, setBuscaNota] = useState('')

  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return

    if (tab === 'soul') {
      main.classList.add('theme-soul')
    } else {
      main.classList.remove('theme-soul')
    }

    return () => main.classList.remove('theme-soul')
  }, [tab])

  const setF = (k, v) => setFiltros(f => ({ ...f, [k]: v }))

  // ── MUTAÇÕES ────────────────────────────────────────────────
  const deleteNota = useMutation({
    mutationFn: async ({ id, tipo }) => {
      const table = tipo === 'teen' ? 'Notas_Teen' : 'Notas_Soul'
      // Procura a PK correta. Se o db.js mapeia PK_MAP[Notas_Teen] = 'id_form', 
      // precisamos garantir que deletamos a linha certa.
      // Como o db.update usa PK_MAP, vamos usar o id da linha.
      return db.delete(table, id)
    },
    onSuccess: (_, { tipo }) => {
      toast.success('Nota excluída')
      qc.invalidateQueries({ queryKey: [tipo === 'teen' ? 'Notas_Teen' : 'Notas_Soul'] })
    },
    onError: (err) => toast.error('Erro ao excluir: ' + err.message)
  })

  const updateNota = useMutation({
    mutationFn: async ({ id, tipo, data }) => {
      const table = tipo === 'teen' ? 'Notas_Teen' : 'Notas_Soul'
      return db.update(table, id, data)
    },
    onSuccess: (_, { tipo }) => {
      toast.success('Nota atualizada')
      qc.invalidateQueries({ queryKey: [tipo === 'teen' ? 'Notas_Teen' : 'Notas_Soul'] })
    },
    onError: (err) => toast.error('Erro ao atualizar: ' + err.message)
  })

  // ── EXPORTAÇÃO ──────────────────────────────────────────────
  const downloadCSV = (rows, filename) => {
    if (!rows.length) return
    const headers = Object.keys(rows[0]).join(';')
    const body = rows.map(r => 
      Object.values(r).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(';')
    ).join('\n')
    const csv = '\uFEFF' + headers + '\n' + body // UTF-8 with BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `${filename}.csv`)
    link.click()
  }

  function exportarCSVGeral() {
    if (!resultadoGeral) return
    const data = resultadoGeral.bases.flatMap(b => {
      const bMembros = resultadoGeral.membros.filter(m => m.id_base === b.id_base)
      if (bMembros.length === 0) {
        return [{
          Regiao: b.Regiao, Distrito: b.Distritos, Igreja: b.Igrejas, 
          Base: b.Base, Base_ID: formatBaseId(b.id_base), Tipo: b.Tipo, Coordenador: b.Coord, Status_Base: b.Status,
          Membro: '', Nascimento: '', Responsavel: '', Status_Membro: ''
        }]
      }
      return bMembros.map(m => ({
        Regiao: b.Regiao, Distrito: b.Distritos, Igreja: b.Igrejas, 
        Base: b.Base, Base_ID: formatBaseId(b.id_base), Tipo: b.Tipo, Coordenador: b.Coord, Status_Base: b.Status,
        Membro: m.Membros, Nascimento: fmtDate(m.Nasc), Responsavel: m.Responsavel, Status_Membro: m.Status
      }))
    })
    downloadCSV(data, 'relatorio_geral_anc')
  }

  function exportarCSVNotas() {
    const data = notasFiltradas.map(n => ({
      Data: fmtDate(n.data),
      Prova: n.titulo,
      Base: n.Base,
      Responsavel: n.responsavel,
      Aluno: n.Membros,
      Nota: n.Nota,
      Comunhao: n.Comunhao || '—',
      Obs: n.Observacoes || ''
    })).sort((a,b) => a.Base.localeCompare(b.Base) || a.Prova.localeCompare(b.Prova))
    downloadCSV(data, `relatorio_notas_${tab.toUpperCase()}`)
  }

  const imprimir = () => window.print()

  // ── LÓGICA DE RELATÓRIO GERAL ──────────────────────────────
  const regioes = [...new Set(bases.map(b => b.Regiao).filter(Boolean))].sort()
  const distritos = [...new Set(
    bases.filter(b => !filtros.Regiao || b.Regiao === filtros.Regiao).map(b => b.Distritos).filter(Boolean)
  )].sort()
  const igrejas = [...new Set(
    bases.filter(b => (!filtros.Regiao || b.Regiao === filtros.Regiao) && (!filtros.Distritos || b.Distritos === filtros.Distritos)).map(b => b.Igrejas).filter(Boolean)
  )].sort()
  const basesOpts = bases
    .filter(b =>
      (!filtros.Tipo || b.Tipo === filtros.Tipo) &&
      (!filtros.Regiao || b.Regiao === filtros.Regiao) &&
      (!filtros.Distritos || b.Distritos === filtros.Distritos) &&
      (!filtros.Igrejas || b.Igrejas === filtros.Igrejas)
    )
    .sort((a, b) => buildBaseLabel(a, { includeTipo: true }).localeCompare(buildBaseLabel(b, { includeTipo: true })))

  function gerarGeral() {
    let basesFilt = bases.filter(b =>
      (!filtros.Tipo || b.Tipo === filtros.Tipo) &&
      (!filtros.Regiao || b.Regiao === filtros.Regiao) &&
      (!filtros.Distritos || b.Distritos === filtros.Distritos) &&
      (!filtros.Igrejas || b.Igrejas === filtros.Igrejas) &&
      (!filtros.id_base || b.id_base === filtros.id_base)
    )
    const baseIds = new Set(basesFilt.map(b => b.id_base))
    const membrosFilt = membros.filter(m => baseIds.has(m.id_base))

    const tree = {}
    basesFilt.forEach(b => {
      const r = b.Regiao || 'Sem Região'; const d = b.Distritos || 'Sem Distrito'; const ig = b.Igrejas || 'Sem Igreja'
      if (!tree[r]) tree[r] = {}
      if (!tree[r][d]) tree[r][d] = {}
      if (!tree[r][d][ig]) tree[r][d][ig] = []
      tree[r][d][ig].push(b)
    })
    setResultadoGeral({ tree, bases: basesFilt, membros: membrosFilt })
  }

  // ── LÓGICA DE RELATÓRIO DE NOTAS ───────────────────────────
  const notasFiltradas = useMemo(() => {
    const raw = tab === 'teen' ? notasTeen : notasSoul
    if (!raw) return []
    return raw.filter(n => 
      !buscaNota || 
      [n.Membros || n.nome_aluno, n.Base || n.base, n.titulo || n.Titulo].join(' ').toLowerCase().includes(buscaNota.toLowerCase())
    )
  }, [tab, notasTeen, notasSoul, buscaNota])

  const notasAgrupadas = useMemo(() => {
    const groups = {}
    notasFiltradas.forEach(n => {
      const bKey = n.Base || n.base || 'Sem Base'
      const pKey = n.titulo || n.Titulo || 'Sem Título'
      if (!groups[bKey]) groups[bKey] = {}
      if (!groups[bKey][pKey]) groups[bKey][pKey] = []
      groups[bKey][pKey].push(n)
    })
    return groups
  }, [notasFiltradas])

  // ── COMPONENTE DE LINHA EDITÁVEL ────────────────────────────
  function LinhaNota({ nota, tipo }) {
    const [edit, setEdit] = useState(false)
    const [val, setVal] = useState({ Nota: nota.Nota, Comunhao: nota.Comunhao || '' })

    if (edit) {
      return (
        <tr>
          <td></td>
          <td><strong>{nota.Membros}</strong></td>
          <td>
            <input 
              type="number" 
              value={val.Nota} 
              onChange={e => setVal({...val, Nota: e.target.value})} 
              style={{ width: 70, textAlign: 'center' }}
            />
          </td>
          <td>
            <select value={val.Comunhao} onChange={e => setVal({...val, Comunhao: e.target.value})}>
              <option value="">—</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </td>
          <td>
            <div className="td-actions">
              <button className="btn btn-primary btn-sm" onClick={() => {
                updateNota.mutate({ id: nota.id, tipo, data: val })
                setEdit(false)
              }}>Salvar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>Canc.</button>
            </div>
          </td>
        </tr>
      )
    }

    return (
      <tr>
        <td style={{ width: 40 }}><span className="row-num">#</span></td>
        <td><strong>{nota.Membros}</strong></td>
        <td style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 800, color: 'var(--c2)', fontSize: 15 }}>{nota.Nota}</span>
        </td>
        <td style={{ textAlign: 'center' }}>
          <span className={`chip ${nota.Comunhao === 'Sim' ? 'chip-good' : nota.Comunhao === 'Não' ? 'chip-bad' : 'chip-muted'}`}>
            {nota.Comunhao || '—'}
          </span>
        </td>
        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {nota.Observacoes || '—'}
        </td>
        <td className="no-print">
          <div className="td-actions">
            <button className="btn-icon" onClick={() => setEdit(true)} title="Editar Nota">✏️</button>
            <button className="btn-icon danger" onClick={() => {
              if (confirm(`Excluir nota de ${nota.Membros}?`)) deleteNota.mutate({ id: nota.id, tipo })
            }} title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
    )
  }

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="tab-container">
        <div className={`tab-item ${tab === 'geral' ? 'active' : ''}`} onClick={() => setTab('geral')}>🏠 Atividade Geral</div>
        <div className={`tab-item ${tab === 'teen' ? 'active' : ''}`} onClick={() => setTab('teen')}>📋 Notas G148 Teen</div>
        <div className={`tab-item ${tab === 'soul' ? 'active' : ''}`} onClick={() => setTab('soul')}>📋 Notas Soul+</div>
      </div>

      {tab === 'geral' ? (
        <>
          {/* Filtros Geral */}
          <div className="card section">
            <div className="card-header"><div className="card-title">📊 Relatório Geral de Atividades</div></div>
            <div className="card-body">
              <div className="form-grid">
                <div className="form-group"><label>Tipo</label><select value={filtros.Tipo} onChange={e => setF('Tipo', e.target.value)}><option value="">Todos</option><option value="G148 Teen">G148 Teen</option><option value="Soul+">Soul+</option></select></div>
                <div className="form-group"><label>Região</label><select value={filtros.Regiao} onChange={e => { setF('Regiao', e.target.value); setF('Distritos', ''); setF('Igrejas', ''); setF('id_base', '') }}><option value="">Todas</option>{regioes.map(r => <option key={r}>{r}</option>)}</select></div>
                <div className="form-group"><label>Distrito</label><select value={filtros.Distritos} onChange={e => { setF('Distritos', e.target.value); setF('Igrejas', ''); setF('id_base', '') }}><option value="">Todos</option>{distritos.map(d => <option key={d}>{d}</option>)}</select></div>
                <div className="form-group"><label>Igreja</label><select value={filtros.Igrejas} onChange={e => { setF('Igrejas', e.target.value); setF('id_base', '') }}><option value="">Todas</option>{igrejas.map(i => <option key={i}>{i}</option>)}</select></div>
                <div className="form-group"><label>Base</label><select value={filtros.id_base} onChange={e => setF('id_base', e.target.value)}><option value="">Todas</option>{basesOpts.map(b => <option key={b.id_base} value={b.id_base}>{buildBaseLabel(b, { includeTipo: true })}</option>)}</select></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, gap: 10 }}>
                {resultadoGeral && (
                  <>
                    <button className="btn btn-outline" onClick={exportarCSVGeral}>📁 Planilha CSV</button>
                    <button className="btn btn-outline" onClick={imprimir}>🖨️ Imprimir / PDF</button>
                  </>
                )}
                <button className="btn btn-primary" onClick={gerarGeral}>🔍 Gerar Relatório</button>
              </div>
            </div>
          </div>

          {resultadoGeral && (
            <div className="fade-in">
              <div className="stats-grid">
                {[{ num: resultadoGeral.bases.length, lbl: 'Bases' }, { num: resultadoGeral.membros.length, lbl: 'Membros' }].map(s => (
                  <div key={s.lbl} className="stat-card c1"><div className="stat-num">{s.num}</div><div className="stat-label">{s.lbl}</div></div>
                ))}
              </div>
              <div style={{ height: 24 }} />
              {Object.entries(resultadoGeral.tree).sort(([a],[b]) => a.localeCompare(b)).map(([reg, dists]) => (
                <div key={reg} className="card section" style={{ borderLeft: '4px solid var(--c4)' }}>
                  <div className="card-header"><h3>🗺️ {reg}</h3></div>
                  <div className="card-body">
                    {Object.entries(dists).sort(([a],[b]) => a.localeCompare(b)).map(([dist, igs]) => (
                      <div key={dist} style={{ marginBottom: 20 }}>
                        <h4 style={{ color: 'var(--c2)', borderBottom: '1px solid var(--line)', paddingBottom: 5 }}>📍 {dist}</h4>
                        {Object.entries(igs).sort(([a],[b]) => a.localeCompare(b)).map(([ig, bList]) => (
                          <div key={ig} style={{ marginLeft: 12, marginBottom: 15 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6 }}>🏛️ {ig}</div>
                            {bList.map(base => (
                              <div key={base.id_base} className="base-print-block" style={{ padding: '8px 0' }}>
                                <strong>⛪ {buildBaseLabel(base, { includeTipo: true })}</strong>
                                <ul className="membros-list-print" style={{ fontSize: 12, marginLeft: 20, marginTop: 4 }}>
                                  {resultadoGeral.membros.filter(m => m.id_base === base.id_base).sort((a, b) => a.Membros.localeCompare(b.Membros, 'pt-BR')).map(m => (
                                    <li key={m.id_membros} style={{ color: 'inherit' }}>{m.Membros}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={`fade-in ${tab === 'soul' ? 'theme-soul' : ''}`}>
          <div className="card section report-header">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="card-title">🔍 Consulta de Notas ({tab === 'teen' ? 'Teen' : 'Soul+'})</div>
              
              <div style={{ display: 'flex', gap: 10, flex: 1, justifyContent: 'flex-end', minWidth: 300 }}>
                <input 
                  placeholder="Filtrar por nome, base ou prova..." 
                  value={buscaNota} 
                  onChange={e => setBuscaNota(e.target.value)}
                  style={{ maxWidth: 260 }}
                />
                <button className="btn btn-outline btn-sm" onClick={exportarCSVNotas}>📁 CSV</button>
                <button className="btn btn-outline btn-sm" onClick={imprimir}>🖨️ PDF</button>
              </div>
            </div>
          </div>

          {/* Listagem Agrupada */}
          {Object.entries(notasAgrupadas).sort(([a],[b]) => a.localeCompare(b)).map(([base, provas]) => (
            <div key={base} className="card" style={{ marginBottom: 20 }}>
              <div className="card-header" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="card-title">⛪ {base}</div>
              </div>
              <div className="card-body">
                {Object.entries(provas).sort(([pA, listA], [pB, listB]) => {
                  const isPA = (pA || '').toUpperCase().includes('PROVA')
                  const isPB = (pB || '').toUpperCase().includes('PROVA')
                  if (isPA && !isPB) return 1
                  if (!isPA && isPB) return -1
                  return ((listA[0]?.data || listA[0]?.Data) || '').localeCompare((listB[0]?.data || listB[0]?.Data) || '')
                }).map(([prova, lista]) => (
                  <div key={prova} style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                      <span style={{ fontWeight: 800, color: 'var(--c2)' }}>📝 {prova}</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>{fmtDate(lista[0]?.data || lista[0]?.Data)}</span>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: 30 }}></th>
                            <th>Aluno</th>
                            <th style={{ textAlign: 'center', width: 60 }}>Nota</th>
                            <th style={{ textAlign: 'center', width: 90 }}>Comunhão</th>
                            <th>Observação</th>
                            <th className="no-print" style={{ width: 100 }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.sort((a,b) => a.Membros.localeCompare(b.Membros)).map(n => (
                            <LinhaNota key={n.id || n.id_membros + n.id_form} nota={n} tipo={tab} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(notasAgrupadas).length === 0 && (
            <div className="empty-state">Nenhum lançamento encontrado para os filtros atuais.</div>
          )}
        </div>
      )}
    </div>
  )
}

