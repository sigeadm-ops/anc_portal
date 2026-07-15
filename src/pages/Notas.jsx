import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useTable } from '../hooks/useTable'
import { db } from '../api/db'
import { useAuthStore } from '../store/authStore'
import { toInputDate, buildBaseLabel, fmtDate } from '../utils/helpers'
import { marcarDuplicados, corDuplicidade } from '../utils/duplicidade'

function getLastSaturdayIso(ref = new Date()) {
  const d = new Date(ref)
  d.setHours(12, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 6 ? 0 : (day + 1)
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

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
  const { data: bases = [] }        = useTable('Bases')
  const { data: provas = [] }       = useTable('Provas')
  const { data: todosMembros = [] } = useTable('Membros')
  const { isAdmin, isAuditMode } = useAuthStore()
  const qc = useQueryClient()

  function invalidateRankingCaches() {
    qc.invalidateQueries({ queryKey: ['ranking_notas'] })
    qc.invalidateQueries({ queryKey: ['ranking_registros'] })
    qc.invalidateQueries({ queryKey: ['ranking_marcos'] })
  }


  const isSoul   = tipo === 'soul'
  const tipoBase  = tipo === 'soul' ? 'Soul+' : 'G148 Teen'
  const tableName = tipo === 'soul' ? 'Notas_Soul' : 'Notas_Teen'

  function toIsoOnlyDate(value) {
    if (!value) return ''
    return toInputDate(value)
  }

  function getProvaId(p) {
    return p?.id_provas ?? p?.id
  }

  function getNextSaturdayIso(ref = new Date()) {
    const d = new Date(ref)
    d.setHours(12, 0, 0, 0)
    const day = d.getDay()
    const diff = day === 6 ? 7 : (6 - day)
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0, 10)
  }

  const canSeeAllProvas = isAdmin || isAuditMode
  const lastSaturdayIso = useMemo(() => getLastSaturdayIso(), [])
  const nextSaturdayIso = useMemo(() => getNextSaturdayIso(), [])
  
  const basesOpts = (bases || [])
    .filter(b => b.Tipo === tipoBase)
    .sort((a, b) => buildBaseLabel(a, { includeTipo: true }).localeCompare(buildBaseLabel(b, { includeTipo: true })))

  const provasOpts = (provas || [])
    .filter(p => p.tipo === tipoBase)
    .filter(p => {
      if (canSeeAllProvas) return true
      const provaDateIso = toIsoOnlyDate(p.data || p.Data)
      if (!provaDateIso) return false
      return provaDateIso <= lastSaturdayIso
    })
    .sort((a, b) => {
      const dateA = toIsoOnlyDate(a.data || a.Data) || '9999-12-31'
      const dateB = toIsoOnlyDate(b.data || b.Data) || '9999-12-31'
      const cmpDate = dateA.localeCompare(dateB)
      if (cmpDate !== 0) return cmpDate
      return (a.nome || '').localeCompare(b.nome || '')
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

  const anoDisc = useMemo(() => {
    const source = meta.data || new Date().toISOString().slice(0, 10)
    return Number(String(source).slice(0, 4))
  }, [meta.data])

  const { data: cartoesDiscipulado = [] } = useQuery({
    queryKey: ['discipulos_cartoes_notas', meta.id_base, anoDisc],
    queryFn: () => db.getDiscipulosCartoes(meta.id_base, anoDisc, null),
    enabled: Boolean(meta.id_base && anoDisc),
  })

  const { data: status300ByMembro = {} } = useQuery({
    queryKey: ['notas_300_status', meta.id_base, tipoBase, meta.data],
    queryFn: () => db.getMembrosCom300Concluido(meta.id_base, tipoBase, meta.data),
    enabled: Boolean(meta.id_base),
  })

  // Notas já lançadas para essa mesma base+prova+data — evita lançar a
  // mesma turma duas vezes sem perceber (cada envio cria linhas novas).
  const { data: notasExistentes = [] } = useQuery({
    queryKey: ['notas_existentes', tableName, meta.id_base, meta.id_provas, meta.data],
    queryFn: () => db.getNotasExistentes(tableName, { id_base: meta.id_base, id_provas: meta.id_provas, data: meta.data }),
    enabled: Boolean(meta.id_base && meta.id_provas && meta.data),
  })

  // Duplicidade = mesma base + mesma criança + mesmo registro de prova, em
  // QUALQUER prova/data já lançada nessa base — aparece assim que a base é
  // escolhida, sem precisar selecionar a prova específica. O lançamento
  // mais recente (lancado_em) fica em vermelho mais intenso.
  const { data: notasDaBase = [] } = useQuery({
    queryKey: ['notas_por_base', tableName, meta.id_base],
    queryFn: () => db.getNotasPorBase(tableName, meta.id_base),
    enabled: Boolean(meta.id_base),
  })

  const duplicadosNaBase = useMemo(() => {
    const marcados = marcarDuplicados(notasDaBase, {
      keyOf: n => {
        const idProva = n.id_provas ?? n.prova_id
        return (n.id_membros && idProva) ? `${n.id_membros}|${idProva}` : null
      },
      timeOf: n => n.lancado_em || n.created_at,
      dataOf: n => n.data || n.Data,
    })
    return marcados
      .filter(n => n.isDuplicado)
      .sort((a, b) => {
        const ka = `${a.id_membros}|${a.id_provas ?? a.prova_id}`
        const kb = `${b.id_membros}|${b.id_provas ?? b.prova_id}`
        return ka.localeCompare(kb) || String(a.lancado_em || '').localeCompare(String(b.lancado_em || ''))
      })
  }, [notasDaBase])

  function hasRequiredCardMeta(card) {
    // Basta ter data_inicio para o cartão ser considerado válido para notas
    return Boolean(card?.data_inicio)
  }

  function isCardActiveForDate(card, dateIso) {
    if (!hasRequiredCardMeta(card) || !dateIso) return false
    const checkDate = String(dateIso).slice(0, 10)
    const start = String(card.data_inicio).slice(0, 10)
    const end = card.data_fim ? String(card.data_fim).slice(0, 10) : null
    if (checkDate < start) return false
    if (end && checkDate > end) return false
    return true
  }

  const activeDiscipuladoByMembro = useMemo(() => {
    const map = {}
    cartoesDiscipulado.forEach((card) => {
      const membroId = String(card?.membro_id ?? '').trim()
      if (!membroId) return
      if (!isCardActiveForDate(card, meta.data || new Date().toISOString().slice(0, 10))) return
      map[membroId] = true
    })
    return map
  }, [cartoesDiscipulado, meta.data])

  const setM = (k, v) => setMeta(m => ({ ...m, [k]: v }))

  // ── Membros filtrados pela base escolhida ─
  const membros = (todosMembros || [])
    .filter(m => m.id_base === meta.id_base)
    .sort((a, b) => (a.Membros || '').localeCompare(b.Membros || ''))

  // ── Handlers ─────────────────────────────────────────────────
  function handleProvaChange(e) {
    const id = e.target.value
    const prova = provasOpts.find(p => getProvaId(p) === id)
    setMeta(m => ({ ...m, id_provas: id, data: prova ? toIsoOnlyDate(prova.data || prova.Data) : '' }))
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
    const membrosDaBase = (todosMembros || [])
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
        const membroKey = String(v ?? '').trim()
        const discipuladoValido = activeDiscipuladoByMembro[membroKey]
        const status300 = status300ByMembro[membroKey] || { treinamento: false, estudo: false }
        return {
          ...row,
          id_membros: v,
          Membros: m?.Membros || '',
          Discipulado: discipuladoValido ? 'Sim' : 'Não',
          TrezentosTrainamento: status300.treinamento ? 'Sim' : row.TrezentosTrainamento,
          TrezentosEstudo: status300.estudo ? 'Sim' : row.TrezentosEstudo,
        }
      }
      return { ...row, [k]: v }
    }))
  }

  useEffect(() => {
    setRows((current) => current.map((row) => {
      const membroId = String(row.id_membros ?? '').trim()
      const discipuladoAtivo = activeDiscipuladoByMembro[membroId]
      const status300 = status300ByMembro[membroId] || { treinamento: false, estudo: false }

      let next = row

      // Discipulado é estritamente binário: Sim se cartão ativo nesta data, Não caso contrário
      const novoDisc = discipuladoAtivo ? 'Sim' : (membroId ? 'Não' : row.Discipulado)
      if (novoDisc !== row.Discipulado) {
        next = { ...next, Discipulado: novoDisc }
      }

      if (status300.treinamento && next.TrezentosTrainamento !== 'Sim') {
        next = { ...next, TrezentosTrainamento: 'Sim' }
      }
      if (status300.estudo && next.TrezentosEstudo !== 'Sim') {
        next = { ...next, TrezentosEstudo: 'Sim' }
      }

      return next
    }))
  }, [activeDiscipuladoByMembro, status300ByMembro])

  function handleClear() {
    setMeta({ id_provas: '', data: '', responsavel: '', id_base: '', Base: '', Regiao: '', Distritos: '', Igrejas: '', id_regiao: '', id_distritos: '', id_igrejas: '' })
    setRows([newRow()])
  }

  // ── Validação ─────────────────────────────────────────────────
  const provaSelecionada = provasOpts.find(p => getProvaId(p) === meta.id_provas)
  const nomeProvaSelecionada = String(provaSelecionada?.nome || '').toLowerCase()
  const soulExigeNota = isSoul && /\bprova\b|prova\s*bonus|b[oô]nus/.test(nomeProvaSelecionada)
  const isRegistroSemanal = isSoul && meta.id_provas !== '' && /\bregistro\b/i.test(nomeProvaSelecionada)

  function hasWeeklySoulAnswers(r) {
    return [
      r.Comunhao,
      r.Verso,
      r.Discipulado,
      r.TrezentosTrainamento,
      r.TrezentosEstudo,
    ].some(v => String(v || '').trim() !== '')
  }

  function isRowValid(r) {
    if (r.Membros.trim().length === 0) return false

    const temNota = String(r.Nota ?? '').trim() !== ''
    const n = Number(r.Nota)
    const notaValida = temNota && Number.isFinite(n) && n >= 1 && n <= 10

    if (soulExigeNota) return notaValida
    if (isSoul) return hasWeeklySoulAnswers(r) || notaValida

    return notaValida
  }

  const validRows = rows.filter(isRowValid)
  const metaOk   = meta.id_provas && meta.data && meta.responsavel.trim() && meta.id_base
  const taskGroupLabel = isSoul ? 'Soul Task' : '300'
  const taskTrainLabel = isSoul ? 'Soul Task Trein.' : '300 Trein.'
  const taskStudyLabel = isSoul ? 'Soul Task Est.' : '300 Est.'

  // ── Salvar ────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async () => {
      const prova    = provasOpts.find(p => getProvaId(p) === meta.id_provas)
      const id_lote  = crypto.randomUUID()

      const dbRows = validRows.map(r => {
        const notaInformada = String(r.Nota ?? '').trim() !== ''
        const notaNumber = notaInformada ? Number(r.Nota) : null
        return {
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
          nota:                  notaNumber,
          Nota:                  notaNumber,
          comunhao:              r.Comunhao || null,
          Comunhao:              r.Comunhao || null,
          verso:                 r.Verso || null,
          Verso:                 r.Verso || null,
          discipulado:           r.Discipulado || null,
          trezentos_treinamento: r.TrezentosTrainamento || null,
          trezentos_estudo:      r.TrezentosEstudo || null,
          observacoes:           r.Observacoes.trim() || null,
          Observacoes:           r.Observacoes.trim() || null,
        }
      })

      const saved = await db.insertNotasForm(dbRows, sheetName, tableName)
      let desafiosSyncError = null

      try {
        await db.syncDesafiosAdministrativosFromNotas({
          base_id: meta.id_base,
          tipo: tipoBase,
          data_sabado: meta.data,
          rows: dbRows,
          responsavel: meta.responsavel,
        })
      } catch (error) {
        desafiosSyncError = error
        console.warn('[Notas] Falha ao sincronizar desafios automaticamente apos salvar notas.', error)
      }

      return { saved, desafiosSyncError }
    },
    onSuccess: ({ saved, desafiosSyncError }) => {
      const n = saved.length
      toast.success(`${n} nota${n !== 1 ? 's' : ''} salva${n !== 1 ? 's' : ''}! Base: ${meta.Base}`)
      if (desafiosSyncError) {
        toast((t) => (
          <span>
            Notas salvas, mas a sincronizacao automatica dos desafios falhou. Reabra a tela de desafios para reenviar.
          </span>
        ), { icon: '⚠️', duration: 6000 })
      }
      qc.invalidateQueries({ queryKey: [tableName] })
      qc.invalidateQueries({ queryKey: ['desafios_registros'] })
      qc.invalidateQueries({ queryKey: ['desafios_registros_ano'] })
      invalidateRankingCaches()
      handleClear()
    },
    onError: (err) => toast.error(`Erro ao salvar: ${err.message}`),
  })

  function handleSalvar() {
    if (notasExistentes.length > 0) {
      const nomes = [...new Set(notasExistentes.map(n => n.Membros).filter(Boolean))]
      const responsaveis = [...new Set(notasExistentes.map(n => n.responsavel).filter(Boolean))]
      const continuar = confirm(
        `Essa prova já tem ${notasExistentes.length} nota${notasExistentes.length !== 1 ? 's' : ''} lançada${notasExistentes.length !== 1 ? 's' : ''} para essa base e data` +
        (responsaveis.length ? ` (por ${responsaveis.join(', ')})` : '') +
        (nomes.length ? `:\n${nomes.slice(0, 10).join(', ')}${nomes.length > 10 ? '…' : ''}` : '') +
        `\n\nSalvar de novo vai CRIAR notas adicionais, não substituir as existentes — pode gerar duplicidade. Deseja continuar mesmo assim?`
      )
      if (!continuar) return
    }
    save.mutate()
  }

  // ── Status bar ────────────────────────────────────────────────
  let statusMsg = ''
  let statusClass = ''
  if (metaOk && validRows.length > 0) {
    statusClass = 'ok'
    statusMsg   = `✅ ${validRows.length} aluno${validRows.length !== 1 ? 's' : ''} válido${validRows.length !== 1 ? 's' : ''} — pronto para salvar.`
  } else if (!metaOk) {
    statusMsg = 'Preencha Prova, Data, Responsável e Base para habilitar o envio.'
  } else if (soulExigeNota) {
    statusMsg = 'Para Prova/Prova Bônus no Soul+, informe nota válida (1–10).'
  } else if (isSoul) {
    statusMsg = 'No Soul+ semanal, registre as colunas de acompanhamento (Comunhão, Verso, Discipulado e Soul Task).'
  } else {
    statusMsg = 'Adicione pelo menos 1 aluno com nome e nota válida (1–10).'
  }

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
          <label>{isSoul ? 'Semana *' : 'Prova *'}</label>
            <select value={meta.id_provas} onChange={handleProvaChange}>
              <option value="">{isSoul ? 'Selecione a semana…' : 'Selecione a prova…'}</option>
              {(() => {
                const provasComNota = new Set(
                  notasDaBase.map(n => String(n.id_provas ?? n.prova_id ?? '')).filter(Boolean)
                )
                return provasOpts.map(p => {
                  const id = String(getProvaId(p))
                  const jaLancado = provasComNota.has(id)
                  return (
                    <option key={id} value={id}>
                      {jaLancado ? '✓ ' : ''}{p.nome}{toIsoOnlyDate(p.data || p.Data) ? ` - ${fmtDate(toIsoOnlyDate(p.data || p.Data))}` : ''}{jaLancado ? ' (✓ já lançado)' : ''}
                    </option>
                  )
                })
              })()}
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

      {/* ── Duplicidade na base inteira: aparece direto ao escolher a base,
          antes mesmo de selecionar a prova — mesma criança + mesma prova
          lançada 2x ou mais, em qualquer data. ── */}
      {duplicadosNaBase.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: 12, overflowX: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bad)', marginBottom: 6 }}>
            ⚠ Duplicidade nesta base: {duplicadosNaBase.length} lançamento{duplicadosNaBase.length !== 1 ? 's' : ''} repetido{duplicadosNaBase.length !== 1 ? 's' : ''} (mesma criança + mesma prova). Vermelho mais intenso = lançamento mais recente:
          </div>
          <table style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>Criança</th>
                <th>Prova</th>
                <th style={{ textAlign: 'center' }}>Nota</th>
                <th>Data</th>
                <th>Responsável</th>
                <th>Lançado em</th>
              </tr>
            </thead>
            <tbody>
              {duplicadosNaBase.map(n => (
                <tr
                  key={n.id}
                  style={{ background: corDuplicidade(n.duplicidadeIntensidade), boxShadow: 'inset 3px 0 0 var(--bad)' }}
                  title={n.duplicidadeMaisRecente ? 'Lançamento mais recente' : 'Lançamento anterior (possível duplicidade)'}
                >
                  <td>
                    <strong>{n.Membros || '—'}</strong>
                    {n.duplicidadeMaisRecente && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: 'var(--bad)' }}>mais recente</span>
                    )}
                  </td>
                  <td>{n.titulo || n.Titulo || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{n.Nota ?? n.nota ?? '—'}</td>
                  <td>{fmtDate(toInputDate(n.data || n.Data)) || '—'}</td>
                  <td>{n.responsavel || '—'}</td>
                  <td>{(n.lancado_em || n.created_at) ? new Date(n.lancado_em || n.created_at).toLocaleString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Aviso quando essa prova+base+data já tem notas lançadas ── */}
      {notasExistentes.length > 0 && (
        <div style={{
          marginBottom: 12, padding: '12px 16px', borderRadius: 8,
          background: 'rgba(255,60,60,.12)', border: '2px solid var(--bad)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🚫</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--bad)', marginBottom: 4 }}>
              ATENÇÃO — Essa prova já foi lançada para esta base!
            </div>
            <div style={{ fontSize: 13 }}>
              {notasExistentes.length} nota{notasExistentes.length !== 1 ? 's' : ''} já registrada{notasExistentes.length !== 1 ? 's' : ''}{' '}
              {[...new Set(notasExistentes.map(n => n.responsavel).filter(Boolean))].length > 0
                ? `por ${[...new Set(notasExistentes.map(n => n.responsavel).filter(Boolean))].join(', ')}`
                : ''}.{' '}
              Salvar novamente vai <strong>criar notas duplicadas</strong>.
              Para corrigir um lançamento, use a tela de <strong>Relatórios</strong>.
            </div>
          </div>
        </div>
      )}

      {/* ── Aviso quando base sem membros ── */}
      {meta.id_base && membros.length === 0 && (
        <div className="status-bar warn" style={{ marginBottom: 12 }}>
          ⚠️ Nenhum membro cadastrado nesta base ainda. Você pode digitar o nome manualmente nas linhas abaixo.
        </div>
      )}

      {!canSeeAllProvas && (
        <div className="status-bar" style={{ marginBottom: 12 }}>
          Provas liberadas até <strong>{fmtDate(lastSaturdayIso)}</strong>. A próxima liberação será em <strong>{fmtDate(nextSaturdayIso)}</strong>.
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
              <th style={{ width: 120, textAlign: 'center' }}>Discipulado</th>
              <th colSpan={2} style={{ width: 200, textAlign: 'center' }}>{taskGroupLabel}</th>
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
              <th style={{ textAlign: 'center', fontWeight: 400, fontSize: 11, paddingTop: 2, lineHeight: 1.3 }}>Requer cartão com<br />depto. e data de início</th>
              <th style={{ width: 100, textAlign: 'center', fontWeight: 400, fontSize: 11, paddingTop: 2 }}>Treinamento</th>
              <th style={{ width: 100, textAlign: 'center', fontWeight: 400, fontSize: 11, paddingTop: 2 }}>{isSoul ? 'Estudo' : 'Est. Bíblico'}</th>
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
                    style={{ textAlign: 'center', width: '100%', opacity: isRegistroSemanal ? 0.35 : 1 }}
                    disabled={isRegistroSemanal}
                    title={isRegistroSemanal ? 'Nota não se aplica a semanas de Registro' : undefined}
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

                <td style={{ textAlign: 'center' }}>
                  {row.id_membros ? (
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 6,
                      fontSize: 12, fontWeight: 700,
                      background: row.Discipulado === 'Sim' ? 'rgba(56,242,163,.18)' : 'rgba(255,255,255,.07)',
                      color: row.Discipulado === 'Sim' ? 'var(--good)' : 'var(--muted)',
                      border: `1px solid ${row.Discipulado === 'Sim' ? 'var(--good)' : 'rgba(255,255,255,.15)'}`,
                    }}>
                      {row.Discipulado === 'Sim' ? '✅ Sim' : '❌ Não'}
                    </span>
                  ) : <span style={{ opacity: 0.3 }}>—</span>}
                </td>

                <td>
                  <SimNao
                    value={row.TrezentosTrainamento}
                    onChange={e => updateRow(row._rid, 'TrezentosTrainamento', e.target.value)}
                    style={row.TrezentosTrainamento === 'Sim' ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
                  />
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
          onClick={handleSalvar}
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
  const { isAdmin, isAuditMode } = useAuthStore()
  const qc = useQueryClient()

  function invalidateRankingCaches() {
    qc.invalidateQueries({ queryKey: ['ranking_notas'] })
    qc.invalidateQueries({ queryKey: ['ranking_registros'] })
    qc.invalidateQueries({ queryKey: ['ranking_marcos'] })
  }
  const [filtros, setFiltros]           = useState({ id_base: '', id_provas: '' })
  const [activeFiltros, setActiveFiltros] = useState({ id_base: '', id_provas: '' })
  const [isFetching, setIsFetching]     = useState(false)
  const [editId, setEditId]   = useState(null)
  const [editData, setEditData] = useState({})

  const tipoBase        = tipo === 'soul' ? 'Soul+' : 'G148 Teen'
  const taskTrainLabel  = tipo === 'soul' ? 'Soul Task Trein.' : '300 Trein.'
  const taskStudyLabel  = tipo === 'soul' ? 'Soul Task Est.' : '300 Est.'
  const canSeeAllProvas = isAdmin || isAuditMode
  const lastSaturdayIso = useMemo(() => getLastSaturdayIso(), [])

  const provasFiltradas = useMemo(() => (provas || [])
    .filter(p => p.tipo === tipoBase)
    .filter(p => {
      if (canSeeAllProvas) return true
      const d = toInputDate(p.data || p.Data)
      return d && d <= lastSaturdayIso
    })
    .sort((a, b) => {
      const dA = toInputDate(a.data || a.Data) || '0000-00-00'
      const dB = toInputDate(b.data || b.Data) || '0000-00-00'
      return dB.localeCompare(dA)
    })
  , [provas, tipoBase, canSeeAllProvas, lastSaturdayIso])

  const { data: notas = [], isLoading, isError, refetch } = useQuery({
    queryKey: [tableName, 'all'],
    queryFn: () => db.getAll(tableName),
    retry: 2,
  })

  async function handlePesquisar() {
    setIsFetching(true)
    try {
      qc.removeQueries({ queryKey: [tableName] })
      await refetch()
      setActiveFiltros({ ...filtros })
    } finally {
      setIsFetching(false)
    }
  }

  const filtered = useMemo(() => {
    const selectedBase  = activeFiltros.id_base   ? (bases  || []).find(b => b.id_base   === activeFiltros.id_base)   : null
    const selectedProva = activeFiltros.id_provas ? (provas || []).find(p => p.id_provas === activeFiltros.id_provas) : null

    return notas.filter(n => {
      if (activeFiltros.id_base) {
        const noteBaseId   = String(n.id_base ?? n.base_id ?? '').trim()
        const noteBaseName = String(n.Base    ?? n.base    ?? '').trim()
        const filterBaseId = String(activeFiltros.id_base).trim()
        const matchById    = noteBaseId !== '' && noteBaseId === filterBaseId
        const matchByName  = selectedBase
          ? noteBaseName !== '' && noteBaseName === String(selectedBase.Base ?? '').trim()
          : false
        if (!matchById && !matchByName) return false
      }

      if (activeFiltros.id_provas) {
        const noteProvaId     = String(n.id_provas ?? n.prova_id ?? '').trim()
        const noteProvaTitulo = String(n.titulo    ?? n.Titulo   ?? '').trim()
        const filterProvaId   = String(activeFiltros.id_provas).trim()
        const provaNome       = selectedProva
          ? String(selectedProva.nome ?? selectedProva.Provas ?? '').trim()
          : ''
        const matchById   = noteProvaId     !== '' && noteProvaId   === filterProvaId
        const matchByName = noteProvaTitulo !== '' && provaNome !== '' && noteProvaTitulo === provaNome
        if (!matchById && !matchByName) return false
      }

      return true
    }).sort((a, b) => {
      const da  = a.data || a.Data || ''
      const db2 = b.data || b.Data || ''
      return db2.localeCompare(da)
    })
  }, [notas, activeFiltros, bases, provas])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.updateNota(tableName, id, data),
    onSuccess: () => {
      toast.success('Nota atualizada!')
      qc.invalidateQueries({ queryKey: [tableName] })
      invalidateRankingCaches()
      setEditId(null)
      setEditData({})
    },
    onError: (err) => toast.error(`Erro ao atualizar: ${err.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: async (nota) => {
      await db.delete(tableName, nota.id)

      const baseId = nota.id_base ?? nota.base_id
      const dataSabado = nota.data ?? nota.Data
      if (!baseId || !dataSabado) return true

      const baseNome = nota.Base ?? nota.base ?? ''
      const rows = tipo === 'soul'
        ? await db.getNotasSoulPorBaseETrimestre(baseId, dataSabado, dataSabado, baseNome)
        : await db.getNotasTeenPorBaseETrimestre(baseId, dataSabado, dataSabado, baseNome)

      await db.syncDesafiosAdministrativosFromNotas({
        base_id: baseId,
        tipo: tipoBase,
        data_sabado: dataSabado,
        rows,
        responsavel: nota.responsavel ?? nota.Responsavel ?? null,
      })

      return true
    },
    onSuccess: () => {
      toast.success('Nota excluída.')
      qc.invalidateQueries({ queryKey: [tableName] })
      qc.invalidateQueries({ queryKey: ['desafios_registros'] })
      qc.invalidateQueries({ queryKey: ['desafios_registros_ano'] })
      invalidateRankingCaches()
    },
    onError: (err) => toast.error(`Erro ao excluir: ${err.message}`),
  })

  function confirmDelete(nota) {
    const aluno = nota.nome_aluno || nota.Membros || 'aluno'
    const prova = nota.titulo || nota.id_provas || 'prova'
    if (window.confirm(`Excluir nota de "${aluno}" — ${prova}?\n\nEsta ação não pode ser desfeita.`)) {
      deleteMutation.mutate(nota)
    }
  }

  function startEdit(nota) {
    setEditId(nota.id)
    setEditData({
      nota:                  nota.nota  ?? nota.Nota  ?? '',
      Nota:                  nota.nota  ?? nota.Nota  ?? '',
      comunhao:              nota.comunhao  ?? nota.Comunhao  ?? '',
      Comunhao:              nota.comunhao  ?? nota.Comunhao  ?? '',
      verso:                 nota.verso ?? nota.Verso ?? '',
      Verso:                 nota.verso ?? nota.Verso ?? '',
      discipulado:           nota.discipulado ?? '',
      trezentos_treinamento: nota.trezentos_treinamento ?? '',
      trezentos_estudo:      nota.trezentos_estudo ?? '',
      observacoes:           nota.observacoes ?? nota.Observacoes ?? '',
      Observacoes:           nota.observacoes ?? nota.Observacoes ?? '',
    })
  }

  function setE(k, v) {
    setEditData(d => {
      const paired = { nota: 'Nota', Nota: 'nota', comunhao: 'Comunhao', Comunhao: 'comunhao', verso: 'Verso', Verso: 'verso', observacoes: 'Observacoes', Observacoes: 'observacoes' }
      return paired[k] ? { ...d, [k]: v, [paired[k]]: v } : { ...d, [k]: v }
    })
  }

  return (
    <div className={`card section ${tipo === 'soul' ? 'theme-soul' : ''}`} style={{ marginTop: 24 }}>
      <div className="card-header"><div className="card-title">🔍 Consulta de Notas Lançadas ({tipoBase})</div></div>
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div className="form-group" style={{ margin: 0, minWidth: 200, flex: 1 }}>
            <label>Filtrar por Base</label>
            <select value={filtros.id_base} onChange={e => setFiltros(f => ({ ...f, id_base: e.target.value, id_provas: '' }))}>
              <option value="">Todas as bases…</option>
              {(bases || [])
                .filter(b => b.Tipo === tipoBase)
                .sort((a, b) => (a.Base || '').localeCompare(b.Base || ''))
                .map(b => (
                  <option key={b.id_base} value={b.id_base}>{b.Base}</option>
                ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 200, flex: 1 }}>
            <label>Filtrar por Prova</label>
            <select value={filtros.id_provas} onChange={e => setFiltros(f => ({ ...f, id_provas: e.target.value }))}>
              <option value="">Todas as provas…</option>
              {provasFiltradas.map(p => (
                <option key={p.id_provas} value={p.id_provas}>
                  {p.nome}{toInputDate(p.data || p.Data) ? ` - ${fmtDate(toInputDate(p.data || p.Data))}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flexShrink: 0 }}>
            <label style={{ visibility: 'hidden', display: 'block' }}>.</label>
            <button
              className="btn btn-primary"
              onClick={handlePesquisar}
              disabled={isFetching}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isFetching ? '⏳ Buscando…' : '🔍 Pesquisar'}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ opacity: 0.5, fontSize: 13 }}>Carregando notas…</p>
          </div>
        ) : isError ? (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <p style={{ opacity: 0.6, marginBottom: 12 }}>Não foi possível carregar os dados.</p>
            <button className="btn btn-outline btn-sm" onClick={() => refetch()}>
              🔄 Tentar novamente
            </button>
          </div>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 950 }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Aluno</th>
                  <th>Base</th>
                  <th>Prova</th>
                  <th style={{ textAlign: 'center' }}>Nota</th>
                  <th style={{ textAlign: 'center' }}>Comunhão</th>
                  <th style={{ textAlign: 'center' }}>Verso</th>
                  <th style={{ textAlign: 'center' }}>Discipulado</th>
                  <th style={{ textAlign: 'center' }}>{taskTrainLabel}</th>
                  <th style={{ textAlign: 'center' }}>{taskStudyLabel}</th>
                  <th>Observação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={12} style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>Nenhum registro encontrado com estes filtros.</td></tr>
                ) : filtered.map(n => {
                  if (editId === n.id) {
                    return (
                      <tr key={n.id} style={{ background: 'var(--bg-alt, rgba(255,255,255,0.04))' }}>
                        <td style={{ fontSize: 12 }}>{fmtDate(n.data || n.Data)}</td>
                        <td style={{ fontWeight: 600 }}>{n.nome_aluno || n.Membros}</td>
                        <td style={{ fontSize: 12 }}>{n.Base}</td>
                        <td style={{ fontSize: 12 }}>{n.titulo || n.id_provas}</td>
                        <td>
                          <select value={editData.nota} onChange={e => setE('nota', e.target.value)} style={{ width: '100%' }}>
                            <option value="">—</option>
                            {[1,2,3,4,5,6,7,8,9,10].map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </td>
                        <td><SimNao value={editData.comunhao} onChange={e => setE('comunhao', e.target.value)} /></td>
                        <td><SimNao value={editData.verso}    onChange={e => setE('verso',    e.target.value)} /></td>
                        <td><SimNao value={editData.discipulado} onChange={e => setE('discipulado', e.target.value)} /></td>
                        <td><SimNao value={editData.trezentos_treinamento} onChange={e => setE('trezentos_treinamento', e.target.value)} /></td>
                        <td><SimNao value={editData.trezentos_estudo}      onChange={e => setE('trezentos_estudo',      e.target.value)} /></td>
                        <td>
                          <input
                            value={editData.observacoes}
                            onChange={e => setE('observacoes', e.target.value)}
                            placeholder="Observação…"
                            style={{ width: '100%' }}
                          />
                        </td>
                        <td style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                          <button
                            className="btn-icon"
                            onClick={() => updateMutation.mutate({ id: n.id, data: editData })}
                            disabled={updateMutation.isPending}
                            title="Salvar"
                          >💾</button>
                          <button
                            className="btn-icon"
                            onClick={() => { setEditId(null); setEditData({}) }}
                            title="Cancelar"
                          >✖️</button>
                          <button
                            className="btn-icon danger"
                            onClick={() => confirmDelete(n)}
                            disabled={deleteMutation.isPending}
                            title="Excluir"
                          >🗑️</button>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={n.id}>
                      <td style={{ fontSize: 12 }}>{fmtDate(n.data || n.Data)}</td>
                      <td style={{ fontWeight: 600 }}>{n.nome_aluno || n.Membros}</td>
                      <td style={{ fontSize: 12 }}>{n.Base}</td>
                      <td style={{ fontSize: 12 }}>{n.titulo || n.id_provas}</td>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--c2)' }}>{n.nota ?? n.Nota}</td>
                      <td style={{ textAlign: 'center' }}>{(n.comunhao ?? n.Comunhao) || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{(n.verso    ?? n.Verso)    || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{n.discipulado || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{n.trezentos_treinamento || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{n.trezentos_estudo      || '—'}</td>
                      <td style={{ fontSize: 11, opacity: 0.7 }}>{n.observacoes || n.Observacoes || '—'}</td>
                      <td style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                        <button className="btn-icon" onClick={() => startEdit(n)} title="Editar nota">✏️</button>
                        <button
                          className="btn-icon danger"
                          onClick={() => confirmDelete(n)}
                          disabled={deleteMutation.isPending}
                          title="Excluir nota"
                        >🗑️</button>
                      </td>
                    </tr>
                  )
                })}
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
