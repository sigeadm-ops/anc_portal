#!/usr/bin/env node
/**
 * Script para aplicar correção em massa nos Desafios
 * Muda categoria de 'admin' para 'da' para desafios Soul+ criados hoje
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://fecxszutgrotuksedyvd.supabase.co'
const supabaseKey = 'sb_publishable_GzL61qw6QQq9aRTag3GmLA_OHAXpiVd'

const supabase = createClient(supabaseUrl, supabaseKey)

async function corrigirDesafios() {
  try {
    console.log('🔍 Buscando desafios a corrigir...')
    
    // 1. Listar desafios que serão corrigidos
    const { data: desafiosAntes, error: errorLista } = await supabase
      .from('desafios_catalogo')
      .select('id, codigo, nome, categoria, tipo, created_at')
      .eq('tipo', 'Soul+')
      .eq('categoria', 'admin')
      .gte('created_at', new Date().toISOString().split('T')[0])
    
    if (errorLista) {
      console.error('❌ Erro ao listar desafios:', errorLista.message)
      process.exit(1)
    }
    
    if (!desafiosAntes || desafiosAntes.length === 0) {
      console.log('✅ Nenhum desafio para corrigir encontrado.')
      return
    }
    
    console.log(`\n📋 Desafios encontrados para corrigir: ${desafiosAntes.length}`)
    desafiosAntes.forEach(d => {
      console.log(`   - ${d.codigo}: ${d.nome} (categoria: ${d.categoria})`)
    })
    
    // 2. Atualizar categoria de admin para da
    console.log('\n⏳ Aplicando correção...')
    const { error: errorUpdate } = await supabase
      .from('desafios_catalogo')
      .update({ categoria: 'da' })
      .eq('tipo', 'Soul+')
      .eq('categoria', 'admin')
      .gte('created_at', new Date().toISOString().split('T')[0])
    
    if (errorUpdate) {
      console.error('❌ Erro ao atualizar:', errorUpdate.message)
      process.exit(1)
    }
    
    // 3. Verificar resultado
    const { data: desafiosDepois, error: errorVerificacao } = await supabase
      .from('desafios_catalogo')
      .select('id, codigo, nome, categoria, tipo')
      .eq('tipo', 'Soul+')
      .eq('categoria', 'da')
      .gte('created_at', new Date().toISOString().split('T')[0])
    
    if (!errorVerificacao && desafiosDepois) {
      console.log(`\n✅ Sucesso! ${desafiosDepois.length} desafios corrigidos:`)
      desafiosDepois.forEach(d => {
        console.log(`   - ${d.codigo}: ${d.nome} (categoria: ${d.categoria})`)
      })
    }
    
    // 4. Registrar no log de auditoria
    console.log('\n📝 Registrando na auditoria...')
    const { error: errorLog } = await supabase
      .from('admin_activity_log')
      .insert({
        username: 'system',
        action: 'update',
        entity: 'desafios_catalogo',
        description: `Correção automática: ${desafiosAntes.length} desafio(s) Soul+ categoria admin → da`
      })
    
    if (errorLog) {
      console.warn('⚠️  Aviso: Não conseguiu registrar na auditoria:', errorLog.message)
    } else {
      console.log('✅ Auditoria registrada')
    }
    
    console.log('\n🎉 Operação concluída com sucesso!')
    
  } catch (err) {
    console.error('❌ Erro inesperado:', err.message)
    process.exit(1)
  }
}

corrigirDesafios()
