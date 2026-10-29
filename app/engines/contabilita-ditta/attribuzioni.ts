import type { SupabaseClient } from '@supabase/supabase-js'
import { centesimi, dataValida } from './riepilogo'

export type ClientAttribuzioni = Pick<SupabaseClient, 'rpc'>
export type Collegamento = { id: string; fattura_id: string; acconto_id: string; importo: string | number; creato_at: string; creato_da: string; scollegato_at: string | null }
export type Acconto = { id: string; importo: string | number; attribuito: string | number; data_incasso: string | null; descrizione: string | null; provenienza: 'acconti_cantiere' }
export type LetturaAttribuzioni = { fattura: { id: string; numero_fattura: string; data_fattura: string | null; cliente: string; totale: string | number; importo_incassato: string | number | null; stato: string }; attribuito: string | number; collegamenti: Collegamento[]; acconti: Acconto[]; incassi_non_fatturati_ambigui: number; situazione: 'Da riconciliare'; residuo_verificato: null }
export type Operazione = { tipo: 'collega'; id: string; fattura: string; acconto: string; importo: string } | { tipo: 'scollega'; id: string; fattura: string; collegamento: string }
export const MESSAGGIO_INCASSI_SENZA_CANTIERE = 'Collegamento incassi non disponibile: questo documento non è associato a un Cantiere.'
// Il campo del DTO è autorevole: soltanto null esplicito attesta l'assenza.
export function statoCantiereAttribuzioni(cantiereId: unknown): 'assente' | 'presente' | 'ignoto' {
  return cantiereId === null ? 'assente' : uuid(cantiereId) ? 'presente' : 'ignoto'
}
export function cantiereDocumento(righe: readonly Record<string, unknown>[], id: string): unknown {
  const corrispondenze = righe.filter(r => r.id === id)
  // Un'identità mancante/ambigua o una proprietà assente non certifica NULL.
  return corrispondenze.length === 1 && Object.prototype.hasOwnProperty.call(corrispondenze[0], 'cantiere_id') ? corrispondenze[0].cantiere_id : undefined
}
export const uuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
export function situazioneImporti(totale: unknown, attribuito: unknown) {
  const t = centesimi(totale), a = centesimi(attribuito)
  return { quota: t !== null && a !== null && t >= 0 && a >= 0 && a <= t ? t - a : null, residuo: null, stato: 'Da riconciliare' as const }
}
export function disponibilita(a: Acconto) { return dataValida(a.data_incasso) ? situazioneImporti(a.importo, a.attribuito).quota : null }
export function messaggioErrore(code?: string) {
  return code === '42501' ? 'Accesso negato o Cantiere non verificabile.' : code === '23514' ? 'Quota non disponibile o origine protetta: aggiorna le letture.' : code === '22023' ? 'Dati o contesto non compatibili: verificare il documento e il movimento.' : 'Esito non confermato. Riprova la stessa operazione per recuperarne l’esito, senza crearne un’altra.'
}
export async function leggiAttribuzioni(client: ClientAttribuzioni, id: string): Promise<LetturaAttribuzioni> {
  const r = await client.rpc('leggi_attribuzioni_cliente', { p_fattura_id: id })
  if (r.error) throw Error(`Lettura non disponibile (${r.error.code || 'rete'}). Nessun dato sostitutivo.`)
  const d = r.data as LetturaAttribuzioni
  if (!d || d.fattura?.id !== id || !Array.isArray(d.collegamenti) || !Array.isArray(d.acconti) || d.situazione !== 'Da riconciliare' || d.residuo_verificato !== null) throw Error('Risposta di lettura non valida.')
  return d
}
export async function eseguiAttribuzione(client: ClientAttribuzioni, op: Operazione) {
  const r = op.tipo === 'collega'
    ? await client.rpc('collega_incasso_cliente', { p_richiesta_id: op.id, p_fattura_id: op.fattura, p_acconto_id: op.acconto, p_importo: op.importo, p_verificato: true })
    : await client.rpc('scollega_incasso_cliente', { p_richiesta_id: op.id, p_collegamento_id: op.collegamento })
  if (r.error) return { confermato: false, rifiutato: ['22023', '23514', '23503'].includes(r.error.code), messaggio: messaggioErrore(r.error.code) }
  const d = r.data as Collegamento
  const valido = d?.fattura_id === op.fattura && (op.tipo === 'collega' ? d.id === op.id && d.acconto_id === op.acconto && centesimi(d.importo) === centesimi(op.importo) : d.id === op.collegamento && !!d.scollegato_at)
  return { confermato: !!valido, rifiutato: false, messaggio: valido ? (op.tipo === 'collega' && d.scollegato_at ? 'Richiesta già eseguita e successivamente scollegata; nessuna riapertura.' : 'Operazione confermata dal server.') : messaggioErrore() }
}
export function recuperaOperazione(raw: string | null, fattura: string): Operazione | null {
  try { const op = JSON.parse(raw || 'null'); return op?.fattura === fattura && uuid(op.id) && (op.tipo === 'collega' ? uuid(op.acconto) && centesimi(op.importo) !== null : op.tipo === 'scollega' && uuid(op.collegamento)) ? op : null } catch { return null }
}
