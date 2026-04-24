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
      return data.filter(d => {
        const itemTipo = (d.tipo || 'G148 Teen').toLowerCase()
        if (isTeen) return itemTipo.includes('teen')
        return itemTipo.includes('soul')
      })
    }
    return data
  },

  async getDesafiosCatalogoAll() {
    const { data, error } = await supabase
      .from('desafios_catalogo')
      .select('*')
      .order('ordem', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async upsertDesafioCatalogo({ id, codigo, nome, descricao, categoria, rastreamento, periodicidade, pontos_total, ordem, ativo, mes_ref, tipo }) {
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
    }
    if (id) {
      const { data, error } = await supabase.from('desafios_catalogo').update(payload).eq('id', id).select().single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase.from('desafios_catalogo').insert(payload).select().single()
    if (error) throw error
    return data
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
    const { data, error } = await supabase
      .from('desafios_registros')
      .select('*')
      .gte('data_sabado', `${ano}-01-01`)
      .lte('data_sabado', `${ano}-12-31`)
    if (error) throw error
    return data ?? []
  },

  async getAllMarcosPorAno(ano) {
    const { data, error } = await supabase
      .from('desafios_marcos')
      .select('*')
      .eq('ano', ano)
    if (error) throw error
    return data ?? []
  },

  async getAllNotasTeenPorAno(ano) {
    const { data, error } = await supabase
      .from('vw_notas_teen')
      .select('id_membros, Membros, nome_aluno, id_base, Base, id_regiao, Regiao, id_distritos, Distritos, id_igrejas, Igrejas, nota, Nota')
      .gte('Data', `${ano}-01-01`)
      .lte('Data', `${ano}-12-31`)
    if (error) throw error
    return (data ?? []).filter(r => {
      const n = Number(r.nota ?? r.Nota)
      return Number.isFinite(n)
    })
  },

  async getAllNotasSoulPorAno(ano) {
    const { data, error } = await supabase
      .from('vw_notas_soul')
      .select('id_membros, Membros, nome_aluno, id_base, Base, id_regiao, Regiao, id_distritos, Distritos, id_igrejas, Igrejas, nota, Nota')
      .gte('Data', `${ano}-01-01`)
      .lte('Data', `${ano}-12-31`)
    if (error) throw error
    return (data ?? []).filter(r => {
      const n = Number(r.nota ?? r.Nota)
      return Number.isFinite(n)
    })
  },

  async getNotasTeenPorBaseETrimestre(base_id, primeiro_sabado, ultimo_sabado) {
    const { data, error } = await supabase
      .from('vw_notas_teen')
      .select('id, id_membros, Membros, nome_aluno, Data, Nota, nota')
      .eq('id_base', base_id)
      .gte('Data', primeiro_sabado)
      .lte('Data', ultimo_sabado)
    if (error) throw error
    return data ?? []
  },

  async getNotasSoulPorBaseETrimestre(base_id, primeiro_sabado, ultimo_sabado) {
    const { data, error } = await supabase
      .from('vw_notas_soul')
      .select('id, id_membros, Membros, nome_aluno, Data, Nota, nota')
      .eq('id_base', base_id)
      .gte('Data', primeiro_sabado)
      .lte('Data', ultimo_sabado)
    if (error) throw error
    return data ?? []
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
    let query = supabase
      .from('discipulos_cartoes')
      .select('*')
      .eq('base_id', base_id)
      .eq('ano', ano)

    if (tipo) query = query.eq('tipo', tipo)

    const { data, error } = await query
      .order('ordem', { ascending: true })
      .order('criado_em', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async createDiscipulosCartao({ membro_id, base_id, ano, tipo = 'G148 Teen', nome, departamento }) {
    const { count, error: countError } = await supabase
      .from('discipulos_cartoes')
      .select('*', { count: 'exact', head: true })
      .eq('membro_id', membro_id)
      .eq('base_id', base_id)
      .eq('ano', ano)
      .eq('tipo', tipo)

    if (countError) throw countError

    const ordem = (count ?? 0) + 1
    const payload = {
      membro_id,
      base_id,
      ano,
      tipo,
      ordem,
      nome: nome?.trim() || `Cartão ${ordem}`,
      departamento: departamento?.trim() || null,
    }

    const { data, error } = await supabase
      .from('discipulos_cartoes')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateDiscipulosCartao({ id, nome, departamento }) {
    const payload = {
      nome: nome?.trim() || 'Cartão',
      departamento: departamento?.trim() || null,
      atualizado_em: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('discipulos_cartoes')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
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

  async getAllDiscipulosRegistrosPorAno(ano) {
    const { data, error } = await supabase
      .from('discipulos_registros')
      .select('*')
      .eq('ano', ano)
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
    const { data, error } = await supabase
      .from('batismos_registros')
      .select('*')
      .eq('ano', ano)
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
