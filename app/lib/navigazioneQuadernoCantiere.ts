type Cantiere = { id?: string; origine_preventivo_id?: string | null; preventivo_contrattuale_id?: string | null }
type Preventivo = { id?: string; cantiere_id?: string | null; sopralluogo_id?: string | null }

// Explicit IDs only: a customer/site name is not an association.
export function sopralluoghiDelCantiere<T extends { id?: string }>(cantiere: Cantiere, sopralluoghi: readonly T[], preventivi: readonly Preventivo[]): T[] {
  if (!cantiere.id) return []
  const riferimenti = new Set([cantiere.origine_preventivo_id, cantiere.preventivo_contrattuale_id].filter(Boolean))
  const ids = new Set(preventivi.filter(p => p.cantiere_id
    ? p.cantiere_id === cantiere.id
    : !!p.id && riferimenti.has(p.id)).map(p => p.sopralluogo_id).filter(Boolean))
  return sopralluoghi.filter(s => !!s.id && ids.has(s.id))
}

export function sopralluogoDiretto<T extends { id?: string }>(collegati: readonly T[], attivi: unknown): T | null {
  return collegati.length === 1 && Array.isArray(attivi) && attivi.includes(collegati[0].id) ? collegati[0] : null
}
