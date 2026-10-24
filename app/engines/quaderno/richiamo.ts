import type { SupabaseClient } from '@supabase/supabase-js'
import { apriArteCna, esportaArteCna, type DocumentoFile } from './fileNativo'
import { riferimentoFileQuaderno, leggiRiferimentoPrivato } from './storagePrivato'
import { archivioOperazioni, chiaveOperazione, trovaOperazione, rpcQuaderno, type ArchivioOperazioni, type Preparazione, type Esito } from './operazioni'
import type { AnalisiNota, PaginaQuadernoNota } from '../../components/note/types'

export const BUCKET_COPIE = 'quaderno-sopralluoghi' as const
export type ProvenienzaQuaderno = { richiamoId: string; progettoId: string; titolo: string; salvatoIl: string; richiamatoIl: string; analisiSorgente?: AnalisiNota | null }
export class EsitoRichiamoIncerto extends Error {}

// Gli ID dei livelli restano locali alla pagina. Gli ID di pagine/oggetti e i
// relativi riferimenti (anche metadata/workspace) cambiano insieme.
export function clonaDocumento(documento: DocumentoFile, provenienza?: ProvenienzaQuaderno): DocumentoFile {
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
  function marca(v: unknown, key = '') {
    if (!v || typeof v !== 'object' || key === 'layers') return
    if (Array.isArray(v)) { v.forEach(x => marca(x)); return }
    const rec = v as Record<string, unknown>
    delete rec.provenienzaQuaderno
    for (const [k, x] of Object.entries(rec)) marca(x, k)
    if (provenienza && typeof rec.id === 'string') rec.provenienzaQuaderno = provenienza
  }
  marca(nuovo)
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
  versioneNota: string | null; ancoraAttivo: () => boolean; archivio?: ArchivioOperazioni;
}) {
  const { supabase, progettoId, sopralluogoId } = args
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw Error('Accedi per richiamare un progetto')
  const uid = auth.user.id, archivio = args.archivio || archivioOperazioni
  const precedente = await trovaOperazione(supabase, sopralluogoId, archivio)
  if (precedente.id || precedente.locale?.conflitto) throw new EsitoRichiamoIncerto('Operazione o conflitto da riconciliare prima di un nuovo richiamo')
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
  const replacements = new Map<string, string>()
  const assets = await Promise.all(portable.risorse.map(async resource => {
    const path = 'utenti/' + uid + '/richiami/' + id + '/' + crypto.randomUUID()
    replacements.set(resource.uri, riferimentoFileQuaderno(path, BUCKET_COPIE))
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(resource.bytes))
    const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
    return { id: crypto.randomUUID(), nome_file: resource.nome, tipo: resource.tipo || 'immagine', mime_type: resource.mime, storage_path: path, sha256 }
  }))
  const merged = aggiungiDocumento(args.attuale, JSON.parse(JSON.stringify(copia, (_k, v: unknown) => typeof v === 'string' ? replacements.get(v) || v : v)))
  const preparazione: Preparazione = { p_id: id, p_sopralluogo: sopralluogoId, p_sorgente: progettoId,
    p_sorgente_versione: source.data.updated_at, p_versione: args.versioneNota, p_documento: merged, p_assets: assets }
  const check = () => { if (!args.ancoraAttivo()) throw Error('Sopralluogo cambiato: riconciliare il richiamo') }
  check()
  // Durevole PRIMA di qualsiasi scrittura remota. Una risposta persa non cambia ID.
  await archivio.scrivi({ chiave: chiaveOperazione(uid, sopralluogoId), utente: uid, sopralluogo: sopralluogoId, bozza: args.attuale, preparazione })
  try {
    await rpcQuaderno(supabase, 'prepara_richiamo_quaderno', preparazione)
    for (let i = 0; i < portable.risorse.length; i++) {
      check()
      const resource = portable.risorse[i]
      const result = await supabase.storage.from(BUCKET_COPIE).upload(assets[i].storage_path,
        new Blob([new Uint8Array(resource.bytes)], { type: resource.mime }), { upsert: false })
      if (result.error) throw result.error
    }
    check()
    // Anche nel successo si rilegge il risultato persistito, mai merged come autorita.
    await rpcQuaderno(supabase, 'completa_richiamo_quaderno', { p_richiamo: id })
    return await rpcQuaderno<Esito>(supabase, 'esito_richiamo_quaderno', { p_id: id })
  } catch (error) {
    const tecnico = error as { code?: string; message?: string; details?: string; hint?: string }
    throw Object.assign(new EsitoRichiamoIncerto('Richiamo ' + id + ': riprendere o annullare tramite il server. Bozza e percorsi conservati. ' + (tecnico.message || '')), tecnico)
  }
}
