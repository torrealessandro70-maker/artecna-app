import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUnitOfMeasure } from '../price-resolution/normalizer'

export type RigaMaterialeFattura = {
  id?: string; fattura_id?: string; descrizione?: string | null; unita_misura?: string | null
  quantita?: number | string | null; prezzo_unitario?: number | string | null; totale_riga?: number | string | null
}
export type RaccoltaMateriali = { id: string; titolo: string; revisione: number; stato: 'bozza' | 'chiusa' }
export type DisponibilitaMateriale = { fattura_riga_id: string; quantita_originale: string; quantita_assegnata: string; quantita_residua: string; gia_presente_nella_raccolta: boolean
  quantita_assegnata_economia?: string; quantita_assegnata_cantiere?: string; quantita_assegnata_impresa?: string }

function componentiImpresa(r: Record<string, unknown>, assegnata: bigint) {
  const e = quantitaIntera(r.quantita_assegnata_economia), c = quantitaIntera(r.quantita_assegnata_cantiere), i = quantitaIntera(r.quantita_assegnata_impresa)
  if (e === null || c === null || i === null || e + c + i !== assegnata) throw Error('Componenti disponibilità Impresa incoerenti')
  return { quantita_assegnata_economia: fisso(e, 6), quantita_assegnata_cantiere: fisso(c, 6), quantita_assegnata_impresa: fisso(i, 6) }
}
type Client = Pick<SupabaseClient, 'rpc'>
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const uuidFattura = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
function numero(v: unknown): number | null {
  if ((typeof v !== 'number' && typeof v !== 'string') || v === '' || (typeof v === 'string' && !v.trim())) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
// Decimal digits decide rounding, including ties; never binary floating point.
function decimale(v: unknown): { intero: bigint; scala: number } | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const m = /^\+?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(v).trim())
  if (!m || m[1].length + (m[2]?.length ?? 0) > 1000) return null
  const esponente = Number(m[3] ?? 0)
  if (!Number.isSafeInteger(esponente) || Math.abs(esponente) > 1000) return null
  const scala = (m[2]?.length ?? 0) - esponente
  const intero = BigInt(m[1] + (m[2] ?? ''))
  return scala < 0 ? { intero: intero * BigInt(10) ** BigInt(-scala), scala: 0 } : { intero, scala }
}
function scalato(d: { intero: bigint; scala: number }, scala: number): bigint {
  if (d.scala <= scala) return d.intero * BigInt(10) ** BigInt(scala - d.scala)
  const divisore = BigInt(10) ** BigInt(d.scala - scala)
  return (d.intero + divisore / BigInt(2)) / divisore
}
function fisso(n: bigint, scala: number): string {
  const s = n.toString().padStart(scala + 1, '0')
  return `${s.slice(0, -scala)}.${s.slice(-scala)}`
}
function quantitaIntera(v: unknown): bigint | null {
  const d = decimale(typeof v === 'string' ? v.replace(',', '.') : v)
  if (!d || (d.scala > 6 && d.intero % (BigInt(10) ** BigInt(d.scala - 6)) !== BigInt(0))) return null
  const q = scalato(d, 6)
  return q <= BigInt('999999999999999999') ? q : null
}
export function quantitaEconomia(v: unknown): string | null {
  const q = quantitaIntera(v)
  return q === null ? null : fisso(q, 6)
}
export function residuoPreview(d: DisponibilitaMateriale | undefined, invio: unknown): string | null {
  const q = quantitaIntera(invio), disponibile = d ? quantitaIntera(d.quantita_residua) : null
  return q === null || disponibile === null || q > disponibile ? null : fisso(disponibile - q, 6)
}
export function motivoQuantita(d: DisponibilitaMateriale | undefined, invio: unknown): string | null {
  if (!d) return 'Disponibilità non verificata'
  if (d.gia_presente_nella_raccolta) return 'Già assegnata a questa raccolta'
  const disponibile = quantitaIntera(d.quantita_residua), q = quantitaIntera(invio)
  if (disponibile === null) return 'Disponibilità non verificata'
  if (disponibile === BigInt(0)) return 'Quantità già completamente assegnata'
  if (q === null || q <= BigInt(0)) return 'Quantità da inviare non valida (massimo 6 decimali)'
  return q > disponibile ? `Disponibile: ${d.quantita_residua}` : null
}
export function valoriEconomiaFattura(r: RigaMaterialeFattura, richiesta: unknown = r.quantita): { prezzo: string; totale: string } | null {
  const p = decimale(r.prezzo_unitario), q = decimale(typeof richiesta === 'string' ? richiesta.replace(',', '.') : richiesta)
  if (!p || !q || q.intero <= BigInt(0)) return null
  const prezzo = scalato(p, 6), quantita = scalato(q, 6), limite = BigInt('999999999999999999')
  if (prezzo > limite || quantita > limite || (q.scala > 6 && q.intero % (BigInt(10) ** BigInt(q.scala - 6)) !== BigInt(0))) return null
  return { prezzo: fisso(prezzo, 6), totale: fisso(scalato({ intero: quantita * prezzo, scala: 12 }, 2), 2) }
}
export function unitaEconomiaValida(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 64 || /[\u0000-\u001f\u007f-\u009f]/.test(value)) return null
  const normalized = normalizeUnitOfMeasure(value)
  return normalized && normalized.length <= 64 ? normalized : null
}
export function motivoNonSelezionabile(r: RigaMaterialeFattura): string | null {
  if (!uuidFattura(r.id)) return 'Riga non salvata: ID mancante'
  if (!r.descrizione?.trim()) return 'Descrizione mancante'
  const q = numero(r.quantita), p = numero(r.prezzo_unitario), t = numero(r.totale_riga)
  if (q === null || q <= 0) return 'Quantità mancante o non valida'
  if (p === null || p < 0) return 'Prezzo unitario mancante o non valido'
  if (!valoriEconomiaFattura(r)) return 'Quantità o prezzo non rappresentabile in Economia (quantità: massimo 6 decimali)'
  if (r.totale_riga !== null && r.totale_riga !== undefined && t === null) return 'Totale documentale non valido'
  return null
}
export function motivoNonTrasferibile(r: RigaMaterialeFattura, umEconomia: unknown = r.unita_misura): string | null {
  const motivo = motivoNonSelezionabile(r)
  if (motivo) return motivo
  if (typeof umEconomia !== 'string' || !umEconomia.trim()) return 'Completa U.M.'
  return unitaEconomiaValida(umEconomia) ? null : 'U.M. Economia non valida'
}
export function selezionaRigaFattura(ids: string[], r: RigaMaterialeFattura, presenti: string[]): string[] {
  if (!r.id || presenti.includes(r.id) || motivoNonSelezionabile(r)) return ids
  return ids.includes(r.id) ? ids.filter(id => id !== r.id) : [...ids, r.id]
}
export async function leggiRaccolteMateriali(client: Client, cantiereId: string): Promise<RaccoltaMateriali[]> {
  if (!uuidFattura(cantiereId)) throw Error('Cantiere non valido')
  const { data, error } = await client.rpc('leggi_raccolte_economia', { p_cantiere_id: cantiereId })
  if (error || !Array.isArray(data)) throw Error('Impossibile leggere le raccolte Economia')
  return data.map((r: unknown) => {
    if (!record(r) || !uuidFattura(r.id) || r.cantiere_id !== cantiereId || typeof r.titolo !== 'string' || !Number.isSafeInteger(r.revisione) || Number(r.revisione) < 0 || !['bozza', 'chiusa'].includes(String(r.stato))) throw Error('Raccolta Economia non verificabile')
    return { id: r.id, titolo: r.titolo, revisione: Number(r.revisione), stato: r.stato as RaccoltaMateriali['stato'] }
  })
}
export async function leggiFattureAssegnate(client: Client, raccoltaId: string, cantiereId: string) {
  const { data, error } = await client.rpc('leggi_raccolta_economia', { p_raccolta_id: raccoltaId })
  if (error || !record(data) || !record(data.raccolta) || data.raccolta.id !== raccoltaId || data.raccolta.cantiere_id !== cantiereId || !['bozza', 'chiusa'].includes(String(data.raccolta.stato)) || !Number.isSafeInteger(data.raccolta.revisione) || Number(data.raccolta.revisione) < 0 || !Array.isArray(data.righe)) throw Error('Raccolta non disponibile')
  const presenti: string[] = []
  for (const r of data.righe) {
    if (!record(r) || r.raccolta_id !== raccoltaId) throw Error('Riga Economia non verificabile')
    if (r.fattura_riga_id !== null && r.fattura_riga_id !== undefined) {
      if (!uuidFattura(r.fattura_riga_id) || r.origine !== 'fattura_fornitore') throw Error('Provenienza fattura non verificabile')
      presenti.push(r.fattura_riga_id)
    }
  }
  return { presenti, revisione: Number(data.raccolta.revisione), stato: data.raccolta.stato as RaccoltaMateriali['stato'] }
}
export async function leggiDisponibilitaMaterialiFattura(client: Client, fatturaId: string, raccoltaId: string | null): Promise<Record<string, DisponibilitaMateriale>> {
  if (!uuidFattura(fatturaId) || (raccoltaId !== null && !uuidFattura(raccoltaId))) throw Error('Destinazione non valida')
  const { data, error } = await client.rpc('leggi_disponibilita_materiali_fattura', { p_fattura_id: fatturaId, p_raccolta_id: raccoltaId })
  if (error || !Array.isArray(data)) throw Error('Disponibilità materiali non verificabile')
  const result: Record<string, DisponibilitaMateriale> = {}
  for (const r of data) {
    if (!record(r) || !uuidFattura(r.fattura_riga_id) || result[r.fattura_riga_id] || typeof r.gia_presente_nella_raccolta !== 'boolean') throw Error('Disponibilità materiali non verificabile')
    const originale = quantitaIntera(r.quantita_originale), assegnata = quantitaIntera(r.quantita_assegnata), residua = quantitaIntera(r.quantita_residua)
    if (originale === null || originale <= BigInt(0) || assegnata === null || residua === null || originale - assegnata !== residua) throw Error('Disponibilità materiali incoerente')
    result[r.fattura_riga_id] = { fattura_riga_id: r.fattura_riga_id, quantita_originale: fisso(originale, 6), quantita_assegnata: fisso(assegnata, 6), quantita_residua: fisso(residua, 6), gia_presente_nella_raccolta: r.gia_presente_nella_raccolta }
    if (raccoltaId === null) {
      if (r.gia_presente_nella_raccolta) throw Error('Raccolta inattesa nel contesto Impresa')
      Object.assign(result[r.fattura_riga_id], componentiImpresa(r, assegnata))
    }
  }
  return result
}
export async function inviaMaterialiFattura(client: Client, raccoltaId: string, revisione: number, ids: string[], unitaEconomia: Record<string, string>, quantita: Record<string, string>, integrazionePostChiusura = false) {
  if (!uuidFattura(raccoltaId) || !Number.isSafeInteger(revisione) || revisione < 0 || !ids.length || ids.some(id => !uuidFattura(id)) || new Set(ids).size !== ids.length) throw Error('Selezione non valida')
  if (!unitaEconomia || ids.some(id => !unitaEconomiaValida(unitaEconomia[id]))) throw Error('Completa U.M. delle righe selezionate prima di inviare')
  if (!quantita || ids.some(id => { const q = quantitaIntera(quantita[id]); return q === null || q <= BigInt(0) }) || typeof integrazionePostChiusura !== 'boolean') throw Error('Quantità da inviare non valida')
  const { data, error } = await client.rpc('salva_bozza_economia', { p_raccolta_id: raccoltaId, p_revisione_attesa: revisione,
    p_payload: { integrazione_post_chiusura: integrazionePostChiusura, righe_da_creare: ids.map(id => ({ origine: 'fattura_fornitore', fattura_riga_id: id, quantita_da_inviare: quantitaEconomia(quantita[id])!, unita_misura_economia: unitaEconomiaValida(unitaEconomia[id])! })) } })
  if (error) throw erroreRpcAssegnazione(error, error.code === '23505' ? 'Conflitto di unicità: rileggere la raccolta. Nessun retry automatico.' : messaggioAssegnazione(error))
  if (!record(data) || !record(data.raccolta) || data.raccolta.id !== raccoltaId || !Number.isSafeInteger(data.raccolta.revisione) || !Array.isArray(data.esiti_fattura)) throw Error('Esito non verificabile: rileggere la raccolta, non ripetere automaticamente.')
  const esiti = data.esiti_fattura.map((r: unknown) => {
    if (!record(r) || !uuidFattura(r.fattura_riga_id) || !ids.includes(r.fattura_riga_id) || !['inserita', 'gia_assegnata', 'errore'].includes(String(r.stato))) throw Error('Esito riga non verificabile')
    return { id: r.fattura_riga_id, stato: String(r.stato), motivo: typeof r.motivo === 'string' ? messaggioAssegnazione(r.motivo) : '' }
  })
  if (esiti.length !== ids.length || new Set(esiti.map(r => r.id)).size !== ids.length) throw Error('Esiti incompleti: rileggere la raccolta, nessun retry automatico.')
  return { esiti, revisione: Number(data.raccolta.revisione) }
}
export function provenienzaFatturaEconomia(r: unknown): string | null {
  if (!record(r) || r.origine !== 'fattura_fornitore') return null
  const d = r.dettagli_analitici
  if (!record(d) || d.version !== 1 || !record(d.fattura) || d.fattura.fattura_riga_id !== r.fattura_riga_id || !uuidFattura(r.fattura_riga_id)) throw Error('Provenienza fattura non verificabile')
  const s = d.fattura
  const testo = (v: unknown) => typeof v === 'string' && v.trim() ? v : 'Non disponibile'
  return `Fonte: Fattura fornitore · Fornitore: ${testo(s.fornitore)} · Fattura n.: ${testo(s.numero_fattura)} · Data: ${testo(s.data_fattura)} · Formato originale: ${testo(s.formato_originale)}`
}

export type DestinazioneMateriale = 'economia' | 'cantiere' | 'impresa'
export type StatoFattura = 'da_assegnare' | 'parzialmente_assegnata' | 'assegnata'
export type AssegnazioneMateriale = {
  id: string; destinazione: DestinazioneMateriale; cantiere_id: string | null; cantiere: string | null
  categoria?: 'attrezzo_ditta' | 'magazzino'
  raccolta_id: string | null; raccolta: string | null; quantita: string; unita_misura: string
  prezzo_unitario: string; totale: string; data: string
}
export type StoricoMateriale = DisponibilitaMateriale & { stato: StatoFattura; assegnazioni: AssegnazioneMateriale[] }
export type ContestoMateriali = {
  storico: Record<string, StoricoMateriale>; disponibilita: Record<string, DisponibilitaMateriale>
  presenti: string[]; revisione: number | null; statoRaccolta: RaccoltaMateriali['stato'] | null; statoFattura: StatoFattura
}
const statoFatturaValido = (v: unknown): v is StatoFattura => v === 'da_assegnare' || v === 'parzialmente_assegnata' || v === 'assegnata'
export function etichettaStatoFattura(v: unknown): string {
  return v === 'assegnata' ? 'Assegnata' : v === 'parzialmente_assegnata' ? 'Parzialmente assegnata' : v === 'da_assegnare' ? 'Da assegnare' : '—'
}
export function statoRigaMateriale(d: DisponibilitaMateriale | undefined): string {
  if (!d) return '—'
  const originale = quantitaIntera(d.quantita_originale), assegnata = quantitaIntera(d.quantita_assegnata), residua = quantitaIntera(d.quantita_residua)
  if (originale === null || originale <= BigInt(0) || assegnata === null || residua === null || originale - assegnata !== residua) return '—'
  return residua === BigInt(0) ? 'Assegnata' : assegnata === BigInt(0) ? 'Da assegnare' : 'Parzialmente assegnata'
}
function erroreRpcAssegnazione(v: unknown, messaggio: string): Error {
  const campo = (nome: string) => record(v) && typeof v[nome] === 'string' ? v[nome] : null
  return Object.assign(Error(messaggio), { diagnosticaRpc: {
    code: campo('code'), message: campo('message'), details: campo('details'), hint: campo('hint'),
  } })
}
export function messaggioAssegnazione(v: unknown): string {
  const testo = typeof v === 'string' ? v : record(v) && typeof v.message === 'string' ? v.message : 'Assegnazione non completata: rileggere lo stato. Nessun retry automatico.'
  const messaggio = /costi legacy|documento con costi legacy/i.test(testo)
    ? 'Questa fattura contiene assegnazioni precedenti non collegabili automaticamente. Verifica manuale necessaria.' : testo
  return record(v) && record(v.diagnosticaRpc)
    ? `${messaggio}\nRPC: ${JSON.stringify(v.diagnosticaRpc, null, 2)}` : messaggio
}
export async function leggiStatoFattura(client: Pick<SupabaseClient, 'from'>, fatturaId: string): Promise<StatoFattura> {
  if (!uuidFattura(fatturaId)) throw Error('Fattura non valida')
  const { data, error } = await client.from('fatture_fornitori').select('id,stato').eq('id', fatturaId).single()
  if (error || !record(data) || data.id !== fatturaId || !statoFatturaValido(data.stato)) throw Error('Stato fattura non verificabile')
  return data.stato
}
export async function leggiStoricoMaterialiFattura(client: Client, fatturaId: string, cantiereId: string | null): Promise<Record<string, StoricoMateriale>> {
  if (!uuidFattura(fatturaId) || (cantiereId !== null && !uuidFattura(cantiereId))) throw Error('Destinazione non valida')
  const { data, error } = await client.rpc('leggi_assegnazioni_materiali_fattura', { p_fattura_id: fatturaId, p_cantiere_id: cantiereId })
  if (error) throw Error(messaggioAssegnazione(error))
  if (!Array.isArray(data)) throw Error('Storico assegnazioni non verificabile')
  const result: Record<string, StoricoMateriale> = {}
  for (const r of data) {
    if (!record(r) || !uuidFattura(r.fattura_riga_id) || result[r.fattura_riga_id] || !Array.isArray(r.assegnazioni)) throw Error('Storico assegnazioni non verificabile')
    const originale = quantitaIntera(r.quantita_originale), assegnata = quantitaIntera(r.quantita_assegnata), residua = quantitaIntera(r.quantita_residua)
    if (originale === null || originale <= BigInt(0) || assegnata === null || residua === null || originale - assegnata !== residua) throw Error('Storico quantità incoerente')
    const stato: StatoFattura = residua === BigInt(0) ? 'assegnata' : assegnata === BigInt(0) ? 'da_assegnare' : 'parzialmente_assegnata'
    if (r.stato !== stato) throw Error('Stato riga non verificabile')
    const seen = new Set<string>(); let sommaVisibile = BigInt(0)
    const assegnazioni: AssegnazioneMateriale[] = r.assegnazioni.map((a: unknown) => {
      if (!record(a) || !uuidFattura(a.id) || seen.has(`${a.destinazione}:${a.id}`) || typeof a.unita_misura !== 'string' || !a.unita_misura.trim() || typeof a.data !== 'string' || !Number.isFinite(Date.parse(a.data))) throw Error('Assegnazione storica non verificabile')
      if (cantiereId === null) {
        if (a.destinazione !== 'impresa' || (a.categoria !== 'attrezzo_ditta' && a.categoria !== 'magazzino') || a.fattura_riga_id !== r.fattura_riga_id || a.cantiere_id !== null || a.cantiere !== null || a.raccolta_id !== null || a.raccolta !== null || a.created_at !== a.data) throw Error('Storico Impresa non verificabile')
      } else if (!uuidFattura(a.cantiere_id) || (a.destinazione !== 'economia' && a.destinazione !== 'cantiere')) throw Error('Assegnazione storica non verificabile')
      if (a.destinazione === 'economia' ? !uuidFattura(a.raccolta_id) : a.raccolta_id !== null) throw Error('Destinazione storica incoerente')
      const q = quantitaIntera(a.quantita), prezzo = decimale(a.prezzo_unitario), totale = decimale(a.totale)
      if (q === null || q <= BigInt(0) || !prezzo || !totale || (prezzo.scala > 6 && scalato(prezzo, 6) * BigInt(10) ** BigInt(prezzo.scala - 6) !== prezzo.intero) || (totale.scala > 2 && scalato(totale, 2) * BigInt(10) ** BigInt(totale.scala - 2) !== totale.intero)) throw Error('Importi storici non verificabili')
      const valori = valoriEconomiaFattura({ quantita: fisso(q, 6), prezzo_unitario: a.prezzo_unitario as string | number })
      if (!valori || valori.totale !== fisso(scalato(totale, 2), 2)) throw Error('Totale storico incoerente')
      seen.add(`${a.destinazione}:${a.id}`); sommaVisibile += q
      return { id: a.id, destinazione: a.destinazione as DestinazioneMateriale, cantiere_id: a.cantiere_id as string | null, cantiere: typeof a.cantiere === 'string' ? a.cantiere : null,
        ...(a.destinazione === 'impresa' ? { categoria: a.categoria as 'attrezzo_ditta' | 'magazzino' } : {}),
        raccolta_id: a.destinazione === 'economia' ? a.raccolta_id as string : null, raccolta: typeof a.raccolta === 'string' ? a.raccolta : null,
        quantita: fisso(q, 6), unita_misura: a.unita_misura, prezzo_unitario: valori.prezzo, totale: valori.totale, data: a.data }
    })
    // The reader can omit details of cantieri not owned by this user; global quantities remain authoritative.
    if (sommaVisibile > assegnata) throw Error('Storico quantità incoerente')
    result[r.fattura_riga_id] = { fattura_riga_id: r.fattura_riga_id, quantita_originale: fisso(originale, 6), quantita_assegnata: fisso(assegnata, 6), quantita_residua: fisso(residua, 6), gia_presente_nella_raccolta: false, stato, assegnazioni }
    if (cantiereId === null) {
      const componenti = componentiImpresa(r, assegnata)
      if (fisso(sommaVisibile, 6) !== componenti.quantita_assegnata_impresa) throw Error('Storico Impresa incompleto')
      Object.assign(result[r.fattura_riga_id], componenti)
    }
  }
  return result
}
export async function leggiContestoMateriali(client: Pick<SupabaseClient, 'rpc' | 'from'>, fatturaId: string, cantiereId: string, destinazione: DestinazioneMateriale, raccoltaId: string): Promise<ContestoMateriali> {
  if (destinazione === 'impresa') {
    const [disponibilita, storico, statoFattura] = await Promise.all([
      leggiDisponibilitaMaterialiFattura(client, fatturaId, null), leggiStoricoMaterialiFattura(client, fatturaId, null), leggiStatoFattura(client, fatturaId),
    ])
    const campi = ['quantita_originale', 'quantita_assegnata', 'quantita_residua', 'quantita_assegnata_economia', 'quantita_assegnata_cantiere', 'quantita_assegnata_impresa'] as const
    if (Object.keys(disponibilita).length !== Object.keys(storico).length || Object.entries(disponibilita).some(([id, d]) => !storico[id] || campi.some(k => d[k] !== storico[id][k]))) throw Error('Disponibilità cambiata: rileggere la fattura')
    return { disponibilita, storico, statoFattura, presenti: [], revisione: null, statoRaccolta: null }
  }
  if (destinazione === 'economia') {
    const [v, disponibilita, storico, statoFattura] = await Promise.all([
      leggiFattureAssegnate(client, raccoltaId, cantiereId), leggiDisponibilitaMaterialiFattura(client, fatturaId, raccoltaId),
      leggiStoricoMaterialiFattura(client, fatturaId, cantiereId), leggiStatoFattura(client, fatturaId),
    ])
    if (Object.keys(disponibilita).length !== Object.keys(storico).length || Object.entries(disponibilita).some(([id, d]) => !storico[id] || d.quantita_originale !== storico[id].quantita_originale || d.quantita_assegnata !== storico[id].quantita_assegnata || d.quantita_residua !== storico[id].quantita_residua || d.gia_presente_nella_raccolta !== v.presenti.includes(id))) throw Error('Disponibilità cambiata: rileggere la fattura')
    return { disponibilita, storico, statoFattura, presenti: v.presenti, revisione: v.revisione, statoRaccolta: v.stato }
  }
  if (destinazione !== 'cantiere') throw Error('Destinazione non valida')
  const [storico, statoFattura] = await Promise.all([leggiStoricoMaterialiFattura(client, fatturaId, cantiereId), leggiStatoFattura(client, fatturaId)])
  return { disponibilita: storico, storico, statoFattura, presenti: [], revisione: null, statoRaccolta: null }
}
export function verificaRigheMateriali(righe: RigaMaterialeFattura[], contesto: ContestoMateriali): void {
  if (!righe.length || Object.keys(contesto.disponibilita).length !== righe.length || new Set(righe.map(r => r.id)).size !== righe.length || righe.some(r => !uuidFattura(r.id) || !contesto.disponibilita[r.id] || quantitaEconomia(r.quantita) !== contesto.disponibilita[r.id].quantita_originale)) throw Error('Disponibilità righe non coerente: rileggere la fattura')
}
export async function assegnaMaterialiCantiere(client: Client, cantiereId: string, ids: string[], unita: Record<string, string>, quantita: Record<string, string>) {
  if (!uuidFattura(cantiereId) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !uuidFattura(id) || !unitaEconomiaValida(unita[id]) || quantitaIntera(quantita[id]) === null || quantitaIntera(quantita[id])! <= BigInt(0))) throw Error('Selezione, quantità o U.M. non valide')
  const esiti: { id: string; stato: string; motivo: string }[] = []
  // RPC transactions are per row: stop at the first failure and always reread server state in the UI.
  for (const id of ids) {
    const { data, error } = await client.rpc('assegna_materiale_fattura_cantiere', { p_fattura_riga_id: id, p_cantiere_id: cantiereId, p_quantita_da_assegnare: quantitaEconomia(quantita[id])!, p_unita_misura: unitaEconomiaValida(unita[id])! })
    if (error) throw erroreRpcAssegnazione(error, error.code === '42501' ? 'Destinazione Cantiere non abilitata o non autorizzata. Rileggere le assegnazioni; nessun retry automatico.' : messaggioAssegnazione(error))
    if (!record(data) || !uuidFattura(data.id) || data.fattura_riga_id !== id || !statoFatturaValido(data.stato_fattura) || quantitaIntera(data.quantita_assegnata) === null || quantitaIntera(data.quantita_residua) === null || quantitaIntera(data.quantita_assegnata)! < quantitaIntera(quantita[id])!) throw Error('Esito non verificabile: rileggere le assegnazioni, nessun retry automatico.')
    esiti.push({ id, stato: 'inserita', motivo: '' })
  }
  return { esiti }
}
export async function assegnaMaterialiImpresa(client: Client, ids: string[], unita: Record<string, string>, quantita: Record<string, string>, richieste: Record<string, string>, categorie?: Record<string, string>) {
  if ((categorie && ids.some(id => !['attrezzo_ditta', 'magazzino'].includes(categorie[id]))) || !ids.length || new Set(ids).size !== ids.length || new Set(ids.map(id => richieste[id])).size !== ids.length || ids.some(id => !uuidFattura(id) || !uuidFattura(richieste[id]) || !unitaEconomiaValida(unita[id]) || quantitaIntera(quantita[id]) === null || quantitaIntera(quantita[id])! <= BigInt(0))) throw Error('Selezione, richiesta, quantità o U.M. non valide')
  const esiti: { id: string; stato: string; motivo: string }[] = []
  for (const id of ids) {
    const { data, error } = await client.rpc('assegna_materiale_fattura_impresa', {
      p_fattura_riga_id: id, p_quantita: quantitaEconomia(quantita[id])!, p_unita_misura: unitaEconomiaValida(unita[id])!, p_categoria: categorie?.[id] ?? 'attrezzo_ditta', p_richiesta_id: richieste[id],
    })
    if (error) throw erroreRpcAssegnazione(error, messaggioAssegnazione(error))
    if (!record(data) || !uuidFattura(data.id) || data.fattura_riga_id !== id || !statoFatturaValido(data.stato_fattura) || quantitaIntera(data.quantita_assegnata) === null || quantitaIntera(data.quantita_residua) === null || quantitaIntera(data.quantita_assegnata)! < quantitaIntera(quantita[id])!) throw Error('Esito Impresa non verificabile: rileggere le assegnazioni, nessun retry automatico.')
    esiti.push({ id, stato: 'inserita', motivo: '' })
  }
  return { esiti }
}
export async function verificaFatturaLegacy(client: Client, fatturaId: string): Promise<void> {
  if (!uuidFattura(fatturaId)) throw Error('Fattura non valida')
  const { data, error } = await client.rpc('fattura_con_assegnazioni_quantitative', { p_fattura_id: fatturaId })
  if (error || typeof data !== 'boolean') throw Error('Impossibile verificare le assegnazioni: nessuna modifica eseguita')
  if (data) throw Error('Questa fattura ha assegnazioni quantitative. Usa Assegna materiali e quantità; gestione precedente bloccata.')
}
