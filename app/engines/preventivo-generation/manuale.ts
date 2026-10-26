import type { PriceKnowledgeItem } from '../price-resolution/types'
import { normalizePriceDescription } from '../price-resolution/normalizer'
import { risolviPrezzoPrioritario } from '../price-resolution/storico-prezzi'

export type VoceManuale = {
  descrizione: string; unita_misura: string; quantita: number; prezzo_unitario: number
  fonte_prezzo: string; origine_documento: 'manuale'; note: string
  riferimento_scelto?: PriceKnowledgeItem
  operazione: 'nuova'; riferimento_preventivo_lavorazione_id: null
  da_verificare: boolean; revisione_confermata: boolean
}
export function voceLibera(): VoceManuale {
  return { descrizione: '', unita_misura: 'a corpo', quantita: 1, prezzo_unitario: 0,
    fonte_prezzo: 'Inserito manualmente', origine_documento: 'manuale', note: '',
    operazione: 'nuova', riferimento_preventivo_lavorazione_id: null, da_verificare: true, revisione_confermata: false }
}
export function cercaRiferimenti(query: string, riferimenti: readonly PriceKnowledgeItem[]) {
  const termini = normalizePriceDescription(query).split(' ').filter(Boolean)
  if (!termini.length) return []
  return riferimenti.filter(r => Number.isFinite(Number(r.prezzo_unitario)) && Number(r.prezzo_unitario) > 0 &&
    termini.every(t => normalizePriceDescription(`${r.codice || ''} ${r.descrizione}`).includes(t)))
    .sort((a, b) => `${a.codice || ''}:${a.descrizione}:${a.id || ''}`.localeCompare(`${b.codice || ''}:${b.descrizione}:${b.id || ''}`))
}
export function voceDaRiferimento(r: PriceKnowledgeItem, prezzi: readonly PriceKnowledgeItem[], memoria: readonly PriceKnowledgeItem[], storico: readonly PriceKnowledgeItem[]) {
  const prezzo = risolviPrezzoPrioritario({ codice: r.codice, descrizione: r.descrizione, unitaMisura: r.unita_misura }, prezzi, memoria, storico)
  // Nessun prezzo AI o fallback inventato: una risoluzione incerta richiede revisione umana.
  return { ...voceLibera(), descrizione: r.descrizione, unita_misura: r.unita_misura || '',
    ...prezzo, riferimento_scelto: { ...r } }
}
export function totaleManuale(voci: readonly Pick<VoceManuale, 'quantita' | 'prezzo_unitario'>[]) {
  return Math.round(voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzo_unitario), 0) * 100) / 100
}
export function validaManuale(voci: readonly VoceManuale[]) {
  if (!voci.length) throw Error('Aggiungi almeno una voce')
  for (const v of voci) if (!v.descrizione.trim() || !v.unita_misura.trim() || !Number.isFinite(Number(v.quantita)) ||
    Number(v.quantita) <= 0 || !Number.isFinite(Number(v.prezzo_unitario)) || Number(v.prezzo_unitario) <= 0)
    throw Error('Completa descrizione, unità di misura, quantità e prezzo positivo di ogni voce')
}
