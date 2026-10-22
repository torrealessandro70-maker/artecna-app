import JSZip from 'jszip'
import type { PaginaQuadernoNota, VoceChecklistNota, AnalisiNota } from '../../components/note/types'

export type DocumentoFile = { titolo: string; testo: string; checklist: VoceChecklistNota[]; analisi_ai: AnalisiNota | null; disegni: PaginaQuadernoNota[] }
export type RisorsaFile = { id: string; nome: string; mime: string; tipo?: 'foto' | 'allegato' | 'audio'; uri: string; bytes: Uint8Array }
export type QuadernoFile = { documento: DocumentoFile; risorse: RisorsaFile[] }
const MAX_FILE = 150 * 1024 * 1024, MAX_TOTAL = 200 * 1024 * 1024, MAX_ASSET = 32 * 1024 * 1024
const ref = (id: string) => `artecna-asset:${id}`
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function sicuro(v: unknown, depth = 0, count = { n: 0 }): void {
  if (++count.n > 400_000 || depth > 40) throw Error('Progetto troppo complesso')
  if (typeof v === 'number' && !Number.isFinite(v)) throw Error('Numero non valido nel progetto')
  if (typeof v === 'string' && v.length > MAX_ASSET * 1.5) throw Error('Testo troppo grande')
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) throw Error('Struttura non consentita')
    sicuro(x, depth + 1, count)
  }
}

const pointValido = (p: unknown) => record(p) && typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)
function validaEntita(e: Record<string, unknown>, grafica = false) {
  const type = grafica ? 'image' : e.type
  if (!['line', 'circle', 'rectangle', 'polyline', 'freehand', 'text', 'image', 'dimension', 'area', 'pin', 'symbol'].includes(String(type))) throw Error('Entità nativa non supportata')
  for (const field of type === 'line' || type === 'dimension' ? ['start', 'end'] : type === 'circle' ? ['center'] : type === 'text' || type === 'pin' ? ['position'] : []) if (!pointValido(e[field])) throw Error('Coordinate entità non valide')
  if (['polyline', 'freehand', 'area'].includes(String(type)) && (!Array.isArray(e.points) || !e.points.every(pointValido))) throw Error('Vertici non validi')
  if (['rectangle', 'image', 'symbol'].includes(String(type))) {
    if (!record(e.transform) || !['x', 'y', 'width', 'height', 'rotation'].every(k => typeof (e.transform as Record<string, unknown>)[k] === 'number' && Number.isFinite((e.transform as Record<string, unknown>)[k]))) throw Error('Trasformazione non valida')
  }
  if (['line','circle','rectangle','polyline','freehand','dimension','area'].includes(String(type)) && (!record(e.stroke) || typeof e.stroke.color !== 'string' || typeof e.stroke.width !== 'number' || !Number.isFinite(e.stroke.width))) throw Error('Stile entità non valido')
  if (type === 'circle' && (typeof e.radius !== 'number' || !Number.isFinite(e.radius) || e.radius <= 0)) throw Error('Cerchio non valido')
  if (type === 'text' && (typeof e.content !== 'string' || typeof e.fontSize !== 'number' || e.fontSize <= 0)) throw Error('Testo CAD non valido')
  if (type === 'image' && typeof (grafica ? e.sorgente : e.source) !== 'string') throw Error('Sorgente immagine mancante')
}

export function validaDocumento(v: unknown): asserts v is DocumentoFile {
  sicuro(v)
  if (!record(v) || typeof v.titolo !== 'string' || typeof v.testo !== 'string' || !Array.isArray(v.checklist) || !Array.isArray(v.disegni) || !v.disegni.length || v.disegni.length > 100) throw Error('Struttura Quaderno non valida (massimo 100 pagine)')
  if (v.analisi_ai !== null && (!record(v.analisi_ai) || typeof v.analisi_ai.sintesi !== 'string' || !['ipotesi', 'verifiche', 'domande'].every(k => Array.isArray((v.analisi_ai as Record<string, unknown>)[k]) && ((v.analisi_ai as Record<string, unknown>)[k] as unknown[]).every(x => typeof x === 'string')))) throw Error('Analisi nota non valida')
  const ids = new Set<string>()
  for (const page of v.disegni) {
    if (!record(page) || typeof page.id !== 'string' || ids.has(page.id) || typeof page.titolo !== 'string' || !Array.isArray(page.disegni) || !(page.sfondoDisegno === null || typeof page.sfondoDisegno === 'string')) throw Error('Pagina non valida o duplicata')
    ids.add(page.id)
    for (const field of ['cadEntities', 'cadDimensions', 'oggettiGrafici', 'layers', 'workspaceCadEntities', 'workspacePosterImages']) if (page[field] !== undefined && !Array.isArray(page[field])) throw Error(`Campo pagina non valido: ${field}`)
    if (page.pageLayout !== undefined && (!record(page.pageLayout) || !['width', 'height'].every(k => typeof (page.pageLayout as Record<string, unknown>)[k] === 'number' && Number((page.pageLayout as Record<string, unknown>)[k]) > 0))) throw Error('Formato pagina non valido')
    if (Array.isArray(page.layers)) for (const layer of page.layers) if (!record(layer) || typeof layer.id !== 'string' || typeof layer.name !== 'string' || typeof layer.visible !== 'boolean') throw Error('Livello non valido')
    for (const segno of page.disegni) if (!record(segno) || typeof segno.id !== 'string' || !Array.isArray(segno.punti) || typeof segno.strumento !== 'string' || !['penna','evidenziatore','freccia','linea','perpendicolare','rettangolo','cerchio','testo','gomma','pin'].includes(segno.strumento) || typeof segno.colore !== 'string' || typeof segno.spessore !== 'number' || !segno.punti.every(pointValido)) throw Error('Tratto non valido')
    for (const field of ['cadEntities', 'cadDimensions', 'oggettiGrafici', 'workspaceCadEntities', 'workspacePosterImages']) for (const entity of (page[field] || []) as unknown[]) {
      if (!record(entity) || typeof entity.id !== 'string') throw Error('Entità non valida')
      if (field.includes('cad') || field === 'workspaceCadEntities') { if (typeof entity.type !== 'string') throw Error('Tipo entità mancante'); validaEntita(entity) } else validaEntita(entity, true)
    }
  }
  for (const c of v.checklist) if (!record(c) || typeof c.id !== 'string' || typeof c.testo !== 'string' || typeof c.completata !== 'boolean') throw Error('Checklist non valida')
}
function visitaImmagini(v: unknown, found: Set<string>) {
  if (!v || typeof v !== 'object') return
  if (record(v)) for (const key of ['sorgente', 'sfondoDisegno', ...(v.type === 'image' ? ['source'] : [])]) if (typeof v[key] === 'string' && v[key]) found.add(v[key])
  for (const x of Object.values(v)) visitaImmagini(x, found)
}
function sostituisci<T>(v: T, replacements: Map<string, string>): T {
  return JSON.parse(JSON.stringify(v, (_k, value: unknown) => typeof value === 'string' ? replacements.get(value) || value : value))
}
export async function uriBinaria(bytes: Uint8Array, mime: string): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => typeof r.result === 'string' ? resolve(r.result) : reject(Error('File illeggibile')); r.onerror = () => reject(Error('File illeggibile')); r.readAsDataURL(new Blob([new Uint8Array(bytes)], { type: mime })) })
}
export async function esportaArteCna(documento: DocumentoFile, allegati: { nome_file: string; tipo: RisorsaFile['tipo']; mime_type?: string | null; uri: string }[], recupera: (uri: string) => Promise<Blob>): Promise<Uint8Array> {
  validaDocumento(documento)
  const zip = new JSZip(), immagini = new Set<string>(), replacements = new Map<string, string>()
  visitaImmagini(documento, immagini)
  const assets: { id: string; file: string; nome: string; mime: string; tipo?: RisorsaFile['tipo']; size: number }[] = []
  if (immagini.size + allegati.length > 511) throw Error('Massimo 511 risorse per pacchetto ARTECNA')
  let total = 0
  for (const item of [...Array.from(immagini, uri => ({ uri, nome_file: 'immagine', tipo: undefined, mime_type: undefined })), ...allegati]) {
    if (!item.uri) throw Error(`Contenuto mancante: ${item.nome_file}`)
    let blob: Blob
    try { blob = await recupera(item.uri) } catch { throw Error(`Impossibile recuperare ${item.nome_file}. Esportazione annullata.`) }
    if ((!item.tipo && !blob.size) || blob.size > MAX_ASSET || (total += blob.size) > MAX_TOTAL) throw Error('Allegato vuoto o limiti superati (32 MB/file, 200 MB totali)')
    const mime = blob.type || item.mime_type || 'application/octet-stream'
    if (!item.tipo && !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) throw Error('Immagine non portabile: usare PNG, JPEG, WebP o GIF')
    const id = crypto.randomUUID(), file = `assets/${id}`
    assets.push({ id, file, nome: item.nome_file.slice(0, 200), mime, tipo: item.tipo, size: blob.size })
    zip.file(file, await blob.arrayBuffer(), { createFolders: false })
    if (!item.tipo) replacements.set(item.uri, ref(id))
  }
  const manifest = JSON.stringify({ formato: 'ARTECNA-QUADERNO', versione: 1, documento: sostituisci(documento, replacements), assets })
  const manifestSize = new TextEncoder().encode(manifest).length
  if (manifestSize > MAX_ASSET || total + manifestSize > MAX_TOTAL) throw Error('Manifesto o progetto espanso oltre i limiti del formato')
  zip.file('manifest.json', manifest)
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  if (bytes.length > MAX_FILE) throw Error('Pacchetto oltre 150 MB')
  return bytes
}
// Legge le dimensioni dichiarate PRIMA di decomprimere: rifiuta ZIP64, duplicati,
// percorsi arbitrari, crittografia e pacchetti espansi oltre i limiti.
function controllaZip(bytes: Uint8Array) {
  if (bytes.length > MAX_FILE || bytes.length < 22) throw Error('Dimensione pacchetto non valida')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end--
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) throw Error('Archivio ZIP non valido')
  const n = view.getUint16(end + 10, true), names = new Set<string>(); let p = view.getUint32(end + 16, true), total = 0
  if (n > 512 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw Error('ZIP multiparte/ZIP64 o troppi file')
  for (let i = 0; i < n; i++) {
    if (p + 46 > end || view.getUint32(p, true) !== 0x02014b50) throw Error('Indice ZIP non valido')
    const size = view.getUint32(p + 24, true), len = view.getUint16(p + 28, true)
    const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + len))
    if (view.getUint16(p + 8, true) & 1 || size > MAX_ASSET || (total += size) > MAX_TOTAL || names.has(name) || !/^(manifest\.json|assets\/[a-zA-Z0-9-]+)$/.test(name)) throw Error('ZIP non sicuro o limiti superati')
    names.add(name); p += 46 + len + view.getUint16(p + 30, true) + view.getUint16(p + 32, true)
  }
  if (!names.has('manifest.json')) throw Error('Manifesto assente')
}
export async function apriArteCna(bytes: Uint8Array): Promise<QuadernoFile> {
  controllaZip(bytes)
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false }), raw: unknown = JSON.parse(await zip.file('manifest.json')!.async('string'))
  sicuro(raw)
  if (!record(raw) || raw.formato !== 'ARTECNA-QUADERNO' || raw.versione !== 1 || !Array.isArray(raw.assets)) throw Error('Formato/versione ARTECNA non supportati')
  validaDocumento(raw.documento)
  if (Object.keys(zip.files).length !== raw.assets.length + 1) throw Error('Contenuti ZIP non dichiarati nel manifesto')
  const risorse: RisorsaFile[] = [], replacements = new Map<string, string>(), names = new Set<string>()
  for (const asset of raw.assets) {
    if (!record(asset) || typeof asset.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(asset.id) || asset.file !== `assets/${asset.id}` || typeof asset.nome !== 'string' || typeof asset.mime !== 'string' || !Number.isSafeInteger(asset.size) || (asset.tipo !== undefined && !['foto', 'allegato', 'audio'].includes(String(asset.tipo))) || names.has(asset.id)) throw Error('Manifesto risorse non valido')
    names.add(asset.id)
    const file = zip.file(String(asset.file)); if (!file) throw Error('Contenuto allegato mancante')
    const content = await file.async('uint8array'); if (content.length !== asset.size) throw Error('Dimensione allegato incoerente')
    const uri = await uriBinaria(content, asset.mime)
    const tipo = asset.tipo as RisorsaFile['tipo']
    if (!tipo && !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(asset.mime)) throw Error('Formato immagine non consentito')
    risorse.push({ id: asset.id, nome: asset.nome, mime: asset.mime, tipo, bytes: content, uri }); replacements.set(ref(asset.id), uri)
  }
  const images = new Set<string>(); visitaImmagini(raw.documento, images)
  for (const image of images) if (!replacements.has(image)) throw Error('Immagine esterna o mancante: pacchetto non portabile')
  const serialized = JSON.stringify(raw.documento)
  for (const match of serialized.matchAll(/artecna-asset:[a-zA-Z0-9-]+/g)) if (!replacements.has(match[0])) throw Error('Riferimento risorsa mancante')
  return { documento: sostituisci(raw.documento, replacements), risorse }
}
export function scaricaFile(bytes: Uint8Array, nome: string, mime: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime })), a = document.createElement('a')
  a.href = url; a.download = nome.replace(/[^a-zA-Z0-9._-]/g, '_'); a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
