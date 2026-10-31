import { costoNettoQuota } from './riepilogoEconomico'

// Preflight delle sole condizioni economiche del ponte. Le verifiche server restano autorevoli.
export type RigaPrecheckProposta = {
  id: string; ordine: number; descrizione: string
  quantita: unknown; prezzo: unknown; totale: unknown
}
export type BloccoProposta = { id: string; ordine: number; descrizione: string; motivi: string[] }

export function numeroRigaProposta(v: unknown): number | null {
  if (v === null || v === undefined) return null
  return (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) ? Number(v) : NaN
}

function precisioneValida(v: number): boolean {
  return Number.isFinite(v) && v > 0 && v < 1e12 && Number(v.toFixed(6)) === v
}

export function blocchiProposta(righe: readonly RigaPrecheckProposta[]): BloccoProposta[] {
  return righe.flatMap(r => {
    const motivi: string[] = []
    const q = numeroRigaProposta(r.quantita), p = numeroRigaProposta(r.prezzo), t = numeroRigaProposta(r.totale)
    if (q === null || !Number.isFinite(q) || q <= 0) motivi.push('Quantità mancante o non valida: deve essere maggiore di zero.')
    if (p === null) motivi.push('Prezzo mancante.')
    else if (!Number.isFinite(p)) motivi.push('Prezzo non numerico o non finito.')
    else if (p === 0) motivi.push('Prezzo 0,00 €: deve essere maggiore di zero.')
    else if (p < 0) motivi.push('Prezzo negativo: deve essere maggiore di zero.')
    if (!r.descrizione.trim()) motivi.push('Descrizione mancante.')
    if (q !== null && p !== null && q > 0 && p > 0 && Number.isFinite(q) && Number.isFinite(p)) {
      if (!precisioneValida(q) || !precisioneValida(p)) motivi.push('Quantità o prezzo non rappresentabili nella precisione del ponte.')
      else {
        try {
          // Stesso prodotto decimale già usato dalla valorizzazione Economia.
          const importo = costoNettoQuota(q, p)
          if (importo <= 0) motivi.push('Importo arrotondato non rappresentabile: deve essere positivo.')
          else if (t === null || !Number.isFinite(t) || t !== importo) motivi.push('Importo non disponibile o incoerente con quantità × prezzo arrotondato ai centesimi.')
        } catch { motivi.push('Importo non rappresentabile con precisione verificabile.') }
      }
    }
    return motivi.length ? [{ id: r.id, ordine: r.ordine, descrizione: r.descrizione, motivi }] : []
  })
}
