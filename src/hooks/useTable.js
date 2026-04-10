import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../api/db'
import toast from 'react-hot-toast'

// ================================================================
// Hook genérico de CRUD via Supabase + React Query
// ================================================================

export function useTable(table, sheetName) {
  const qc = useQueryClient()

  // ── Buscar todos ─────────────────────────────────────────────
  const query = useQuery({
    queryKey: [table],
    queryFn: () => db.getAll(table),
  })

  // ── Inserir ──────────────────────────────────────────────────
  const insert = useMutation({
    mutationFn: (record) => db.insert(table, record, sheetName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
    },
    onError: (err) => {
      toast.error(`Erro ao salvar: ${err.message}`)
    },
  })

  // ── Atualizar ────────────────────────────────────────────────
  const update = useMutation({
    mutationFn: ({ id, data }) => db.update(table, id, data, sheetName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
    },
    onError: (err) => {
      toast.error(`Erro ao atualizar: ${err.message}`)
    },
  })

  // ── Deletar ──────────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: (id) => db.delete(table, id, sheetName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
    },
    onError: (err) => {
      toast.error(`Erro ao excluir: ${err.message}`)
    },
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    insert,
    update,
    remove,
  }
}
