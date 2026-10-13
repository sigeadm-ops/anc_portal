import { useMemo, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useTable } from './useTable'
import { mensagemTravaRegiao } from '../lib/travaRegiao'

// Estado da trava de lançamentos por região, pra telas públicas avisarem e
// desabilitarem a edição. A garantia de verdade fica no db.js
// (lib/travaRegiao.js), que confere no banco na hora de gravar.
export function useTravaRegiao() {
  const isAdmin = useAuthStore(s => s.isAdmin)
  const { data: regioes = [] } = useTable('Regiao')

  const travadas = useMemo(() => {
    const map = new Map()
    regioes.forEach(r => {
      if (r.bloqueio_lancamentos) map.set(String(r.id_regiao ?? r.id), r.Regiao ?? r.nome ?? '')
    })
    return map
  }, [regioes])

  // Nome da região se ela estiver travada pra quem está usando (admin nunca é
  // travado); null se liberada.
  const regiaoTravada = useCallback((id_regiao) => {
    if (isAdmin || !id_regiao) return null
    return travadas.has(String(id_regiao)) ? travadas.get(String(id_regiao)) || String(id_regiao) : null
  }, [isAdmin, travadas])

  return { regiaoTravada, mensagem: mensagemTravaRegiao, nomesTravadas: [...travadas.values()] }
}
