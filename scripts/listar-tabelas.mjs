#!/usr/bin/env node
/**
 * Script para buscar quais tabelas existem no Supabase
 */

import { createClient } from '@supabase/supabase-js'

async function listarTabelas() {
  const url = 'https://fydiwlxbzlmvqloyqlhz.supabase.co'
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZGl3bHhiemxtdnFsb3lxbGh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc2NjU3NiwiZXhwIjoyMDkxMzQyNTc2fQ.hVKStOarseweACCJbtUT-V9h7IIUkl06GclIYtQVDc8'
  
  const supabase = createClient(url, serviceKey)
  
  console.log('🔍 Listando tabelas no Supabase...\n')
  
  try {
    // Usar rpc para executar query custom (se existir)
    // Ou tentar listar diretamente
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
    } else {
      console.log('❌ desafios_catalogo:', e3.message)
    }
    
  } catch (err) {
    console.error('❌ Erro:', err.message)
  }
}

listarTabelas()
