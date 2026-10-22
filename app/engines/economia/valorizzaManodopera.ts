import type { ClientManodopera, VoceManodoperaEconomia } from './manodoperaEconomiaDettaglio'
import { costoNettoQuota } from './riepilogoEconomico'

export type TariffaManodopera = { prezzo: string; ultimaConferma: string; numeroUtilizzi: number }
export type ContestoValorizzazione = { raccoltaId: string; rigaId: string; revisione: number }
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
// Stessa sintassi decimale della valorizzazione Rapportini esistente; limite NUMERIC(18,6) della RPC.
export function prezzoClienteManodopera(testo: string): string | null {
  const s = testo.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,6})?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 && n < 1000000000000 ? s : null
}
export function totaleValorizzazione(ore: number, testo: string): number | null {
  const prezzo = prezzoClienteManodopera(testo)
  if (prezzo === null) return null
  try { return costoNettoQuota(ore, prezzo) } catch { return null }
}
export function puoValorizzare(r: VoceManodoperaEconomia, statoRaccolta?: string): boolean {
  return r.stato === 'Da contabilizzare' && r.prezzo === null && r.origine === 'rapportino' && r.um === 'h' && statoRaccolta === 'bozza'
}
export async function leggiTariffeManodopera(client: ClientManodopera): Promise<TariffaManodopera[]> {
  const { data, error } = await client.rpc('leggi_tariffe_manodopera_economia', {})
  if (error || !Array.isArray(data)) throw Error('Suggerimenti non disponibili. Puoi inserire manualmente il prezzo.')
  const visti = new Set<number>()
  return data.map(v => {
    const prezzo = record(v) ? prezzoClienteManodopera(String(v.prezzo)) : null
    const data = record(v) && typeof v.ultima_conferma === 'string' ? v.ultima_conferma : ''
    const usi = record(v) ? Number(v.numero_utilizzi) : NaN
    if (!prezzo || !data || !Number.isFinite(Date.parse(data)) || !Number.isSafeInteger(usi) || usi <= 0 || visti.has(Number(prezzo))) throw Error('Suggerimenti non verificabili. Puoi inserire manualmente il prezzo.')
    visti.add(Number(prezzo))
    return { prezzo, ultimaConferma: data, numeroUtilizzi: usi }
  }) // L'ordine è esclusivamente quello del reader server.
}
export async function leggiContestoValorizzazione(client: ClientManodopera, riga: VoceManodoperaEconomia, cantiereId: string): Promise<ContestoValorizzazione> {
  const { data, error } = await client.rpc('leggi_raccolta_economia', { p_raccolta_id: riga.raccoltaId })
  const c = record(data) ? data.raccolta : null
  const righe = record(data) && Array.isArray(data.righe) ? data.righe.filter((r: any) => r.id === riga.rigaId) : []
  const r = righe[0]
  if (error || !record(c) || c.id !== riga.raccoltaId || c.cantiere_id !== cantiereId || c.stato !== 'bozza' || !Number.isSafeInteger(c.revisione) || c.revisione < 0 || righe.length !== 1 || !record(r) || r.raccolta_id !== c.id || r.origine !== 'rapportino' || r.tipo_riga !== 'manodopera' || r.unita_misura !== 'h' || Number(r.quantita) !== riga.quantita || r.prezzo_unitario !== null) throw Error('Riga o raccolta cambiata: ricarica il dettaglio prima di valorizzare.')
  return { raccoltaId: c.id, rigaId: r.id, revisione: c.revisione }
}
export class ErroreValorizzazione extends Error {
  constructor(message: string, public readonly conflitto = false) { super(message) }
}
export async function confermaTariffaManodopera(client: ClientManodopera, contesto: ContestoValorizzazione, testo: string): Promise<number> {
  const prezzo = prezzoClienteManodopera(testo)
  if (!prezzo) throw new ErroreValorizzazione('Inserisci un prezzo positivo con massimo 6 decimali.')
  const { data, error } = await client.rpc('valorizza_manodopera_economia', { p_riga_id: contesto.rigaId, p_prezzo_cliente: prezzo, p_revisione_attesa: contesto.revisione })
  if (error) throw new ErroreValorizzazione(error.code === 'PT409' || error.code === '40001'
    ? 'Raccolta o prestazione cambiata. Dati ricaricati: verifica prima di confermare nuovamente.'
    : 'Valorizzazione non confermata. Ricarica i dati prima di riprovare.', true)
  if (!record(data) || data.raccolta?.id !== contesto.raccoltaId || data.raccolta?.revisione !== contesto.revisione + 1 || data.riga?.id !== contesto.rigaId || data.riga?.raccolta_id !== contesto.raccoltaId || Number(data.riga?.prezzo_unitario) !== Number(prezzo) || typeof data.riga?.prezzo_cliente_confermato_at !== 'string' || !Number.isFinite(Date.parse(data.riga.prezzo_cliente_confermato_at))) throw new ErroreValorizzazione('Esito non verificabile. Ricarica i dati prima di riprovare.', true)
  return data.raccolta.revisione
}

export async function confermaTariffeSequenziali(client: ClientManodopera, raccolta: { id: string; stato: string; revisione: number }, righe: { id: string; prezzo: string }[], attiva: () => boolean = () => true): Promise<{ confermate: number; revisione: number; interrotta: boolean; messaggio: string }> {
  if (raccolta.stato !== 'bozza' || !Number.isSafeInteger(raccolta.revisione) || raccolta.revisione < 0 || !righe.length || new Set(righe.map(r => r.id)).size !== righe.length || righe.some(r => !r.id || !prezzoClienteManodopera(r.prezzo))) throw Error('Prezzi o raccolta non validi.')
  let revisione = raccolta.revisione, confermate = 0
  for (const riga of righe) {
    if (!attiva()) return { confermate, revisione, interrotta: true, messaggio: `${confermate} righe valorizzate; operazione interrotta. Rileggi lo stato server.` }
    try {
      revisione = await confermaTariffaManodopera(client, { raccoltaId: raccolta.id, rigaId: riga.id, revisione }, riga.prezzo)
      confermate++
    } catch (e) {
      return { confermate, revisione, interrotta: true, messaggio: `${confermate} ${confermate === 1 ? 'riga valorizzata' : 'righe valorizzate'}, operazione interrotta sulla riga ${confermate + 1}. ${e instanceof Error ? e.message : 'Esito non verificabile: rileggi lo stato server.'} Conteggio delle sole conferme verificate; controlla la riga interrotta nella rilettura server.` }
    }
  }
  return { confermate, revisione, interrotta: false, messaggio: `${confermate} ${confermate === 1 ? 'riga valorizzata' : 'righe valorizzate'}. Raccolta in bozza; nessuna Variante creata.` }
}
