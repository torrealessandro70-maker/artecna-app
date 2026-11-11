import type { SupabaseClient } from '@supabase/supabase-js'
import { centesimi, dataValida } from './riepilogo'
import { bozzaDaScadenza, validaBozzaScadenza, type Scadenza, type StatoScadenza } from './scadenziario'

export type ClientScadenziario = Pick<SupabaseClient, 'rpc'>
export type ErroreScadenziarioTipo = 'lettura' | 'conflitto' | 'scrittura' | 'esito_incerto'
export class ErroreScadenziario extends Error {
  constructor(public readonly tipo: ErroreScadenziarioTipo, message: string) { super(message); this.name = 'ErroreScadenziario' }
}
export type ScadenzaPersistita = Scadenza & {
  revisione: string; importoPagato: string | null; dataPagamento: string | null
  createdAt: string; createdBy: string; updatedAt: string; updatedBy: string
  archiviataAt: string | null; archiviataBy: string | null; motivoArchiviazione: string | null
}
export type DatiScadenza = { scadenza: Scadenza; importoPagato: string | null; dataPagamento: string | null }
export interface ArchivioScadenziario {
  elenco(includiArchiviate?: boolean): Promise<ScadenzaPersistita[]>
  crea(dati: DatiScadenza): Promise<ScadenzaPersistita>
  aggiorna(dati: DatiScadenza, revisioneAttesa: string): Promise<ScadenzaPersistita>
  archivia(id: string, revisioneAttesa: string, motivo: string): Promise<ScadenzaPersistita>
  impostaDocumento(id: string, revisioneAttesa: string, documentoId: string | null): Promise<ScadenzaPersistita>
}
const statiDb: Record<StatoScadenza, string> = { Previsto: 'previsto', 'Da verificare': 'da_verificare', 'Da pagare': 'da_pagare', Pagato: 'pagato' }
const statiUi = Object.fromEntries(Object.entries(statiDb).map(([k, v]) => [v, k])) as Record<string, StatoScadenza>
const uuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const revisione = (s: unknown): s is string => typeof s === 'string' && /^(0|[1-9][0-9]*)$/.test(s) && BigInt(s) <= BigInt(Number.MAX_SAFE_INTEGER)
const istante = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s) && Number.isFinite(Date.parse(s))
function denaro(s: unknown): number | null {
  if (s === null) return null
  if (typeof s !== 'string' || !/^\d{1,12}(?:\.\d{1,2})?$/.test(s)) throw Error('Importo persistito non verificabile')
  const c = centesimi(s)
  if (c === null || c < 0 || c > 99999999999999) throw Error('Importo fuori contratto')
  return c
}
function leggiRiga(raw: unknown): ScadenzaPersistita {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Riga non valida')
  const r = raw as Record<string, unknown>
  const documentoId = r.documento_id ?? null
  if (documentoId !== null && !uuid(documentoId)) throw Error('Identità documento non valida')
  if (!uuid(r.id) || !revisione(r.revisione) || !uuid(r.created_by) || !uuid(r.updated_by) || !istante(r.created_at) || !istante(r.updated_at)
    || Date.parse(r.updated_at) < Date.parse(r.created_at) || typeof r.stato !== 'string' || !statiUi[r.stato]
    || typeof r.tipo !== 'string' || typeof r.periodo_riferimento !== 'string' || typeof r.note !== 'string' || typeof r.riferimento_documento !== 'string' || typeof r.includi_nei_totali !== 'boolean') throw Error('Metadati incompleti')
  const importo = denaro(r.importo_previsto); denaro(r.importo_pagato)
  if (r.data_pagamento !== null && (!dataValida(r.data_pagamento) || r.importo_pagato === null)) throw Error('Pagamento non verificabile')
  if (!((r.archiviata_at === null && r.archiviata_by === null && r.motivo_archiviazione === null)
    || (istante(r.archiviata_at) && uuid(r.archiviata_by) && typeof r.motivo_archiviazione === 'string' && r.motivo_archiviazione.trim().length > 0))) throw Error('Archiviazione incompleta')
  const base = validaBozzaScadenza({ tipo: r.tipo, periodo: r.periodo_riferimento, dataScadenza: String(r.data_scadenza), importo: r.importo_previsto === null ? '' : String(r.importo_previsto), stato: statiUi[r.stato], nota: r.note, riferimento: r.riferimento_documento, includiNeiTotali: r.includi_nei_totali }, r.id)
  if (base.importoCentesimi !== importo) throw Error('Conversione importo non coerente')
  return { ...base, documentoId, revisione: r.revisione, importoPagato: r.importo_pagato as string | null, dataPagamento: r.data_pagamento as string | null, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by, archiviataAt: r.archiviata_at as string | null, archiviataBy: r.archiviata_by as string | null, motivoArchiviazione: r.motivo_archiviazione as string | null }
}
function payload(dati: DatiScadenza) {
  const { scadenza: s, importoPagato, dataPagamento } = dati
  if (!uuid(s.id)) throw new ErroreScadenziario('scrittura', 'UUID scadenza non valido.')
  const b = bozzaDaScadenza(s); validaBozzaScadenza(b, s.id)
  const previsto = s.importoCentesimi === null ? null : b.importo
  denaro(previsto); denaro(importoPagato)
  if (dataPagamento !== null && (!dataValida(dataPagamento) || importoPagato === null)) throw new ErroreScadenziario('scrittura', 'Annotazione pagamento non valida.')
  return { tipo: b.tipo, periodo_riferimento: b.periodo, data_scadenza: b.dataScadenza, importo_previsto: previsto, stato: statiDb[b.stato], importo_pagato: importoPagato, data_pagamento: dataPagamento, note: b.nota, riferimento_documento: b.riferimento, includi_nei_totali: b.includiNeiTotali }
}
function payloadVerificato(dati: DatiScadenza) {
  try { return payload(dati) } catch (error) { throw new ErroreScadenziario('scrittura', error instanceof Error ? error.message : 'Dati non validi.') }
}
export function creaArchivioScadenziario(client: ClientScadenziario): ArchivioScadenziario {
  async function chiama(nome: string, args: Record<string, unknown>, lettura: boolean) {
    let risposta
    try { risposta = await client.rpc(nome, args) } catch { throw new ErroreScadenziario(lettura ? 'lettura' : 'esito_incerto', lettura ? 'Lettura non disponibile: non è un archivio vuoto.' : 'Esito scrittura incerto. Nessun retry: rileggere lo stesso UUID.') }
    if (!risposta || typeof risposta !== 'object') throw new ErroreScadenziario(lettura ? 'lettura' : 'esito_incerto', 'Risposta RPC assente: nessun retry automatico.')
    if (risposta.error) {
      if (risposta.error.code === '40001') throw new ErroreScadenziario('conflitto', 'Revisione cambiata o voce archiviata. Rileggere, senza reinvio automatico.')
      throw new ErroreScadenziario(lettura ? 'lettura' : 'scrittura', `${lettura ? 'Lettura' : 'Scrittura'} non riuscita (${risposta.error.code || 'codice assente'}). Nessun fallback locale o retry automatico.`)
    }
    return risposta.data as unknown
  }
  async function scrivi(nome: string, args: Record<string, unknown>, id: string, attesa: string | null, archivia: boolean) {
    const raw = await chiama(nome, args, false)
    try {
      const r = leggiRiga(raw)
      if (r.id !== id || r.revisione !== (attesa === null ? '0' : String(BigInt(attesa) + BigInt(1))) || Boolean(r.archiviataAt) !== archivia) throw Error('Acknowledgement non coerente')
      if (args.p_dati) {
        const inviati = args.p_dati as Record<string, unknown>, osservati = payload({ scadenza: r, importoPagato: r.importoPagato, dataPagamento: r.dataPagamento })
        for (const k of Object.keys(inviati)) {
          if (k === 'importo_previsto' || k === 'importo_pagato') { if (denaro(inviati[k]) !== denaro(osservati[k as keyof typeof osservati])) throw Error('Importo ack diverso') }
          else if (inviati[k] !== osservati[k as keyof typeof osservati]) throw Error('Contenuto ack diverso')
        }
      }
      return r
    } catch { throw new ErroreScadenziario('esito_incerto', 'Risposta di scrittura incompleta/inattesa. Nessun reinvio: rileggere lo stesso UUID.') }
  }
  return {
    async elenco(includiArchiviate = false) {
      const raw = await chiama('leggi_scadenze_fiscali', { p_includi_archiviate: includiArchiviate }, true)
      try {
        const r = raw as Record<string, unknown>
        if (!r || r.versione !== 1 || r.include_archiviate !== includiArchiviate || !Array.isArray(r.righe) || r.totale !== r.righe.length || r.righe.length > 5000) throw Error('Elenco incompleto')
        const righe = r.righe.map(leggiRiga), ids = new Set(righe.map(s => s.id))
        if (ids.size !== righe.length || (!includiArchiviate && righe.some(s => s.archiviataAt !== null))) throw Error('Elenco duplicato/non attivo')
        return righe
      } catch { throw new ErroreScadenziario('lettura', 'Contratto di lettura incompleto: nessun archivio vuoto sostitutivo.') }
    },
    async crea(dati) { const p = payloadVerificato(dati); return scrivi('crea_scadenza_fiscale', { p_id: dati.scadenza.id, p_dati: p }, dati.scadenza.id, null, false) },
    async aggiorna(dati, attesa) {
      if (!revisione(attesa)) throw new ErroreScadenziario('scrittura', 'Revisione attesa non valida.')
      return scrivi('aggiorna_scadenza_fiscale', { p_id: dati.scadenza.id, p_revisione_attesa: attesa, p_dati: payloadVerificato(dati) }, dati.scadenza.id, attesa, false)
    },
    async archivia(id, attesa, motivo) {
      if (!uuid(id) || !revisione(attesa) || !motivo.trim() || motivo.trim().length > 2000) throw new ErroreScadenziario('scrittura', 'Identità, revisione o motivo non validi.')
      return scrivi('archivia_scadenza_fiscale', { p_id: id, p_revisione_attesa: attesa, p_motivo: motivo.trim() }, id, attesa, true)
    },
    async impostaDocumento(id, attesa, documentoId) {
      if (!uuid(id) || !revisione(attesa) || (documentoId !== null && !uuid(documentoId))) {
        throw new ErroreScadenziario('scrittura', 'Identità o revisione non valida.')
      }
      const args = { p_id: id, p_revisione_attesa: attesa }
      const r = documentoId === null
        ? await scrivi('scollega_documento_scadenza', args, id, attesa, false)
        : await scrivi('collega_documento_scadenza', { ...args, p_documento_id: documentoId }, id, attesa, false)
      if (r.documentoId !== documentoId) throw new ErroreScadenziario('esito_incerto', 'Collegamento non confermato. Rileggere la scadenza.')
      return r
    },
  }
}
