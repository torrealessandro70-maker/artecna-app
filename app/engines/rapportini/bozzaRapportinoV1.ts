import type { NuovaPrestazioneRapportino, PrestazioneRapportinoAggiornata } from '../../types'
import { calcolaOreNetteTimbratura } from '../../utils/rapportinoOperai'

import type { VarianteRapportinoPortale, EsitoSalvataggioRapportino } from './contrattoServizio'
import type { SezioneMaterialiBozza } from './materialiBozzaV1'

export type PrestazioneBozzaV1 = NuovaPrestazioneRapportino | PrestazioneRapportinoAggiornata
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type DocumentoBozzaV1 = { note: string; materiali: string; quantita_materiali: string }
export type BozzaRapportinoV1 = {
  materialiStrutturati?: SezioneMaterialiBozza
  versione_contratto: 1
  rapportino_id: string | null
  revisione_attesa: number | null
  baseline?: EsitoSalvataggioRapportino
  cantiere_id: string
  data: string
  documento: DocumentoBozzaV1
  prestazioni: {
    nuove: readonly NuovaPrestazioneRapportino[]
    aggiornate: readonly PrestazioneRapportinoAggiornata[]
    rimosse: readonly string[]
  }
}
export function ricostruisciBozzaRapportinoV1(dettaglio: EsitoSalvataggioRapportino): BozzaRapportinoV1 {
  const baseline = Object.freeze({ ...dettaglio, documento: Object.freeze({ ...dettaglio.documento }),
    prestazioni: Object.freeze(dettaglio.prestazioni.map(p => Object.freeze({ ...p }))) })
  return { versione_contratto: 1, rapportino_id: dettaglio.rapportino_id, revisione_attesa: dettaglio.revisione,
    cantiere_id: dettaglio.cantiere_id, data: dettaglio.data, baseline,
    documento: { ...dettaglio.documento }, prestazioni: { nuove: [], aggiornate: [], rimosse: [] } }
}
export function prestazioniAttiveBozza(bozza: BozzaRapportinoV1): readonly PrestazioneBozzaV1[] {
  return [...(bozza.baseline?.prestazioni || []).filter(p => p.rimossa_at === null && !bozza.prestazioni.rimosse.includes(p.prestazione_id))
    .map(p => bozza.prestazioni.aggiornate.find(a => a.prestazione_id === p.prestazione_id) || p), ...bozza.prestazioni.nuove]
}
export function originalePrestazioneBozza(bozza: BozzaRapportinoV1, p: PrestazioneBozzaV1): PrestazioneBozzaV1 | undefined {
  return bozza.baseline?.prestazioni.find(a => a.prestazione_id === p.prestazione_id && a.rimossa_at === null)
}
export function prestazioniUguali(a: PrestazioneBozzaV1, b: PrestazioneBozzaV1): boolean {
  return (['prestazione_id', 'chiave_client', 'operaio_id', 'ora_inizio', 'ora_fine', 'pausa_minuti',
    'lavoro_in_economia', 'variante_id'] as const).every(k => a[k] === b[k])
}
export function creaBozzaRapportinoV1(cantiere_id: string, data: string): BozzaRapportinoV1 {
  return { versione_contratto: 1, rapportino_id: null, revisione_attesa: null, cantiere_id, data,
    documento: { note: '', materiali: '', quantita_materiali: '' }, prestazioni: { nuove: [], aggiornate: [], rimosse: [] } }
}
/** La chiave viene generata dal chiamante una sola volta, all'aggiunta. */
export function aggiungiPrestazioneBozza(bozza: BozzaRapportinoV1, chiave: string): BozzaRapportinoV1 {
  if ([...(bozza.baseline?.prestazioni || []), ...bozza.prestazioni.nuove].some(p => p.chiave_client === chiave)) throw new Error('Chiave prestazione già presente')
  const p: NuovaPrestazioneRapportino = { prestazione_id: null, chiave_client: chiave, operaio_id: '',
    ora_inizio: '', ora_fine: '', pausa_minuti: 0, lavoro_in_economia: false, variante_id: null }
  return { ...bozza, prestazioni: { ...bozza.prestazioni, nuove: [...bozza.prestazioni.nuove, p] } }
}
export function modificaPrestazioneBozza(bozza: BozzaRapportinoV1, chiave: string,
  modifica: Partial<Pick<PrestazioneBozzaV1, 'operaio_id' | 'ora_inizio' | 'ora_fine' | 'pausa_minuti' | 'lavoro_in_economia' | 'variante_id'>>,
  generaChiave?: () => string): BozzaRapportinoV1 {
  const p = prestazioniAttiveBozza(bozza).find(p => p.chiave_client === chiave)
  if (!p) return bozza
  const aggiornata = { ...p, ...modifica, variante_id:
    modifica.lavoro_in_economia !== undefined && modifica.lavoro_in_economia !== p.lavoro_in_economia ? null :
    (modifica.lavoro_in_economia ?? p.lavoro_in_economia) ? (modifica.variante_id === undefined ? p.variante_id : modifica.variante_id) : null } as PrestazioneBozzaV1
  if (p.prestazione_id === null) return { ...bozza, prestazioni: { ...bozza.prestazioni,
    nuove: bozza.prestazioni.nuove.map(n => n.chiave_client === chiave ? aggiornata as NuovaPrestazioneRapportino : n) } }
  if (aggiornata.operaio_id !== p.operaio_id) {
    if (!generaChiave) throw new Error('Nuova identità prestazione obbligatoria')
    const nuovaChiave = generaChiave()
    const rimossa = rimuoviPrestazioneBozza(bozza, chiave)
    const aggiunta = aggiungiPrestazioneBozza(rimossa, nuovaChiave)
    const cambiata = modificaPrestazioneBozza(aggiunta, nuovaChiave, { operaio_id: aggiornata.operaio_id,
      ora_inizio: aggiornata.ora_inizio, ora_fine: aggiornata.ora_fine, pausa_minuti: aggiornata.pausa_minuti,
      lavoro_in_economia: aggiornata.lavoro_in_economia })
    return modificaPrestazioneBozza(cambiata, nuovaChiave, { variante_id: aggiornata.variante_id })
  }
  const originale = originalePrestazioneBozza(bozza, p)!
  return { ...bozza, prestazioni: { ...bozza.prestazioni, aggiornate: [
    ...bozza.prestazioni.aggiornate.filter(a => a.prestazione_id !== p.prestazione_id),
    ...(prestazioniUguali(aggiornata, originale) ? [] : [aggiornata as PrestazioneRapportinoAggiornata]),
  ] } }
}
export function rimuoviPrestazioneBozza(bozza: BozzaRapportinoV1, chiave: string): BozzaRapportinoV1 {
  const p = prestazioniAttiveBozza(bozza).find(p => p.chiave_client === chiave)
  if (!p) return bozza
  return { ...bozza, prestazioni: { nuove: bozza.prestazioni.nuove.filter(p => p.chiave_client !== chiave),
    aggiornate: bozza.prestazioni.aggiornate.filter(a => a.prestazione_id !== p.prestazione_id),
    rimosse: p.prestazione_id === null ? bozza.prestazioni.rimosse : [...bozza.prestazioni.rimosse, p.prestazione_id] } }
}
function validaOrariOperaio(p: PrestazioneBozzaV1): string[] {
  const errori: string[] = []
  if (!p.operaio_id.trim()) errori.push('Seleziona un operaio')
  const hhmm = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
  const inizioValido = hhmm.test(p.ora_inizio), fineValida = hhmm.test(p.ora_fine)
  if (!inizioValido) errori.push('Inserisci ora inizio nel formato HH:mm')
  if (!fineValida) errori.push('Inserisci ora fine nel formato HH:mm')
  if (!Number.isInteger(p.pausa_minuti) || p.pausa_minuti < 0) errori.push('La pausa deve essere un numero intero di minuti non negativo')
  if (inizioValido && fineValida) {
    const minuti = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
    const durata = minuti(p.ora_fine) - minuti(p.ora_inizio)
    if (durata <= 0) errori.push('Ora fine deve essere successiva a ora inizio')
    else if (Number.isInteger(p.pausa_minuti) && p.pausa_minuti >= durata) errori.push('La pausa deve essere inferiore alla durata')
  }
  return errori
}
export function validaPrestazioneBozza(p: PrestazioneBozzaV1, varianti: readonly VarianteRapportinoPortale[] = [], originale?: PrestazioneBozzaV1): readonly string[] {
  const errori = validaOrariOperaio(p)
  const invariata = originale && prestazioniUguali(p, originale)
  const collegamentoStorico = originale?.lavoro_in_economia && p.variante_id !== null && p.variante_id === originale.variante_id
  if (originale && (p.operaio_id !== originale.operaio_id || p.chiave_client !== originale.chiave_client)) errori.push('Identità persistente non modificabile')
  if (p.lavoro_in_economia && !invariata && (!p.variante_id || !uuid.test(p.variante_id))) errori.push('Seleziona una variante per Economia')
  else if (p.lavoro_in_economia && !invariata && !collegamentoStorico && !varianti.some(v => v.id === p.variante_id && v.selezionabile)) errori.push('La variante non è disponibile per un nuovo collegamento')
  if (!p.lavoro_in_economia && p.variante_id !== null) errori.push('Ordinario non può avere una variante')
  return errori
}
export function oreAnteprimaPrestazione(p: PrestazioneBozzaV1): number {
  if (validaOrariOperaio(p).length) return 0
  return calcolaOreNetteTimbratura(p.ora_inizio, p.ora_fine, p.pausa_minuti)
}
