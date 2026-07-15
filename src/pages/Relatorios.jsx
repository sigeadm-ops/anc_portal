import { useState, useMemo, useEffect } from 'react'
import { useTable } from '../hooks/useTable'
import { fmtDate, buildBaseLabel, formatBaseId } from '../utils/helpers'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { db } from '../api/db'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { isProvaTitulo } from '../lib/desafiosPontuacao'
import { marcarDuplicados, corDuplicidade } from '../utils/duplicidade'

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

function toIsoDate(v) {
  if (!v) return ''
  const s = String(v).trim()
  const iso = s.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

function monthKey(iso) {
  return iso ? iso.slice(0, 7) : ''
}

function quarterFromIso(iso) {
  if (!iso) return ''
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  if (!year || !month) return ''
  const q = Math.ceil(month / 3)
  return `${year}-T${q}`
}

function labelMonth(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return months[Number(m) - 1] || ''
}

function labelQuarter(key) {
  if (!key) return ''
  const [y, t] = key.split('-T')
  return `${t}º Trim`
}

function clampNota(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(10, n))
}

function isSimValue(v) {
  const raw = String(v ?? '').trim().toLowerCase()
  return raw === 'sim' || raw === 's' || raw === 'yes' || raw === 'true' || raw === '1' || raw === 'x'
}

function countSabadosInRange(inicioIso, fimIso) {
  if (!inicioIso || !fimIso) return 0
  const inicio = new Date(`${inicioIso}T12:00:00`)
  const fim = new Date(`${fimIso}T12:00:00`)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) return 0

  while (inicio.getDay() !== 6) inicio.setDate(inicio.getDate() + 1)
  let total = 0
  const cursor = new Date(inicio)
  while (cursor <= fim) {
    total += 1
    cursor.setDate(cursor.getDate() + 7)
  }
  return total
}

function isSaturdayIso(iso) {
  if (!iso) return false
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return false
  return d.getDay() === 6
}

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function Relatorios() {
  const qc = useQueryClient()
  const { isAdmin } = useAuthStore()
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
  const [filtroNotaProva, setFiltroNotaProva] = useState('')
  const [filtroNotaBase, setFiltroNotaBase] = useState('')
  const [tipoIndividual, setTipoIndividual] = useState('')
  const [baseIndividual, setBaseIndividual] = useState('')
  const [membroIndividual, setMembroIndividual] = useState('')

  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return

    if (tab === 'soul' || (tab === 'individual' && tipoIndividual === 'Soul+')) {
      main.classList.add('theme-soul')
    } else {
      main.classList.remove('theme-soul')
    }

    return () => main.classList.remove('theme-soul')
  }, [tab, tipoIndividual])

  useEffect(() => {
    if (tab === 'desempenho' && !isAdmin) {
      setTab('geral')
    }
  }, [tab, isAdmin])

  useEffect(() => {
    if (tab !== 'teen' && tab !== 'soul') return
    setFiltroNotaProva('')
    setFiltroNotaBase('')
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
  const notasAtuais = useMemo(() => {
    const raw = tab === 'teen' ? notasTeen : notasSoul
    return raw || []
  }, [tab, notasTeen, notasSoul])

  const provasNotaOpts = useMemo(() => {
    return [...new Set(notasAtuais.map(n => n.titulo || n.Titulo).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [notasAtuais])

  const basesNotaOpts = useMemo(() => {
    return [...new Set(notasAtuais.map(n => n.Base || n.base).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [notasAtuais])

  const notasFiltradas = useMemo(() => {
    if (!notasAtuais.length) return []
    return notasAtuais.filter(n => {
      const nomeProva = n.titulo || n.Titulo || ''
      const nomeBase = n.Base || n.base || ''
      const texto = [n.Membros || n.nome_aluno, nomeBase, nomeProva].join(' ').toLowerCase()

      if (buscaNota && !texto.includes(buscaNota.toLowerCase())) return false
      if (filtroNotaProva && nomeProva !== filtroNotaProva) return false
      if (filtroNotaBase && nomeBase !== filtroNotaBase) return false
      return true
    })
  }, [notasAtuais, buscaNota, filtroNotaProva, filtroNotaBase])

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

    const dupStyle = nota.isDuplicado
      ? { background: corDuplicidade(nota.duplicidadeIntensidade), boxShadow: 'inset 3px 0 0 var(--bad)' }
      : undefined
    const dupTitle = nota.isDuplicado
      ? `⚠ Possível duplicidade: ${nota.duplicidadeTotal} lançamentos para a mesma base/criança/prova${nota.duplicidadeMaisRecente ? ' — este é o mais recente' : ' — lançamento anterior'}.`
      : undefined

    if (edit) {
      return (
        <tr style={dupStyle} title={dupTitle}>
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
      <tr style={dupStyle} title={dupTitle}>
        <td style={{ width: 40 }}><span className="row-num">#</span></td>
        <td>
          <strong>{nota.Membros}</strong>
          {nota.isDuplicado && (
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: 'var(--bad)' }}>
              ⚠ {nota.duplicidadeMaisRecente ? 'duplicado (mais recente)' : 'duplicado'}
            </span>
          )}
        </td>
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
        {isAdmin && (
          <div className={`tab-item ${tab === 'desempenho' ? 'active' : ''}`} onClick={() => setTab('desempenho')}>📈 Desempenho</div>
        )}
        <div className={`tab-item ${tab === 'individual' ? 'active' : ''}`} onClick={() => setTab('individual')}>👤 Histórico Individual</div>
        <div className={`tab-item ${tab === 'teen' ? 'active' : ''}`} onClick={() => setTab('teen')}>📋 Notas G148 Teen</div>
        <div className={`tab-item ${tab === 'soul' ? 'active' : ''}`} onClick={() => setTab('soul')}>📋 Notas Soul+</div>
      </div>

      {tab === 'desempenho' && isAdmin && <DesempenhoTab />}

      {tab === 'individual' && (
        <RelatorioIndividualTab
          bases={bases}
          notasTeen={notasTeen}
          notasSoul={notasSoul}
          membros={membros}
          tipo={tipoIndividual}
          setTipo={setTipoIndividual}
          baseId={baseIndividual}
          setBaseId={setBaseIndividual}
          membroId={membroIndividual}
          setMembroId={setMembroIndividual}
          downloadCSV={downloadCSV}
        />
      )}

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
                <select
                  value={filtroNotaProva}
                  onChange={e => setFiltroNotaProva(e.target.value)}
                  style={{ maxWidth: 240 }}
                >
                  <option value="">Todas as provas</option>
                  {provasNotaOpts.map((prova) => <option key={prova} value={prova}>{prova}</option>)}
                </select>
                <select
                  value={filtroNotaBase}
                  onChange={e => setFiltroNotaBase(e.target.value)}
                  style={{ maxWidth: 220 }}
                >
                  <option value="">Todas as bases</option>
                  {basesNotaOpts.map((base) => <option key={base} value={base}>{base}</option>)}
                </select>
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
                }).map(([prova, lista]) => {
                  // Duplicidade = mesma criança lançada 2x+ nesta base+prova
                  // (o grupo já está restrito a essa base+prova). O
                  // lançamento mais recente fica em vermelho mais intenso.
                  const listaMarcada = marcarDuplicados(lista, {
                    keyOf: n => n.id_membros ? String(n.id_membros) : (n.Membros ? `nome:${n.Membros}` : null),
                    timeOf: n => n.lancado_em || n.created_at,
                    dataOf: n => n.data || n.Data,
                  })
                  const qtdDuplicados = listaMarcada.filter(n => n.isDuplicado).length
                  return (
                  <div key={prova} style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                      <span style={{ fontWeight: 800, color: 'var(--c2)' }}>
                        📝 {prova}
                        {qtdDuplicados > 0 && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: 'var(--bad)' }}>
                            ⚠ {qtdDuplicados} lançamento{qtdDuplicados !== 1 ? 's' : ''} duplicado{qtdDuplicados !== 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
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
                          {listaMarcada.sort((a,b) => (a.Membros || a.nome_aluno || '').localeCompare(b.Membros || b.nome_aluno || '')).map(n => (
                            <LinhaNota key={n.id || n.id_membros + n.id_form} nota={n} tipo={tab} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )
                })}
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
  const [trimestre, setTrimestre] = useState('')
  const [baseFiltro, setBaseFiltro] = useState('')
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
  const { data: discipulosCartoes = [], isLoading: loadingDisc } = useQuery({
    queryKey: ['all_discipulos_cartoes', ano],
    queryFn: () => db.getAllDiscipulosCartoesPorAno(ano),
    staleTime: 2 * 60 * 1000,
  })
  const { data: discipulosConfig = null } = useQuery({
    queryKey: ['discipulos_config'],
    queryFn: () => db.getDiscipulosConfig(),
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
  const basesTeenFiltradas = useMemo(() => {
    return basesTeen.filter((b) => !baseFiltro || String(b.id_base ?? b.id) === String(baseFiltro))
  }, [basesTeen, baseFiltro])

  const trimestreConfigAtivo = useMemo(() => {
    if (!trimestre) return null
    return trimestresConfig.find((t) => Number(t.trimestre) === Number(trimestre)) || null
  }, [trimestresConfig, trimestre])

  const mesesTrimestreAtivo = useMemo(() => {
    if (!trimestre) return null
    return new Set(mesesDoTrimestre(Number(trimestre)))
  }, [trimestre])

  function rowIsInsideSelectedQuarter(dateValue) {
    if (!trimestre) return true
    const iso = toIsoDate(dateValue)
    if (!iso) return false
    if (trimestreConfigAtivo?.primeiro_sabado && trimestreConfigAtivo?.ultimo_sabado) {
      return iso >= trimestreConfigAtivo.primeiro_sabado && iso <= trimestreConfigAtivo.ultimo_sabado
    }
    if (!mesesTrimestreAtivo) return true
    const mes = Number(iso.slice(5, 7))
    return mesesTrimestreAtivo.has(mes)
  }

  const notasMediaPorBase = useMemo(() => {
    const map = {}
    todasNotas.forEach(r => {
      const baseId = r.id_base
      const nota = Number(r.nota ?? r.Nota)
      const nome = r.Membros ?? r.nome_aluno ?? ''
      if (!baseId || !Number.isFinite(nota) || !nome.trim()) return
      if (!rowIsInsideSelectedQuarter(r.data ?? r.Data)) return
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
  }, [todasNotas, trimestre, trimestreConfigAtivo, mesesTrimestreAtivo])

  // Pontos de discípulos por base:
  // — só o primeiro cartão (ordem = 1) de cada membro conta
  // — metade dos pontos ao ativar (data_inicio), total ao encerrar (data_fim)
  const discipulosPtsPorBase = useMemo(() => {
    const ptsPorCartao = Number(discipulosConfig?.pontos_por_cartao ?? 0)
    if (!ptsPorCartao || !discipulosCartoes.length) return {}

    const primeiros = {}
    discipulosCartoes.forEach(card => {
      const key = `${card.base_id}|${card.membro_id}`
      if (!primeiros[key] || (card.ordem ?? 999) < (primeiros[key].ordem ?? 999)) {
        primeiros[key] = card
      }
    })

    const map = {}
    Object.values(primeiros).forEach(card => {
      if (!card.data_inicio) return
      if (!rowIsInsideSelectedQuarter(card.data_inicio)) return
      const pts = card.data_fim ? ptsPorCartao : ptsPorCartao / 2
      map[card.base_id] = (map[card.base_id] ?? 0) + pts
    })
    return map
  }, [discipulosCartoes, discipulosConfig, trimestre, trimestreConfigAtivo, mesesTrimestreAtivo])

  const batismosPtsPorBase = useMemo(() => {
    const ptsPorBatismo = Number(batismosConfig?.pontos_por_batismo ?? 0)
    if (!ptsPorBatismo) return {}
    const map = {}
    batismosRegs.forEach(r => {
      if (trimestre && mesesTrimestreAtivo && !mesesTrimestreAtivo.has(Number(r.mes))) return
      map[r.base_id] = (map[r.base_id] ?? 0) + ptsPorBatismo
    })
    return map
  }, [batismosRegs, batismosConfig, trimestre, mesesTrimestreAtivo])

  const desempenho = useMemo(() => {
    if (!catalogo.length || !basesTeenFiltradas.length) return []
    return basesTeenFiltradas.map(base => {
      const baseId = base.id_base ?? base.id
      const catPts = {}
      CATS_DESEMPENHO.forEach(cat => {
        const catDesafios = catalogo.filter(d => d.categoria === cat)
        const semanais = catDesafios.filter(d => d.rastreamento === 'semanal'  && d.periodicidade === 'trimestral')
        const mensais  = catDesafios.filter(d => d.periodicidade === 'mensal'  && d.mes_ref)
        const pontuais = catDesafios.filter(d => d.rastreamento === 'pontual'  && d.periodicidade === 'trimestral')
        const anuais   = catDesafios.filter(d => d.periodicidade === 'anual')

        const trimestresAlvo = trimestre
          ? trimestresConfig.filter(tc => Number(tc.trimestre) === Number(trimestre))
          : trimestresConfig

        const wPts = trimestresAlvo.reduce((total, tc) => {
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
          if (trimestre && Number(Math.ceil(Number(d.mes_ref) / 3)) !== Number(trimestre)) return s
          const done = todosMarcos.some(m => m.base_id === baseId && m.desafio_id === d.id && m.mes === d.mes_ref && m.realizado)
          return s + (done ? Number(d.pontos_total) : 0)
        }, 0)

        const pPts = pontuais.reduce((s, d) => {
          const n = todosMarcos.filter(m => {
            if (!(m.base_id === baseId && m.desafio_id === d.id && m.mes != null && m.realizado)) return false
            if (trimestre && mesesTrimestreAtivo && !mesesTrimestreAtivo.has(Number(m.mes))) return false
            return true
          }).length
          // Com trimestre selecionado, o período tem sempre 3 meses. Sem
          // filtro (ano inteiro), divide pelo nº real de trimestres configurados.
          const divisor = trimestre ? 3 : (trimestresConfig.length || 4)
          return s + n * (Number(d.pontos_total) / divisor)
        }, 0)

        const aPts = anuais.reduce((s, d) => {
          if (trimestre) return s
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
  }, [basesTeenFiltradas, catalogo, trimestresConfig, todosRegistros, todosMarcos, notasMediaPorBase, discipulosPtsPorBase, batismosPtsPorBase, trimestre, mesesTrimestreAtivo])

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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}
          >
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={trimestre}
            onChange={e => setTrimestre(e.target.value)}
            style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}
          >
            <option value="">Todos os trimestres</option>
            {[1,2,3,4].map(t => <option key={t} value={t}>{t}º Trimestre</option>)}
          </select>
          <select
            value={baseFiltro}
            onChange={e => setBaseFiltro(e.target.value)}
            style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6, minWidth: 220 }}
          >
            <option value="">Todas as bases</option>
            {basesTeen.map(b => (
              <option key={b.id_base ?? b.id} value={b.id_base ?? b.id}>{b.Base ?? b.nome ?? 'Base'}</option>
            ))}
          </select>
        </div>
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

function ColumnLineChart({ title, rows, annualLineValue = 0, variant = 'teen' }) {
  const isSoul = variant === 'soul'
  const barGradient = isSoul
    ? 'linear-gradient(180deg, rgba(255,179,0,.95), rgba(255,143,0,.92))'
    : 'linear-gradient(180deg, rgba(119,88,255,.95), rgba(39,197,235,.9))'
  const barShadow = isSoul ? '0 8px 18px rgba(255,143,0,.25)' : '0 8px 18px rgba(39,197,235,.16)'
  const devLine = isSoul ? 'rgba(62,32,0,0.85)' : 'rgba(255,255,255,0.9)'
  const annualLine = isSoul ? 'rgba(141,82,0,0.65)' : 'rgba(255,255,255,0.35)'
  const annualBadgeBg = isSoul ? 'rgba(255,248,225,0.9)' : 'rgba(8,16,56,0.8)'
  const annualBadgeBorder = isSoul ? '1px solid rgba(141,82,0,0.25)' : '1px solid rgba(255,255,255,0.12)'
  const annualBadgeColor = isSoul ? '#5d3500' : 'inherit'
  const labelMaskBg = isSoul ? 'rgba(255,248,225,0.96)' : 'rgba(8,16,56,0.94)'
  
  // Determinar qual é o período atual para saber o que é "futuro"
  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtualValue = hoje.getFullYear()
  
  // Filtrar apenas dados com valores reais (qtd > 0) ou que são do presente/passado
  const rowsComDados = rows.map((r, i) => {
    // Se houver dados (qtd > 0), incluir
    // Se não houver dados mas for passado/presente, incluir mas marcar como "futuro"
    const isFuturo = r.qtd === 0
    return { ...r, isFuturo, index: i }
  })
  
  // Encontrar o último índice com dados reais
  const lastDataIndex = rows.findIndex(r => r.qtd === 0)
  const hasDataIndex = lastDataIndex >= 0 ? lastDataIndex - 1 : rows.length - 1
  
  // Calcular valores apenas para dados reais
  const valuesWithData = rows.map(r => r.qtd > 0 ? clampNota(r.media || 0) : null)
  
  // Construir polyline apenas com pontos que têm dados
  const pointsWithData = valuesWithData
    .map((v, i) => v !== null ? { index: i, value: v } : null)
    .filter(Boolean)
  
  const step = rows.length > 1 ? (100 / (rows.length - 1)) : 100
  const annualPct = Math.max(0, Math.min(100, (clampNota(annualLineValue) / 10) * 100))
  
  const points = pointsWithData.map(({ index, value }) => {
    const x = rows.length === 1 ? 50 : index * step
    const y = 100 - ((value / 10) * 100)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header"><div className="card-title">{title}</div></div>
      <div className="card-body">
        {rows.length === 0 ? (
          <div className="empty-state" style={{ padding: 10 }}>Sem dados para o período.</div>
        ) : (
          <div style={{ position: 'relative', paddingTop: 12 }}>
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${12 + (100 - annualPct)}px`,
              borderTop: `1px dashed ${annualLine}`,
              pointerEvents: 'none'
            }} />

            <div style={{
              position: 'absolute',
              right: 0,
              top: `${6 + (100 - annualPct)}px`,
              fontSize: 10,
              opacity: 0.75,
              background: annualBadgeBg,
              padding: '1px 6px',
              borderRadius: 999,
              border: annualBadgeBorder,
              color: annualBadgeColor
            }}>
              Anual {clampNota(annualLineValue).toFixed(1)}
            </div>

            <div style={{ height: 112, display: 'grid', gridTemplateColumns: `repeat(${rows.length}, minmax(16px,1fr))`, gap: 12, alignItems: 'end', position: 'relative', zIndex: 2 }}>
              {rows.map((r, i) => {
                const h = Math.max(4, Math.round((valuesWithData[i] / 10) * 100))
                const isFuturo = r.qtd === 0
                return (
                  <div key={r.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%' }}>
                    {!isFuturo && (
                      <div style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        background: labelMaskBg,
                        border: '1px solid transparent',
                        borderRadius: 999,
                        padding: '0 6px',
                        boxShadow: `0 0 0 4px ${labelMaskBg}`,
                      }}>
                        {valuesWithData[i].toFixed(1)}
                      </div>
                    )}
                    {isFuturo && <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, opacity: 0 }}>0.0</div>}
                    <div style={{
                      height: `${h}px`,
                      width: '100%',
                      borderRadius: '8px 8px 3px 3px',
                      background: isFuturo ? 'rgba(128,128,128,0.15)' : barGradient,
                      boxShadow: isFuturo ? 'none' : barShadow
                    }} />
                  </div>
                )
              })}
            </div>
            {/* Labels dos meses em linha separada, abaixo do grid de barras */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, minmax(16px,1fr))`, gap: 12, marginTop: 4 }}>
              {rows.map((r) => (
                <div key={r.label} style={{ textAlign: 'center', fontSize: 11, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
              ))}
            </div>

            {points && (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: 'absolute', left: 0, right: 0, top: 12, height: 100, width: '100%', pointerEvents: 'none', zIndex: 1 }}
                aria-hidden="true"
              >
                <polyline
                  fill="none"
                  stroke={devLine}
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={points}
                />
              </svg>
            )}

            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, opacity: 0.85, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: barGradient }} />
                Colunas
              </div>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 14, borderTop: `2px solid ${devLine}` }} />
                Linha de Desenvolvimento
              </div>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 14, borderTop: `2px dashed ${annualLine}` }} />
                Linha Anual
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function GaugeChart({ title, value, variant = 'teen' }) {
  const isSoul = variant === 'soul'
  const score = clampNota(value)
  const ratio = score / 10
  const deg = -90 + ratio * 180
  const color = isSoul
    ? `hsl(${38 - ratio * 8} 95% ${86 - ratio * 34}%)`
    : `hsl(${205 - ratio * 155} 95% ${82 - ratio * 36}%)`

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header"><div className="card-title">{title}</div></div>
      <div className="card-body" style={{ paddingTop: 18 }}>
        <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto', height: 180 }}>
          <svg viewBox="0 0 240 140" style={{ width: '100%', height: '100%' }} aria-hidden="true">
            <defs>
              <linearGradient id="gaugeTrack" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={isSoul ? 'hsl(45 100% 91%)' : 'hsl(205 90% 88%)'} />
                <stop offset="55%" stopColor={isSoul ? 'hsl(38 100% 72%)' : 'hsl(190 88% 70%)'} />
                <stop offset="100%" stopColor={isSoul ? 'hsl(33 100% 50%)' : 'hsl(285 92% 48%)'} />
              </linearGradient>
            </defs>

            <path d="M 20 120 A 100 100 0 0 1 220 120" stroke="rgba(255,255,255,0.12)" strokeWidth="18" fill="none" strokeLinecap="round" />
            <path
              d="M 20 120 A 100 100 0 0 1 220 120"
              stroke="url(#gaugeTrack)"
              strokeWidth="18"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(4, ratio * 314)} 400`}
            />

            <g transform={`rotate(${deg} 120 120)`}>
              <line x1="120" y1="120" x2="120" y2="36" stroke={color} strokeWidth="5" strokeLinecap="round" />
            </g>

            <circle cx="120" cy="120" r="11" fill={color} />
          </svg>

          <div style={{ position: 'absolute', left: 0, bottom: 4, fontSize: 12, opacity: 0.75 }}>0.0</div>
          <div style={{ position: 'absolute', right: 0, bottom: 4, fontSize: 12, opacity: 0.75 }}>10.0</div>

          <div style={{
            position: 'absolute',
            left: '50%',
            top: '56%',
            transform: 'translate(-50%,-50%)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color }}>{score.toFixed(1)}</div>
            <div style={{ fontSize: 11, opacity: 0.78, marginTop: 4 }}>Média Geral</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 8, marginTop: 2 }}>
          {[0, 2.5, 5, 7.5, 10].map(mark => {
            const r = mark / 10
            const c = isSoul
              ? `hsl(${38 - r * 8} 95% ${86 - r * 34}%)`
              : `hsl(${205 - r * 155} 95% ${82 - r * 36}%)`
            return (
              <div key={mark} style={{ textAlign: 'center' }}>
                <div style={{ height: 6, borderRadius: 999, background: c, marginBottom: 3 }} />
                <div style={{ fontSize: 10, opacity: 0.7 }}>{mark.toFixed(1)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RelatorioIndividualTab({ bases, notasTeen, notasSoul, membros, tipo, setTipo, baseId, setBaseId, membroId, setMembroId, downloadCSV }) {
  const notasAll = useMemo(() => {
    const teen = (notasTeen || []).map(n => ({ ...n, _tipo: 'G148 Teen' }))
    const soul = (notasSoul || []).map(n => ({ ...n, _tipo: 'Soul+' }))
    return [...teen, ...soul]
  }, [notasTeen, notasSoul])

  const isSoulMode = tipo === 'Soul+'

  const basesOpts = useMemo(() => {
    return (bases || [])
      .filter(b => !tipo || b.Tipo === tipo)
      .sort((a, b) => buildBaseLabel(a, { includeTipo: true }).localeCompare(buildBaseLabel(b, { includeTipo: true }), 'pt-BR'))
  }, [bases, tipo])

  const membrosOpts = useMemo(() => {
    return (membros || [])
      .filter(m => !tipo || m.Tipo === tipo)
      .filter(m => !baseId || String(m.id_base || '') === String(baseId))
      .sort((a, b) => (a.Membros || '').localeCompare(b.Membros || '', 'pt-BR'))
  }, [membros, tipo, baseId])

  const historico = useMemo(() => {
    const linhas = notasAll
      .filter(n => {
        if (tipo && n._tipo !== tipo) return false
        if (baseId && String(n.id_base || '') !== String(baseId)) return false
        if (membroId && String(n.id_membros || '') !== String(membroId)) return false
        return true
      })
      .map(n => {
        const dataIso = toIsoDate(n.data || n.Data)
        return {
          id: n.id ?? null,
          id_base: n.id_base || '',
          id_provas: n.id_provas ?? n.prova_id ?? '',
          id_membros: n.id_membros ?? '',
          lancadoEm: n.lancado_em || n.created_at || n.saved_at || null,
          dataIso,
          data: fmtDate(dataIso),
          tipo: n._tipo,
          prova: n.titulo || n.Titulo || 'Sem título',
          base: n.Base || n.base || '—',
          aluno: n.Membros || n.nome_aluno || '—',
          nota: Number(n.Nota ?? n.nota ?? 0),
          comunhao: n.Comunhao ?? n.comunhao ?? n.nota_1000 ?? n.Nota_1000 ?? '',
          observacao: n.Observacoes || n.observacoes || '',
        }
      })
      .filter(r => r.dataIso)
      .sort((a, b) => a.dataIso.localeCompare(b.dataIso))

    // Duplicidade = mesma base + mesma criança + mesmo registro de prova,
    // mesmo que os demais dados sejam diferentes. O lançamento mais recente
    // (por lancado_em, com fallback pra data) recebe vermelho mais intenso.
    return marcarDuplicados(linhas, {
      keyOf: r => (r.id_base && r.id_membros && r.id_provas) ? `${r.id_base}|${r.id_membros}|${r.id_provas}` : null,
      timeOf: r => r.lancadoEm,
      dataOf: r => r.dataIso,
    })
  }, [notasAll, tipo, baseId, membroId])

  const anoRef = useMemo(() => {
    if (!historico.length) return String(new Date().getFullYear())
    return historico[historico.length - 1].dataIso.slice(0, 4)
  }, [historico])

  // No Soul+, "Registro Semanal" não tem nota de verdade (só Comunhão/Verso/
  // Discipulado/300) — só "NN Prova Soul+" deve entrar nas médias de nota.
  // A lista bruta (`historico`) continua mostrando tudo, pra manter o extrato
  // de auditoria completo.
  const historicoNotas = useMemo(() => (
    historico.filter(r => r.tipo !== 'Soul+' || isProvaTitulo(r.prova))
  ), [historico])

  const { data: configTrimestresAno = [] } = useQuery({
    queryKey: ['configuracao_trimestres_individual', anoRef],
    queryFn: () => db.getConfiguracaoTrimestres(Number(anoRef)),
    enabled: Boolean(anoRef),
  })

  const porMes = useMemo(() => {
    const map = {}
    historicoNotas.forEach(r => {
      const k = monthKey(r.dataIso)
      if (!k) return
      if (!map[k]) map[k] = { soma: 0, qtd: 0 }
      map[k].soma += r.nota
      map[k].qtd += 1
    })

    return Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, '0')
      const key = `${anoRef}-${month}`
      const found = map[key] || { soma: 0, qtd: 0 }
      return {
        key,
        label: labelMonth(key),
        media: found.qtd ? found.soma / found.qtd : 0,
        qtd: found.qtd,
      }
    })
  }, [historicoNotas, anoRef])

  const porTrimestre = useMemo(() => {
    const map = {}
    historicoNotas.forEach(r => {
      const k = quarterFromIso(r.dataIso)
      if (!k) return
      if (!map[k]) map[k] = { soma: 0, qtd: 0 }
      map[k].soma += r.nota
      map[k].qtd += 1
    })

    return Array.from({ length: 4 }, (_, i) => {
      const quarter = i + 1
      const key = `${anoRef}-T${quarter}`
      const found = map[key] || { soma: 0, qtd: 0 }
      return {
        key,
        label: labelQuarter(key),
        media: found.qtd ? found.soma / found.qtd : 0,
        qtd: found.qtd,
      }
    })
  }, [historicoNotas, anoRef])

  const porAno = useMemo(() => {
    const map = {}
    historicoNotas.forEach(r => {
      const y = r.dataIso.slice(0, 4)
      if (!map[y]) map[y] = { soma: 0, qtd: 0 }
      map[y].soma += r.nota
      map[y].qtd += 1
    })
    return Object.entries(map)
      .map(([k, v]) => ({ key: k, label: k, media: v.qtd ? v.soma / v.qtd : 0, qtd: v.qtd }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [historicoNotas])

  const mediaGeral = useMemo(() => {
    if (!historicoNotas.length) return 0
    return historicoNotas.reduce((s, r) => s + r.nota, 0) / historicoNotas.length
  }, [historicoNotas])

  const mediaAnualRef = useMemo(() => {
    const anoSelecionado = porAno.find(a => a.key === anoRef)
    return anoSelecionado ? clampNota(anoSelecionado.media) : clampNota(mediaGeral)
  }, [porAno, anoRef, mediaGeral])

  const notaMilStats = useMemo(() => {
    const trimestresCfg = Array.isArray(configTrimestresAno) ? configTrimestresAno : []
    const cfgMap = Object.fromEntries(
      trimestresCfg
        .filter(t => Number(t.trimestre) >= 1 && Number(t.trimestre) <= 4)
        .map(t => [Number(t.trimestre), t])
    )

    const simTrim = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() }
    const simAnoRows = historico.filter(
      r => r.dataIso.startsWith(`${anoRef}-`) && isSimValue(r.comunhao) && isSaturdayIso(r.dataIso)
    )

    simAnoRows.forEach(r => {
      const month = Number(r.dataIso.slice(5, 7))
      const q = Math.ceil(month / 3)
      if (q >= 1 && q <= 4) simTrim[q].add(r.dataIso)
    })

    const trimRows = [1, 2, 3, 4].map(q => {
      const cfg = cfgMap[q]
      const fallbackStart = `${anoRef}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`
      const fallbackEnd = `${anoRef}-${String(q * 3).padStart(2, '0')}-${q === 1 ? '31' : q === 2 ? '30' : q === 3 ? '30' : '31'}`
      const sabadosRef = countSabadosInRange(cfg?.primeiro_sabado || fallbackStart, cfg?.ultimo_sabado || fallbackEnd)
      const sim = simTrim[q]?.size || 0
      const mediaPorSabado = sabadosRef > 0 ? sim / sabadosRef : 0
      const percentual = sabadosRef > 0 ? (sim / sabadosRef) * 100 : 0

      return {
        trimestre: q,
        sim,
        sabadosRef,
        mediaPorSabado,
        percentual,
      }
    })

    const simAno = trimRows.reduce((acc, r) => acc + r.sim, 0)
    const sabadosAno = trimRows.reduce((acc, r) => acc + r.sabadosRef, 0)
    const mediaAnoPorSabado = sabadosAno > 0 ? simAno / sabadosAno : 0
    const percentualAno = sabadosAno > 0 ? (simAno / sabadosAno) * 100 : 0

    return {
      trimRows,
      simAno,
      sabadosAno,
      mediaAnoPorSabado,
      percentualAno,
    }
  }, [historico, anoRef, configTrimestresAno])

  function exportarHistorico() {
    if (!historico.length) return
    downloadCSV(historico.map(r => ({
      Data: r.data,
      Tipo: r.tipo,
      Aluno: r.aluno,
      Base: r.base,
      Prova: r.prova,
      Nota: r.nota,
      Observacao: r.observacao,
    })), 'historico_individual_notas')
  }

  function exportarConsolidado() {
    const linhas = [
      ...porMes.map(r => ({ Periodo: 'Mes', Referencia: r.label, Media: Number(r.media).toFixed(2), Lancamentos: r.qtd })),
      ...porTrimestre.map(r => ({ Periodo: 'Trimestre', Referencia: r.label, Media: Number(r.media).toFixed(2), Lancamentos: r.qtd })),
      ...porAno.map(r => ({ Periodo: 'Ano', Referencia: r.label, Media: Number(r.media).toFixed(2), Lancamentos: r.qtd })),
    ]
    if (!linhas.length) return
    downloadCSV(linhas, 'historico_individual_resumo')
  }

  function exportarPDF() {
    if (!historico.length) {
      toast.error('Selecione uma criança com histórico para exportar o PDF.')
      return
    }

    const janela = window.open('', '_blank', 'width=1280,height=900')
    if (!janela) {
      toast.error('O navegador bloqueou a janela de impressão. Libere pop-up e tente novamente.')
      return
    }

    const aluno = historico[0]?.aluno || 'Aluno'
    const tipoAtual = tipo || historico[0]?.tipo || 'Todos'
    const baseAtual = baseId
      ? (basesOpts.find(b => String(b.id_base) === String(baseId))?.Base || 'Base selecionada')
      : 'Todas'
    const periodo = `${historico[0]?.data || '—'} a ${historico[historico.length - 1]?.data || '—'}`
    const emitidoEm = new Date().toLocaleString('pt-BR')
    const anual = clampNota(mediaAnualRef)
    const score = clampNota(mediaGeral)
    const scorePct = Math.round((score / 10) * 100)
    const notaMilPct = Math.max(0, Math.min(100, notaMilStats.percentualAno))
    const raio = 100
    const semicirc = Math.PI * raio
    const preenchimento = Math.max(8, (score / 10) * semicirc)

    const nomeArquivo = `historico_${aluno}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()

    const chartHtml = (titulo, rows) => {
      if (!rows.length) {
        return `<section class="panel"><h3>${escapeHtml(titulo)}</h3><div class="empty">Sem dados neste período.</div></section>`
      }

      const safeRows = rows.map(r => ({ ...r, v: clampNota(r.media || 0) }))
      const w = 540
      const h = 190
      const padL = 16
      const padR = 16
      const padT = 16
      const padB = 34
      const iw = w - padL - padR
      const ih = h - padT - padB
      const n = safeRows.length
      const barW = Math.max(14, Math.min(42, Math.floor((iw - Math.max(0, n - 1) * 8) / n)))
      const gap = n > 1 ? (iw - n * barW) / (n - 1) : 0

      const annualY = padT + ih - (anual / 10) * ih

      const bars = safeRows.map((r, i) => {
        const x = padL + i * (barW + gap)
        const barH = Math.max(6, (r.v / 10) * ih)
        const y = padT + ih - barH
        const labelX = x + barW / 2
        return `
          <g>
            <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW}" height="${barH.toFixed(2)}" rx="6" fill="url(#barGrad)" />
            <text x="${labelX.toFixed(2)}" y="${(h - 10).toFixed(2)}" text-anchor="middle" class="xlab">${escapeHtml(r.label)}</text>
            <text x="${labelX.toFixed(2)}" y="${(y - 5).toFixed(2)}" text-anchor="middle" class="val">${r.v.toFixed(1)}</text>
          </g>
        `
      }).join('')

      const points = safeRows.map((r, i) => {
        const x = padL + i * (barW + gap) + barW / 2
        const y = padT + ih - (r.v / 10) * ih
        return `${x.toFixed(2)},${y.toFixed(2)}`
      }).join(' ')

      return `
        <section class="panel">
          <h3>${escapeHtml(titulo)}</h3>
          <svg viewBox="0 0 ${w} ${h}" class="chart" aria-hidden="true">
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${isSoulMode ? '#FFB300' : '#8a5cff'}" />
                <stop offset="100%" stop-color="${isSoulMode ? '#FF8F00' : '#2ce0f6'}" />
              </linearGradient>
            </defs>
            <line x1="${padL}" y1="${annualY.toFixed(2)}" x2="${(w - padR).toFixed(2)}" y2="${annualY.toFixed(2)}" stroke="${isSoulMode ? '#8D5200' : '#b3bee7'}" stroke-width="1.3" stroke-dasharray="6 5" />
            ${bars}
            <polyline points="${points}" fill="none" stroke="${isSoulMode ? '#3E2000' : '#ffffff'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="legend">
            <span><i class="dot col"></i>Colunas</span>
            <span><i class="dot dev"></i>Linha de Desenvolvimento</span>
            <span><i class="dot yr"></i>Linha Anual (${anual.toFixed(1)})</span>
          </div>
        </section>
      `
    }

    const historicoRows = historico
      .map((r, i) => `
        <tr${r.isDuplicado ? ` style="background:${corDuplicidade(r.duplicidadeIntensidade)};"` : ''}>
          <td>${i + 1}</td>
          <td>${escapeHtml(r.data)}</td>
          <td>${escapeHtml(r.tipo)}</td>
          <td>${escapeHtml(r.prova)}${r.isDuplicado ? ` <strong style="color:#c81e3a;">⚠ duplicado${r.duplicidadeMaisRecente ? ' (mais recente)' : ''}</strong>` : ''}</td>
          <td>${escapeHtml(r.base)}</td>
          <td class="nota">${clampNota(r.nota).toFixed(1)}</td>
          <td>${escapeHtml(r.observacao || '—')}</td>
        </tr>
      `)
      .join('')

    const notaMilRows = notaMilStats.trimRows
      .map(r => `
        <tr>
          <td>${r.trimestre}º Trim</td>
          <td>${r.sabadosRef}</td>
          <td class="nota">${r.sim}</td>
          <td>${r.percentual.toFixed(1)}%</td>
        </tr>
      `)
      .join('')

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório Individual - ${escapeHtml(aluno)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Trebuchet MS", sans-serif;
      color: ${isSoulMode ? '#281400' : '#f2f5ff'};
      background: ${isSoulMode
        ? 'radial-gradient(circle at 20% -10%, rgba(255,179,0,.45) 0%, transparent 35%), radial-gradient(circle at 85% 0%, rgba(255,143,0,.4) 0%, transparent 30%), #FFF8E1'
        : 'radial-gradient(circle at 20% -10%, #2d4cff 0%, transparent 35%), radial-gradient(circle at 85% 0%, #6a2bff 0%, transparent 30%), #050924'};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      border: 1px solid ${isSoulMode ? 'rgba(141,82,0,.35)' : '#2d3e7a'};
      border-radius: 16px;
      overflow: hidden;
      background: ${isSoulMode
        ? 'linear-gradient(180deg, rgba(255,248,225,.96), rgba(255,236,179,.96))'
        : 'linear-gradient(180deg, rgba(14,22,61,.95), rgba(7,12,36,.98))'};
      box-shadow: ${isSoulMode ? '0 20px 50px rgba(141,82,0,.2)' : '0 20px 50px rgba(3,5,20,.45)'};
    }
    .hero {
      padding: 20px;
      background: ${isSoulMode
        ? 'linear-gradient(125deg, rgba(255,179,0,.34), rgba(255,143,0,.2))'
        : 'linear-gradient(125deg, rgba(138,92,255,.34), rgba(44,224,246,.25))'};
      border-bottom: 1px solid ${isSoulMode ? 'rgba(62,32,0,.15)' : 'rgba(255,255,255,.1)'};
    }
    .kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; opacity: .78; }
    .title { font-size: 30px; font-weight: 900; margin: 4px 0 8px; }
    .meta { font-size: 12px; opacity: .88; display: flex; gap: 14px; flex-wrap: wrap; }
    .content { padding: 16px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 12px; }
    .card {
      background: ${isSoulMode
        ? 'linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,248,225,.85))'
        : 'linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.04))'};
      border: 1px solid ${isSoulMode ? 'rgba(141,82,0,.2)' : 'rgba(255,255,255,.12)'};
      border-radius: 12px;
      padding: 10px;
      min-height: 72px;
    }
    .card .num { font-size: 24px; font-weight: 900; }
    .card .lbl { font-size: 11px; opacity: .82; margin-top: 2px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .panel {
      background: ${isSoulMode ? 'rgba(255,252,241,.88)' : 'rgba(10,17,49,.82)'};
      border: 1px solid ${isSoulMode ? 'rgba(141,82,0,.22)' : 'rgba(255,255,255,.12)'};
      border-radius: 12px;
      padding: 10px;
      break-inside: avoid;
    }
    .panel h3 { margin: 0 0 8px; font-size: 14px; }
    .chart { width: 100%; height: 190px; display: block; }
    .xlab { fill: ${isSoulMode ? '#6B3E00' : '#d6ddff'}; font-size: 10px; }
    .val {
      fill: ${isSoulMode ? '#3E2000' : '#ffffff'};
      font-size: 10px;
      font-weight: 700;
      stroke: ${isSoulMode ? 'rgba(255,252,241,.88)' : 'rgba(10,17,49,.82)'};
      stroke-width: 4px;
      paint-order: stroke fill;
      stroke-linejoin: round;
    }
    .legend { margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap; font-size: 10px; opacity: .88; }
    .dot { display: inline-block; width: 11px; height: 11px; border-radius: 2px; margin-right: 5px; vertical-align: -2px; }
    .dot.col { background: ${isSoulMode ? 'linear-gradient(180deg,#FFB300,#FF8F00)' : 'linear-gradient(180deg,#8a5cff,#2ce0f6)'}; }
    .dot.dev { width: 14px; height: 2px; border-radius: 8px; background: #fff; }
    .dot.yr { width: 14px; height: 2px; border-radius: 8px; background: ${isSoulMode ? 'repeating-linear-gradient(90deg,#8D5200 0 4px,transparent 4px 8px)' : 'repeating-linear-gradient(90deg,#b3bee7 0 4px,transparent 4px 8px)'}; }
    .gauge-wrap {
      display: grid;
      grid-template-columns: 230px 1fr;
      gap: 12px;
      align-items: center;
    }
    .gauge {
      width: 220px;
      height: 130px;
      display: block;
      margin: 0 auto;
    }
    .g-desc { font-size: 12px; opacity: .9; }
    .g-num { font-size: 34px; font-weight: 900; line-height: 1; color: ${isSoulMode ? '#8D5200' : '#71ebff'}; }
    .g-bar { margin-top: 8px; height: 10px; border-radius: 999px; background: ${isSoulMode ? 'rgba(141,82,0,.15)' : 'rgba(255,255,255,.14)'}; overflow: hidden; }
    .g-fill { height: 100%; width: ${scorePct}%; background: ${isSoulMode ? 'linear-gradient(90deg,#FFE082,#FF8F00)' : 'linear-gradient(90deg,#c9f4ff,#8a5cff)'}; }
    .table-panel { margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid ${isSoulMode ? 'rgba(141,82,0,.2)' : 'rgba(255,255,255,.12)'}; padding: 7px 6px; }
    th { background: ${isSoulMode ? 'rgba(255,179,0,.18)' : 'rgba(255,255,255,.08)'}; text-align: left; }
    td.nota { text-align: center; font-weight: 800; color: ${isSoulMode ? '#8D5200' : '#7de9ff'}; }
    .empty { font-size: 12px; opacity: .8; padding: 12px; border-radius: 8px; background: rgba(255,255,255,.06); }
    .footer { margin-top: 8px; text-align: right; font-size: 10px; opacity: .75; }
    @media print {
      .page { box-shadow: none; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="kicker">Portal ANC • Relatório Individual</div>
      <div class="title">Desempenho de ${escapeHtml(aluno)}</div>
      <div class="meta">
        <span><strong>Tipo:</strong> ${escapeHtml(tipoAtual)}</span>
        <span><strong>Base:</strong> ${escapeHtml(baseAtual)}</span>
        <span><strong>Período:</strong> ${escapeHtml(periodo)}</span>
        <span><strong>Emissão:</strong> ${escapeHtml(emitidoEm)}</span>
      </div>
    </section>

    <section class="content">
      <div class="stats">
        <article class="card"><div class="num">${historico.length}</div><div class="lbl">Lançamentos</div></article>
        <article class="card"><div class="num">${score.toFixed(1)}</div><div class="lbl">Média Geral</div></article>
        <article class="card"><div class="num">${porMes.filter(m => m.qtd > 0).length}/${porTrimestre.filter(t => t.qtd > 0).length}</div><div class="lbl">Meses / Trimestres</div></article>
        <article class="card"><div class="num">${anual.toFixed(1)}</div><div class="lbl">Referência Anual</div></article>
        <article class="card"><div class="num">${notaMilStats.simAno}</div><div class="lbl">Sábados com SIM (${notaMilPct.toFixed(1)}% freq.)</div></article>
      </div>

      <div class="grid2">
        ${chartHtml('Desempenho por Mês', porMes)}
        ${chartHtml('Desempenho por Trimestre', porTrimestre)}
      </div>

      <section class="panel" style="margin-top:12px;">
        <h3>Velocímetro de Desempenho (0 a 10)</h3>
        <div class="gauge-wrap">
          <svg viewBox="0 0 240 140" class="gauge" aria-hidden="true">
            <defs>
              <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="${isSoulMode ? '#FFF3C1' : '#d8f6ff'}" />
                <stop offset="60%" stop-color="${isSoulMode ? '#FFD35D' : '#7cefff'}" />
                <stop offset="100%" stop-color="${isSoulMode ? '#FF8F00' : '#8a5cff'}" />
              </linearGradient>
            </defs>
            <path d="M 20 120 A 100 100 0 0 1 220 120" stroke="${isSoulMode ? 'rgba(141,82,0,.18)' : 'rgba(255,255,255,.14)'}" stroke-width="18" fill="none" stroke-linecap="round" />
            <path d="M 20 120 A 100 100 0 0 1 220 120" stroke="url(#gg)" stroke-width="18" fill="none" stroke-linecap="round" stroke-dasharray="${preenchimento} 999" />
            <text x="20" y="136" fill="${isSoulMode ? '#6B3E00' : '#d7defd'}" font-size="11">0</text>
            <text x="214" y="136" fill="${isSoulMode ? '#6B3E00' : '#d7defd'}" font-size="11">10</text>
          </svg>
          <div>
            <div class="g-num">${score.toFixed(1)}</div>
            <div class="g-desc">Quanto mais próximo de 10, maior a intensidade e consistência da evolução.</div>
            <div class="g-bar"><div class="g-fill"></div></div>
          </div>
        </div>
      </section>

      <section class="panel table-panel">
        <h3>Aluno Nota Mil • Comunhão por Sábados (${anoRef})</h3>
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Sábados Ref.</th>
              <th>Sábados com SIM</th>
              <th>Frequência %</th>
            </tr>
          </thead>
          <tbody>
            ${notaMilRows}
            <tr>
              <td><strong>Ano</strong></td>
              <td><strong>${notaMilStats.sabadosAno}</strong></td>
              <td class="nota"><strong>${notaMilStats.simAno}</strong></td>
              <td><strong>${notaMilStats.percentualAno.toFixed(1)}%</strong></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel table-panel">
        <h3>Histórico Completo de Provas</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Prova</th>
              <th>Base</th>
              <th>Nota</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>${historicoRows}</tbody>
        </table>
      </section>

      <div class="footer">Documento gerado automaticamente pelo Portal ANC.</div>
    </section>
  </main>
</body>
</html>`

    janela.document.open()
    janela.document.write(html)
    janela.document.close()
    janela.focus()
    janela.document.title = `${nomeArquivo || 'historico_individual'}.pdf`
    setTimeout(() => janela.print(), 350)
  }

  return (
    <div className="fade-in">
      <div className="card section">
        <div className="card-header"><div className="card-title">👤 Histórico Individual de Notas</div></div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Tipo</label>
              <select value={tipo} onChange={e => { setTipo(e.target.value); setBaseId(''); setMembroId('') }}>
                <option value="">Todos</option>
                <option value="G148 Teen">G148 Teen</option>
                <option value="Soul+">Soul+</option>
              </select>
            </div>
            <div className="form-group">
              <label>Base</label>
              <select value={baseId} onChange={e => { setBaseId(e.target.value); setMembroId('') }}>
                <option value="">Todas</option>
                {basesOpts.map(b => (
                  <option key={b.id_base} value={b.id_base}>{buildBaseLabel(b, { includeTipo: true })}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Criança</label>
              <select value={membroId} onChange={e => setMembroId(e.target.value)}>
                <option value="">Selecione…</option>
                {membrosOpts.map(m => <option key={m.id_membros} value={m.id_membros}>{m.Membros} ({m.Tipo || '—'})</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5,minmax(120px,1fr))', flex: 1 }}>
              <div className="stat-card c1"><div className="stat-num">{historico.length}</div><div className="stat-label">Lançamentos</div></div>
              <div className="stat-card c1"><div className="stat-num">{mediaGeral ? mediaGeral.toFixed(1) : '0.0'}</div><div className="stat-label">Média Geral</div></div>
              <div className="stat-card c1"><div className="stat-num">{porMes.filter(m => m.qtd > 0).length}/{porTrimestre.filter(t => t.qtd > 0).length}</div><div className="stat-label">Meses / Trimestres</div></div>
              <div className="stat-card c1"><div className="stat-num">{notaMilStats.simAno}</div><div className="stat-label">Sábados com SIM ({notaMilStats.percentualAno.toFixed(1)}% freq.)</div></div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={exportarPDF}>🧾 Salvar PDF</button>
              <button className="btn btn-outline" onClick={exportarHistorico}>📁 Exportar Histórico</button>
              <button className="btn btn-outline" onClick={exportarConsolidado}>📁 Exportar Consolidado</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <ColumnLineChart title="Desempenho por Mês" rows={porMes} annualLineValue={mediaAnualRef} variant={isSoulMode ? 'soul' : 'teen'} />
        <ColumnLineChart title="Desempenho por Trimestre" rows={porTrimestre} annualLineValue={mediaAnualRef} variant={isSoulMode ? 'soul' : 'teen'} />
      </div>

      <GaugeChart title="Velocímetro de Desempenho (0 a 10)" value={mediaGeral} variant={isSoulMode ? 'soul' : 'teen'} />

      <div className="card">
        <div className="card-header"><div className="card-title">💯 Aluno Nota Mil • Comunhão por Sábados ({anoRef})</div></div>
        <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th>Período</th>
                <th style={{ textAlign: 'center' }}>Sábados Ref.</th>
                <th style={{ textAlign: 'center' }}>Sábados com SIM</th>
                <th style={{ textAlign: 'center' }}>Frequência %</th>
              </tr>
            </thead>
            <tbody>
              {notaMilStats.trimRows.map(row => (
                <tr key={`nota-mil-trim-${row.trimestre}`}>
                  <td>{row.trimestre}º Trimestre</td>
                  <td style={{ textAlign: 'center' }}>{row.sabadosRef}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--c2)' }}>{row.sim}</td>
                  <td style={{ textAlign: 'center' }}>{row.percentual.toFixed(1)}%</td>
                </tr>
              ))}
              <tr>
                <td><strong>Ano</strong></td>
                <td style={{ textAlign: 'center' }}><strong>{notaMilStats.sabadosAno}</strong></td>
                <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--c2)' }}><strong>{notaMilStats.simAno}</strong></td>
                <td style={{ textAlign: 'center' }}><strong>{notaMilStats.percentualAno.toFixed(1)}%</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">🧾 Histórico Completo de Provas</div></div>
        <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Criança</th>
                <th>Base</th>
                <th>Prova</th>
                <th style={{ textAlign: 'center' }}>Nota</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.6, padding: 20 }}>Selecione uma criança para visualizar o histórico.</td></tr>
              ) : historico.map((r, i) => (
                <tr
                  key={`${r.dataIso}-${r.prova}-${i}`}
                  style={r.isDuplicado ? {
                    background: corDuplicidade(r.duplicidadeIntensidade),
                    boxShadow: 'inset 3px 0 0 var(--bad)',
                  } : undefined}
                  title={r.isDuplicado
                    ? `⚠ Possível duplicidade: ${r.duplicidadeTotal} lançamentos para a mesma base/criança/prova${r.duplicidadeMaisRecente ? ' — este é o mais recente' : ' — lançamento anterior'}.`
                    : undefined}
                >
                  <td>{r.data}</td>
                  <td>{r.tipo}</td>
                  <td><strong>{r.aluno}</strong></td>
                  <td>{r.base}</td>
                  <td>
                    {r.prova}
                    {r.isDuplicado && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: 'var(--bad)' }}>
                        ⚠ {r.duplicidadeMaisRecente ? 'duplicado (mais recente)' : 'duplicado'}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--c2)' }}>{r.nota}</td>
                  <td style={{ fontSize: 12, opacity: 0.8 }}>{r.observacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
