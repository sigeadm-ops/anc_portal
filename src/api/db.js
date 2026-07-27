import { supabase } from './supabase'
import { SheetsAPI } from './sheetsApi'

// ================================================================
// Mapeamento tabela → view para leituras (getAll)
// Inserts/Updates continuam nas tabelas base com FKs
// ================================================================
const VIEW_MAP = {
  Bases:      'vw_bases',
  Membros:    'vw_membros',
  Notas_Teen: 'vw_notas_teen',
  Notas_Soul: 'vw_notas_soul',
  Provas:     'Provas',
  Regiao:     'Regiao',
  Distritos:  'Distritos',
  Igrejas:    'Igrejas',
}

// Mapeamento para escrita (tabelas base)
const TABLE_MAP = {
  Regiao:     'Regiao',
  Distritos:  'Distritos',
  Igrejas:    'Igrejas',
  Provas:     'Provas',
  Bases:      'Bases',
  Membros:    'Membros',
}

const PK_MAP = {
  Bases:      'id_base',
  Membros:    'id_membros',
  Notas_Teen: 'id',
  Notas_Soul: 'id',
  Provas:     'id_provas',
  Regiao:     'id_regiao',
  Distritos:  'id_distritos',
  Igrejas:    'id_igrejas',
}

const ORDER_CONFIG = {
  Bases:      { columns: ['created_at', 'updated_at'], ascending: false },
  Membros:    { columns: ['created_at', 'updated_at', 'DataCad', 'data_cad'], ascending: false },
  Notas_Teen: { columns: ['data', 'Data', 'created_at'], ascending: false },
  Notas_Soul: { columns: ['data', 'Data', 'created_at'], ascending: false },
  Provas:     { columns: ['data', 'Data', 'created_at'], ascending: false },
  Regiao:     { columns: ['Regiao', 'regiao', 'nome'], ascending: true },
  Distritos:  { columns: ['Distritos', 'distrito', 'nome'], ascending: true },
  Igrejas:    { columns: ['Igrejas', 'igreja', 'nome'], ascending: true },
}

const SELECT_PAGE_SIZE = 1000

function getPkCandidates(table) {
  if (table === 'Provas') return ['id', 'id_provas']
  return [PK_MAP[table] || 'id']
}

function getOrderConfig(table) {
  return ORDER_CONFIG[table] || { columns: ['created_at', 'CreatedAt', 'CreateAt'], ascending: false }
}

function isMissingColumnError(error, column) {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes(String(column || '').toLowerCase()) && (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('column'))
}

// Confere quantas linhas casam com esse id ANTES de fazer update/delete.
// Retorna 'ok' (0 ou 1 linha, seguro seguir), 'blocked' (>1 linha — id não é
// único, não deve prosseguir) ou 'missing_pk_column' (essa coluna não existe
// nessa tabela, deixa o chamador tentar o próximo candidato de PK).
async function assertSingleRowForPk(target, pk, id) {
  const { count, error } = await supabase
    .from(target)
    .select(pk, { count: 'exact', head: true })
    .eq(pk, id)

  if (error) {
    return isMissingColumnError(error, pk) ? 'missing_pk_column' : 'ok'
  }
  return (count || 0) > 1 ? 'blocked' : 'ok'
}

async function fetchAllRows(queryFactory) {
  const rows = []
  let from = 0

  for (;;) {
    const to = from + SELECT_PAGE_SIZE - 1
    const resp = await queryFactory(from, to)
    if (resp.error) return { data: null, error: resp.error }

    const page = resp.data ?? []
    rows.push(...page)

    if (page.length < SELECT_PAGE_SIZE) {
      return { data: rows, error: null }
    }

    from += SELECT_PAGE_SIZE
  }
}

function normalizeDateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function matchesBaseRow(row, base_id, base_nome) {
  const targetId = String(base_id ?? '').trim()
  const targetName = normalizeText(base_nome)

  const rowIds = [row?.id_base, row?.base_id, row?.id_base_geo]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)

  if (targetId && rowIds.includes(targetId)) return true

  const rowNames = [row?.Base, row?.base, row?.nome_base]
    .map((v) => normalizeText(v))
    .filter(Boolean)

  if (!targetName || rowNames.length === 0) return false

  return rowNames.some((name) =>
    name === targetName || name.includes(targetName) || targetName.includes(name)
  )
}

async function fetchLegacyNotasFallback({ legacyTableCandidates, normalizeTable, base_id, base_nome, primeiro_sabado, ultimo_sabado }) {
  for (const tableName of legacyTableCandidates) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')

    if (error) continue

    const rows = (data ?? [])
      .map((row) => normalizeReadRow(normalizeTable, row))
      .filter((row) => {
        if (!matchesBaseRow(row, base_id, base_nome)) return false

        const rowDate = normalizeDateOnly(row?.data ?? row?.Data)
        if (!rowDate) return false
        if (primeiro_sabado && rowDate < primeiro_sabado) return false
        if (ultimo_sabado && rowDate > ultimo_sabado) return false
        return true
      })

    if (rows.length > 0) return rows
  }

  return []
}

function hasAnsweredValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function isSimLike(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === 'sim' || raw === 's' || raw === 'true' || raw === '1' || raw === 'yes' || raw === 'x'
}

function normalizeTipoMinisterio(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  if (raw.includes('soul')) return 'soul'
  if (raw.includes('teen')) return 'teen'
  return raw
}

function isCategoriaAutoAdministrativa(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === 'admin' || raw === 'da'
}

function notaPreencheCartao(nota) {
  return [
    nota?.comunhao ?? nota?.Comunhao,
    nota?.verso ?? nota?.Verso,
    nota?.discipulado ?? nota?.Discipulado,
    nota?.trezentos_treinamento ?? nota?.TrezentosTrainamento,
    nota?.trezentos_estudo ?? nota?.TrezentosEstudo,
  ].every(hasAnsweredValue)
}

function findDesafiosAdminSemanais(catalogo) {
  const semanaisAdmin = (catalogo ?? []).filter(
    (desafio) => isCategoriaAutoAdministrativa(desafio.categoria) &&
    (desafio.periodicidade === 'semanal' || desafio.rastreamento === 'semanal')
  )

  return {
    cartao: semanaisAdmin.filter((desafio) => /cart[aã]o/i.test(desafio.nome ?? '')),
    comunhao: semanaisAdmin.filter((desafio) => /comunh[aã]o/i.test(desafio.nome ?? '')),
    assiduidade: semanaisAdmin.filter((desafio) => /assiduidade|portal/i.test(desafio.nome ?? '')),
  }
}

function sortDesafios(list) {
  return [...(list ?? [])].sort((a, b) => {
    const aDate = a.data_ocorrencia || '9999-12-31'
    const bDate = b.data_ocorrencia || '9999-12-31'
    const cmpDate = String(aDate).localeCompare(String(bDate))
    if (cmpDate !== 0) return cmpDate

    const aOrdem = Number(a.ordem ?? 99)
    const bOrdem = Number(b.ordem ?? 99)
    if (aOrdem !== bOrdem) return aOrdem - bOrdem

    return String(a.nome ?? '').localeCompare(String(b.nome ?? ''))
  })
}

function filterNotasByTable(table, rows) {
  if (!Array.isArray(rows)) return []
  if (table !== 'Notas_Teen' && table !== 'Notas_Soul') return rows

  const hasDiscriminator = rows.some((row) => {
    const tipo = row?.tipo ?? row?.Tipo
    const aba = row?.aba ?? row?.Aba
    return tipo !== undefined || aba !== undefined
  })

  // Se a fonte já é uma tabela física separada e não traz discriminador,
  // não filtramos para não descartar dados válidos.
  if (!hasDiscriminator) return rows

  return rows.filter((row) => {
    const tipo = String(row?.tipo ?? row?.Tipo ?? '').trim()
    const aba = String(row?.aba ?? row?.Aba ?? '').trim().toUpperCase()

    if (table === 'Notas_Teen') {
      return tipo === 'G148 Teen' || aba === 'NOTAS' || aba === 'NOTAS_TEEN'
    }

    return tipo === 'Soul+' || aba === 'NOTAS_SOUL'
  })
}

function normalizeReadRow(table, row) {
  if (!row || typeof row !== 'object') return row

  if (table === 'Regiao') {
    return {
      ...row,
      id_regiao: row.id_regiao ?? row.id,
      Regiao: row.Regiao ?? row.regiao ?? row.nome,
    }
  }

  if (table === 'Distritos') {
    return {
      ...row,
      id_distritos: row.id_distritos ?? row.id,
      Distritos: row.Distritos ?? row.distrito ?? row.nome,
      id_regiao: row.id_regiao ?? row.regiao_id,
      regiao_id: row.regiao_id ?? row.id_regiao,
    }
  }

  if (table === 'Igrejas') {
    return {
      ...row,
      id_igrejas: row.id_igrejas ?? row.id,
      Igrejas: row.Igrejas ?? row.igreja ?? row.nome,
      id_distritos: row.id_distritos ?? row.distrito_id,
      distrito_id: row.distrito_id ?? row.id_distritos,
    }
  }

  if (table === 'Provas') {
    return {
      ...row,
      id: row.id ?? row.id_provas,
      id_provas: row.id_provas ?? row.id,
      Provas: row.Provas ?? row.provas ?? row.nome,
      Data: row.Data ?? row.data,
    }
  }

  if (table === 'Bases') {
    return {
      ...row,
      id_base: row.id_base ?? row.id,
      Base: row.Base ?? row.base ?? row.nome,
      Tipo: row.Tipo ?? row.tipo,
      Status: row.Status ?? row.status,
      Data_Cad: row.Data_Cad ?? row.data_cad,
      id_igrejas: row.id_igrejas ?? row.igreja_id,
      igreja_id: row.igreja_id ?? row.id_igrejas,
      id_distritos: row.id_distritos ?? row.distrito_id,
      distrito_id: row.distrito_id ?? row.id_distritos,
      id_regiao: row.id_regiao ?? row.regiao_id,
      regiao_id: row.regiao_id ?? row.id_regiao,
      Igreja_Nome: row.Igreja_Nome ?? row.Igrejas ?? row.igreja ?? row.nome_igreja,
      Distrito_Nome: row.Distrito_Nome ?? row.Distritos ?? row.distrito ?? row.nome_distrito,
      Regiao_Nome: row.Regiao_Nome ?? row.Regiao ?? row.regiao ?? row.nome_regiao,
      Igrejas: row.Igrejas ?? row.Igreja_Nome ?? row.igreja ?? row.nome_igreja,
      Distritos: row.Distritos ?? row.Distrito_Nome ?? row.distrito ?? row.nome_distrito,
      Regiao: row.Regiao ?? row.Regiao_Nome ?? row.regiao ?? row.nome_regiao,
      Coord: row.Coord ?? row.coord,
      Coord_Fone: row.Coord_Fone ?? row.coord_fone,
      Coord_Email: row.Coord_Email ?? row.coord_email,
      Prof: row.Prof ?? row.prof,
      Prof_Fone: row.Prof_Fone ?? row.prof_fone,
      Prof_Email: row.Prof_Email ?? row.prof_email,
      Midia: row.Midia ?? row.midia,
      Midia_Fone: row.Midia_Fone ?? row.midia_fone,
      Midia_Email: row.Midia_Email ?? row.midia_email,
    }
  }

  if (table === 'Membros') {
    return {
      ...row,
      id_membros: row.id_membros ?? row.id,
      id_base: row.id_base ?? row.base_id,
      Membros: row.Membros ?? row.nome,
      Nasc: row.Nasc ?? row.nasc,
      Fone: row.Fone ?? row.fone,
      Email: row.Email ?? row.email,
      Endereco: row.Endereco ?? row.endereco,
      Responsavel: row.Responsavel ?? row.responsavel,
      CPF: row.CPF ?? row.cpf,
      RG: row.RG ?? row.rg,
      Camiseta: row.Camiseta ?? row.camiseta,
      Status: row.Status ?? row.status,
      DataCad: row.DataCad ?? row.data_cad,
      Tipo: row.Tipo ?? row.tipo,
      Base: row.Base ?? row.base ?? row.nome_base,
      Igrejas: row.Igrejas ?? row.igrejas ?? row.nome_igreja,
    }
  }

  if (table === 'Notas_Teen' || table === 'Notas_Soul') {
    return {
      ...row,
      id: row.id,
      id_form: row.id_form,
      // Unifica variações de chave estrangeira de base
      id_base:  row.id_base  ?? row.base_id,
      base_id:  row.base_id  ?? row.id_base,
      // Unifica variações de chave estrangeira de prova
      id_provas: row.id_provas ?? row.prova_id,
      prova_id:  row.prova_id  ?? row.id_provas,
      // Membro
      id_membros: row.id_membros,
      Membros:    row.Membros    ?? row.nome_aluno,
      nome_aluno: row.nome_aluno ?? row.Membros,
      // Localização
      Base:      row.Base      ?? row.base,
      base:      row.base      ?? row.Base,
      Regiao:    row.Regiao    ?? row.regiao,
      Distritos: row.Distritos ?? row.Distrito ?? row.distrito,
      Igrejas:   row.Igrejas   ?? row.Igreja   ?? row.igreja,
      id_base_geo: row.id_base,
      id_regiao:   row.id_regiao,
      id_distritos: row.id_distritos,
      id_igrejas:   row.id_igrejas,
      // Data — normaliza para garantir que 'data' (lowercase) existe sempre
      data:  row.data  ?? row.Data,
      Data:  row.Data  ?? row.data,
      // Prova info
      titulo: row.titulo ?? row.Titulo,
      Titulo: row.Titulo ?? row.titulo,
      // Nota
      Nota: row.Nota ?? row.nota,
      nota: row.nota ?? row.Nota,
      // Campos booleanos/texto
      Comunhao:  row.Comunhao  ?? row.comunhao,
      comunhao:  row.comunhao  ?? row.Comunhao,
      Verso:     row.Verso     ?? row.verso,
      verso:     row.verso     ?? row.Verso,
      // discipulado: a coluna pode ser 'discipulado' (legacy) ou 'discipulo' (normalizado)
      discipulado: row.discipulado ?? row.Discipulado ?? row.discipulo,
      trezentos_treinamento: row.trezentos_treinamento ?? row.TrezentosTrainamento ?? null,
      trezentos_estudo:      row.trezentos_estudo      ?? row.TrezentosEstudo      ?? null,
      Observacoes: row.Observacoes ?? row.observacoes,
      observacoes: row.observacoes ?? row.Observacoes,
      responsavel: row.responsavel,
      tipo: row.tipo ?? row.Tipo,
      aba:  row.aba  ?? row.Aba,
    }
  }

  return row
}

function mapWriteRecord(table, record) {
  if (!record || typeof record !== 'object') return record

  if (table === 'Bases') {
    return {
      Tipo: record.Tipo ?? record.tipo,
      Base: record.Base ?? record.nome,
      id_igrejas: record.id_igrejas ?? record.igreja_id,
      Coord: record.Coord ?? record.coord ?? null,
      Coord_Fone: record.Coord_Fone ?? record.coord_fone ?? null,
      Coord_Email: record.Coord_Email ?? record.coord_email ?? null,
      Prof: record.Prof ?? record.prof ?? null,
      Prof_Fone: record.Prof_Fone ?? record.prof_fone ?? null,
      Prof_Email: record.Prof_Email ?? record.prof_email ?? null,
      Midia: record.Midia ?? record.midia ?? null,
      Midia_Fone: record.Midia_Fone ?? record.midia_fone ?? null,
      Midia_Email: record.Midia_Email ?? record.midia_email ?? null,
      Data_Cad: record.Data_Cad ?? record.data_cad ?? null,
      Status: record.Status ?? record.status ?? 'Ativo',
    }
  }

  if (table === 'Membros') {
    return {
      id_base: record.id_base ?? record.base_id,
      Membros: record.Membros ?? record.nome,
      Nasc: record.Nasc ?? record.nasc ?? null,
      Fone: record.Fone ?? record.fone ?? null,
      Email: record.Email ?? record.email ?? null,
      Endereco: record.Endereco ?? record.endereco ?? null,
      Responsavel: record.Responsavel ?? record.responsavel ?? null,
      CPF: record.CPF ?? record.cpf ?? null,
      RG: record.RG ?? record.rg ?? null,
      Camiseta: record.Camiseta ?? record.camiseta ?? null,
      Status: record.Status ?? record.status ?? 'Ativo',
      DataCad: record.DataCad ?? record.data_cad ?? null,
      Tipo: record.Tipo ?? record.tipo ?? null,
    }
  }

  if (table === 'Provas') {
    return {
      tipo: record.tipo ?? record.Tipo,
      nome: record.nome ?? record.Provas,
      data: record.data ?? record.Data ?? null,
    }
  }

  if (table === 'Regiao') {
    return {
      Regiao: record.Regiao ?? record.nome,
    }
  }

  if (table === 'Distritos') {
    return {
      Distritos: record.Distritos ?? record.nome,
      id_regiao: record.id_regiao ?? record.regiao_id,
    }
  }

  if (table === 'Igrejas') {
    return {
      Igrejas: record.Igrejas ?? record.nome,
      id_distritos: record.id_distritos ?? record.distrito_id,
      CodRef: record.CodRef ?? record.codref ?? null,
      Templo: record.Templo ?? record.tipo_templo ?? null,
      Pastor_Distrital: record.Pastor_Distrital ?? record.pastor_distrital ?? null,
    }
  }

  return record
}

async function enrichBasesGeo(rows, deps) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return list

  const needsGeoEnrichment = list.some((base) => {
    const hasIgreja = Boolean(base?.Igrejas || base?.Igreja_Nome)
    const hasDistrito = Boolean(base?.Distritos || base?.Distrito_Nome)
    const hasRegiao = Boolean(base?.Regiao || base?.Regiao_Nome)
    return !(hasIgreja && hasDistrito && hasRegiao)
  })

  if (!needsGeoEnrichment) return list

  const [igrejas, distritos, regioes] = await Promise.all([
    deps.getIgrejas(),
    deps.getDistritos(),
    deps.getRegioes(),
  ])

  const igrejasById = new Map((igrejas || []).map((i) => [String(i.id_igrejas ?? i.id ?? '').trim(), i]))
  const distritosById = new Map((distritos || []).map((d) => [String(d.id_distritos ?? d.id ?? '').trim(), d]))
  const regioesById = new Map((regioes || []).map((r) => [String(r.id_regiao ?? r.id ?? '').trim(), r]))

  return list.map((base) => {
    const igrejaId = String(base.id_igrejas ?? base.igreja_id ?? '').trim()
    const igreja = igrejasById.get(igrejaId)

    const distritoId = String(
      base.id_distritos ??
      base.distrito_id ??
      igreja?.id_distritos ??
      igreja?.distrito_id ??
      ''
    ).trim()
    const distrito = distritosById.get(distritoId)

    const regiaoId = String(
      base.id_regiao ??
      base.regiao_id ??
      distrito?.id_regiao ??
      distrito?.regiao_id ??
      ''
    ).trim()
    const regiao = regioesById.get(regiaoId)

    return {
      ...base,
      id_igrejas: (base.id_igrejas !== undefined && base.id_igrejas !== null && base.id_igrejas !== '') ? base.id_igrejas : (igrejaId || undefined),
      id_distritos: (base.id_distritos !== undefined && base.id_distritos !== null && base.id_distritos !== '') ? base.id_distritos : (distritoId || undefined),
      id_regiao: (base.id_regiao !== undefined && base.id_regiao !== null && base.id_regiao !== '') ? base.id_regiao : (regiaoId || undefined),
      Igreja_Nome: base.Igreja_Nome || base.Igrejas || igreja?.Igrejas || igreja?.nome,
      Distrito_Nome: base.Distrito_Nome || base.Distritos || distrito?.Distritos || distrito?.nome,
      Regiao_Nome: base.Regiao_Nome || base.Regiao || regiao?.Regiao || regiao?.nome,
      Igrejas: base.Igrejas || base.Igreja_Nome || igreja?.Igrejas || igreja?.nome,
      Distritos: base.Distritos || base.Distrito_Nome || distrito?.Distritos || distrito?.nome,
      Regiao: base.Regiao || base.Regiao_Nome || regiao?.Regiao || regiao?.nome,
    }
  })
}

// ================================================================
// API GENÉRICA — CRUD apenas no Supabase (Sheets desconectado)
// ================================================================

export const db = {

  // ── SELECT ──────────────────────────────────────────────────
  async getAll(table) {
    const source = VIEW_MAP[table] || table

    // Usa colunas prováveis por entidade para evitar erros 400 em schemas legados.
    const { columns, ascending } = getOrderConfig(table)
    const pk = getPkCandidates(table)[0]
    let data = null
    let error = null

    for (const col of columns) {
      // IMPORTANTE: sempre desempata pelo PK. Ordenar só por "data"/"created_at"
      // (colunas com muitos valores repetidos, ex.: vários alunos na mesma
      // prova) deixa a paginação por range() instável — o Postgres pode
      // devolver a MESMA linha em duas páginas seguidas (ou pular alguma)
      // quando o critério de ordenação empata na fronteira da página. Isso
      // é o que causava notas "fantasma" duplicadas na tela sem existir
      // duplicidade real no banco.
      let resp = await fetchAllRows((from, to) =>
        supabase
          .from(source)
          .select('*')
          .order(col, { ascending })
          .order(pk, { ascending: true })
          .range(from, to)
      )

      if (resp.error && isMissingColumnError(resp.error, pk)) {
        // Essa view não expõe o PK com esse nome — cai pro comportamento antigo
        // (sem desempate) só pra essa coluna de ordenação, em vez de quebrar.
        resp = await fetchAllRows((from, to) =>
          supabase
            .from(source)
            .select('*')
            .order(col, { ascending })
            .range(from, to)
        )
      }

      if (!resp.error) {
        data = resp.data
        break
      }

      error = resp.error
      if (!isMissingColumnError(resp.error, col)) {
        break
      }
    }

    if (!data) {
      let resp = await fetchAllRows((from, to) =>
        supabase
          .from(source)
          .select('*')
          .order(pk, { ascending: true })
          .range(from, to)
      )

      if (resp.error && isMissingColumnError(resp.error, pk)) {
        resp = await fetchAllRows((from, to) =>
          supabase
            .from(source)
            .select('*')
            .range(from, to)
        )
      }

      if (resp.error) throw resp.error
      const normalized = filterNotasByTable(table, resp.data ?? []).map((row) => normalizeReadRow(table, row))
      if (table === 'Bases') {
        return enrichBasesGeo(normalized, {
          getIgrejas: () => this.getIgrejas(),
          getDistritos: () => this.getDistritos(),
          getRegioes: () => this.getRegioes(),
        })
      }
      return normalized
    }

    const normalized = filterNotasByTable(table, data ?? []).map((row) => normalizeReadRow(table, row))
    if (table === 'Bases') {
      return enrichBasesGeo(normalized, {
        getIgrejas: () => this.getIgrejas(),
        getDistritos: () => this.getDistritos(),
        getRegioes: () => this.getRegioes(),
      })
    }

    return normalized
  },

  async getById(table, id) {
    const source = VIEW_MAP[table] || table
    const candidates = getPkCandidates(table)

    let data = null
    let error = null

    for (const pk of candidates) {
      const resp = await supabase
        .from(source)
        .select('*')
        .eq(pk, id)
        .single()

      if (!resp.error) {
        data = resp.data
        break
      }

      error = resp.error
      const msg = String(resp.error.message || '').toLowerCase()
      const missingPkColumn = msg.includes(pk.toLowerCase()) && (msg.includes('does not exist') || msg.includes('column'))
      if (!missingPkColumn) break
    }

    if (!data) throw error

    const normalized = normalizeReadRow(table, data)
    if (table === 'Bases') {
      const [enriched] = await enrichBasesGeo([normalized], {
        getIgrejas: () => this.getIgrejas(),
        getDistritos: () => this.getDistritos(),
        getRegioes: () => this.getRegioes(),
      })
      return enriched
    }
    return normalized
  },

  // ── INSERT ──────────────────────────────────────────────────
  async insert(table, record) {
    const target = TABLE_MAP[table] || table
    const mappedRecord = mapWriteRecord(table, record)
    // Remove id vazio/nulo para que o DEFAULT do banco seja usado
    const { id, ...rest } = mappedRecord
    const payload = (id !== undefined && id !== null && id !== '') ? { id, ...rest } : rest
    const { data: inserted, error } = await supabase
      .from(target)
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return normalizeReadRow(table, inserted)
  },

  // ── UPDATE ──────────────────────────────────────────────────
  async update(table, id, record) {
    const target = TABLE_MAP[table] || table
    const payload = mapWriteRecord(table, record)
    const candidates = getPkCandidates(table)

    let updated = null
    let error = null

    for (const pk of candidates) {
      // Checagem de segurança: se o id não for único na tabela (dado legado
      // corrompido), um .update().eq(pk, id) alteraria TODAS as linhas com
      // esse id de uma vez, mesmo que .single() depois reclame do formato.
      const guard = await assertSingleRowForPk(target, pk, id)
      if (guard === 'missing_pk_column') continue
      if (guard === 'blocked') {
        throw new Error(`Atualização bloqueada: mais de um registro em "${target}" compartilha o mesmo identificador (${pk}=${id}). Corrija a duplicidade antes de editar, para não alterar os dois de uma vez.`)
      }

      const resp = await supabase
        .from(target)
        .update(payload)
        .eq(pk, id)
        .select()
        .single()

      if (!resp.error) {
        updated = resp.data
        break
      }

      error = resp.error
      const msg = String(resp.error.message || '').toLowerCase()
      const missingPkColumn = msg.includes(pk.toLowerCase()) && (msg.includes('does not exist') || msg.includes('column'))
      if (!missingPkColumn) break
    }

    if (!updated) throw error
    return normalizeReadRow(table, updated)
  },

  // ── DELETE ──────────────────────────────────────────────────
  async delete(table, id) {
    const target = TABLE_MAP[table] || table
    const candidates = getPkCandidates(table)

    let lastError = null
    for (const pk of candidates) {
      // Checagem de segurança: tabelas legadas (ex.: Notas_Teen/Notas_Soul)
      // podem ter ids duplicados por falha de importação. Sem essa checagem,
      // .delete().eq(pk, id) apagaria TODAS as linhas com esse id de uma vez,
      // mesmo quando o usuário só queria excluir uma nota específica.
      const guard = await assertSingleRowForPk(target, pk, id)
      if (guard === 'missing_pk_column') continue
      if (guard === 'blocked') {
        throw new Error(`Exclusão bloqueada: mais de um registro em "${target}" compartilha o mesmo identificador (${pk}=${id}). Isso indica duplicidade nos dados — peça para um administrador corrigir antes de excluir, para não perder as duas linhas de uma vez.`)
      }

      const resp = await supabase
        .from(target)
        .delete()
        .eq(pk, id)

      if (!resp.error) {
        return true
      }

      lastError = resp.error
      const msg = String(resp.error.message || '').toLowerCase()
      const missingPkColumn = msg.includes(pk.toLowerCase()) && (msg.includes('does not exist') || msg.includes('column'))
      if (!missingPkColumn) break
    }

    if (lastError) throw lastError
    return true
  },

  // ── NOTAS: atualiza uma linha, com retry para colunas ausentes ──
  async updateNota(tableName, id, fields) {
    let payload = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v === '' ? null : v])
    )
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (!error) return data

      const msg = String(error.message || '')
      const m1 = msg.match(/Could not find the '([^']+)' column/i)
      const m2 = msg.match(/column\s+"?([A-Za-z0-9_]+)"?\s+does not exist/i)
      const badCol = m1?.[1] || m2?.[1]

      if (!badCol) throw error
      const { [badCol]: _drop, ...rest } = payload
      payload = rest
    }
    throw new Error('Falha ao atualizar nota após sanitizar colunas inválidas.')
  },

  // ── NOTAS: verifica se já existe lançamento para essa base+prova+data ──
  // Usado pra avisar o coordenador ANTES de salvar, evitando lançar a
  // mesma turma duas vezes (cada envio de formulário insere linhas novas,
  // não substitui as existentes).
  async getNotasExistentes(tableName, { id_base, id_provas, data }) {
    if (!id_base || !id_provas || !data) return []
    // Usa select('*') para evitar erro 400 em tabelas legadas que não têm
    // todas as colunas (ex.: lancado_em, created_at ausentes em Notas_Soul).
    const { data: rows, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id_base', id_base)
      .eq('id_provas', id_provas)
      .eq('data', data)

    if (error) return []
    return rows || []
  },

  // ── NOTAS: todos os lançamentos de uma base (todas as provas) ──
  // Usado pra detectar duplicidade (mesma criança + mesma prova lançada
  // mais de uma vez) assim que a base é escolhida, sem depender da prova
  // ou data selecionadas no momento.
  async getNotasPorBase(tableName, id_base) {
    if (!id_base) return []
    // Usa select('*') para evitar erro 400 em tabelas legadas que não
    // possuem todas as colunas listadas (prova_id, lancado_em, created_at).
    const { data: rows, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id_base', id_base)

    if (error) return []
    return rows || []
  },

  // ── NOTAS: insere todas as linhas de um formulário ──────────
  async insertNotasForm(rows, _ignored, tableName = 'Notas_Teen') {
    let payload = rows
    // Em bases legadas, algumas colunas não existem (ex.: Versao/SalvoEm).
    // Faz retry removendo a coluna apontada no erro para não travar o lançamento.
    for (let attempt = 0; attempt < 30; attempt++) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()

      if (!error) return data

      const msg = String(error.message || '')
      const m1 = msg.match(/Could not find the '([^']+)' column/i)
      const m2 = msg.match(/column\s+"?([A-Za-z0-9_]+)"?\s+does not exist/i)
      const badCol = m1?.[1] || m2?.[1]

      if (!badCol) throw error

      payload = payload.map((row) => {
        const { [badCol]: _drop, ...rest } = row
        return rest
      })
    }

    throw new Error('Falha ao salvar notas após sanitizar colunas inválidas.')
  },

  async getMembrosCom300Concluido(base_id, tipo = 'G148 Teen', data_referencia = null) {
    if (!base_id) return {}

    const source = String(tipo).toLowerCase().includes('soul') ? 'vw_notas_soul' : 'vw_notas_teen'
    let query = supabase
      .from(source)
      .select('*')
      .eq('id_base', base_id)

    if (data_referencia) {
      query = query.lte('data', String(data_referencia).slice(0, 10))
    }

    const { data, error } = await query
    if (error) throw error

    const statusByMembro = {}
    ;(data ?? []).forEach((row) => {
      const membroId = String(row?.id_membros ?? '').trim()
      if (!membroId) return

      if (!statusByMembro[membroId]) {
        statusByMembro[membroId] = { treinamento: false, estudo: false }
      }

      if (isSimLike(row?.trezentos_treinamento ?? row?.TrezentosTrainamento)) {
        statusByMembro[membroId].treinamento = true
      }
      if (isSimLike(row?.trezentos_estudo ?? row?.TrezentosEstudo)) {
        statusByMembro[membroId].estudo = true
      }
    })

    return statusByMembro
  },

  async syncDesafiosAdministrativosFromNotas({ base_id, tipo, data_sabado, rows, responsavel, catalogo }) {
    const sabado = normalizeDateOnly(data_sabado)
    if (!base_id || !tipo || !sabado || !Array.isArray(rows)) {
      return { assiduidade: false, cartao: false }
    }

    const desafiosCatalogo = Array.isArray(catalogo) && catalogo.length > 0
      ? catalogo
      : await this.getDesafiosCatalogo(tipo)

    const desafiosAdmin = findDesafiosAdminSemanais(desafiosCatalogo)
    const assiduidadeOk = rows.length > 0
    const cartaoOk = rows.length > 0 && rows.every(notaPreencheCartao)
    const comunhaoOk = rows.length > 0 && rows.some((nota) => isSimLike(nota?.comunhao ?? nota?.Comunhao))
    const tasks = []

    desafiosAdmin.assiduidade.forEach((desafio) => {
      tasks.push(this.upsertRegistro({
        base_id,
        desafio_id: desafio.id,
        data_sabado: sabado,
        realizado: assiduidadeOk,
        responsavel: assiduidadeOk ? (responsavel ?? null) : null,
        obs: assiduidadeOk ? 'Automático via lançamento de notas' : null,
      }))
    })

    desafiosAdmin.cartao.forEach((desafio) => {
      tasks.push(this.upsertRegistro({
        base_id,
        desafio_id: desafio.id,
        data_sabado: sabado,
        realizado: cartaoOk,
        responsavel: cartaoOk ? (responsavel ?? null) : null,
        obs: cartaoOk ? 'Automático via preenchimento das notas' : null,
      }))
    })

    desafiosAdmin.comunhao.forEach((desafio) => {
      tasks.push(this.upsertRegistro({
        base_id,
        desafio_id: desafio.id,
        data_sabado: sabado,
        realizado: comunhaoOk,
        responsavel: comunhaoOk ? (responsavel ?? null) : null,
        obs: comunhaoOk ? 'Automático via campo Comunhão nas notas' : null,
      }))
    })

    if (tasks.length > 0) {
      await Promise.all(tasks)
    }

    return { assiduidade: assiduidadeOk, cartao: cartaoOk, comunhao: comunhaoOk }
  },

  // ── TABELAS DIMENSÃO ────────────────────────────────────────
  async getRegioes() {
    let resp = await supabase.from('Regiao').select('*').order('Regiao', { ascending: true })
    if (resp.error) {
      resp = await supabase.from('regioes').select('*').order('nome', { ascending: true })
    }
    if (resp.error) throw resp.error
    return (resp.data ?? []).map((row) => normalizeReadRow('Regiao', row))
  },

  async getDistritos() {
    let resp = await supabase.from('Distritos').select('*').order('Distritos', { ascending: true })
    if (resp.error) {
      resp = await supabase.from('distritos').select('*').order('nome', { ascending: true })
    }
    if (resp.error) throw resp.error
    return (resp.data ?? []).map((row) => normalizeReadRow('Distritos', row))
  },

  async getIgrejas() {
    let resp = await supabase.from('Igrejas').select('*').order('Igrejas', { ascending: true })
    if (resp.error) {
      resp = await supabase.from('igrejas').select('*').order('nome', { ascending: true })
    }
    if (resp.error) throw resp.error
    return (resp.data ?? []).map((row) => normalizeReadRow('Igrejas', row))
  },

  // ── DESAFIOS ────────────────────────────────────────────────

  async getDesafiosCatalogo(tipo) {
    const { data, error } = await supabase
      .from('desafios_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true })

    if (error) throw error
    if (!data) return []

    // Se o tipo for informado, filtra no JS para evitar erro caso a coluna 'tipo' não exista no banco
    if (tipo) {
      const isTeen = tipo.toLowerCase().includes('teen')
      return sortDesafios(data.filter(d => {
        const itemTipo = (d.tipo || 'G148 Teen').toLowerCase()
        if (isTeen) return itemTipo.includes('teen')
        return itemTipo.includes('soul')
      }))
    }
    return sortDesafios(data)
  },

  async getDesafiosCatalogoAll() {
    const { data, error } = await supabase
      .from('desafios_catalogo')
      .select('*')
      .order('ordem', { ascending: true })
    if (error) throw error
    return sortDesafios(data ?? [])
  },

  async upsertDesafioCatalogo({ id, codigo, nome, descricao, categoria, rastreamento, periodicidade, pontos_total, ordem, ativo, mes_ref, tipo, data_ocorrencia, cadencia }) {
    const payload = {
      codigo,
      nome,
      descricao: descricao || null,
      categoria: categoria || null,
      rastreamento,
      periodicidade,
      pontos_total: Number(pontos_total),
      ordem: Number(ordem ?? 99),
      ativo: ativo !== false,
      mes_ref: mes_ref ? Number(mes_ref) : null,
      tipo: tipo || 'G148 Teen',
      data_ocorrencia: data_ocorrencia || null,
      cadencia: cadencia === 'mensal' ? 'mensal' : 'semanal',
    }

    const save = async (withDate = true, withCadencia = true) => {
      let row = payload
      if (!withDate) row = { ...row, data_ocorrencia: undefined }
      if (!withCadencia) row = { ...row, cadencia: undefined }
      if (id) {
        return supabase.from('desafios_catalogo').update(row).eq('id', id).select().single()
      }
      return supabase.from('desafios_catalogo').insert(row).select().single()
    }

    let resp = await save(true, true)
    const missingDateCol = resp.error && String(resp.error.message || '').toLowerCase().includes('data_ocorrencia')
    const missingCadenciaCol = resp.error && String(resp.error.message || '').toLowerCase().includes('cadencia')

    // Compatibilidade para bancos que ainda não aplicaram as migrations mais recentes
    if (missingDateCol || missingCadenciaCol) {
      resp = await save(!missingDateCol, !missingCadenciaCol)
    }

    if (resp.error) throw resp.error
    return resp.data
  },

  async deleteDesafioCatalogo(id) {
    const { error: e1 } = await supabase.from('desafios_registros').delete().eq('desafio_id', id)
    if (e1) throw e1
    const { error: e2 } = await supabase.from('desafios_marcos').delete().eq('desafio_id', id)
    if (e2) throw e2
    const { error } = await supabase.from('desafios_catalogo').delete().eq('id', id)
    if (error) throw error
    return true
  },

  async getConfiguracaoTrimestres(ano) {
    const { data, error } = await supabase
      .from('configuracao_trimestres')
      .select('*')
      .eq('ano', ano)
      .order('trimestre', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async upsertConfiguracaoTrimestre({ ano, trimestre, primeiro_sabado, ultimo_sabado }) {
    const { data, error } = await supabase
      .from('configuracao_trimestres')
      .upsert({ ano, trimestre, primeiro_sabado, ultimo_sabado }, { onConflict: 'ano,trimestre' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteConfiguracaoTrimestre(id) {
    const { error } = await supabase
      .from('configuracao_trimestres')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },

  async getDesafiosRegistros(base_id, primeiro_sabado, ultimo_sabado) {
    const { data, error } = await supabase
      .from('desafios_registros')
      .select('*')
      .eq('base_id', base_id)
      .gte('data_sabado', primeiro_sabado)
      .lte('data_sabado', ultimo_sabado)
    if (error) throw error
    return data ?? []
  },

  async getDesafiosRegistrosPorAno(base_id, ano) {
    const { data, error } = await supabase
      .from('desafios_registros')
      .select('*')
      .eq('base_id', base_id)
      .gte('data_sabado', `${ano}-01-01`)
      .lte('data_sabado', `${ano}-12-31`)
    if (error) throw error
    return data ?? []
  },

  async upsertRegistro({ base_id, desafio_id, data_sabado, realizado, responsavel, obs }) {
    const { data, error } = await supabase
      .from('desafios_registros')
      .upsert(
        { base_id, desafio_id, data_sabado, realizado, responsavel: responsavel ?? null, obs: obs ?? null },
        { onConflict: 'base_id,desafio_id,data_sabado' }
      )
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getDesafiosMarcos(base_id, ano) {
    const { data, error } = await supabase
      .from('desafios_marcos')
      .select('*')
      .eq('base_id', base_id)
      .eq('ano', ano)
    if (error) throw error
    return data ?? []
  },

  async upsertMarco({ base_id, desafio_id, ano, trimestre, mes, realizado, data_realizacao, responsavel, obs }) {
    const payload = {
      base_id,
      desafio_id,
      ano,
      trimestre: trimestre ?? null,
      mes: mes ?? null,
      realizado,
      data_realizacao: data_realizacao ?? null,
      responsavel: responsavel ?? null,
      obs: obs ?? null,
    }

    // Busca registro existente considerando NULL em trimestre e mes
    let q = supabase
      .from('desafios_marcos')
      .select('id')
      .eq('base_id', base_id)
      .eq('desafio_id', desafio_id)
      .eq('ano', ano)

    q = trimestre != null ? q.eq('trimestre', trimestre) : q.is('trimestre', null)
    q = mes != null ? q.eq('mes', mes) : q.is('mes', null)

    const { data: existing } = await q.maybeSingle()

    if (existing?.id) {
      const { data, error } = await supabase
        .from('desafios_marcos')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return data
    }

    const { data, error } = await supabase
      .from('desafios_marcos')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getAllRegistrosPorAno(ano) {
    const { data, error } = await fetchAllRows((from, to) =>
      supabase
        .from('desafios_registros')
        .select('*')
        .gte('data_sabado', `${ano}-01-01`)
        .lte('data_sabado', `${ano}-12-31`)
        .order('id', { ascending: true })
        .range(from, to)
    )
    if (error) throw error
    return data ?? []
  },

  async getAllMarcosPorAno(ano) {
    const { data, error } = await fetchAllRows((from, to) =>
      supabase
        .from('desafios_marcos')
        .select('*')
        .eq('ano', ano)
        .order('id', { ascending: true })
        .range(from, to)
    )
    if (error) throw error
    return data ?? []
  },

  async getAllNotasTeenPorAno(ano) {
    const { data, error } = await fetchAllRows((from, to) =>
      supabase
        .from('vw_notas_teen')
        .select('id, id_membros, Membros, nome_aluno, id_base, Base, id_regiao, Regiao, id_distritos, Distritos, id_igrejas, Igrejas, data, nota, Nota, titulo, Titulo')
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`)
        .order('id', { ascending: true })
        .range(from, to)
    )
    if (error) throw error
    return (data ?? []).filter(r => {
      const n = Number(r.nota ?? r.Nota)
      return Number.isFinite(n)
    })
  },

  async getAllNotasSoulPorAno(ano) {
    const { data, error } = await fetchAllRows((from, to) =>
      supabase
        .from('vw_notas_soul')
        .select('id, id_membros, Membros, nome_aluno, id_base, Base, id_regiao, Regiao, id_distritos, Distritos, id_igrejas, Igrejas, data, nota, Nota, titulo, Titulo')
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`)
        .order('id', { ascending: true })
        .range(from, to)
    )
    if (error) throw error
    return (data ?? []).filter(r => {
      const n = Number(r.nota ?? r.Nota)
      return Number.isFinite(n)
    })
  },

  async getNotasTeenPorBaseETrimestre(base_id, primeiro_sabado, ultimo_sabado, base_nome = null) {
    const COLS = 'id, id_membros, nome_aluno, data, nota, comunhao, verso, discipulado, trezentos_treinamento, trezentos_estudo, id_base, base'

    const primaryPromise = supabase
      .from('vw_notas_teen')
      .select(COLS)
      .gte('data', primeiro_sabado)
      .lte('data', ultimo_sabado)
      .eq('id_base', base_id)

    // Busca paralela por nome captura notas com id_base errado/nulo
    const namePromise = base_id && base_nome
      ? supabase.from('vw_notas_teen').select(COLS).gte('data', primeiro_sabado).lte('data', ultimo_sabado)
      : Promise.resolve({ data: null, error: null })

    const [primary, byName] = await Promise.all([primaryPromise, namePromise])
    if (primary.error) throw primary.error

    const rows = primary.data ?? []
    if (!byName.error && byName.data) {
      const existingIds = new Set(rows.map(r => r.id))
      const extra = byName.data.filter(row => !existingIds.has(row.id) && matchesBaseRow(row, base_id, base_nome))
      if (extra.length > 0) return [...rows, ...extra]
    }

    if (rows.length === 0 && base_id && base_nome) {
      return fetchLegacyNotasFallback({
        legacyTableCandidates: ['Notas_Teen', 'notas_teen'],
        normalizeTable: 'Notas_Teen',
        base_id,
        base_nome,
        primeiro_sabado,
        ultimo_sabado,
      })
    }

    return rows
  },

  async getNotasSoulPorBaseETrimestre(base_id, primeiro_sabado, ultimo_sabado, base_nome = null) {
    const COLS = 'id, id_membros, nome_aluno, data, nota, comunhao, verso, discipulado, trezentos_treinamento, trezentos_estudo, id_base, base'

    const primaryPromise = supabase
      .from('vw_notas_soul')
      .select(COLS)
      .gte('data', primeiro_sabado)
      .lte('data', ultimo_sabado)
      .eq('id_base', base_id)

    // Busca paralela por nome captura notas com id_base errado/nulo
    const namePromise = base_id && base_nome
      ? supabase.from('vw_notas_soul').select(COLS).gte('data', primeiro_sabado).lte('data', ultimo_sabado)
      : Promise.resolve({ data: null, error: null })

    const [primary, byName] = await Promise.all([primaryPromise, namePromise])
    if (primary.error) throw primary.error

    const rows = primary.data ?? []
    if (!byName.error && byName.data) {
      const existingIds = new Set(rows.map(r => r.id))
      const extra = byName.data.filter(row => !existingIds.has(row.id) && matchesBaseRow(row, base_id, base_nome))
      if (extra.length > 0) return [...rows, ...extra]
    }

    if (rows.length === 0 && base_id && base_nome) {
      return fetchLegacyNotasFallback({
        legacyTableCandidates: ['Notas_Soul', 'notas_soul'],
        normalizeTable: 'Notas_Soul',
        base_id,
        base_nome,
        primeiro_sabado,
        ultimo_sabado,
      })
    }

    return rows
  },

  // ── DISCÍPULOS TEEN ─────────────────────────────────────────

  async getDiscipulosRequisitoCatalogo() {
    const { data, error } = await supabase
      .from('discipulos_requisitos_catalogo')
      .select('*')
      .order('numero', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async upsertDiscipuloRequisitoCatalogo({ id, numero, descricao, pontos, ativo }) {
    const payload = {
      numero: Number(numero),
      descricao,
      pontos: Number(pontos ?? 0),
      ativo: ativo !== false,
    }
    if (id) {
      const { data, error } = await supabase
        .from('discipulos_requisitos_catalogo')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('discipulos_requisitos_catalogo')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getDiscipuladoDepartamentos(onlyAtivos = false) {
    let query = supabase
      .from('discipulado_departamentos_catalogo')
      .select('*')

    if (onlyAtivos) query = query.eq('ativo', true)

    const { data, error } = await query
      .order('nome', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getDiscipuladoDepartamentosAtivos() {
    return this.getDiscipuladoDepartamentos(true)
  },

  async upsertDiscipuladoDepartamento({ id, nome, ativo, ordem }) {
    const payload = {
      nome: String(nome ?? '').trim(),
      ativo: ativo !== false,
      ordem: Number(ordem ?? 99),
    }

    if (!payload.nome) throw new Error('Nome do departamento é obrigatório.')

    if (id) {
      const { data, error } = await supabase
        .from('discipulado_departamentos_catalogo')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }

    const { data, error } = await supabase
      .from('discipulado_departamentos_catalogo')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteDiscipuladoDepartamento(id) {
    const { error } = await supabase
      .from('discipulado_departamentos_catalogo')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },

  async getDiscipulosCartoes(base_id, ano, tipo = 'G148 Teen') {
    const { data, error } = await supabase
      .from('discipulos_cartoes')
      .select('*')
      .eq('base_id', base_id)

    if (error) throw error

    const targetTipo = normalizeTipoMinisterio(tipo)
    const targetAno = Number(ano)

    return (data ?? [])
      .filter((card) => {
        const cardAno = Number(card?.ano)
        if (Number.isFinite(targetAno) && Number.isFinite(cardAno) && cardAno !== targetAno) return false

        if (targetTipo) {
          const cardTipo = normalizeTipoMinisterio(card?.tipo)
          if (cardTipo && cardTipo !== targetTipo) return false
        }

        return true
      })
      .sort((a, b) => {
        const ordA = Number(a?.ordem ?? 999)
        const ordB = Number(b?.ordem ?? 999)
        if (ordA !== ordB) return ordA - ordB
        return String(a?.criado_em ?? '').localeCompare(String(b?.criado_em ?? ''))
      })
  },

  async createDiscipulosCartao({ membro_id, base_id, ano, tipo = 'G148 Teen', nome, departamento, descricao, data_inicio, data_fim, observacoes_professor, foto_url }) {
    const { data: ultimoCartao, error: ultimoCartaoError } = await supabase
      .from('discipulos_cartoes')
      .select('ordem')
      .eq('membro_id', membro_id)
      .eq('base_id', base_id)
      .eq('ano', ano)
      .eq('tipo', tipo)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ultimoCartaoError) throw ultimoCartaoError

    const ordem = (ultimoCartao?.ordem ?? 0) + 1
    const payload = {
      membro_id,
      base_id,
      ano,
      tipo,
      ordem,
      nome: nome?.trim() || `Cartão ${ordem}`,
      departamento: departamento?.trim() || null,
      descricao: descricao?.trim() || null,
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
      observacoes_professor: observacoes_professor?.trim() || null,
      foto_url: foto_url ?? null,
    }

    const { data, error } = await supabase
      .from('discipulos_cartoes')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateDiscipulosCartao({ id, nome, departamento, descricao, data_inicio, data_fim, observacoes_professor, foto_url }) {
    const payload = {
      nome: nome?.trim() || 'Cartão',
      departamento: departamento?.trim() || null,
      descricao: descricao?.trim() || null,
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
      observacoes_professor: observacoes_professor?.trim() || null,
      atualizado_em: new Date().toISOString(),
    }
    if (foto_url !== undefined) payload.foto_url = foto_url ?? null
    const { data, error } = await supabase
      .from('discipulos_cartoes')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteDiscipulosCartao(id) {
    const { error } = await supabase
      .from('discipulos_cartoes')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async getDiscipulosRegistros(base_id, ano, tipo = null) {
    if (!tipo) {
      const { data, error } = await supabase
        .from('discipulos_registros')
        .select('*')
        .eq('base_id', base_id)
        .eq('ano', ano)
      if (error) throw error
      return data ?? []
    }

    const cartoes = await this.getDiscipulosCartoes(base_id, ano, tipo)
    const ids = cartoes.map(c => c.id)
    if (!ids.length) return []

    const { data, error } = await supabase
      .from('discipulos_registros')
      .select('*')
      .eq('base_id', base_id)
      .eq('ano', ano)
      .in('card_id', ids)
    if (error) throw error
    return data ?? []
  },

  async getAllDiscipulosCartoesPorAno(ano) {
    const { data, error } = await fetchAllRows((from, to) =>
      supabase
        .from('discipulos_cartoes')
        .select('*')
        .eq('ano', ano)
        .order('ordem', { ascending: true })
        .range(from, to)
    )
    if (error) throw error
    return data ?? []
  },

  async getDiscipulosConfig() {
    const { data, error } = await supabase
      .from('discipulos_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async upsertDiscipulosConfig({ pontos_por_cartao }) {
    const { data, error } = await supabase
      .from('discipulos_config')
      .upsert({ id: 1, pontos_por_cartao: Number(pontos_por_cartao ?? 0), atualizado_em: new Date().toISOString() }, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getAllDiscipulosRegistrosPorAno(ano) {
    const { data, error } = await fetchAllRows((from, to) =>
      supabase
        .from('discipulos_registros')
        .select('*')
        .eq('ano', ano)
        .order('id', { ascending: true })
        .range(from, to)
    )
    if (error) throw error
    return data ?? []
  },

  async upsertDiscipuloRegistro({ membro_id, base_id, card_id, requisito_id, ano, realizado, data_realizacao, responsavel }) {
    if (!card_id) throw new Error('Cartão do discipulado não informado.')

    const payload = {
      membro_id,
      base_id,
      card_id,
      requisito_id,
      ano,
      realizado: realizado ?? false,
      data_realizacao: data_realizacao ?? null,
      responsavel: responsavel ?? null,
    }
    const { data: existing } = await supabase
      .from('discipulos_registros')
      .select('id')
      .eq('membro_id', membro_id)
      .eq('card_id', card_id)
      .eq('requisito_id', requisito_id)
      .eq('ano', ano)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await supabase
        .from('discipulos_registros')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('discipulos_registros')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // ── BATISMOS ─────────────────────────────────────────────────

  async getBatismosConfig() {
    const { data, error } = await supabase
      .from('batismos_config')
      .select('*')
      .eq('id', 1)
      .single()
    if (error) throw error
    return data
  },

  async upsertBatismosConfig({ pontos_por_batismo }) {
    const { data, error } = await supabase
      .from('batismos_config')
      .upsert({ id: 1, pontos_por_batismo: Number(pontos_por_batismo ?? 0) }, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getBatismos(base_id, ano) {
    const { data, error } = await supabase
      .from('batismos_registros')
      .select('*')
      .eq('base_id', base_id)
      .eq('ano', ano)
      .order('mes', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async getAllBatismosPorAno(ano) {
    const { data, error } = await fetchAllRows((from, to) =>
      supabase
        .from('batismos_registros')
        .select('*')
        .eq('ano', ano)
        .order('id', { ascending: true })
        .range(from, to)
    )
    if (error) throw error
    return data ?? []
  },

  async upsertBatismo({ id, base_id, nome, mes, ano, foto_url, obs }) {
    const payload = {
      base_id,
      nome,
      mes: mes ? Number(mes) : null,
      ano: Number(ano),
      foto_url: foto_url ?? null,
      obs: obs ?? null,
    }
    if (id) {
      const { data, error } = await supabase
        .from('batismos_registros')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('batismos_registros')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteBatismo(id) {
    const { error } = await supabase.from('batismos_registros').delete().eq('id', id)
    if (error) throw error
    return true
  },

  // Sincroniza automaticamente o desafio anual "Batismo" com o count real de batismos.
  // Chamado após cada upsert/delete de batismo.
  async syncBatismoDesafio(base_id, ano, tipo) {
    const [batismos, catalogo] = await Promise.all([
      this.getBatismos(base_id, ano),
      this.getDesafiosCatalogo(tipo),
    ])
    const count = batismos.length
    const batismoDesafio = catalogo.find(
      d => d.periodicidade === 'anual' && /batismo/i.test(d.nome ?? '')
    )
    if (!batismoDesafio) return

    // Preserva data e obs que o usuário possa ter registrado manualmente
    let q = supabase
      .from('desafios_marcos')
      .select('data_realizacao, obs')
      .eq('base_id', base_id)
      .eq('desafio_id', batismoDesafio.id)
      .eq('ano', ano)
      .is('trimestre', null)
      .is('mes', null)
    const { data: existing } = await q.maybeSingle()

    // Quando não há batismos registrados, limpa tudo (data_realizacao + obs)
    if (count === 0) {
      return this.upsertMarco({
        base_id,
        desafio_id: batismoDesafio.id,
        ano,
        trimestre: null,
        mes: null,
        realizado: false,
        data_realizacao: null,
        obs: null,
      })
    }

    return this.upsertMarco({
      base_id,
      desafio_id: batismoDesafio.id,
      ano,
      trimestre: null,
      mes: null,
      realizado: true,
      data_realizacao: existing?.data_realizacao ?? null,
      obs: `${count} batismo(s) registrado(s) em ${ano}.`,
    })
  },

  // ── BIBLIOTECA DE IMAGENS ────────────────────────────────────

  async getBibliotecaImagens(base_id) {
    const { data, error } = await supabase
      .from('biblioteca_imagens')
      .select('*')
      .eq('base_id', base_id)
      .order('data_upload', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async upsertBibliotecaImagem({ id, base_id, titulo, url, data_upload, observacao }) {
    const payload = {
      base_id,
      titulo,
      url,
      data_upload: data_upload ?? new Date().toISOString().split('T')[0],
      observacao: observacao ?? null,
    }
    if (id) {
      const { data, error } = await supabase
        .from('biblioteca_imagens')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('biblioteca_imagens')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteBibliotecaImagem(id) {
    const { error } = await supabase.from('biblioteca_imagens').delete().eq('id', id)
    if (error) throw error
    return true
  },

  // ── STORAGE (upload de arquivos) ─────────────────────────────

  async uploadArquivo(bucket, path, file) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return urlData.publicUrl
  },
}
