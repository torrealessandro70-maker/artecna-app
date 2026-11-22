import type { SupabaseClient } from '@supabase/supabase-js'
import { centesimi, dataValida } from './riepilogo'

export type ClientIncassi = Pick<SupabaseClient, 'rpc'> & Partial<Pick<SupabaseClient, 'auth'>>
export type QuotaIncasso = { id: string; fattura_id: string; numero: string | null; cliente: string | null; importo: string; valida: boolean; revocata: boolean }
export type MovimentoIncasso = {
  id: string; acconto_id: string; cantiere_id: string; cantiere: string | null; importo: string; data: string; metodo: string
  fonte: string; descrizione: string | null; nota: string | null; netto_acconto: string; imputazione: string
  identita_valida: boolean; assenza_collegamenti_verificata: boolean; fiscale: { stato: string; termine?: string | null }; quote: QuotaIncasso[]
}
export type SnapshotIncassi = { versione: 1; completa: true; autore: string; da: string; a: string; fotografia: string; ambito: string; storici_da_riconciliare: number; movimenti: MovimentoIncasso[] }
export type RigaIncasso = MovimentoIncasso & { totale: number; fatturato: number; senzaFattura: number; riconciliare: number; cliente: string }
export type RiepilogoIncassi = { totale: number; fatturato: number; senzaFattura: number; riconciliare: number; righe: RigaIncasso[] }
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const positive = (v: unknown) => { const n = centesimi(v); if (n === null || n <= 0) throw Error('Importo non verificabile'); return n }
const sum = (a: number, b: number) => { const n = a + b; if (!Number.isSafeInteger(n)) throw Error('Totale fuori intervallo'); return n }

export function validaSnapshotIncassi(value: unknown, da: string, a: string): SnapshotIncassi {
  if (!dataValida(da) || !dataValida(a) || da > a || !object(value) || value.versione !== 1 || value.completa !== true || value.da !== da || value.a !== a || !uuid(value.autore)
    || typeof value.fotografia !== 'string' || !Number.isFinite(Date.parse(value.fotografia)) || typeof value.ambito !== 'string'
    || !Number.isSafeInteger(value.storici_da_riconciliare) || Number(value.storici_da_riconciliare) < 0 || !Array.isArray(value.movimenti)) throw Error('Snapshot incompleta o non coerente: nessuno zero sostitutivo')
  const ids = new Set<string>(), quote = new Set<string>()
  for (const m of value.movimenti) {
    if (!object(m) || !uuid(m.id) || ids.has(m.id) || !uuid(m.acconto_id) || !uuid(m.cantiere_id) || m.identita_valida !== true || !dataValida(m.data) || m.data < da || m.data > a
      || typeof m.metodo !== 'string' || typeof m.fonte !== 'string' || !object(m.fiscale) || typeof m.fiscale.stato !== 'string'
      || !(m.nota === null || typeof m.nota === 'string') || !(m.descrizione === null || typeof m.descrizione === 'string')
      || !(m.fiscale.termine == null || dataValida(m.fiscale.termine)) || centesimi(m.netto_acconto) === null
      || ![null, 'string'].includes(m.cantiere === null ? null : typeof m.cantiere) || typeof m.imputazione !== 'string'
      || typeof m.assenza_collegamenti_verificata !== 'boolean' || !Array.isArray(m.quote)) throw Error('Movimento non verificabile o duplicato')
    positive(m.importo); ids.add(m.id)
    for (const q of m.quote) {
      if (!object(q) || !uuid(q.id) || quote.has(q.id) || !uuid(q.fattura_id) || typeof q.valida !== 'boolean' || typeof q.revocata !== 'boolean'
        || !(q.cliente === null || typeof q.cliente === 'string') || !(q.numero === null || typeof q.numero === 'string')) throw Error('Collegamento non verificabile o duplicato')
      positive(q.importo); quote.add(q.id)
    }
  }
  return value as SnapshotIncassi
}

export function calcolaIncassi(snapshot: SnapshotIncassi): RiepilogoIncassi {
  // Validate again: callers cannot bypass runtime checks by a TypeScript cast.
  validaSnapshotIncassi(snapshot, snapshot.da, snapshot.a)
  const result: RiepilogoIncassi = { totale: 0, fatturato: 0, senzaFattura: 0, riconciliare: 0, righe: [] }
  for (const m of snapshot.movimenti) {
    const totale = positive(m.importo); let fatturato = 0, attribuito = 0
    const clienti = new Set<string>()
    for (const q of m.quote) {
      if (q.revocata) continue
      attribuito = sum(attribuito, positive(q.importo))
      if (q.valida) { fatturato = sum(fatturato, positive(q.importo)); if (q.cliente?.trim()) clienti.add(q.cliente.trim()) }
    }
    if (attribuito > totale) throw Error('Quote superiori al pagamento: dati da riconciliare')
    if (m.assenza_collegamenti_verificata && m.quote.length) throw Error('Copertura documentale contraddittoria')
    const senzaFattura = m.assenza_collegamenti_verificata ? totale : 0
    const riconciliare = totale - fatturato - senzaFattura
    if (riconciliare < 0) throw Error('Categorie sovrapposte')
    result.righe.push({ ...m, totale, fatturato, senzaFattura, riconciliare, cliente: clienti.size === 1 ? [...clienti][0] : 'Cliente da verificare' })
    for (const key of ['totale', 'fatturato', 'senzaFattura', 'riconciliare'] as const) result[key] = sum(result[key], ({ totale, fatturato, senzaFattura, riconciliare })[key])
  }
  if (result.totale !== result.fatturato + result.senzaFattura + result.riconciliare) throw Error('Quadratura non valida')
  return result
}

export async function leggiIncassiFatturazione(client: ClientIncassi, da: string, a: string): Promise<SnapshotIncassi> {
  if (!dataValida(da) || !dataValida(a) || da > a) throw Error('Periodo non valido')
  const r = await client.rpc('leggi_incassi_fatturazione_impresa', { p_da: da, p_a: a })
  if (r.error) throw Error(r.error.code === 'PGRST202' ? 'Riepilogo non disponibile: richiede la migrazione READ ONLY separata.' : 'Lettura impresa non disponibile o non autorizzata. Nessun totale stimato.')
  return validaSnapshotIncassi(r.data, da, a)
}
