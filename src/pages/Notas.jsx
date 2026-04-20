import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import { db } from '../api/db'
import { toInputDate, buildBaseLabel } from '../utils/helpers'

// ── Linha vazia padrão ───────────────────────────────────────────
function newRow() {
  return {
    _rid:        crypto.randomUUID(),
    id_membros:  '', // ID Único do Membro
    Membros:     '', // Nome para exibição/mirror
    Nota:        '',
    Comunhao:    '',
    Verso:       '',
    Observacoes: '',
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

  // Ativa tema Soul+ na página inteira quando tipo === 'soul'
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    if (tipo === 'soul') {
      main.classList.add('theme-soul')
    } else {
      main.classList.remove('theme-soul')
    }
    return () => main.classList.remove('theme-soul')
  }, [tipo])

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
        _rid:        crypto.randomUUID(),
        id_membros:  m.id_membros,
        Membros:     m.Membros,
        Nota:        '',
        Comunhao:    '',
        Verso:       '',
        Observacoes: '',
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
      n >= 0 && n <= 99
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
        id_membros:   r.id_membros || null,
        nome_aluno:   r.Membros,
        Membros:      r.Membros,
        nota:         Number(r.Nota),
        Nota:         Number(r.Nota),
        comunhao:     r.Comunhao || null,
        Comunhao:     r.Comunhao || null,
        verso:        r.Verso || null,
        Verso:        r.Verso || null,
        observacoes:  r.Observacoes.trim() || null,
        Observacoes:  r.Observacoes.trim() || null,
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
    statusMsg = 'Adicione pelo menos 1 aluno com nome e nota válida (0–99).'
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={`card section ${tipo === 'soul' ? 'theme-soul' : ''}`}>
      <div className="card-header">
        <div className="card-title">
          {tipo === 'soul' ? '📋 Notas Provinha Soul+' : '📋 Notas BEP Teen'}
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
      <div className="table-wrap staging-table" style={{ marginBottom: 14 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th style={{ minWidth: 190 }}>Aluno *</th>
              <th style={{ width: 110, textAlign: 'center' }}>Nota *<br /><span style={{ fontWeight: 400, fontSize: 10 }}>0 – 99</span></th>
              <th style={{ width: 110, textAlign: 'center' }}>Comunhão</th>
              <th style={{ width: 110, textAlign: 'center' }}>VERSO</th>
              <th style={{ minWidth: 160 }}>Observação</th>
              <th style={{ width: 36 }}></th>
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
                  <input
                    type="number"
                    min={0}
                    max={99}
                    step={1}
                    value={row.Nota}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9.]/g, '')
                      updateRow(row._rid, 'Nota', v)
                    }}
                    placeholder="0–99"
                    style={{ textAlign: 'center' }}
                  />
                </td>

                <td>
                  <SimNao value={row.Comunhao} onChange={e => updateRow(row._rid, 'Comunhao', e.target.value)} />
                </td>

                <td>
                  <SimNao value={row.Verso} onChange={e => updateRow(row._rid, 'Verso', e.target.value)} />
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

// ── Páginas individuais ──────────────────────────────────────────
export default function Notas() {
  return <NotasForm tipo="teen" sheetName="NOTAS" />
}
