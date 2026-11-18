import type { SupabaseClient } from '@supabase/supabase-js'
import { uuidFattura } from './fattureMateriali'

export type QuotaAddebito = { materiale_id: string; fattura_riga_id: string; cantiere_id: string; cantiere: string
  descrizione: string; quantita: number; disponibile: number; unita_misura: string; costo: number }
export type DatiAddebito = { materiale: string; quantita: string; importo: string; ivaInclusa: boolean; aliquota: string
  descrizione: string; motivo: string; riferimento: string }
export type AnteprimaAddebito = { versione: 1; materiale_id: string; fattura_id: string; fattura_riga_id: string
  cantiere_id: string; cantiere: string; quantita: number; unita_misura: string; costo_originale_quota: number
  netto: number; contratto_attuale: number; contratto_dopo_approvazione: number; token: string }
type Client = Pick<SupabaseClient, 'rpc'>
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export function numeroAddebito(value: string, decimali: number, zero = false): number {
  if (!new RegExp(`^\\d+(?:[.,]\\d{1,${decimali}})?$`).test(value.trim())) throw Error('Valore numerico non valido')
  const n = Number(value.replace(',', '.'))
  if (!Number.isFinite(n) || (zero ? n < 0 : n <= 0) || n >= 1e10) throw Error('Valore numerico fuori limite')
  return n
}
export async function quoteAddebito(client: Client, fattura: string): Promise<QuotaAddebito[]> {
  if (!uuidFattura(fattura)) throw Error('Fattura non valida')
  const { data, error } = await client.rpc('leggi_quote_addebito_cliente', { p_fattura: fattura })
  if (error || !Array.isArray(data)) throw Error('Quote per addebito non disponibili. Nessuna quantità viene riassegnata.')
  const seen = new Set<string>()
  return data.map((r: unknown) => {
    if (!record(r) || !uuidFattura(r.materiale_id) || seen.has(r.materiale_id) || !uuidFattura(r.fattura_riga_id) || !uuidFattura(r.cantiere_id)
      || typeof r.cantiere !== 'string' || typeof r.descrizione !== 'string' || typeof r.unita_misura !== 'string'
      || !number(r.quantita) || r.quantita <= 0 || !number(r.disponibile) || r.disponibile < 0 || r.disponibile > r.quantita
      || !number(r.costo) || r.costo < 0) throw Error('Identità o costo della quota non verificabili')
    seen.add(r.materiale_id)
    return r as QuotaAddebito
  })
}
export function parametriAddebito(d: DatiAddebito) {
  if (!uuidFattura(d.materiale) || !d.descrizione.trim() || !d.motivo.trim() || !d.riferimento.trim()) throw Error('Completa descrizione, motivazione e accordo')
  const aliquota = numeroAddebito(d.aliquota, 2, true)
  if (aliquota > 100) throw Error('Aliquota non valida')
  return { p_materiale: d.materiale, p_quantita: numeroAddebito(d.quantita, 6), p_importo: numeroAddebito(d.importo, 2),
    p_iva_inclusa: d.ivaInclusa, p_aliquota: aliquota, p_descrizione: d.descrizione.trim(), p_motivo: d.motivo.trim(), p_riferimento: d.riferimento.trim() }
}
export async function anteprimaAddebito(client: Client, d: DatiAddebito): Promise<AnteprimaAddebito> {
  const { data: r, error } = await client.rpc('anteprima_addebito_cliente', parametriAddebito(d))
  if (error) throw Error(`Anteprima non disponibile (${error.code}). Verifica quota e contratto; nessun retry automatico.`)
  if (!record(r) || r.versione !== 1 || r.materiale_id !== d.materiale || !uuidFattura(r.fattura_id) || !uuidFattura(r.fattura_riga_id)
    || !uuidFattura(r.cantiere_id) || typeof r.token !== 'string' || !/^[a-f0-9]{64}$/.test(r.token)
    || !number(r.netto) || r.netto <= 0 || !number(r.costo_originale_quota) || r.costo_originale_quota < 0
    || !number(r.contratto_attuale) || !number(r.contratto_dopo_approvazione)
    || Math.round(r.contratto_attuale * 100) + Math.round(r.netto * 100) !== Math.round(r.contratto_dopo_approvazione * 100)) throw Error('Anteprima non verificabile')
  return r as AnteprimaAddebito
}
export async function creaAddebito(client: Client, d: DatiAddebito, a: AnteprimaAddebito, richiesta: string) {
  if (!uuidFattura(richiesta) || a.materiale_id !== d.materiale) throw Error('Richiesta incoerente')
  const { data, error } = await client.rpc('crea_addebito_cliente', { ...parametriAddebito(d), p_token: a.token, p_richiesta: richiesta })
  if (error) throw Error(`Creazione non certificata (${error.code}). Rileggi le varianti prima di ripetere la richiesta.`)
  if (!record(data) || !uuidFattura(data.variante_id) || data.netto !== a.netto || typeof data.riutilizzata !== 'boolean') throw Error('Esito incerto: controlla le varianti, nessun rilancio automatico')
  return data as { variante_id: string; netto: number; riutilizzata: boolean }
}
