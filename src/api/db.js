import { supabase } from './supabase'
import { SheetsAPI } from './sheetsApi'

// ================================================================
// Mapeamento tabela → view para leituras (getAll)
// Inserts/Updates continuam nas tabelas base com FKs
// ================================================================
const VIEW_MAP = {
  Bases:      'vw_bases',
  Membros:    'vw_membros',
  Notas_Teen: 'vw_notas',      // vw_notas unificada no v2
  Notas_Soul: 'vw_notas',
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
    
    // Tenta buscar com ordenação padrão primeiro
    // Tenta colunas de ordenação comuns. Se todas falharem, busca sem ordem (evita erros 400).
    const possibleCols = ['created_at', 'CreatedAt', 'CreateAt']
    let data = null
    let error = null

    for (const col of possibleCols) {
      const resp = await supabase.from(source).select('*').order(col, { ascending: false })
      if (!resp.error) {
        data = resp.data
        break
      }
      error = resp.error
    }

    if (!data) {
      const resp = await supabase.from(source).select('*')
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
    const pk = PK_MAP[table] || 'id'
    const { data, error } = await supabase
      .from(source)
      .select('*')
      .eq(pk, id)
      .single()
    if (error) throw error
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
    const pk = PK_MAP[table] || 'id'
    const payload = mapWriteRecord(table, record)
    const { data: updated, error } = await supabase
      .from(target)
      .update(payload)
      .eq(pk, id)
      .select()
      .single()
    if (error) throw error
    return normalizeReadRow(table, updated)
  },

  // ── DELETE ──────────────────────────────────────────────────
  async delete(table, id) {
    const target = TABLE_MAP[table] || table
    const pk = PK_MAP[table] || 'id'
    const { error } = await supabase
      .from(target)
      .delete()
      .eq(pk, id)
    if (error) throw error
    return true
  },

  // ── NOTAS: insere todas as linhas de um formulário ──────────
  async insertNotasForm(rows, _ignored, tableName = 'Notas_Teen') {
    let payload = rows
    // Em bases legadas, algumas colunas não existem (ex.: Versao/SalvoEm).
    // Faz retry removendo a coluna apontada no erro para não travar o lançamento.
    for (let attempt = 0; attempt < 6; attempt++) {
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
}
