import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../api/supabase'

/**
 * Assina todas as mudanças no schema public do Supabase.
 * Quando qualquer usuário altera um dado, todos os clientes conectados
 * têm o cache do React Query invalidado automaticamente.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('global-db-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
          queryClient.invalidateQueries()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
