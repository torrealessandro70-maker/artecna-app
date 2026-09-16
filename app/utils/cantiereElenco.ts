type Cantiere = { id?: string; nome: string; preventivo?: number; preventivo_contrattuale_id?: string | null }
type Preventivo = { id?: string; cantiere_id?: string | null; importo_totale?: number | null }

export function mappaPreventiviElenco(preventivi: Preventivo[]) {
  const mappa = new Map<string, number | null>()
  for (const p of preventivi) {
    if (!p.cantiere_id) continue
    mappa.set(p.cantiere_id, mappa.has(p.cantiere_id) ? null : Number(p.importo_totale || 0))
  }
  return { totali: mappa, perId: new Map(preventivi.filter(p => p.id).map(p => [p.id!, p])) }
}

export function totalePreventivoElenco(c: Cantiere, mappa: ReturnType<typeof mappaPreventiviElenco>) {
  if (c.preventivo_contrattuale_id) {
    const p = mappa.perId.get(c.preventivo_contrattuale_id)
    if (!p || !c.id || p.cantiere_id !== c.id) return undefined
    return Number(p.importo_totale || 0)
  }
  return c.id && mappa.totali.has(c.id) ? mappa.totali.get(c.id) : Number(c.preventivo || 0)
}

export function confrontaPreventiviElenco(a: Cantiere, b: Cantiere, mappa: ReturnType<typeof mappaPreventiviElenco>, direzione: string) {
  const x = totalePreventivoElenco(a, mappa)
  const y = totalePreventivoElenco(b, mappa)
  // Ambiguous rows always follow monetary values, in stable name/UUID order.
  if (x == null || y == null) {
    if (x != null) return -1
    if (y != null) return 1
    return a.nome.localeCompare(b.nome) || String(a.id).localeCompare(String(b.id))
  }
  return direzione === 'asc' ? x - y : y - x
}
