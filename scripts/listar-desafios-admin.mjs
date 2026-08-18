#!/usr/bin/env node
/**
 * Script para listar desafios com categoria 'admin' que precisam ser corrigidos
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fecxszutgrotuksedyvd.supabase.co'
const supabaseKey = 'sb_publishable_GzL61qw6QQq9aRTag3GmLA_OHAXpiVd'

const supabase = createClient(supabaseUrl, supabaseKey)

async function listarDesafiosAdmin() {
  try {
    console.log('🔍 Buscando desafios com categoria "admin"...\n')
    
    const { data: desafios, error } = await supabase
      .from('desafios_catalogo')
      .select('id, codigo, nome, categoria, tipo, rastreamento, pontos_total')
      .eq('categoria', 'admin')
      .order('codigo', { ascending: true })
    
    if (error) {
      console.error('❌ Erro ao buscar:', error.message)
      process.exit(1)
    }
    
    if (!desafios || desafios.length === 0) {
      console.log('ℹ️  Nenhum desafio com categoria "admin" encontrado.')
      console.log('\nPara verificar se existem desafios com outro nome de categoria, execute:')
      console.log('   node scripts/listar-todas-categorias.mjs')
      process.exit(0)
    }
    
    console.log(`📋 ${desafios.length} desafio(s) encontrado(s):\n`)
    desafios.forEach(d => {
      console.log(`   ID: ${d.id}`)
      console.log(`   Código: ${d.codigo}`)
      console.log(`   Nome: ${d.nome}`)
      console.log(`   Categoria: ${d.categoria}`)
      console.log(`   Tipo: ${d.tipo}`)
      console.log(`   Pontos: ${d.pontos_total}`)
      console.log()
    })
    
  } catch (err) {
    console.error('❌ Erro:', err.message)
    process.exit(1)
  }
}

listarDesafiosAdmin()
