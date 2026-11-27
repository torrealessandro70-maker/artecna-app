import { centesimi } from './riepilogo'
import { uuid } from './attribuzioni'
export type ClientRiconciliazione = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> }

export type Gruppo = { indice: number; imponibile: number; iva: number; aliquota: number; natura: string | null }
export type FatturaRiconciliazione = { id: string; numero: string; data: string; cliente: string; totale: number; attribuito_netto: number;
  documento: { valida: boolean; motivo?: string; fonte?: string; impronta?: string; gruppi?: Gruppo[] };
  collegamenti_netto: { id: string; acconto_id: string; importo: number; attiva: boolean; unificata: boolean }[];
  sdi: { tipo?: string; esito?: string }; quote: { id: string; attribuzione_id: string | null; incasso_id: string; importo: number; revocata: boolean;
    allocazioni: { indice: number; imponibile: number; iva: number }[] | null }[] }
export type SnapshotRiconciliazione = { versione: 1; autore: string; cantiere_id: string; cantiere: string;
  acconti: { id: string; descrizione: string; importo: number; attribuito: number; data: string; fiscale: { stato: string; termine?: string } }[];
  fatture: FatturaRiconciliazione[]; incassi: { id: string; acconto_id: string; importo: number; disponibile: number; ricevuto_il: string; riferimento: string; metodo: string }[] }
export const decimale = (n: number) => (n / 100).toFixed(2)
export function ripartisci(f: FatturaRiconciliazione, valori: Record<number, string>) {
  if (!f.documento.valida || !f.documento.gruppi?.length) throw Error('Fonte fiscale non verificabile.')
  let netto = 0, iva = 0
  const allocazioni = []
  for (const g of f.documento.gruppi) {
    const n = centesimi((valori[g.indice]?.trim() || '0').replace(',', '.'))
    if (n === null || n < 0) throw Error('Inserisci quote imponibili con due decimali.')
    if (!n) continue
    const base = centesimi(g.imponibile), tax = centesimi(g.iva)
    if (base === null || base <= 0 || tax === null || tax < 0) throw Error('Riepilogo fiscale non coerente.')
    const usato = f.quote.filter(q => !q.revocata).flatMap(q => q.allocazioni ?? []).filter(q => q.indice === g.indice)
      .reduce((sum, q) => sum + (centesimi(q.imponibile) ?? 0), 0)
    if (n + usato > base) throw Error('Quota superiore alla disponibilità imponibile della fattura.')
    const rate = centesimi(g.aliquota)
    if (rate === null || rate < 0 || rate > 10000) throw Error('Aliquota documentale non coerente.')
    const imposta = (x: number) => Number((BigInt(x) * BigInt(rate) + BigInt(5000)) / BigInt(10000))
    const v = imposta(usato + n) - imposta(usato)
    netto += n; iva += v; allocazioni.push({ indice: g.indice, imponibile: decimale(n) })
  }
  if (!netto || !Number.isSafeInteger(netto + iva)) throw Error('Seleziona almeno una quota imponibile positiva.')
  return { netto, iva, lordo: netto + iva, allocazioni }
}
export function propostaUnivoca(d: SnapshotRiconciliazione, acconto: string) {
  const a = d.acconti.find(x => x.id === acconto)
  if (!a) return null
  const residuo = (centesimi(a.importo) ?? 0) - (centesimi(a.attribuito) ?? 0)
  const candidati = d.fatture.filter(f => f.documento.valida && f.documento.gruppi?.reduce((n, g) => n + (centesimi(g.imponibile) ?? 0), 0)
    === residuo + (centesimi(f.attribuito_netto) ?? 0))
  return candidati.length === 1 ? candidati[0].id : null
}
export async function leggiRiconciliazione(client: ClientRiconciliazione, fattura?: string, acconto?: string) {
  const r = await client.rpc('leggi_riconciliazione_unificata', { p_fattura: fattura ?? null, p_acconto: acconto ?? null })
  if (r.error) throw Error(r.error.code === 'PGRST202' ? 'Procedura non disponibile: richiede la migrazione separata.' : 'Contesto non disponibile o non autorizzato.')
  const d = r.data as SnapshotRiconciliazione
  if (!d || d.versione !== 1 || !uuid(d.autore) || !uuid(d.cantiere_id) || !Array.isArray(d.acconti) || !Array.isArray(d.fatture) || !Array.isArray(d.incassi)) throw Error('Risposta non verificabile.')
  return d
}

export function propostaAccontoUnivoco(d: SnapshotRiconciliazione, fattura: string) {
  const f = d.fatture.find(x => x.id === fattura)
  if (!f?.documento.valida) return null
  const netto = f.documento.gruppi?.reduce((n, g) => n + (centesimi(g.imponibile) ?? 0), 0)
  const candidati = d.acconti.filter(a => (centesimi(a.importo) ?? 0) - (centesimi(a.attribuito) ?? 0) === (netto ?? 0) - (centesimi(f.attribuito_netto) ?? 0))
  return candidati.length === 1 ? candidati[0].id : null
}
