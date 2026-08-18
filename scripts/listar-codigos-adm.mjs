#!/usr/bin/env node
/**
 * Script para verificar quais desafios usam código "ADM_" e poderiam ser "DA_"
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fecxszutgrotuksedyvd.supabase.co'
const supabaseKey = 'sb_publishable_GzL61qw6QQq9aRTag3GmLA_OHAXpiVd'

const supabase = createClient(supabaseUrl, supabaseKey)

async function listarDesafiosADM() {
  try {
    console.log('🔍 Buscando desafios com código "ADM_"...\n')
    
    const { data: desafios, error } = await supabase
      .from('desafios_catalogo')
      .select('id, codigo, nome, categoria, tipo')
      .ilike('codigo', 'ADM_%')
      .order('codigo', { ascending: true })
    
    if (error) {
      console.error('❌ Erro:', error.message)
      process.exit(1)
    }
    
    if (!desafios || desafios.length === 0) {
      console.log('Nenhum desafio com código "ADM_" encontrado.')
      process.exit(0)
    }
    
    console.log(`📋 ${desafios.length} desafio(s) com código "ADM_":\n`)
    desafios.forEach(d => {
      console.log(`   ${d.codigo} → ${d.categoria} | ${d.tipo} | ${d.nome}`)
    })
    
    console.log('\n💡 Para renomear estes códigos de "ADM_" para "DA_", execute:')
    console.log('   node scripts/renomear-codigos-desafios.mjs')
    
  } catch (err) {
    console.error('❌ Erro:', err.message)
    process.exit(1)
  }
}

listarDesafiosADM()
