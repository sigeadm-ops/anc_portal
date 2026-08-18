#!/usr/bin/env node
/**
 * Script para renomear códigos de desafios: ADM_* → DA_*
 * Atenção: O código é UNIQUE, então é uma mudança delicada
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fecxszutgrotuksedyvd.supabase.co'
const supabaseKey = 'sb_publishable_GzL61qw6QQq9aRTag3GmLA_OHAXpiVd'

const supabase = createClient(supabaseUrl, supabaseKey)

async function renomearCodigos() {
  try {
    console.log('🔍 Buscando desafios com código "ADM_" para renomear...\n')
    
    // 1. Listar desafios ADM_
    const { data: desafios, error: errorLista } = await supabase
      .from('desafios_catalogo')
      .select('id, codigo, nome')
      .ilike('codigo', 'ADM_%')
      .order('codigo', { ascending: true })
    
    if (errorLista) {
      console.error('❌ Erro ao listar:', errorLista.message)
      process.exit(1)
    }
    
    if (!desafios || desafios.length === 0) {
      console.log('ℹ️  Nenhum desafio com código "ADM_" encontrado.')
      process.exit(0)
    }
    
    console.log(`📋 ${desafios.length} desafio(s) encontrado(s) para renomear:\n`)
    desafios.forEach(d => {
      const novoCodigo = d.codigo.replace('ADM_', 'DA_')
      console.log(`   ${d.codigo} → ${novoCodigo} | ${d.nome}`)
    })
    
    console.log('\n⏳ Aplicando renomeação...')
    
    // 2. Renomear cada código
    let sucesso = 0
    let erro = 0
    
    for (const desafio of desafios) {
      const novoCodigo = desafio.codigo.replace('ADM_', 'DA_')
      
      const { error: updateError } = await supabase
        .from('desafios_catalogo')
        .update({ codigo: novoCodigo })
        .eq('id', desafio.id)
      
      if (updateError) {
        console.error(`   ❌ Erro ao renomear ${desafio.codigo}: ${updateError.message}`)
        erro++
      } else {
        sucesso++
      }
    }
    
    console.log(`\n✅ Conclusão:`)
    console.log(`   • ${sucesso} código(s) renomeado(s) com sucesso`)
    if (erro > 0) {
      console.log(`   • ⚠️  ${erro} erro(s) durante renomeação`)
    }
    
    // 3. Verificar resultado
    const { data: desafiosNovos, error: errorVerif } = await supabase
      .from('desafios_catalogo')
      .select('id, codigo, nome')
      .ilike('codigo', 'DA_%')
      .order('codigo', { ascending: true })
    
    if (!errorVerif && desafiosNovos && desafiosNovos.length > 0) {
      console.log(`\n📋 Desafios com novo código "DA_":\n`)
      desafiosNovos.slice(0, 10).forEach(d => {
        console.log(`   ${d.codigo}: ${d.nome}`)
      })
      if (desafiosNovos.length > 10) {
        console.log(`   ... e mais ${desafiosNovos.length - 10}`)
      }
    }
    
    console.log('\n🎉 Operação concluída!')
    
  } catch (err) {
    console.error('❌ Erro inesperado:', err.message)
    process.exit(1)
  }
}

renomearCodigos()
