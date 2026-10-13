import { useMemo, useCallback, useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useTable } from './useTable'
import { mensagemTravaRegiao, regiaoEstaTravada } from '../lib/travaRegiao'

// Estado da trava de lançamentos por região, pra telas públicas avisarem e
// desabilitarem a edição. A garantia de verdade fica no db.js
// (lib/travaRegiao.js), que confere no banco na hora de gravar.
export function useTravaRegiao() {
  const isAdmin = useAuthStore(s => s.isAdmin)
  const { data: regioes = [] } = useTable('Regiao')

  // Relógio de minuto em minuto, pra trava agendada entrar em vigor com a
  // tela aberta (a gravação em si é conferida no banco pelo db.js)
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const travadas = useMemo(() => {
    const map = new Map()
    regioes.forEach(r => {
      if (regiaoEstaTravada(r, agora)) map.set(String(r.id_regiao ?? r.id), r.Regiao ?? r.nome ?? '')
    })
    return map
  }, [regioes, agora])

  // Nome da região se ela estiver travada pra quem está usando (admin nunca é
  // travado); null se liberada.
  const regiaoTravada = useCallback((id_regiao) => {
    if (isAdmin || !id_regiao) return null
    return travadas.has(String(id_regiao)) ? travadas.get(String(id_regiao)) || String(id_regiao) : null
  }, [isAdmin, travadas])

  return { regiaoTravada, mensagem: mensagemTravaRegiao, nomesTravadas: [...travadas.values()] }
}
