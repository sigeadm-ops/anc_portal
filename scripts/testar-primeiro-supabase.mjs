#!/usr/bin/env node
/**
 * Script para buscar quais tabelas existem no primeiro Supabase (o que o frontend usa)
 */

import { createClient } from '@supabase/supabase-js'

async function listarTabelas() {
  const url = 'https://fecxszutgrotuksedyvd.supabase.co'
  const anonKey = 'sb_publishable_GzL61qw6QQq9aRTag3GmLA_OHAXpiVd'
  
  const supabase = createClient(url, anonKey)
  
  console.log(`🔍 Testando URL: ${url}\n`)
  
  try {
    const { data: membros, error: e1 } = await supabase
      .from('Membros')
      .select('id', { count: 'exact' })
      .limit(1)
    
    if (!e1) {
      console.log('✅ Tabela "Membros" existe')
    } else {
      console.log('❌ Membros:', e1.message)
    }
    
    const { data: notas, error: e2 } = await supabase
      .from('Notas_Teen')
      .select('id', { count: 'exact' })
      .limit(1)
    
    if (!e2) {
      console.log('✅ Tabela "Notas_Teen" existe')
    } else {
      console.log('❌ Notas_Teen:', e2.message)
    }
    
    const { data: desafios, error: e3 } = await supabase
      .from('desafios_catalogo')
      .select('id', { count: 'exact' })
      .limit(1)
    
    if (!e3) {
      console.log('✅ Tabela "desafios_catalogo" existe')
      return true
    } else {
      console.log('❌ desafios_catalogo:', e3.message)
    }
    
  } catch (err) {
    console.error('❌ Erro:', err.message)
  }
  
  return false
}

listarTabelas().then(found => {
  if (found) {
    console.log('\n✅ Use VITE_SUPABASE_URL')
    process.exit(0)
  } else {
    console.log('\n❌ Tabelas não encontradas em nenhum projeto')
    process.exit(1)
  }
})
