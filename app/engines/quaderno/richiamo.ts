import type { SupabaseClient } from '@supabase/supabase-js'
import { apriArteCna, esportaArteCna, type DocumentoFile } from './fileNativo'
import { riferimentoFileQuaderno, leggiRiferimentoPrivato } from './storagePrivato'
import type { AllegatoNota, AnalisiNota, PaginaQuadernoNota } from '../../components/note/types'

export const BUCKET_COPIE = 'quaderno-sopralluoghi' as const
export type ProvenienzaQuaderno = { richiamoId: string; progettoId: string; titolo: string; salvatoIl: string; richiamatoIl: string; analisiSorgente?: AnalisiNota | null }
export class EsitoRichiamoIncerto extends Error {}

// Gli ID dei livelli restano locali alla pagina. Gli ID di pagine/oggetti e i
// relativi riferimenti (anche metadata/workspace) cambiano insieme.
export function clonaDocumento(documento: DocumentoFile, provenienza: ProvenienzaQuaderno): DocumentoFile {
  const ids = new Map<string, string>()
  function raccogli(v: unknown, key = '') {
    if (!v || typeof v !== 'object' || key === 'layers') return
    if (Array.isArray(v)) { v.forEach(x => raccogli(x)); return }
    const record = v as Record<string, unknown>
    if (typeof record.id === 'string' && !ids.has(record.id)) ids.set(record.id, crypto.randomUUID())
    for (const [k, x] of Object.entries(record)) raccogli(x, k)
  }
  raccogli(documento)
  const nuovo: DocumentoFile = JSON.parse(JSON.stringify(documento, (key, value: unknown) =>
    typeof value === 'string' && (key === 'id' || /Ids?$/.test(key) || /^\d+$/.test(key)) ? ids.get(value) || value : value))
  nuovo.disegni.forEach(page => { page.provenienzaQuaderno = provenienza })
  return nuovo
}

export function aggiungiDocumento(attuale: DocumentoFile, copia: DocumentoFile): DocumentoFile {
  if (attuale.disegni.length + copia.disegni.length > 100) throw Error('Il richiamo supererebbe il limite di 100 pagine')
  const pagine = structuredClone(copia.disegni)
  pagine.forEach((p, i) => { p.workspaceY ??= i * ((p.pageLayout?.height || 1200) + 80) })
  const bottom = Math.max(...attuale.disegni.map(p => (p.workspaceY || 0) + (p.pageLayout?.height || 1200)))
  const shift = bottom + 80 - Math.min(...pagine.map(p => p.workspaceY || 0))
  const sposta = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sposta)
    if (!v || typeof v !== 'object') return v
    const r = v as Record<string, unknown>
    // Solo geometrie workspace, mai misure o coordinate locali della pagina.
    if (typeof r.x === 'number' && typeof r.y === 'number') return { ...r, y: r.y + shift }
    return Object.fromEntries(Object.entries(r).map(([k, x]) => [k, sposta(x)]))
  }
  const entities = pagine.flatMap(p => p.workspaceCadEntities || []).map(e => sposta(e) as typeof e)
  const posters = pagine.flatMap(p => p.workspacePosterImages || []).map(e => sposta(e) as typeof e)
  pagine.forEach(p => { p.workspaceY = (p.workspaceY || 0) + shift; p.workspaceCadEntities = []; p.workspacePosterImages = [] })
  const tutte: PaginaQuadernoNota[] = [...structuredClone(attuale.disegni), ...pagine]
  tutte[0].workspaceCadEntities = [...(tutte[0].workspaceCadEntities || []), ...entities]
  tutte[0].workspacePosterImages = [...(tutte[0].workspacePosterImages || []), ...posters]
  const layerIds = new Set(tutte[0].layers?.map(l => l.id) || [])
  for (const page of pagine) for (const layer of page.layers || []) if (!layerIds.has(layer.id)) {
    tutte[0].layers = [...(tutte[0].layers || []), structuredClone(layer)]
    layerIds.add(layer.id)
  }
  return { ...structuredClone(attuale), testo: [attuale.testo, `\n— ${copia.titolo} —\n${copia.testo}`].filter(Boolean).join('\n'),
    checklist: [...structuredClone(attuale.checklist), ...copia.checklist], disegni: tutte }
}

export async function richiamaProgetto(args: {
  supabase: SupabaseClient; progettoId: string; sopralluogoId: string; attuale: DocumentoFile;
  versioneNota: string | null; ancoraAttivo: () => boolean;
}) {
  const { supabase, progettoId, sopralluogoId } = args
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw Error('Accedi per richiamare un progetto')
  const uid = auth.user.id
  const source = await supabase.from('quaderno_progetti').select('*').eq('id', progettoId).eq('user_id', uid).single()
  if (source.error) throw source.error
  const files = await supabase.from('quaderno_allegati').select('*').eq('nota_id', progettoId).eq('user_id', uid)
  if (files.error) throw files.error
  const documentoSorgente: DocumentoFile = { titolo: source.data.titolo, testo: source.data.testo,
    checklist: source.data.checklist, disegni: source.data.disegni, analisi_ai: source.data.analisi_ai }
  const packed = await esportaArteCna(documentoSorgente, (files.data || []).map(f => ({ ...f, uri: 'storage:' + f.storage_path })), async uri => {
    const privato = leggiRiferimentoPrivato(uri)
    if (privato || uri.startsWith('storage:')) {
      const result = await supabase.storage.from(privato?.bucket || 'quaderno-privato').download(privato?.path || uri.slice(8))
      if (result.error) throw result.error
      return result.data
    }
    if (!uri.startsWith('data:')) throw Error('Sorgente immagine non privata o non incorporata')
    const response = await fetch(uri)
    if (!response.ok) throw Error('Immagine non recuperabile')
    return response.blob()
  })
  const portable = await apriArteCna(packed)
  const id = crypto.randomUUID(), created = new Date().toISOString()
  const provenienza = { richiamoId: id, progettoId, titolo: source.data.titolo, salvatoIl: source.data.updated_at, richiamatoIl: created, analisiSorgente: source.data.analisi_ai }
  const copia = clonaDocumento(portable.documento, provenienza)
  const check = () => { if (!args.ancoraAttivo()) throw Error('Sopralluogo cambiato: richiamo interrotto') }
  check()
  const prepared = await supabase.from('quaderno_richiami_sopralluogo').insert({ id, user_id: uid, sopralluogo_id: sopralluogoId,
    sorgente_id: progettoId, sorgente_titolo: provenienza.titolo, sorgente_updated_at: provenienza.salvatoIl }).select('id').single()
  if (prepared.error) {
    if (['42P01', 'PGRST205'].includes(prepared.error.code)) throw Error('Richiamo non disponibile: richiede la nuova migrazione 20261023_quaderno_richiamo_sopralluogo.sql. Bozza conservata.')
    throw Object.assign(new Error(`Preparazione ${id} non completata: ${prepared.error.message}. Nessuna nota modificata; eventuale preparazione da verificare.`), {
      code: prepared.error.code, details: prepared.error.details, hint: prepared.error.hint,
    })
  }
  const uploaded: string[] = [], replacements = new Map<string, string>(), anteprime = new Map<string, string>()
  const assets: { id: string; nome_file: string; tipo: string; mime_type: string; storage_path: string }[] = []
  let committed = false, merged: DocumentoFile | undefined
  try {
    for (const resource of portable.risorse) {
      check()
      const path = `utenti/${uid}/richiami/${id}/${crypto.randomUUID()}`
      const result = await supabase.storage.from(BUCKET_COPIE).upload(path, new Blob([new Uint8Array(resource.bytes)], { type: resource.mime }), { upsert: false })
      if (result.error) throw result.error
      uploaded.push(path)
      replacements.set(resource.uri, riferimentoFileQuaderno(path, BUCKET_COPIE))
      if (!resource.tipo) anteprime.set(riferimentoFileQuaderno(path, BUCKET_COPIE), resource.uri + '#richiamo-' + crypto.randomUUID())
      assets.push({ id: crypto.randomUUID(), nome_file: resource.nome, tipo: resource.tipo || 'immagine', mime_type: resource.mime, storage_path: path })
    }
    merged = aggiungiDocumento(args.attuale, JSON.parse(JSON.stringify(copia, (_k, v: unknown) => typeof v === 'string' ? replacements.get(v) || v : v)))
    check()
    const result = await supabase.rpc('completa_richiamo_quaderno', { p_richiamo: id, p_documento: merged, p_assets: assets, p_versione_nota: args.versioneNota })
    if (result.error) throw result.error
    committed = true
    return { documento: merged, provenienza, anteprime, notaId: result.data.nota_id as string, updatedAt: result.data.updated_at as string,
      allegati: assets.filter(a => a.tipo !== 'immagine').map(a => ({ ...a, tipo: a.tipo as AllegatoNota['tipo'], storage_bucket: BUCKET_COPIE, url: '' })) }
  } catch (error) {
    // Una risposta persa non prova un rollback. Prima di rimuovere i SOLI nuovi
    // oggetti si verifica l'esito; nessun retry del writer.
    const status = await Promise.resolve(supabase.from('quaderno_richiami_sopralluogo').select('stato,nota_id,nota_updated_at').eq('id', id).single())
      .catch(() => ({ error: new Error('Connessione interrotta'), data: null }))
    if (status.error || status.data?.stato === 'completato' || committed) {
      throw new EsitoRichiamoIncerto(`Richiamo ${id}: esito da rileggere dal server prima di salvare o ripetere. La bozza è conservata. ${status.data?.stato === 'completato' ? 'Copia registrata sul server.' : ''}`)
    }
    const cleanup = uploaded.length ? await Promise.resolve(supabase.storage.from(BUCKET_COPIE).remove(uploaded))
      .catch(() => ({ error: new Error('Rimozione non confermata') })) : { error: null }
    if (cleanup.error) throw Error(`Richiamo non completato. Bozza conservata; file parziali della richiesta ${id} da ripulire separatamente.`)
    const removed = await supabase.from('quaderno_richiami_sopralluogo').delete().eq('id', id).eq('stato', 'preparazione')
    if (removed.error) throw Error(`Bozza conservata; preparazione ${id} da verificare separatamente.`)
    throw error
  }
}
