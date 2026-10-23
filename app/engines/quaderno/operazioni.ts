import type { SupabaseClient } from '@supabase/supabase-js'
import type { DocumentoFile } from './fileNativo'
import type { AllegatoNota } from '../../components/note/types'

export type AssetRichiamo = { id: string; nome_file: string; tipo: string; mime_type: string; storage_path: string; sha256: string }
export type Preparazione = { p_id: string; p_sopralluogo: string; p_sorgente: string; p_sorgente_versione: string; p_versione: string | null; p_documento: DocumentoFile; p_assets: AssetRichiamo[] }
export type Diario = { chiave: string; utente: string; sopralluogo: string; bozza: DocumentoFile; preparazione?: Preparazione; conflitto?: boolean }
export type Esito = { richiamo: { id: string; stato: 'preparazione' | 'completato' | 'annullato'; assets: AssetRichiamo[]; sorgente_titolo: string; sorgente_updated_at: string; richiamato_at: string; pulito_at?: string | null }; nota: (DocumentoFile & { id: string; updated_at: string }) | null; allegati: AllegatoNota[] }
export interface ArchivioOperazioni { leggi(chiave: string): Promise<Diario | undefined>; scrivi(diario: Diario): Promise<void>; elimina(chiave: string): Promise<void> }

// IndexedDB contiene anche la bozza: nessuna quota stringa localStorage o URL scadibile.
async function transazione<T>(mode: IDBTransactionMode, azione: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('artecna-quaderno-operazioni', 1)
    request.onupgradeneeded = () => { request.result.createObjectStore('operazioni', { keyPath: 'chiave' }) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('operazioni', mode), request = azione(tx.objectStore('operazioni'))
    tx.oncomplete = () => { resolve(request.result); db.close() }
    tx.onabort = () => { reject(tx.error || request.error); db.close() }
    tx.onerror = () => { /* onabort gestisce l'esito, nessun successo anticipato */ }
  })
}
export const archivioOperazioni: ArchivioOperazioni = {
  leggi: chiave => transazione<Diario | undefined>('readonly', s => s.get(chiave)),
  scrivi: async diario => { await transazione('readwrite', s => s.put(diario)) },
  elimina: async chiave => { await transazione('readwrite', s => s.delete(chiave)) },
}
export const chiaveOperazione = (utente: string, sopralluogo: string) => `${utente}:${sopralluogo}`
export async function rpcQuaderno<T>(supabase: SupabaseClient, nome: string, args: Record<string, unknown>): Promise<T> {
  const r = await supabase.rpc(nome, args)
  if (r.error) throw r.error
  return r.data as T
}
export async function trovaOperazione(supabase: SupabaseClient, sopralluogo: string, archivio = archivioOperazioni) {
  const auth = await supabase.auth.getUser()
  if (auth.error) throw auth.error
  if (!auth.data.user) throw Error('Autenticazione richiesta')
  const chiave = chiaveOperazione(auth.data.user.id, sopralluogo), locale = await archivio.leggi(chiave)
  const backup = await archivio.leggi(chiave + ':bozza')
  const pending = await supabase.from('quaderno_richiami_sopralluogo').select('id').eq('user_id', auth.data.user.id).eq('sopralluogo_id', sopralluogo).is('confermato_at', null).maybeSingle()
  if (pending.error) throw pending.error
  return { locale, backup, id: pending.data?.id as string | undefined || locale?.preparazione?.p_id }
}
export async function risolviOperazione(supabase: SupabaseClient, id: string): Promise<Esito> {
  return rpcQuaderno<Esito>(supabase, 'esito_richiamo_quaderno', { p_id: id })
}
export async function pulisciAnnullato(supabase: SupabaseClient, id: string, sopralluogo: string): Promise<Esito> {
  // La conferma server prende lo stesso lock del completamento. Solo dopo si toccano i file.
  const esito = await rpcQuaderno<Esito>(supabase, 'annulla_richiamo_quaderno', { p_id: id, p_sopralluogo: sopralluogo })
  if (esito.richiamo.stato !== 'annullato') return esito
  if (esito.richiamo.pulito_at) return esito
  const paths = esito.richiamo.assets.map(a => a.storage_path)
  if (paths.length) { const r = await supabase.storage.from('quaderno-sopralluoghi').remove(paths); if (r.error) throw r.error }
  await rpcQuaderno(supabase, 'conferma_richiamo_quaderno', { p_id: id, p_pulizia: true })
  return esito
}
