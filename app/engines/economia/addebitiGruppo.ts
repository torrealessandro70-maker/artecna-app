import type { SupabaseClient } from '@supabase/supabase-js'
import { numeroAddebito, type QuotaAddebito } from './addebitiCliente'
import { uuidFattura } from './fattureMateriali'

export type RigaGruppo = { materiale_id: string; quantita: string; importo: string; iva_inclusa: boolean;
  aliquota: string; iva_confermata: boolean; descrizione: string; motivo: string; riferimento: string }
export type CampiComuni = Partial<Pick<RigaGruppo, 'aliquota' | 'iva_inclusa' | 'iva_confermata' | 'motivo' | 'riferimento'>>
export type AnteprimaGruppo = { token: string; netto: number; contratto_attuale: number; contratto_dopo_approvazione: number;
  righe: { materiale_id: string; fattura_id: string; fattura_riga_id: string; quantita: number; unita_misura: string; costo_originale_quota: number; netto: number }[] }
type Client = Pick<SupabaseClient, 'rpc'>
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function centesimi(v: string): number { return Math.round(numeroAddebito(v, 2) * 100) }
const micro = (v: string) => {
  numeroAddebito(v, 6)
  const [intero, decimali = ''] = v.trim().replace(',', '.').split('.')
  return BigInt(intero) * BigInt(1000000) + BigInt(decimali.padEnd(6, '0'))
}
export const euroInput = (c: number) => (c / 100).toFixed(2)
export function costoQuota(q: QuotaAddebito, quantita: string): number {
  const scelta = micro(quantita), totale = micro(String(q.quantita))
  if (scelta > micro(String(q.disponibile))) throw Error('Quantità oltre disponibilità')
  const cents = Math.round(q.costo * 100)
  if (!Number.isSafeInteger(cents) || cents < 0) throw Error('Costo non rappresentabile')
  const costo = BigInt(cents)
  return Number((costo * scelta * BigInt(2) + totale) / (totale * BigInt(2)))
}
export function preparaRiga(q: QuotaAddebito): RigaGruppo {
  return { materiale_id: q.materiale_id, quantita: String(q.disponibile), importo: euroInput(costoQuota(q, String(q.disponibile))),
    iva_inclusa: false, aliquota: '', iva_confermata: false, descrizione: q.descrizione, motivo: '', riferimento: '' }
}
export function applicaComuni(righe: readonly RigaGruppo[], selezione: readonly string[], comuni: CampiComuni): RigaGruppo[] {
  const ids = new Set(selezione)
  return righe.map(r => ids.has(r.materiale_id) ? { ...r, ...comuni } : r)
}
export function ripartisci(totale: string, pesi: readonly number[]): number[] {
  const c = centesimi(totale)
  if (!pesi.length || pesi.some(p => !Number.isSafeInteger(p) || p < 0) || !pesi.some(p => p > 0)) throw Error('Basi di ripartizione non verificabili')
  const somma = pesi.reduce((s, p) => s + BigInt(p), BigInt(0)), target = BigInt(c)
  const parti = pesi.map((p, i) => ({ i, c: Number(target * BigInt(p) / somma), resto: target * BigInt(p) % somma }))
  let residuo = c - parti.reduce((s, p) => s + p.c, 0)
  for (const p of [...parti].sort((a, b) => a.resto === b.resto ? a.i - b.i : a.resto > b.resto ? -1 : 1)) {
    if (!residuo) break; p.c++; residuo--
  }
  if (parti.some(p => p.c <= 0)) throw Error('Totale insufficiente per prezzi positivi su tutte le quote selezionate')
  return parti.map(p => p.c)
}
export function ricarico(costo: number, percentuale: string): number {
  const p = BigInt(Math.round(numeroAddebito(percentuale, 2, true) * 100))
  const c = Number((BigInt(costo) * (BigInt(10000) + p) + BigInt(5000)) / BigInt(10000))
  if (!Number.isSafeInteger(c) || c <= 0 || c >= 1e12) throw Error('Prezzo fuori limite')
  return c
}
export function payloadGruppo(righe: readonly RigaGruppo[]) {
  if (!righe.length || righe.length > 100 || new Set(righe.map(r => r.materiale_id)).size !== righe.length) throw Error('Selezione vuota o duplicata')
  return righe.map(r => {
    if (!uuidFattura(r.materiale_id) || !r.iva_confermata || !r.descrizione.trim() || !r.motivo.trim() || !r.riferimento.trim()) throw Error('Conferma IVA, descrizione, motivo e accordo per ogni quota')
    const aliquota = numeroAddebito(r.aliquota, 2, true)
    if (aliquota > 100) throw Error('Aliquota non valida')
    return { ...r, quantita: numeroAddebito(r.quantita, 6), importo: numeroAddebito(r.importo, 2), aliquota }
  }).sort((a, b) => a.materiale_id.localeCompare(b.materiale_id))
}
export async function leggiQuoteGruppo(client: Client, fatturaId: string): Promise<QuotaAddebito[]> {
  if (!uuidFattura(fatturaId)) throw Error('Fattura non valida')
  const { data, error } = await client.rpc('leggi_quote_addebito_gruppo', { p_fattura: fatturaId })
  if (error || !Array.isArray(data)) throw Error('Quote di gruppo non disponibili. Verificare installazione e autorizzazioni.')
  const seen = new Set<string>()
  return data.map((r: unknown) => {
    if (!record(r) || !uuidFattura(r.materiale_id) || seen.has(r.materiale_id) || !uuidFattura(r.fattura_riga_id) || !uuidFattura(r.cantiere_id)
      || typeof r.cantiere !== 'string' || typeof r.descrizione !== 'string' || typeof r.unita_misura !== 'string'
      || typeof r.quantita !== 'number' || !Number.isFinite(r.quantita) || r.quantita <= 0
      || typeof r.disponibile !== 'number' || !Number.isFinite(r.disponibile) || r.disponibile < 0 || r.disponibile > r.quantita
      || typeof r.costo !== 'number' || !Number.isFinite(r.costo) || r.costo < 0) throw Error('Quote di gruppo non verificabili')
    seen.add(r.materiale_id); return r as QuotaAddebito
  })
}
export async function anteprimaGruppo(client: Client, cantiere: string, righe: readonly RigaGruppo[]): Promise<AnteprimaGruppo> {
  if (!uuidFattura(cantiere)) throw Error('Cantiere non valido')
  const input = payloadGruppo(righe)
  const { data: p, error } = await client.rpc('anteprima_addebiti_gruppo', { p_cantiere: cantiere, p_righe: input })
  if (error || !record(p) || p.versione !== 1 || p.cantiere_id !== cantiere || typeof p.token !== 'string' || !/^[a-f0-9]{64}$/.test(p.token)
    || typeof p.netto !== 'number' || !Number.isFinite(p.netto) || p.netto <= 0
    || typeof p.contratto_attuale !== 'number' || !Number.isFinite(p.contratto_attuale)
    || typeof p.contratto_dopo_approvazione !== 'number' || !Number.isFinite(p.contratto_dopo_approvazione)
    || Math.round(p.contratto_dopo_approvazione * 100) !== Math.round(p.contratto_attuale * 100) + Math.round(p.netto * 100)
    || !Array.isArray(p.righe) || p.righe.length !== input.length) throw Error('Anteprima gruppo non verificabile')
  const ids = new Set<string>(); let somma = 0
  for (const r of p.righe) {
    const original = record(r) && input.find(x => x.materiale_id === r.materiale_id)
    if (!record(r) || !original || !uuidFattura(r.materiale_id) || ids.has(r.materiale_id) || !uuidFattura(r.fattura_id) || !uuidFattura(r.fattura_riga_id)
      || r.cantiere_id !== cantiere || r.quantita !== original.quantita || r.importo_inserito !== original.importo
      || r.aliquota !== original.aliquota || r.iva_inclusa !== original.iva_inclusa
      || typeof r.unita_misura !== 'string' || typeof r.costo_originale_quota !== 'number' || !Number.isFinite(r.costo_originale_quota)
      || typeof r.netto !== 'number' || !Number.isFinite(r.netto) || r.netto <= 0) throw Error('Riga anteprima discordante')
    ids.add(r.materiale_id); somma += Math.round(r.netto * 100)
  }
  if (somma !== Math.round(p.netto * 100)) throw Error('Totale anteprima discordante')
  return p as AnteprimaGruppo
}
export async function creaGruppo(client: Client, richiesta: string, cantiere: string, righe: readonly RigaGruppo[], anteprima: AnteprimaGruppo) {
  if (!uuidFattura(richiesta) || !uuidFattura(cantiere)) throw Error('Richiesta non valida')
  const { data, error } = await client.rpc('crea_addebiti_gruppo', {
    p_richiesta: richiesta, p_cantiere: cantiere, p_righe: payloadGruppo(righe), p_token: anteprima.token,
  })
  if (error || !record(data) || !uuidFattura(data.variante_id) || data.netto !== anteprima.netto || typeof data.riutilizzata !== 'boolean')
    throw Error('Creazione non certificata: verificare le Varianti. Nessun retry automatico.')
  return { varianteId: data.variante_id, riutilizzata: data.riutilizzata }
}
