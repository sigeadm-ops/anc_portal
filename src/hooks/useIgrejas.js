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

  const regioes = regiaoQuery.data ?? []
  const distritos = distritosQuery.data ?? []
  const igrejas = igrejasQuery.data ?? []

  // Distritos filtrados por id_regiao
  const getDistritos = useMemo(() => (id_regiao) => {
    if (!id_regiao) return []
    return distritos
      .filter(d => d.id_regiao === id_regiao)
      .sort((a, b) => (a.Distritos || '').localeCompare(b.Distritos || ''))
  }, [distritos])

  // Igrejas filtradas por id_distritos
  const getIgrejas = useMemo(() => (id_distritos) => {
    if (!id_distritos) return []
    return igrejas
      .filter(i => i.id_distritos === id_distritos)
      .sort((a, b) => (a.Igrejas || '').localeCompare(b.Igrejas || ''))
  }, [igrejas])

  // Codref de uma igreja pelo seu ID
  function getCodRef(id_igrejas) {
    return igrejas.find(i => i.id_igrejas === id_igrejas)?.codref || ''
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
