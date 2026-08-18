#!/usr/bin/env node
/**
 * Script para corrigir desafios: categoria admin → da
 * Muda TODOS os desafios Soul+ com categoria 'admin' para 'da'
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fecxszutgrotuksedyvd.supabase.co'
const supabaseKey = 'sb_publishable_GzL61qw6QQq9aRTag3GmLA_OHAXpiVd'

const supabase = createClient(supabaseUrl, supabaseKey)

async function corrigirDesafios() {
  try {
    console.log('🔍 Buscando desafios Soul+ com categoria "admin"...\n')
    
    // 1. Listar desafios que serão corrigidos
    const { data: desafiosAntes, error: errorLista } = await supabase
      .from('desafios_catalogo')
      .select('id, codigo, nome, categoria')
      .eq('categoria', 'admin')
      .eq('tipo', 'Soul+')
      .order('codigo', { ascending: true })
    
    if (errorLista) {
      console.error('❌ Erro ao listar desafios:', errorLista.message)
      process.exit(1)
    }
    
    if (!desafiosAntes || desafiosAntes.length === 0) {
      console.log('✅ Nenhum desafio Soul+ com categoria "admin" encontrado.')
      process.exit(0)
    }
    
    console.log(`📋 ${desafiosAntes.length} desafio(s) encontrado(s) para corrigir:\n`)
    desafiosAntes.forEach(d => {
      console.log(`   ${d.codigo}: ${d.nome}`)
    })
    
    console.log('\n⏳ Aplicando correção...')
    
    // 2. Atualizar cada desafio individualmente
    let sucesso = 0
    let erro = 0
    
    for (const desafio of desafiosAntes) {
      const { error: updateError } = await supabase
        .from('desafios_catalogo')
        .update({ categoria: 'da' })
        .eq('id', desafio.id)
      
      if (updateError) {
        console.error(`   ❌ Erro ao atualizar ${desafio.codigo}: ${updateError.message}`)
        erro++
      } else {
        sucesso++
      }
    }
    
    console.log(`\n✅ Conclusão:`)
    console.log(`   • ${sucesso} desafio(s) atualizado(s) com sucesso`)
    if (erro > 0) {
      console.log(`   • ⚠️  ${erro} erro(s) durante atualização`)
    }
    
    // 3. Verificar resultado
    const { data: desafiosDepois, error: errorVerificacao } = await supabase
      .from('desafios_catalogo')
      .select('id, codigo, nome, categoria')
      .eq('categoria', 'da')
      .eq('tipo', 'Soul+')
      .order('codigo', { ascending: true })
    
    if (!errorVerificacao && desafiosDepois && desafiosDepois.length > 0) {
      console.log(`\n📋 Desafios corrigidos (categoria agora é 'da'):\n`)
      desafiosDepois.forEach(d => {
        console.log(`   ${d.codigo}: ${d.nome}`)
      })
    }
    
    console.log('\n🎉 Operação concluída!')
    
  } catch (err) {
    console.error('❌ Erro inesperado:', err.message)
    process.exit(1)
  }
}

corrigirDesafios()
