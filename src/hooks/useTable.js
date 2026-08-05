import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../api/db'
import { useUIStore } from '../store/uiStore'
import { parseError } from '../lib/errorMessages'

// ================================================================
// Hook genérico de CRUD via Supabase + React Query
// ================================================================

export function useTable(table) {
  const qc = useQueryClient()
  const showError = useUIStore.getState().showError

  function handleError(err, action) {
    const { title, message, technicalInfo = null, contactAdmin = false } = parseError(err, table, action)
    showError(title, message, technicalInfo, contactAdmin)
  }

  // ── Buscar todos ─────────────────────────────────────────────
  const query = useQuery({
    queryKey: [table],
    queryFn: () => db.getAll(table),
  })

  // ── Inserir ──────────────────────────────────────────────────
  const insert = useMutation({
    mutationFn: (record) => db.insert(table, record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
    },
    onError: (err) => handleError(err, 'insert'),
  })

  // ── Atualizar ────────────────────────────────────────────────
  const update = useMutation({
    mutationFn: ({ id, data }) => db.update(table, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
    },
    onError: (err) => handleError(err, 'update'),
  })

  // ── Deletar ──────────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: (id) => db.delete(table, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
    },
    onError: (err) => handleError(err, 'delete'),
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
