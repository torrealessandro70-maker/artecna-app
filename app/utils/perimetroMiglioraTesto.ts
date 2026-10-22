export const messaggioPerimetro =
  'Testo non applicato: la proposta modificava il contenuto tecnico della voce.'

const normalizza = (testo: string) => testo.normalize('NFKC').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Solo equivalenze redazionali locali: nessuna modifica al matching prezzi.
const equivalenze: Record<string, string> = {
  sola: 'solo', pavimentazione: 'pavimento', battiscopa: 'zoccolino', zoccoletto: 'zoccolino',
  adattamenti: 'tagli', adattamento: 'tagli', taglio: 'tagli',
  rifinitura: 'rifiniture', finiture: 'rifiniture',
}
const redazionali = new Set(('a ad al allo alla alle agli ai all con da dal dalla dalle dei degli del dello della delle di e ed il lo la le gli i in nel nello nella nelle nei negli o per su sul sulla sulle sui tra un uno una un opera esecuzione eseguire eseguita eseguito applicazione applicato applicata necessari necessarie necessario necessaria lavoro lavori finito finita').split(' '))

function concetti(testo: string): string[] {
  return [...new Set(normalizza(testo)
    // Condizioni espositive consentite, non lavorazioni di preparazione supporto.
    .replace(/\ba regola d['’ ]arte\b/g, '')
    .replace(/\bsu supporto idoneo\b/g, '')
    .replace(/\bper dare\b/g, '')
    .match(/[a-z0-9]+(?:[.,][0-9]+)?/g)?.filter(t => !redazionali.has(t))
    .map(t => equivalenze[t] || t) || [])].sort()
}

export function estraiVincoliMiglioraTesto(originale: string) {
  const testo = normalizza(originale)
  return {
    concettiDaPreservare: concetti(originale),
    soloPosa: /\bposa\b/.test(testo) && !/\bfornitura\b|\bfornitur[ae] e posa\b/.test(testo),
    fornituraEsclusa: /\bfornitura\b[^.;\n]*\besclus[aoe]\b|\bsenza fornitura\b/.test(testo),
    materialeCommittenza: /\bfornit[oaie]\b[^.;\n]*\bcommittenza\b/.test(testo),
    testoVincolante: originale,
  }
}

export function preservaPerimetroMiglioraTesto(originale: string, proposta: unknown): proposta is string {
  if (typeof proposta !== 'string' || !proposta.trim()) return false
  const prima = estraiVincoliMiglioraTesto(originale)
  const dopo = estraiVincoliMiglioraTesto(proposta)
  if (prima.fornituraEsclusa !== dopo.fornituraEsclusa ||
      prima.materialeCommittenza !== dopo.materialeCommittenza) return false
  // Non basta conservare l'esclusione in fondo se si aggiunge una fornitura attiva.
  const fornituraAttiva = (testo: string) => /\bfornitura\b/.test(normalizza(testo)
    .replace(/\bfornitura\b[^.;\n]*\besclus[aoe]\b/g, '')
    .replace(/\bsenza fornitura\b/g, ''))
  if (fornituraAttiva(originale) !== fornituraAttiva(proposta)) return false
  // Conserva anche l'associazione fra ogni limite e la lavorazione interessata:
  // una semplice uguaglianza di parole non rileverebbe esclusioni scambiate.
  const limitazioni = (testo: string) => normalizza(testo).split(/[.;,\n]/)
    .filter(clausola => /\b(esclus[aoei]|senza|sol[oa]|soltanto|non|eccetto|salvo|committenza)\b/.test(clausola))
    .map(concetti)
  const limitiDopo = limitazioni(proposta)
  if (limitazioni(originale).some(limite =>
    !limitiDopo.some(candidato => limite.every(t => candidato.includes(t))))) return false
  return JSON.stringify(prima.concettiDaPreservare) === JSON.stringify(dopo.concettiDaPreservare)
}
