import type { SupabaseClient } from '@supabase/supabase-js'
import { apriArteCna, esportaArteCna, type DocumentoFile } from './fileNativo'
import { clonaDocumento } from './richiamo'
import { leggiRiferimentoPrivato, riferimentoFileQuaderno } from './storagePrivato'
import { rpcQuaderno, type AssetRichiamo } from './operazioni'

export type Gestione = {
  id: string; user_id: string; tipo: 'duplica' | 'elimina' | 'rimuovi'; stato: 'aperto' | 'pulizia' | 'completato'
  titolo: string; progetto_id?: string; destinazione_id?: string; richiamo_id?: string; sopralluogo_id?: string
  assets: { storage_path: string }[]
}
type FileCopia = { path: string; bytes: Uint8Array; mime: string; sha256: string }
export type PianoGestione = { id: string; user: string; tipo: Gestione['tipo']; titolo: string; sopralluogo?: string; rpc: string; args: Record<string, unknown>; files: FileCopia[] }
export interface DiarioGestione { salva(piano: PianoGestione): Promise<void>; leggi(user: string, id: string): Promise<PianoGestione | undefined>; elenco(user: string): Promise<PianoGestione[]>; elimina(user: string, id: string): Promise<void> }

async function locale<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('artecna-quaderno-gestioni', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('piani', { keyPath: ['user', 'id'] })
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
  })
  return new Promise((resolve, reject) => {
    const tx = db.transaction('piani', mode), r = action(tx.objectStore('piani'))
    tx.oncomplete = () => { db.close(); resolve(r.result) }
    tx.onabort = () => { db.close(); reject(tx.error || r.error) }
    tx.onerror = () => { /* solo onabort conclude il fallimento */ }
  })
}
export const diarioGestione: DiarioGestione = {
  salva: async p => { await locale('readwrite', s => s.put(p)) },
  leggi: (u, id) => locale('readonly', s => s.get([u, id])),
  elenco: async u => (await locale<PianoGestione[]>('readonly', s => s.getAll())).filter(p => p.user === u),
  elimina: async (u, id) => { await locale('readwrite', s => s.delete([u, id])) },
}
async function utente(client: SupabaseClient) {
  const auth = await client.auth.getUser()
  if (auth.error) throw auth.error
  if (!auth.data.user) throw Error('Autenticazione richiesta')
  return auth.data.user.id
}
async function hash(bytes: Uint8Array) {
  const h = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('')
}
export async function gestioniPendenti(client: SupabaseClient, diario = diarioGestione): Promise<Gestione[]> {
  const u = await utente(client)
  const remote = await client.from('quaderno_gestioni').select('*').eq('user_id', u).neq('stato', 'completato')
  if (remote.error) throw remote.error
  const found = new Map<string, Gestione>((remote.data || []).map(g => [g.id, g]))
  for (const p of await diario.elenco(u)) if (!found.has(p.id)) found.set(p.id, {
    id: p.id, user_id: u, tipo: p.tipo, stato: 'aperto', titolo: p.titolo, assets: [],
    sopralluogo_id: p.sopralluogo,
    richiamo_id: p.args.p_richiamo as string | undefined,
    progetto_id: (p.args.p_progetto || p.args.p_sorgente) as string | undefined,
    destinazione_id: p.args.p_destinazione as string | undefined,
  })
  return [...found.values()]
}
export async function archiviaNonAvviata(client: SupabaseClient, g: Gestione, diario = diarioGestione) {
  const u = await utente(client)
  await rpcQuaderno(client, 'quaderno_archivia_non_avviata', { p_id: g.id, p_tipo: g.tipo })
  await diario.elimina(u, g.id)
}
// Nessun successo anticipato: una risposta persa lascia lo stesso UUID e i byte nel diario.
export async function riprendiGestione(client: SupabaseClient, id: string, annullaCopia = false, diario = diarioGestione): Promise<Gestione> {
  const u = await utente(client), piano = await diario.leggi(u, id)
  let g: Gestione
  if (annullaCopia) g = await rpcQuaderno(client, 'quaderno_annulla_duplicazione', { p_id: id })
  else if (piano) g = await rpcQuaderno(client, piano.rpc, piano.args)
  else g = await rpcQuaderno(client, 'quaderno_gestione_esito', { p_id: id })
  if (g.user_id !== u) throw Error('Operazione di altro utente')
  if (g.stato !== 'completato') {
    if (g.tipo === 'duplica' && g.stato === 'aperto') {
      if (!piano || g.assets.length !== piano.files.length) throw Error('Byte locali non disponibili: annulla la copia incompleta e riprendi pulizia')
      for (const file of piano.files) {
        if (!g.assets.some(a => a.storage_path === file.path) || await hash(file.bytes) !== file.sha256) throw Error('Manifesto locale non valido')
        const bucket = client.storage.from('quaderno-privato')
        const upload = await bucket.upload(file.path, new Blob([new Uint8Array(file.bytes)], { type: file.mime }), { upsert: false })
        if (upload.error) {
          // Include upload riuscito con risposta persa e conflitto su un retry.
          const existing = await bucket.download(file.path)
          if (existing.error || !existing.data || await hash(new Uint8Array(await existing.data.arrayBuffer())) !== file.sha256) throw upload.error
        }
      }
    } else {
      const bucket = g.tipo === 'rimuovi' ? 'quaderno-sopralluoghi' : 'quaderno-privato'
      const prefix = `utenti/${u}/${g.tipo === 'rimuovi' ? 'richiami/' + g.richiamo_id : 'quaderni/' + (g.destinazione_id || g.progetto_id)}/`
      const paths = g.assets.map(a => a.storage_path)
      if (paths.some(path => !path.startsWith(prefix))) throw Error('Manifesto fuori dal perimetro autorizzato')
      for (let i = 0; i < paths.length; i += 100) {
        const result = await client.storage.from(bucket).remove(paths.slice(i, i + 100))
        if (result.error) throw result.error
      }
    }
    g = await rpcQuaderno(client, 'quaderno_concludi_gestione', { p_id: id })
  }
  if (g.stato !== 'completato') throw Error('Operazione non conclusa: riprendere')
  await diario.elimina(u, id)
  return g
}
async function verificaLibero(client: SupabaseClient, diario: DiarioGestione, progetto?: string, sopralluogo?: string) {
  const pendenti = await gestioniPendenti(client, diario)
  if (pendenti.some(g => progetto ? g.progetto_id === progetto : g.sopralluogo_id === sopralluogo)) throw Error('Operazione precedente da riprendere prima di una nuova richiesta')
}
export async function eliminaProgetto(client: SupabaseClient, progetto: { id: string; titolo: string; updated_at: string }, diario = diarioGestione) {
  await verificaLibero(client, diario, progetto.id)
  const u = await utente(client), id = crypto.randomUUID()
  await diario.salva({ id, user: u, tipo: 'elimina', titolo: progetto.titolo, files: [], rpc: 'quaderno_prepara_eliminazione', args: { p_id: id, p_progetto: progetto.id, p_versione: progetto.updated_at } })
  return riprendiGestione(client, id, false, diario)
}
export async function rimuoviRichiamo(client: SupabaseClient, richiamo: { id: string; titolo: string; sopralluogo: string; versione: string | null }, diario = diarioGestione) {
  await verificaLibero(client, diario, undefined, richiamo.sopralluogo)
  const u = await utente(client), id = crypto.randomUUID()
  await diario.salva({ id, user: u, tipo: 'rimuovi', titolo: richiamo.titolo, sopralluogo: richiamo.sopralluogo, files: [], rpc: 'quaderno_prepara_rimozione', args: { p_id: id, p_richiamo: richiamo.id, p_versione: richiamo.versione } })
  return riprendiGestione(client, id, false, diario)
}
export async function duplicaProgetto(client: SupabaseClient, progettoId: string, diario = diarioGestione) {
  await verificaLibero(client, diario, progettoId)
  const u = await utente(client)
  const source = await client.from('quaderno_progetti').select('*').eq('id', progettoId).eq('user_id', u).single()
  if (source.error) throw source.error
  const attachments = await client.from('quaderno_allegati').select('*').eq('nota_id', progettoId).eq('user_id', u)
  if (attachments.error) throw attachments.error
  const s = source.data, doc: DocumentoFile = { titolo: s.titolo, testo: s.testo, checklist: s.checklist, disegni: s.disegni, analisi_ai: s.analisi_ai }
  const zip = await esportaArteCna(doc, (attachments.data || []).map(a => ({ ...a, uri: 'storage:' + a.storage_path })), async uri => {
    const ref = leggiRiferimentoPrivato(uri)
    if (ref || uri.startsWith('storage:')) {
      const r = await client.storage.from(ref?.bucket || 'quaderno-privato').download(ref?.path || uri.slice(8))
      if (r.error) throw r.error
      return r.data
    }
    if (!uri.startsWith('data:')) throw Error('Risorsa non privata o incorporata')
    return (await fetch(uri)).blob()
  })
  const portable = await apriArteCna(zip), dest = crypto.randomUUID(), id = crypto.randomUUID()
  const replacements = new Map<string, string>(), assets: AssetRichiamo[] = [], files: FileCopia[] = []
  for (const resource of portable.risorse) {
    const path = `utenti/${u}/quaderni/${dest}/${crypto.randomUUID()}`, sha256 = await hash(resource.bytes)
    replacements.set(resource.uri, riferimentoFileQuaderno(path))
    assets.push({ id: crypto.randomUUID(), nome_file: resource.nome, tipo: resource.tipo || 'immagine', mime_type: resource.mime, storage_path: path, sha256 })
    files.push({ path, bytes: resource.bytes, mime: resource.mime, sha256 })
  }
  const document = clonaDocumento(portable.documento)
  document.titolo = s.titolo + ' - copia'
  const rewritten: DocumentoFile = JSON.parse(JSON.stringify(document, (_k, v: unknown) => typeof v === 'string' ? replacements.get(v) || v : v))
  await diario.salva({ id, user: u, tipo: 'duplica', titolo: document.titolo, files, rpc: 'quaderno_prepara_duplicazione', args: { p_id: id, p_sorgente: progettoId, p_versione: s.updated_at, p_destinazione: dest, p_documento: rewritten, p_assets: assets } })
  return riprendiGestione(client, id, false, diario)
}

export function idsRichiamiPresenti(pagine: unknown, allegati: { richiamo_id?: string }[]): string[] {
  const found = new Set<string>()
  function visita(v: unknown) {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) { v.forEach(visita); return }
    const rec = v as Record<string, unknown>, origin = rec.provenienzaQuaderno as { richiamoId?: string } | undefined
    if (origin?.richiamoId) found.add(origin.richiamoId)
    for (const [k, value] of Object.entries(rec)) if (k !== 'provenienzaQuaderno') visita(value)
  }
  visita(pagine); allegati.forEach(a => { if (a.richiamo_id) found.add(a.richiamo_id) })
  return [...found]
}
