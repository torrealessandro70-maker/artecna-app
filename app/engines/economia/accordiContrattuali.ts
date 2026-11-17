export type VoceAccordo = {
  id?: number; ordine: number; descrizione: string; quantita: number; unita_misura: string
  prezzo_unitario: number; importo_previsto: number; prezzo_unitario_contrattuale: number
  importo_contrattuale: number; conguaglio: number
}
export type AccordoContrattuale = {
  versione: 1; richiesta?: string; token: string; cantiere_id: string; preventivo_id: string; revisione: number
  importo_documento: number | null; totale_originale: number; importo_concordato: number
  ribasso_percentuale: number; modalita: 'a_corpo' | 'a_misura'; motivo: string; riferimento: string
  nota_documentale: string; nome_file: string; file_url: string | null; file_path: string | null
  autore?: string; data?: string; righe: VoceAccordo[]
}

export function importoOriginaleVoce(quantita: string, prezzo: string): number {
  const decimale = (testo: string) => {
    if (!/^\d+(?:[.,]\d{1,6})?$/.test(testo.trim())) throw Error('Quantità e prezzo devono avere al massimo sei decimali')
    const [intero, frazione = ''] = testo.trim().replace(',', '.').split('.')
    return { valore: BigInt(intero + frazione), scala: frazione.length }
  }
  const q = decimale(quantita), p = decimale(prezzo)
  const prodotto = q.valore * p.valore * BigInt(100)
  const divisore = BigInt(10) ** BigInt(q.scala + p.scala)
  const centesimi = (prodotto + divisore / BigInt(2)) / divisore
  if (centesimi > BigInt(900000000000)) throw Error('Importo originale fuori limite')
  return Number(centesimi) / 100
}

// Gli importi canonici provengono dalla ripartizione NUMERIC server-side.
export function importoContrattoPreventivo(p: {
  id?: string; cantiere_id?: string | null; importo_totale?: unknown; accordo_contrattuale?: unknown
}): number | null {
  const a = p.accordo_contrattuale as AccordoContrattuale | null | undefined
  if (a == null) {
    const v = p.importo_totale
    if (!(typeof v === 'number' || typeof v === 'string' && v.trim())) return null
    return Number.isFinite(Number(v)) ? Number(v) : null
  }
  if (a.versione !== 1 || a.preventivo_id !== p.id || a.cantiere_id !== p.cantiere_id || !a.richiesta ||
      !Number.isInteger(a.revisione) || a.revisione < 1 || !Array.isArray(a.righe) || !a.righe.length ||
      !Number.isFinite(a.importo_concordato) || a.importo_concordato <= 0 ||
      !Number.isFinite(a.totale_originale) || a.totale_originale < a.importo_concordato ||
      !Number.isFinite(a.ribasso_percentuale) || a.ribasso_percentuale < 0 || a.ribasso_percentuale > 100) return null
  const ids = new Set<number>()
  let somma = 0, originali = 0
  const centesimiValidi = (n: number) => Number.isFinite(n) && Number.isSafeInteger(Math.round(n * 100)) &&
    Math.abs(n * 100 - Math.round(n * 100)) <= 4 * Number.EPSILON * Math.max(1, Math.abs(n * 100))
  if (!centesimiValidi(a.importo_concordato) || !centesimiValidi(a.totale_originale) ||
      Math.abs(a.ribasso_percentuale - (a.totale_originale - a.importo_concordato) * 100 / a.totale_originale) > 1e-9) return null
  for (const r of a.righe) {
    if (!r || typeof r !== 'object' || typeof r.descrizione !== 'string' || !r.descrizione.trim() ||
        typeof r.unita_misura !== 'string' || !r.unita_misura.trim() ||
        !Number.isSafeInteger(r.id) || ids.has(r.id!) || !Number.isFinite(r.quantita) || r.quantita <= 0 ||
        !Number.isFinite(r.prezzo_unitario) || r.prezzo_unitario < 0 ||
        !centesimiValidi(r.importo_previsto) || r.importo_previsto < 0 ||
        !centesimiValidi(r.importo_contrattuale) || r.importo_contrattuale < 0 ||
        !Number.isFinite(r.prezzo_unitario_contrattuale) || r.prezzo_unitario_contrattuale < 0 ||
        !centesimiValidi(r.conguaglio)) return null
    ids.add(r.id!)
    somma += Math.round(r.importo_contrattuale * 100)
    originali += Math.round(r.importo_previsto * 100)
  }
  return Number.isSafeInteger(somma) && somma === Math.round(a.importo_concordato * 100) &&
    originali === Math.round(a.totale_originale * 100) ? a.importo_concordato : null
}
