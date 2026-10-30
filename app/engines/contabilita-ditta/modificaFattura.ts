import type { SupabaseClient } from '@supabase/supabase-js'
import { uuid, statoCantiereAttribuzioni } from './attribuzioni'

export type StatoCantieri = 'caricamento' | 'pronto' | 'errore'
export type RigaFattura = Record<string, unknown>
export type CantiereOpzione = { id: string; nome: string }
export type ModificheFattura = { cantiere_id?: string | null; cantiere?: string | null; importo_incassato?: number; stato?: string }
export type EsitoModifica =
  | { tipo: 'confermato'; riga: RigaFattura; elencoAggiornato?: boolean }
  | { tipo: 'errore_server' | 'non_confermato'; messaggio: string }
export type AggiornaFattura = (id: string, modifiche: ModificheFattura, soloLettura?: boolean) => Promise<EsitoModifica>
export const EVENTO_FATTURE_AGGIORNATE = 'artecna-fatture-emesse-aggiornate'

export function numeroDichiarato(v: unknown): number | null {
  if ((typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function opzioniCantieri(righe: readonly Record<string, unknown>[]): CantiereOpzione[] {
  const ids = new Map<string, number>()
  for (const r of righe) if (uuid(r.id)) ids.set(r.id, (ids.get(r.id) || 0) + 1)
  return righe.filter((r): r is CantiereOpzione => uuid(r.id) && typeof r.nome === 'string' && ids.get(r.id) === 1)
}

/** Undefined = campo non modificato; stringa vuota = rimozione esplicita. */
export function preparaModifiche(originale: RigaFattura, scelta: string | undefined, importo: string | undefined, cantieri: readonly CantiereOpzione[], stato: StatoCantieri): ModificheFattura {
  const patch: ModificheFattura = {}
  if (scelta !== undefined) {
    if (stato !== 'pronto' || statoCantiereAttribuzioni(originale.cantiere_id) === 'ignoto') throw Error('Associazione non verificabile: attendere o ricaricare i dati.')
    if (scelta === '') {
      if (originale.cantiere_id !== null) Object.assign(patch, { cantiere_id: null, cantiere: null })
    } else if (scelta !== originale.cantiere_id) {
      const c = cantieri.find(r => r.id === scelta)
      if (!c || !uuid(c.id)) throw Error('Cantiere selezionato non disponibile: ricaricare l’elenco.')
      Object.assign(patch, { cantiere_id: c.id, cantiere: c.nome })
    }
  }
  if (importo !== undefined) {
    const valore = numeroDichiarato(importo)
    if (valore === null) throw Error('Importo incassato non valido: indicare un numero finito, senza lasciare il campo vuoto.')
    if (valore !== numeroDichiarato(originale.importo_incassato)) {
      const totale = numeroDichiarato(originale.totale)
      if (totale === null) throw Error('Totale fattura non disponibile o non valido: impossibile determinare lo stato.')
      patch.importo_incassato = valore
      patch.stato = valore <= 0 ? 'emessa' : valore >= totale ? 'incassata' : 'parziale'
    }
  }
  return patch
}

const campi = 'id,cantiere_id,cantiere,importo_incassato,stato'
function coerente(riga: unknown, id: string, patch: ModificheFattura): riga is RigaFattura {
  if (!riga || typeof riga !== 'object' || (riga as RigaFattura).id !== id) return false
  const r = riga as RigaFattura
  return Object.entries(patch).every(([k, v]) => Object.prototype.hasOwnProperty.call(r, k) && (k === 'importo_incassato' ? numeroDichiarato(r[k]) === numeroDichiarato(v) : r[k] === v))
}

/** La rilettura di recupero usa soltanto SELECT. Mai retry dell'UPDATE. */
export async function modificaFattura(client: Pick<SupabaseClient, 'from'>, id: string, patch: ModificheFattura, soloLettura = false): Promise<EsitoModifica> {
  if (!uuid(id)) throw Error('Identificativo fattura non valido.')
  if (!Object.keys(patch).length || Object.keys(patch).some(k => !['cantiere_id', 'cantiere', 'importo_incassato', 'stato'].includes(k))) throw Error('Modifiche mancanti o non ammesse.')
  try {
    const risposta = soloLettura
      ? await client.from('fatture_emesse').select(campi).eq('id', id)
      : await client.from('fatture_emesse').update(patch).eq('id', id).select(campi)
    if (risposta.error) {
      if (risposta.error.code && risposta.status !== 0) return { tipo: 'errore_server', messaggio: `Errore restituito dal server (${risposta.error.code}): ${risposta.error.message}` }
      return { tipo: 'non_confermato', messaggio: 'Risposta non disponibile: esito non confermato. Verifica tramite rilettura; nessun reinvio automatico.' }
    }
    if (!Array.isArray(risposta.data) || risposta.data.length !== 1 || !coerente(risposta.data[0], id, patch)) return { tipo: 'non_confermato', messaggio: 'Aggiornamento non confermato: la risposta non contiene una singola riga coerente. Non significa necessariamente che la fattura non esista. Verifica tramite rilettura.' }
    return { tipo: 'confermato', riga: risposta.data[0] }
  } catch {
    return { tipo: 'non_confermato', messaggio: 'Risposta persa o lettura non disponibile: esito non confermato. Nessun reinvio automatico; verifica tramite rilettura.' }
  }
}

export async function modificaERicarica(client: Pick<SupabaseClient, 'from'>, id: string, patch: ModificheFattura, soloLettura: boolean, viste: { applica: (r: RigaFattura) => void; invalida: () => void; rileggi: () => Promise<void> }): Promise<EsitoModifica> {
  const esito = await modificaFattura(client, id, patch, soloLettura)
  if (esito.tipo !== 'confermato') return esito
  try {
    viste.applica(esito.riga)
    viste.invalida()
    await viste.rileggi()
    return { ...esito, elencoAggiornato: true }
  } catch {
    return { ...esito, elencoAggiornato: false }
  }
}
