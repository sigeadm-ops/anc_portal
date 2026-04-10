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

// ================================================================
// API GENÉRICA — CRUD apenas no Supabase (Sheets desconectado)
// ================================================================

export const db = {

  // ── SELECT ──────────────────────────────────────────────────
  async getAll(table) {
    const source = VIEW_MAP[table] || table
    
    // Tenta buscar com ordenação padrão primeiro
    // Bases usa 'CreatedAt', Membros usa 'CreateAt'
    const sortCol = (table === 'Bases') ? 'CreatedAt' : 'CreateAt'
    
    const query = supabase.from(source).select('*')
    
    // Testa se a coluna de ordenação existe, senão busca sem ordem
    const { data, error } = await query.order(sortCol, { ascending: false })
    
    if (error) {
      console.warn(`Erro ao ordenar por ${sortCol} na tabela ${table}, tentando sem ordem...`)
      const { data: fallbackData, error: fallbackError } = await supabase.from(source).select('*')
      if (fallbackError) throw fallbackError
      return fallbackData
    }
    
    return data
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
    return data
  },

  // ── INSERT ──────────────────────────────────────────────────
  async insert(table, record) {
    const { data: inserted, error } = await supabase
      .from(table)
      .insert(record)
      .select()
      .single()
    if (error) throw error
    return inserted
  },

  // ── UPDATE ──────────────────────────────────────────────────
  async update(table, id, record) {
    const pk = PK_MAP[table] || 'id'
    const { data: updated, error } = await supabase
      .from(table)
      .update(record)
      .eq(pk, id)
      .select()
      .single()
    if (error) throw error
    return updated
  },

  // ── DELETE ──────────────────────────────────────────────────
  async delete(table, id) {
    const pk = PK_MAP[table] || 'id'
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(pk, id)
    if (error) throw error
    return true
  },

  // ── NOTAS: insere todas as linhas de um formulário ──────────
  async insertNotasForm(rows, _ignored, tableName = 'Notas_Teen') {
    const { data, error } = await supabase
      .from(tableName)
      .insert(rows)
      .select()
    if (error) throw error
    return data
  },

  // ── TABELAS DIMENSÃO ────────────────────────────────────────
  async getRegioes() {
    const { data, error } = await supabase
      .from('Regiao')
      .select('*')
      .order('Regiao', { ascending: true })
    if (error) throw error
    return data
  },

  async getDistritos() {
    const { data, error } = await supabase
      .from('Distritos')
      .select('*')
      .order('Distritos', { ascending: true })
    if (error) throw error
    return data
  },

  async getIgrejas() {
    const { data, error } = await supabase
      .from('Igrejas')
      .select('*')
      .order('Igrejas', { ascending: true })
    if (error) throw error
    return data
  },
}
