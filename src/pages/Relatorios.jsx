import { useState, useMemo, useEffect } from 'react'
import { useTable } from '../hooks/useTable'
import { fmtDate, buildBaseLabel, formatBaseId } from '../utils/helpers'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { db } from '../api/db'
import toast from 'react-hot-toast'

function gerarSabados(primeiro, ultimo) {
  const sabados = []
  let d = new Date(primeiro + 'T12:00:00')
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  const fim = new Date(ultimo + 'T12:00:00')
  while (d <= fim) {
    sabados.push(d.toISOString().slice(0, 10))
    d = new Date(d); d.setDate(d.getDate() + 7)
  }
  return sabados
}

function anoAtual() { return new Date().getFullYear() }

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
      Verso: n.Verso || '—',
      Discipulado: n.discipulado || '—',
      '300_Treinamento': n.trezentos_treinamento || '—',
      '300_Est_Biblico': n.trezentos_estudo || '—',
      Obs: n.Observacoes || ''
    })).sort((a,b) => (a.Base || '').localeCompare(b.Base || '') || (a.Prova || '').localeCompare(b.Prova || ''))
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
    const [val, setVal] = useState({
      Nota: nota.Nota,
      Comunhao: nota.Comunhao || '',
      Verso: nota.Verso || '',
      discipulado: nota.discipulado || '',
      trezentos_treinamento: nota.trezentos_treinamento || '',
      trezentos_estudo: nota.trezentos_estudo || '',
    })

    const SimNaoSelect = ({ field }) => (
      <select value={val[field]} onChange={e => setVal({ ...val, [field]: e.target.value })} style={{ width: '100%' }}>
        <option value="">—</option>
        <option value="Sim">Sim</option>
        <option value="Não">Não</option>
      </select>
    )

    const SimNaoChip = ({ value }) => (
      <span className={`chip ${value === 'Sim' ? 'chip-good' : value === 'Não' ? 'chip-bad' : 'chip-muted'}`}>
        {value || '—'}
      </span>
    )

    if (edit) {
      return (
        <tr>
          <td></td>
          <td><strong>{nota.Membros}</strong></td>
          <td>
            <input
              type="number"
              value={val.Nota}
              onChange={e => setVal({ ...val, Nota: e.target.value })}
              style={{ width: 60, textAlign: 'center' }}
            />
          </td>
          <td><SimNaoSelect field="Comunhao" /></td>
          <td><SimNaoSelect field="Verso" /></td>
          <td><SimNaoSelect field="discipulado" /></td>
          <td><SimNaoSelect field="trezentos_treinamento" /></td>
          <td><SimNaoSelect field="trezentos_estudo" /></td>
          <td></td>
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
        <td style={{ textAlign: 'center' }}><SimNaoChip value={nota.Comunhao} /></td>
        <td style={{ textAlign: 'center' }}><SimNaoChip value={nota.Verso} /></td>
        <td style={{ textAlign: 'center' }}><SimNaoChip value={nota.discipulado} /></td>
        <td style={{ textAlign: 'center' }}><SimNaoChip value={nota.trezentos_treinamento} /></td>
        <td style={{ textAlign: 'center' }}><SimNaoChip value={nota.trezentos_estudo} /></td>
        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{nota.Observacoes || '—'}</td>
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
        <div className={`tab-item ${tab === 'desempenho' ? 'active' : ''}`} onClick={() => setTab('desempenho')}>📈 Desempenho</div>
        <div className={`tab-item ${tab === 'teen' ? 'active' : ''}`} onClick={() => setTab('teen')}>📋 Notas G148 Teen</div>
        <div className={`tab-item ${tab === 'soul' ? 'active' : ''}`} onClick={() => setTab('soul')}>📋 Notas Soul+</div>
      </div>

      {tab === 'desempenho' && <DesempenhoTab />}

      {tab === 'geral' && (
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
                                  {resultadoGeral.membros.filter(m => m.id_base === base.id_base).sort((a, b) => (a.Membros || '').localeCompare(b.Membros || '', 'pt-BR')).map(m => (
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
      )}

      {(tab === 'teen' || tab === 'soul') && (
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
                    <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ minWidth: 920 }}>
                        <thead>
                          <tr style={{ verticalAlign: 'bottom' }}>
                            <th style={{ width: 30 }}></th>
                            <th style={{ minWidth: 160 }}>Aluno</th>
                            <th style={{ textAlign: 'center', width: 70 }}>Nota</th>
                            <th style={{ textAlign: 'center', width: 90 }}>Comunhão</th>
                            <th style={{ textAlign: 'center', width: 80 }}>Verso</th>
                            <th style={{ textAlign: 'center', width: 100 }}>Discipulado</th>
                            <th colSpan={2} style={{ textAlign: 'center', width: 200 }}>300</th>
                            <th style={{ minWidth: 130 }}>Observação</th>
                            <th className="no-print" style={{ width: 90 }}>Ações</th>
                          </tr>
                          <tr style={{ verticalAlign: 'top' }}>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th style={{ textAlign: 'center', width: 100, fontWeight: 400, fontSize: 11, paddingTop: 2 }}>Treinamento</th>
                            <th style={{ textAlign: 'center', width: 100, fontWeight: 400, fontSize: 11, paddingTop: 2 }}>Est. Bíblico</th>
                            <th></th>
                            <th className="no-print"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.sort((a,b) => (a.Membros || a.nome_aluno || '').localeCompare(b.Membros || b.nome_aluno || '')).map(n => (
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

// ── RELATÓRIO DE DESEMPENHO ───────────────────────────────────────
const CATS_DESEMPENHO = ['admin', 'estudo', 'missao', 'midia', 'da']
const CAT_LABELS_DES  = { admin: 'Adm.', estudo: 'Estudo', missao: 'Missão', midia: 'Mídia', da: 'DA' }

function DesempenhoTab() {
  const [ano, setAno]       = useState(anoAtual())
  const [sortBy, setSortBy] = useState('total')
  const [sortDir, setSortDir] = useState('desc')

  const { data: bases = [] } = useTable('Bases')

  const { data: catalogo = [] } = useQuery({
    queryKey: ['desafios_catalogo'],
    queryFn: () => db.getDesafiosCatalogo(),
    staleTime: 10 * 60 * 1000,
  })
  const { data: trimestresConfig = [] } = useQuery({
    queryKey: ['configuracao_trimestres', ano],
    queryFn: () => db.getConfiguracaoTrimestres(ano),
  })
  const { data: todosRegistros = [], isLoading: loadingReg } = useQuery({
    queryKey: ['ranking_registros', ano],
    queryFn: () => db.getAllRegistrosPorAno(ano),
  })
  const { data: todosMarcos = [], isLoading: loadingMar } = useQuery({
    queryKey: ['ranking_marcos', ano],
    queryFn: () => db.getAllMarcosPorAno(ano),
  })
  const { data: todasNotas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ['ranking_notas', ano],
    queryFn: () => db.getAllNotasTeenPorAno(ano),
  })
  const { data: discipulosRegs = [], isLoading: loadingDisc } = useQuery({
    queryKey: ['all_discipulos', ano],
    queryFn: () => db.getAllDiscipulosRegistrosPorAno(ano),
    staleTime: 2 * 60 * 1000,
  })
  const { data: discipulosCatalogo = [] } = useQuery({
    queryKey: ['discipulos_catalogo'],
    queryFn: () => db.getDiscipulosRequisitoCatalogo(),
    staleTime: 10 * 60 * 1000,
  })
  const { data: batismosRegs = [], isLoading: loadingBat } = useQuery({
    queryKey: ['all_batismos', ano],
    queryFn: () => db.getAllBatismosPorAno(ano),
    staleTime: 2 * 60 * 1000,
  })
  const { data: batismosConfig = null } = useQuery({
    queryKey: ['batismos_config'],
    queryFn: () => db.getBatismosConfig(),
    staleTime: 10 * 60 * 1000,
  })

  const isLoading = loadingReg || loadingMar || loadingNotas || loadingDisc || loadingBat

  const basesTeen = useMemo(() => bases.filter(b => b.Tipo === 'G148 Teen'), [bases])

  const notasMediaPorBase = useMemo(() => {
    const map = {}
    todasNotas.forEach(r => {
      const baseId = r.id_base
      const nota = Number(r.nota ?? r.Nota)
      const nome = r.Membros ?? r.nome_aluno ?? ''
      if (!baseId || !Number.isFinite(nota) || !nome.trim()) return
      const key = r.id_membros ?? (baseId + '|' + nome)
      if (!map[baseId]) map[baseId] = {}
      if (!map[baseId][key]) map[baseId][key] = { sum: 0, count: 0 }
      map[baseId][key].sum += nota; map[baseId][key].count++
    })
    const result = {}
    Object.entries(map).forEach(([baseId, students]) => {
      const avgs = Object.values(students).map(s => s.sum / s.count)
      result[baseId] = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0
    })
    return result
  }, [todasNotas])

  const discipulosPtsPorBase = useMemo(() => {
    if (!discipulosCatalogo.length) return {}
    const pontosReq = Object.fromEntries(discipulosCatalogo.map(r => [r.id, Number(r.pontos ?? 0)]))
    const map = {}
    discipulosRegs.forEach(r => {
      if (!r.realizado || !r.data_realizacao || !r.responsavel) return
      const pts = pontosReq[r.requisito_id] ?? 0
      if (!pts) return
      map[r.base_id] = (map[r.base_id] ?? 0) + pts
    })
    return map
  }, [discipulosRegs, discipulosCatalogo])

  const batismosPtsPorBase = useMemo(() => {
    const ptsPorBatismo = Number(batismosConfig?.pontos_por_batismo ?? 0)
    if (!ptsPorBatismo) return {}
    const map = {}
    batismosRegs.forEach(r => { map[r.base_id] = (map[r.base_id] ?? 0) + ptsPorBatismo })
    return map
  }, [batismosRegs, batismosConfig])

  const desempenho = useMemo(() => {
    if (!catalogo.length || !basesTeen.length) return []
    return basesTeen.map(base => {
      const baseId = base.id_base ?? base.id
      const catPts = {}
      CATS_DESEMPENHO.forEach(cat => {
        const catDesafios = catalogo.filter(d => d.categoria === cat)
        const semanais = catDesafios.filter(d => d.rastreamento === 'semanal'  && d.periodicidade === 'trimestral')
        const mensais  = catDesafios.filter(d => d.periodicidade === 'mensal'  && d.mes_ref)
        const pontuais = catDesafios.filter(d => d.rastreamento === 'pontual'  && d.periodicidade === 'trimestral')
        const anuais   = catDesafios.filter(d => d.periodicidade === 'anual')

        const wPts = trimestresConfig.reduce((total, tc) => {
          const sabadosTc = gerarSabados(tc.primeiro_sabado, tc.ultimo_sabado)
          const numSabs = sabadosTc.length
          if (!numSabs) return total
          return total + semanais.reduce((s, d) => {
            const n = todosRegistros.filter(r =>
              r.base_id === baseId && r.desafio_id === d.id && r.realizado && sabadosTc.includes(r.data_sabado)
            ).length
            return s + n * (Number(d.pontos_total) / numSabs)
          }, 0)
        }, 0)

        const mPts = mensais.reduce((s, d) => {
          const done = todosMarcos.some(m => m.base_id === baseId && m.desafio_id === d.id && m.mes === d.mes_ref && m.realizado)
          return s + (done ? Number(d.pontos_total) : 0)
        }, 0)

        const pPts = pontuais.reduce((s, d) => {
          const n = todosMarcos.filter(m => m.base_id === baseId && m.desafio_id === d.id && m.mes != null && m.realizado).length
          return s + n * (Number(d.pontos_total) / 3)
        }, 0)

        const aPts = anuais.reduce((s, d) => {
          const done = todosMarcos.some(m => m.base_id === baseId && m.desafio_id === d.id && m.trimestre == null && m.mes == null && m.realizado)
          return s + (done ? Number(d.pontos_total) : 0)
        }, 0)

        catPts[cat] = Math.round((wPts + mPts + pPts + aPts) * 10) / 10
      })

      const notaMedia     = Math.round((notasMediaPorBase[baseId] ?? 0) * 10) / 10
      const discipulosPts = Math.round((discipulosPtsPorBase[baseId] ?? 0) * 10) / 10
      const batismosPts   = Math.round((batismosPtsPorBase[baseId] ?? 0) * 10) / 10
      const total = Math.round(
        (CATS_DESEMPENHO.reduce((s, c) => s + (catPts[c] ?? 0), 0) + notaMedia + discipulosPts + batismosPts) * 10
      ) / 10

      return { id: baseId, nome: base.Base ?? base.nome ?? 'Base', ...catPts, notaMedia, discipulosPts, batismosPts, total }
    })
  }, [basesTeen, catalogo, trimestresConfig, todosRegistros, todosMarcos, notasMediaPorBase, discipulosPtsPorBase, batismosPtsPorBase])

  const sorted = useMemo(() =>
    [...desempenho].sort((a, b) => {
      const va = a[sortBy] ?? 0
      const vb = b[sortBy] ?? 0
      return sortDir === 'desc' ? vb - va : va - vb
    }),
    [desempenho, sortBy, sortDir]
  )

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  function thSort(col, label) {
    const active = sortBy === col
    return (
      <th
        style={{ textAlign: 'center', width: 80, cursor: 'pointer', userSelect: 'none',
          color: active ? 'var(--c2)' : undefined }}
        onClick={() => toggleSort(col)}
      >
        {label}{active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
      </th>
    )
  }

  if (isLoading) return <div className="card empty-state"><div className="spinner" /></div>

  return (
    <div className="card section fade-in">
      <div className="card-header">
        <div className="card-title">📈 Relatório de Desempenho por Base</div>
        <select
          value={ano}
          onChange={e => setAno(Number(e.target.value))}
          style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}
        >
          {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="card-body">
        <div className="table-wrap">
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>Base</th>
                {CATS_DESEMPENHO.map(cat => thSort(cat, CAT_LABELS_DES[cat]))}
                {thSort('notaMedia', 'Notas')}
                {thSort('discipulosPts', 'Disc.')}
                {thSort('batismosPts', 'Batismos')}
                <th
                  style={{ textAlign: 'center', width: 90, cursor: 'pointer', userSelect: 'none',
                    fontWeight: 800, color: sortBy === 'total' ? 'var(--c2)' : 'var(--c2)' }}
                  onClick={() => toggleSort('total')}
                >
                  Total{sortBy === 'total' ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.id} style={{
                  background: i === 0 ? 'rgba(255,215,0,.05)'
                            : i === 1 ? 'rgba(192,192,192,.03)'
                            : undefined
                }}>
                  <td style={{ fontWeight: 600 }}>{row.nome}</td>
                  {CATS_DESEMPENHO.map(cat => (
                    <td key={cat} style={{ textAlign: 'center', fontSize: 13, color: row[cat] > 0 ? 'var(--text)' : 'var(--muted)' }}>
                      {row[cat] > 0 ? row[cat] : '—'}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', fontSize: 13, color: row.notaMedia > 0 ? 'var(--good)' : 'var(--muted)' }}>
                    {row.notaMedia > 0 ? row.notaMedia.toFixed(1) : '—'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: 13, color: row.discipulosPts > 0 ? 'var(--c3)' : 'var(--muted)' }}>
                    {row.discipulosPts > 0 ? row.discipulosPts : '—'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: 13, color: row.batismosPts > 0 ? 'var(--c4)' : 'var(--muted)' }}>
                    {row.batismosPts > 0 ? row.batismosPts : '—'}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, color: 'var(--c2)' }}>
                    {row.total}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>Nenhuma base encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
