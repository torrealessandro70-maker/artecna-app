import { getConfidenceBadge } from '../confidence'

type VoceDiagnostica = {
  descrizione?: string
  unita_misura?: string
  prezzo_unitario?: number
  fonte_prezzo?: string
  priceResolutionInvalidated?: boolean
  priceResolution?: { matched?: boolean; strategy?: string; confidence?: number }
}

export function modificaVoceDiagnostica<T extends VoceDiagnostica>(
  voce: T, campo: 'descrizione' | 'unita_misura' | 'prezzo_unitario', valore: string | number,
): T {
  const prima = campo === 'prezzo_unitario' ? Number(voce[campo] ?? 0) : voce[campo] ?? ''
  if (prima === valore) return voce
  const nuova = { ...voce, [campo]: valore, priceResolutionInvalidated: true }
  delete nuova.priceResolution
  if (campo === 'prezzo_unitario') nuova.fonte_prezzo = 'Prezzo manuale'
  return nuova
}

export function esitoDiagnosticaVoce(voce: VoceDiagnostica): 'resolved' | 'review' | 'unresolved' | 'modified' {
  const esito = voce.priceResolution
  if (!esito) return voce.priceResolutionInvalidated ? 'modified' : 'review'
  if (esito.matched === true) {
    const livello = getConfidenceBadge(Number(esito.confidence || 0) * 100).level
    return livello === 'perfect' || livello === 'reliable' ? 'resolved' : 'review'
  }
  return esito.strategy === 'ai_fallback' || esito.strategy === 'no_match' ? 'unresolved' : 'review'
}
