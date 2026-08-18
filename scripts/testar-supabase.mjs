#!/usr/bin/env node
/**
 * Script para verificar qual Supabase tem as tabelas de desafios
 */

import { createClient } from '@supabase/supabase-js'

const urls = [
  { name: 'VITE_SUPABASE_URL', url: 'https://fecxszutgrotuksedyvd.supabase.co', key: 'sb_publishable_GzL61qw6QQq9aRTag3GmLA_OHAXpiVd' },
  { name: 'portal_anc_SUPABASE_URL', url: 'https://fydiwlxbzlmvqloyqlhz.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZGl3bHhiemxtdnFsb3lxbGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjY1NzYsImV4cCI6MjA5MTM0MjU3Nn0.crzqXNMON-fqtzH0_fYLxOmsjlZapm-AYoBoTKIi8AQ' }
]

async function testar() {
  for (const config of urls) {
    console.log(`\n🔍 Testando ${config.name}...`)
    console.log(`   URL: ${config.url}`)
    
    try {
      const supabase = createClient(config.url, config.key)
      
      // Tentar buscar desafios_catalogo
      const { data: desafios, error: erroDesafios } = await supabase
        .from('desafios_catalogo')
        .select('id, nome, categoria', { count: 'exact' })
        .limit(5)
      
      if (!erroDesafios) {
        console.log(`   ✅ Tabela "desafios_catalogo" ENCONTRADA! (${desafios?.length || 0} registros)`)
        return config // Retorna o config que funcionou
      } else {
        console.log(`   ❌ Erro: ${erroDesafios.message}`)
        
        // Tentar listar tabelas para debug
        const { data: tableInfo, error: erroInfo } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .limit(10)
        
        if (!erroInfo && tableInfo) {
          console.log(`   📋 Tabelas disponíveis: ${tableInfo.map(t => t.table_name).join(', ')}`)
        }
      }
    } catch (err) {
      console.log(`   ❌ Erro ao conectar: ${err.message}`)
    }
  }
}

testar().then(config => {
  if (config) {
    console.log(`\n✅ Use ${config.name}: ${config.url}`)
  }
})
