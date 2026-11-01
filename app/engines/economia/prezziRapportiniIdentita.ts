export type RigaPrezziRapportino = {
  id: string; ordine: number; descrizione: string; um: string; quantita: number
  prezzo: number | null; note: string | null; origine: string
  operaioId?: string | null; operativo?: Record<string, unknown>
}

export function idOperaioPrezzi(riga: RigaPrezziRapportino): string | null {
  return typeof riga.operaioId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(riga.operaioId)
    ? riga.operaioId : null
}

export function identitaPrezziRapportino(riga: RigaPrezziRapportino) {
  const op = riga.operativo ?? {}
  const data = typeof op.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(op.data)
    ? op.data.split('-').reverse().join('/') : 'Data non disponibile'
  const operaio = typeof op.operaio === 'string' && op.operaio.trim() ? op.operaio : 'Operaio non disponibile'
  const qualifica = typeof op.qualifica === 'string' && op.qualifica.trim() ? op.qualifica : null
  return { data, operaio, qualifica }
}

// Stessa regola di "Applica a tutte": solo prezzi persistiti null, solo bozze locali.
export function prezziPerOperaio(righe: RigaPrezziRapportino[], rigaId: string, tariffa: string, correnti: Record<string, string>) {
  const selezionata = righe.find(r => r.id === rigaId)
  const operaioId = selezionata && idOperaioPrezzi(selezionata)
  if (!operaioId) return correnti
  return { ...correnti, ...Object.fromEntries(righe.filter(r => r.origine === 'rapportino' && r.um === 'h' &&
    idOperaioPrezzi(r) === operaioId && r.prezzo === null).map(r => [r.id, tariffa])) }
}
