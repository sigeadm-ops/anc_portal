import { useQuery } from '@tanstack/react-query'
import { db } from '../api/db'
import { useMemo } from 'react'

// ================================================================
// Hook para carregar a hierarquia geográfica normalizada:
//   regioes → distritos → igrejas
// e gerar selects em cascata por ID (FK seguro)
// ================================================================

export function useIgrejas() {
  const regiaoQuery = useQuery({
    queryKey: ['regioes'],
    queryFn: () => db.getRegioes(),
    staleTime: 1000 * 60 * 30,
  })

  const distritosQuery = useQuery({
    queryKey: ['distritos'],
    queryFn: () => db.getDistritos(),
    staleTime: 1000 * 60 * 30,
  })

  const igrejasQuery = useQuery({
    queryKey: ['igrejas'],
    queryFn: () => db.getIgrejas(),
    staleTime: 1000 * 60 * 30,
  })

  const regioes = useMemo(() => {
    return (regiaoQuery.data ?? []).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }, [regiaoQuery.data])
  const distritos = distritosQuery.data ?? []
  const igrejas = igrejasQuery.data ?? []

  // Distritos filtrados por regiao_id
  const getDistritos = useMemo(() => (regiao_id) => {
    if (!regiao_id) return []
    return distritos
      .filter(d => (d.regiao_id ?? d.id_regiao) === regiao_id)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }, [distritos])

  // Igrejas filtradas por distrito_id
  const getIgrejas = useMemo(() => (distrito_id) => {
    if (!distrito_id) return []
    return igrejas
      .filter(i => (i.distrito_id ?? i.id_distritos) === distrito_id)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }, [igrejas])

  // Codref de uma igreja pelo seu ID
  function getCodRef(id) {
    return igrejas.find(i => i.id === id)?.codref || ''
  }

  const isLoading = regiaoQuery.isLoading || distritosQuery.isLoading || igrejasQuery.isLoading

  return {
    isLoading,
    regioes,
    distritos,
    igrejas,
    getDistritos,
    getIgrejas,
    getCodRef,
  }
}
