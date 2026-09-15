type Cantiere = { id?: string; nome: string; preventivo?: number }
type Preventivo = { cantiere_id?: string | null; importo_totale?: number | null }

export function mappaPreventiviElenco(preventivi: Preventivo[]) {
  const mappa = new Map<string, number | null>()
  for (const p of preventivi) {
    if (!p.cantiere_id) continue
    mappa.set(p.cantiere_id, mappa.has(p.cantiere_id) ? null : Number(p.importo_totale || 0))
  }
  return mappa
}

export function totalePreventivoElenco(c: Cantiere, mappa: Map<string, number | null>) {
  return c.id && mappa.has(c.id) ? mappa.get(c.id)! : Number(c.preventivo || 0)
}

export function confrontaPreventiviElenco(a: Cantiere, b: Cantiere, mappa: Map<string, number | null>, direzione: string) {
  const x = totalePreventivoElenco(a, mappa)
  const y = totalePreventivoElenco(b, mappa)
  // Ambiguous rows always follow monetary values, in stable name/UUID order.
  if (x === null || y === null) {
    if (x !== null) return -1
    if (y !== null) return 1
    return a.nome.localeCompare(b.nome) || String(a.id).localeCompare(String(b.id))
  }
  return direzione === 'asc' ? x - y : y - x
}
