import { prezzoClienteManodopera } from './valorizzaManodopera'
import { costoNettoQuota } from './riepilogoEconomico'

// Stessa sintassi NUMERIC(18,6) del prezzo cliente delle ore; nessun margine automatico.
export const prezzoClienteMateriale = prezzoClienteManodopera
export function totaleClienteMateriale(quantita: number, testo: string): number | null {
  const p = prezzoClienteMateriale(testo)
  if (!p) return null
  try { const t = costoNettoQuota(quantita, p); return t > 0 ? t : null } catch { return null }
}
export type RigaPrezzoMateriale = {
  id: string; ordine: number; descrizione: string; um: string; quantita: number
  prezzo: number | null; prezzoOrigine: number | null; origine: string; provenienzaFattura: string | null
}
type Client = { rpc: (nome: string, parametri: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export async function salvaPrezzoMateriale(client: Client, raccolta: { id: string; revisione: number; stato: string }, riga: RigaPrezzoMateriale, testo: string): Promise<void> {
  const prezzo = prezzoClienteMateriale(testo)
  if (raccolta.stato !== 'bozza' || !Number.isSafeInteger(raccolta.revisione) || raccolta.revisione < 0 || !prezzo || totaleClienteMateriale(riga.quantita, testo) === null) throw Error('Inserisci un prezzo fatturabile positivo e rappresentabile; la Raccolta deve essere in bozza.')
  const { data, error } = await client.rpc('valorizza_materiale_economia', { p_raccolta_id: raccolta.id, p_riga_id: riga.id, p_prezzo_cliente: prezzo, p_revisione_attesa: raccolta.revisione })
  if (error) throw Error(error.code === 'PT409' || error.code === '40001' ? 'La Raccolta è cambiata: rileggi prima di confermare nuovamente.' : error.code === '55000' ? 'Raccolta congelata o storico protetto: modifica non consentita.' : 'Salvataggio non confermato. Rileggi i dati prima di riprovare.')
  const result = record(data) ? data : {}, c = result.raccolta, e = result.riga
  if (!record(c) || !record(e) || c.id !== raccolta.id || c.revisione !== raccolta.revisione + 1 || c.stato !== 'bozza' || e.id !== riga.id || e.raccolta_id !== raccolta.id || Number(e.quantita) !== riga.quantita || (e.prezzo_unitario === null ? null : Number(e.prezzo_unitario)) !== riga.prezzoOrigine || Number(result.prezzo_cliente) !== Number(prezzo) || Number(result.totale_riga) !== totaleClienteMateriale(riga.quantita, testo)) throw Error('Risposta non verificabile. Rileggi lo stato server; non reinviare automaticamente.')
}
