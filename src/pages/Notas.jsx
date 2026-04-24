import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import { db } from '../api/db'
import { useAuthStore } from '../store/authStore'
import { toInputDate, buildBaseLabel, fmtDate } from '../utils/helpers'

// ── Linha vazia padrão ───────────────────────────────────────────
function newRow() {
  return {
    _rid:                 crypto.randomUUID(),
    id_membros:           '',
    Membros:              '',
    Nota:                 '',
    Comunhao:             '',
    Verso:                '',
    Discipulado:          '',
    TrezentosTrainamento: '',
    TrezentosEstudo:      '',
    Observacoes:          '',
  }
}

// ── Select Sim / Não reutilizável ────────────────────────────────
function SimNao({ value, onChange, style }) {
  return (
    <select value={value} onChange={onChange} style={{ width: '100%', ...style }}>
      <option value="">—</option>
      <option value="Sim">Sim</option>
      <option value="Não">Não</option>
    </select>
  )
}

// ── Componente principal (reutilizado por Teen e Soul+) ───────────
export function NotasForm({ tipo, sheetName }) {
  const { data: bases }        = useTable('Bases')
  const { data: provas }       = useTable('Provas')
  const { data: todosMembros } = useTable('Membros')
  const qc = useQueryClient()


  const tipoBase  = tipo === 'soul' ? 'Soul+' : 'G148 Teen'
  const tableName = tipo === 'soul' ? 'Notas_Soul' : 'Notas_Teen'
  
  const basesOpts = bases
    .filter(b => b.Tipo === tipoBase)
    .sort((a, b) => buildBaseLabel(a, { includeTipo: true }).localeCompare(buildBaseLabel(b, { includeTipo: true })))

  const provasOpts = provas
    .filter(p => p.tipo === tipoBase)
    .sort((a, b) => {
      const nameA = (a.nome || '').toUpperCase()
      const nameB = (b.nome || '').toUpperCase()
      const isProvaA = nameA.includes('PROVA')
      const isProvaB = nameB.includes('PROVA')
      if (isProvaA && !isProvaB) return 1
      if (!isProvaA && isProvaB) return -1
      return (a.data || '').localeCompare(b.data || '')
    })

  const [meta, setMeta] = useState({
    id_provas:   '',
    data:        '',
    responsavel: '',
    id_base:     '',
    // Campos enriquecidos da view
    Base:        '',
    Regiao:      '',
    Distritos:    '',
    Igrejas:    '',
    id_regiao:   '',
    id_distritos: '',
    id_igrejas:   '',
  })
  const [rows, setRows] = useState([newRow()])

  const setM = (k, v) => setMeta(m => ({ ...m, [k]: v }))

  // ── Membros filtrados pela base escolhida ─
  const membros = todosMembros
    .filter(m => m.id_base === meta.id_base)
    .sort((a, b) => (a.Membros || '').localeCompare(b.Membros || ''))

  // ── Handlers ─────────────────────────────────────────────────
  function handleProvaChange(e) {
    const id = e.target.value
    const prova = provasOpts.find(p => p.id_provas === id)
    setMeta(m => ({ ...m, id_provas: id, data: prova ? toInputDate(prova.data || prova.Data) : '' }))
  }

  function handleBaseChange(e) {
    const id_base = e.target.value
    const base = basesOpts.find(b => b.id_base === id_base)
    setMeta(m => ({
      ...m,
      id_base,
      Base:      base?.Base      || '',
      Regiao:    base?.Regiao    || '',
      Distritos: base?.Distritos || '',
      Igrejas:   base?.Igrejas   || '',
      id_regiao: base?.id_regiao || '',
      id_distritos: base?.id_distritos || '',
      id_igrejas: base?.id_igrejas || '',
    }))

    // Auto-preencher membros da base na tabela
    const membrosDaBase = todosMembros
      .filter(m => m.id_base === id_base)
      .sort((a, b) => (a.Membros || '').localeCompare(b.Membros || ''))

    if (membrosDaBase.length > 0) {
      setRows(membrosDaBase.map(m => ({
        _rid:                 crypto.randomUUID(),
        id_membros:           m.id_membros,
        Membros:              m.Membros,
        Nota:                 '',
        Comunhao:             '',
        Verso:                '',
        Discipulado:          '',
        TrezentosTrainamento: '',
        TrezentosEstudo:      '',
        Observacoes:          '',
      })))
    } else {
      setRows([newRow()])
    }
  }

  function addRows(n = 1) {
    setRows(r => [...r, ...Array.from({ length: n }, newRow)])
  }

  function removeRow(rid) {
    setRows(r => r.filter(row => row._rid !== rid))
  }

  function updateRow(rid, k, v) {
    setRows(r => r.map(row => {
      if (row._rid !== rid) return row
      if (k === 'id_membros') {
        const m = membros.find(mem => mem.id_membros === v)
        return { ...row, id_membros: v, Membros: m?.Membros || '' }
      }
      return { ...row, [k]: v }
    }))
  }

  function handleClear() {
    setMeta({ id_provas: '', data: '', responsavel: '', id_base: '', Base: '', Regiao: '', Distritos: '', Igrejas: '', id_regiao: '', id_distritos: '', id_igrejas: '' })
    setRows([newRow()])
  }

  // ── Validação ─────────────────────────────────────────────────
  function isRowValid(r) {
    const n = Number(r.Nota)
    return (
      r.Membros.trim().length > 0 &&
      r.Nota !== '' &&
      Number.isFinite(n) &&
      n >= 1 && n <= 10
    )
  }

  const validRows = rows.filter(isRowValid)
  const metaOk   = meta.id_provas && meta.data && meta.responsavel.trim() && meta.id_base

  // ── Salvar ────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async () => {
      const prova    = provasOpts.find(p => p.id_provas === meta.id_provas)
      const id_lote  = crypto.randomUUID()

      const dbRows = validRows.map(r => ({
        // Cada aluno precisa de chave própria para evitar colisão de PK.
        id_form:      crypto.randomUUID(),
        id_lote,
        tipo:         tipoBase,
        prova_id:     meta.id_provas || null,
        id_provas:    meta.id_provas,
        base_id:      meta.id_base,
        id_base:      meta.id_base,
        aba:          tipo === 'soul' ? 'NOTAS_SOUL' : 'NOTAS',
        data:         meta.data,
        titulo:       prova?.nome || '',
        responsavel:  meta.responsavel,
        id_regiao:    meta.id_regiao,
        Regiao:       meta.Regiao,
        id_distritos: meta.id_distritos,
        Distritos:    meta.Distritos,
        id_igrejas:   meta.id_igrejas,
        Igrejas:      meta.Igrejas,
        Base:         meta.Base,
        id_membros:            r.id_membros || null,
        nome_aluno:            r.Membros,
        Membros:               r.Membros,
        nota:                  Number(r.Nota),
        Nota:                  Number(r.Nota),
        comunhao:              r.Comunhao || null,
        Comunhao:              r.Comunhao || null,
        verso:                 r.Verso || null,
        Verso:                 r.Verso || null,
        discipulado:           r.Discipulado || null,
        trezentos_treinamento: r.TrezentosTrainamento || null,
        trezentos_estudo:      r.TrezentosEstudo || null,
        observacoes:           r.Observacoes.trim() || null,
        Observacoes:           r.Observacoes.trim() || null,
      }))

      return db.insertNotasForm(dbRows, sheetName, tableName)
    },
    onSuccess: (data) => {
      const n = data.length
      toast.success(`${n} nota${n !== 1 ? 's' : ''} salva${n !== 1 ? 's' : ''}! Base: ${meta.Base}`)
      qc.invalidateQueries({ queryKey: [tableName] })
      handleClear()
    },
    onError: (err) => toast.error(`Erro ao salvar: ${err.message}`),
  })

  // ── Status bar ────────────────────────────────────────────────
  let statusMsg = ''
  let statusClass = ''
  if (metaOk && validRows.length > 0) {
    statusClass = 'ok'
    statusMsg   = `✅ ${validRows.length} aluno${validRows.length !== 1 ? 's' : ''} válido${validRows.length !== 1 ? 's' : ''} — pronto para salvar.`
  } else if (!metaOk) {
    statusMsg = 'Preencha Prova, Data, Responsável e Base para habilitar o envio.'
  } else {
    statusMsg = 'Adicione pelo menos 1 aluno com nome e nota válida (1–10).'
  }

  const isSoul = tipo === 'soul'

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={`card section ${tipo === 'soul' ? 'theme-soul' : ''}`}>
      <div className="card-header">
        <div className="card-title">
          {isSoul ? '📋 Notas Provinha Soul+' : '📋 Notas BEP Teen'}
        </div>
      </div>

      {/* ── Cabeçalho do lote ── */}
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label>Prova *</label>
            <select value={meta.id_provas} onChange={handleProvaChange}>
              <option value="">Selecione a prova…</option>
              {provasOpts.map(p => (
                <option key={p.id_provas} value={p.id_provas}>{p.nome}</option>
              ))}
            </select>
        </div>

        <div className="form-group">
          <label>Data</label>
          <input
            type="date"
            value={meta.data}
            onChange={e => setM('data', e.target.value)}
            readOnly
          />
        </div>

        <div className="form-group">
          <label>Responsável *</label>
          <input
            value={meta.responsavel}
            onChange={e => setM('responsavel', e.target.value)}
            placeholder="Nome de quem está lançando"
          />
        </div>

        <div className="form-group">
          <label>Base *</label>
          <select value={meta.id_base} onChange={handleBaseChange}>
            <option value="">Selecione a base…</option>
            {basesOpts.map(b => (
              <option key={b.id_base} value={b.id_base}>{buildBaseLabel(b, { includeTipo: true })}</option>
            ))}
          </select>
        </div>

        {meta.Regiao && (
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Localização</label>
            <input
              value={`${meta.Regiao}  ›  ${meta.Distritos}  ›  ${meta.Igrejas}`}
              readOnly
              style={{ background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'default' }}
            />
          </div>
        )}
      </div>

      {/* ── Aviso quando base sem membros ── */}
      {meta.id_base && membros.length === 0 && (
        <div className="status-bar warn" style={{ marginBottom: 12 }}>
          ⚠️ Nenhum membro cadastrado nesta base ainda. Você pode digitar o nome manualmente nas linhas abaixo.
        </div>
      )}

      {/* ── Status geral ── */}
      <div className={`status-bar ${statusClass}`} style={{ marginBottom: 12 }}>
        {statusMsg}
      </div>

      {/* ── Botões adicionar linhas ── */}
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-outline btn-sm" onClick={() => addRows(1)}>+ 1 aluno</button>
        <button className="btn btn-outline btn-sm" onClick={() => addRows(5)}>+ 5 alunos</button>
      </div>

      {/* ── Tabela de lançamento ── */}
      <div className="table-wrap staging-table" style={{ marginBottom: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ minWidth: 980 }}>
          <thead>
            {/* Linha 1 — títulos, todos no topo */}
            <tr style={{ verticalAlign: 'bottom' }}>
              <th style={{ width: 32 }}>#</th>
              <th style={{ minWidth: 190 }}>Aluno *</th>
              <th style={{ width: 100, textAlign: 'center' }}>Nota *</th>
              <th style={{ width: 100, textAlign: 'center' }}>Comunhão</th>
              <th style={{ width: 100, textAlign: 'center' }}>VERSO</th>
              <th style={{ width: 100, textAlign: 'center' }}>Discipulado</th>
              <th colSpan={2} style={{ width: 200, textAlign: 'center' }}>300</th>
              <th style={{ minWidth: 150 }}>Observação</th>
              <th style={{ width: 36 }}></th>
            </tr>
            {/* Linha 2 — subtítulos, todos no topo desta linha */}
            <tr style={{ verticalAlign: 'top' }}>
              <th style={{ width: 32 }}></th>
              <th></th>
              <th style={{ textAlign: 'center', fontWeight: 400, fontSize: 11, paddingTop: 2 }}>1 – 10</th>
              <th style={{ textAlign: 'center', fontWeight: 400, fontSize: 11, paddingTop: 2 }}>Aluno nota 1000</th>
              <th></th>
              <th></th>
              <th style={{ width: 100, textAlign: 'center', fontWeight: 400, fontSize: 11, paddingTop: 2 }}>Treinamento</th>
              <th style={{ width: 100, textAlign: 'center', fontWeight: 400, fontSize: 11, paddingTop: 2 }}>Est. Bíblico</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row._rid}>
                <td>
                  <span className="row-num">{String(i + 1).padStart(2, '0')}</span>
                </td>

                {/* Aluno — select se tiver membros, input se não tiver */}
                <td>
                  {membros.length > 0 ? (
                    <select
                      value={row.id_membros}
                      onChange={e => updateRow(row._rid, 'id_membros', e.target.value)}
                      style={{ minWidth: 180 }}
                    >
                      <option value="">Selecione o aluno…</option>
                      {membros.map(m => (
                        <option key={m.id_membros} value={m.id_membros}>{m.Membros}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={row.Membros}
                      onChange={e => updateRow(row._rid, 'Membros', e.target.value)}
                      placeholder="Nome do aluno"
                      style={{ minWidth: 180 }}
                    />
                  )}
                </td>

                <td>
                  <select
                    value={row.Nota}
                    onChange={e => updateRow(row._rid, 'Nota', e.target.value)}
                    style={{ textAlign: 'center', width: '100%' }}
                  >
                    <option value="">—</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </td>

                <td>
                  <SimNao value={row.Comunhao} onChange={e => updateRow(row._rid, 'Comunhao', e.target.value)} />
                </td>

                <td>
                  <SimNao value={row.Verso} onChange={e => updateRow(row._rid, 'Verso', e.target.value)} />
                </td>

                <td>
                  <SimNao value={row.Discipulado} onChange={e => updateRow(row._rid, 'Discipulado', e.target.value)} />
                </td>

                <td>
                  <SimNao value={row.TrezentosTrainamento} onChange={e => updateRow(row._rid, 'TrezentosTrainamento', e.target.value)} />
                </td>

                <td>
                  <SimNao value={row.TrezentosEstudo} onChange={e => updateRow(row._rid, 'TrezentosEstudo', e.target.value)} />
                </td>

                <td>
                  <input
                    value={row.Observacoes}
                    onChange={e => updateRow(row._rid, 'Observacoes', e.target.value)}
                    placeholder="Observação livre…"
                  />
                </td>

                <td>
                  <button
                    className="btn-icon danger"
                    onClick={() => removeRow(row._rid)}
                    title="Remover linha"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Ações ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-outline" onClick={handleClear}>
          Limpar tudo
        </button>
        <button
          className="btn btn-primary"
          onClick={() => save.mutate()}
          disabled={save.isPending || !metaOk || validRows.length === 0}
        >
          {save.isPending
            ? <><span className="spinner" /> Salvando…</>
            : `💾 Salvar ${validRows.length > 0 ? validRows.length : ''} nota${validRows.length !== 1 ? 's' : ''}`
          }
        </button>
      </div>
    </div>
  )
}

function NotasHistorico({ tipo, tableName }) {
  const { data: bases }  = useTable('Bases')
  const { data: provas } = useTable('Provas')
  const [filtros, setFiltros] = useState({ id_base: '', id_provas: '' })

  const tipoBase = tipo === 'soul' ? 'Soul+' : 'G148 Teen'
  const { data: notas = [], isLoading } = useQuery({
    queryKey: [tableName, 'all'],
    queryFn: () => db.getAll(tableName)
  })

  const filtered = useMemo(() => {
    const selectedBase  = filtros.id_base   ? (bases  || []).find(b => b.id_base   === filtros.id_base)   : null
    const selectedProva = filtros.id_provas ? (provas || []).find(p => p.id_provas === filtros.id_provas) : null

    return notas.filter(n => {
      if (filtros.id_base && selectedBase) {
        const noteBaseId   = String(n.id_base ?? n.base_id ?? '').trim()
        const noteBaseName = String(n.Base    ?? n.base    ?? '').trim()
        const matchById   = noteBaseId   && noteBaseId   === String(filtros.id_base).trim()
        const matchByName = noteBaseName && noteBaseName === String(selectedBase.Base ?? '').trim()
        if (!matchById && !matchByName) return false
      }

      if (filtros.id_provas && selectedProva) {
        const noteProvaId    = String(n.id_provas ?? n.prova_id ?? '').trim()
        const noteProvaTitulo = String(n.titulo   ?? n.Titulo   ?? '').trim()
        const provaNome      = String(selectedProva.nome ?? selectedProva.Provas ?? '').trim()
        const matchById   = noteProvaId    && noteProvaId    === String(filtros.id_provas).trim()
        const matchByName = noteProvaTitulo && provaNome && noteProvaTitulo === provaNome
        if (!matchById && !matchByName) return false
      }

      return true
    }).sort((a, b) => {
      const da = a.data || a.Data || ''
      const db2 = b.data || b.Data || ''
      return db2.localeCompare(da)
    })
  }, [notas, filtros, bases, provas])

  return (
    <div className={`card section ${tipo === 'soul' ? 'theme-soul' : ''}`} style={{ marginTop: 24 }}>
      <div className="card-header"><div className="card-title">🔍 Consulta de Notas Lançadas ({tipoBase})</div></div>
      <div className="card-body">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label>Filtrar por Base</label>
            <select value={filtros.id_base} onChange={e => setFiltros(f => ({ ...f, id_base: e.target.value }))}>
              <option value="">Todas as bases…</option>
              {(bases || [])
                .filter(b => b.Tipo === tipoBase)
                .sort((a, b) => (a.Base || '').localeCompare(b.Base || ''))
                .map(b => (
                  <option key={b.id_base} value={b.id_base}>{b.Base}</option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label>Filtrar por Prova</label>
            <select value={filtros.id_provas} onChange={e => setFiltros(f => ({ ...f, id_provas: e.target.value }))}>
              <option value="">Todas as provas…</option>
              {(provas || [])
                .filter(p => p.tipo === tipoBase)
                .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                .map(p => (
                  <option key={p.id_provas} value={p.id_provas}>{p.nome}</option>
                ))}
            </select>
          </div>
        </div>

        {isLoading ? <div className="spinner" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Aluno</th>
                  <th>Base</th>
                  <th>Prova</th>
                  <th style={{ textAlign: 'center' }}>Nota</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>Nenhum registro encontrado com estes filtros.</td></tr>
                ) : filtered.map(n => (
                  <tr key={n.id}>
                    <td style={{ fontSize: 12 }}>{fmtDate(n.data || n.Data)}</td>
                    <td style={{ fontWeight: 600 }}>{n.nome_aluno || n.Membros}</td>
                    <td style={{ fontSize: 12 }}>{n.Base}</td>
                    <td style={{ fontSize: 12 }}>{n.titulo || n.id_provas}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--c2)' }}>{n.nota ?? n.Nota}</td>
                    <td style={{ fontSize: 11, opacity: 0.7 }}>{n.observacoes || n.Observacoes || '—'}</td>
                    <td>
                      <button className="btn-icon" onClick={() => alert('Função de correção em desenvolvimento para este histórico.')} title="Corrigir nota">✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>{filtered.length} registro{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Páginas individuais ──────────────────────────────────────────
export default function Notas() {
  const { type } = useParams()
  const currentType = type === 'soul' ? 'soul' : 'teen'
  const tableName = currentType === 'soul' ? 'Notas_Soul' : 'Notas_Teen'
  
  return (
    <>
      <NotasForm tipo={currentType} sheetName={currentType.toUpperCase()} />
      <NotasHistorico tipo={currentType} tableName={tableName} />
    </>
  )
}
