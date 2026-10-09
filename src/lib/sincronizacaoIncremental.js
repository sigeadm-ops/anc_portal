// Lógica pura da sincronização incremental do realtime (sem React nem
// Supabase), usada pelo useRealtimeSync: acumula os eventos de uma rajada e
// mescla só as linhas alteradas nas listas que já estão em cache.

export function criarLote() {
  return { tocados: new Set(), removidos: new Set(), semChave: false }
}

// Registra um evento do postgres_changes no lote da tabela. Só o PK é
// aproveitado: as linhas em si são relidas pelo mesmo caminho da carga
// completa, pra chegarem no formato exato que as telas esperam.
export function registrarEvento(lote, evento, pk) {
  const linha = evento.eventType === 'DELETE' ? evento.old : evento.new
  const id = linha?.[pk]
  if (id === null || id === undefined || id === '') {
    lote.semChave = true
    return
  }
  const chave = String(id)
  lote.tocados.add(chave)
  if (evento.eventType === 'DELETE') lote.removidos.add(chave)
  else lote.removidos.delete(chave)
}

// IDs que precisam ser relidos do banco (os removidos só saem do cache).
export function idsParaBuscar(lote) {
  return [...lote.tocados].filter(id => !lote.removidos.has(id))
}

// Devolve uma nova lista: as linhas tocadas são substituídas pela versão
// nova (na mesma posição) ou retiradas se não vieram em `novas`; as que
// ainda não existiam entram no início ou no fim.
export function mesclarLinhas(atual, { pk, tocados, novas, novasNoInicio = false }) {
  const porId = new Map(novas.map(linha => [String(linha[pk]), linha]))
  const resultado = []

  for (const linha of atual) {
    const id = String(linha?.[pk])
    if (!tocados.has(id)) {
      resultado.push(linha)
      continue
    }
    const nova = porId.get(id)
    if (nova) {
      resultado.push(nova)
      porId.delete(id)
    }
  }

  const ineditas = [...porId.values()]
  return novasNoInicio ? [...ineditas, ...resultado] : [...resultado, ...ineditas]
}
