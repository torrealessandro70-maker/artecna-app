import type { FotoCantiere } from '../../types'
import type { AnalisiNota } from '../../components/note/types'
import { leggiFontiCollegate, previewVariante, type FonteQuadernoCollegata } from '../sopralluogo-memory/previewVariante'
import type { InputOsservatore } from '../osservatore/analizza'

export type TipoFotoFonte = 'foto_cantiere' | 'foto_sopralluogo'
export type FotoFonte = {
  source_id: string; source_type: TipoFotoFonte; source_version: null; impronta: string
  origine: 'cantiere' | 'sopralluogo'; sopralluogo_id: string | null; collegata: boolean; disponibile: boolean
  foto: FotoCantiere & { file_url?: string | null; file_path?: string | null; thumbnail_url?: string | null; rapportino_id?: string | null; tag?: string | null }
}
export type ManifestoFonti = {
  versione: 1; firma: string; variante: { source_id: string; impronta: string }
  quaderni: { source_id: string; source_version: string }[]
  foto: { source_id: string; source_type: TipoFotoFonte; source_version: null; impronta: string }[]
}
export type PacchettoOsservatore = {
  variante: { id: string; stato: 'bozza'; titolo: string | null; descrizione: string }
  cantiere_id: string; quaderni: FonteQuadernoCollegata[]; foto: FotoFonte[]; manifesto: ManifestoFonti
}
export type AnalisiVariante = {
  id: string; data: string; modello: string; allineata: boolean
  fonti: { manifesto: ManifestoFonti; foto_bytes: { source_id: string; source_type: TipoFotoFonte; sha256: string }[] }
  risultato: AnalisiNota
}
export type LetturaOsservatore = { fonti: PacchettoOsservatore; analisi: AnalisiVariante | null }
export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const impronta = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
const tipoFoto = (v: unknown): v is TipoFotoFonte => v === 'foto_cantiere' || v === 'foto_sopralluogo'
export const chiaveFoto = (f: Pick<FotoFonte, 'source_type' | 'source_id'>) => `${f.source_type}:${f.source_id}`

export function leggiFotoFonti(value: unknown): FotoFonte[] {
  if (!Array.isArray(value) || value.length > 1000 || !value.every(f => record(f) && uuid(f.source_id) && tipoFoto(f.source_type)
    && f.source_version === null && impronta(f.impronta) && typeof f.collegata === 'boolean' && typeof f.disponibile === 'boolean'
    && ['cantiere', 'sopralluogo'].includes(String(f.origine)) && (f.sopralluogo_id === null || uuid(f.sopralluogo_id))
    && record(f.foto) && f.foto.id === f.source_id && ['cantiere', 'nota', 'immagine_base64'].every(k => typeof (f.foto as Record<string, unknown>)[k] === 'string')
    && (f.foto.allegato_v1_id === null || uuid(f.foto.allegato_v1_id)))) throw Error('Elenco foto non valido')
  const foto = value as FotoFonte[]
  if (new Set(foto.map(chiaveFoto)).size !== foto.length) throw Error('Foto duplicate nella risposta')
  return [...foto].sort((a, b) => chiaveFoto(a).localeCompare(chiaveFoto(b)))
}

export function leggiManifesto(value: unknown): ManifestoFonti {
  if (!record(value) || value.versione !== 1 || !impronta(value.firma) || !record(value.variante)
    || !uuid(value.variante.source_id) || !impronta(value.variante.impronta)
    || !Array.isArray(value.quaderni) || !value.quaderni.every(q => record(q) && uuid(q.source_id) && typeof q.source_version === 'string')
    || !Array.isArray(value.foto) || value.foto.length > 8 || !value.foto.every(f => record(f) && uuid(f.source_id)
      && tipoFoto(f.source_type) && f.source_version === null && impronta(f.impronta))) throw Error('Provenienza fonti non valida')
  return value as ManifestoFonti
}

export function leggiAnalisiNota(value: unknown): AnalisiNota {
  if (!record(value) || typeof value.sintesi !== 'string' || !['ipotesi', 'verifiche', 'domande'].every(k =>
    Array.isArray(value[k]) && value[k].every((s: unknown) => typeof s === 'string'))
    || typeof value.avvertenza !== 'string') throw Error('Analisi Osservatore non valida')
  return value as AnalisiNota
}

export function leggiOsservatore(value: unknown, varianteId: string): LetturaOsservatore {
  if (!record(value) || !record(value.fonti)) throw Error('Fonti Osservatore non disponibili')
  const p = value.fonti
  if (!record(p.variante) || p.variante.id !== varianteId || p.variante.stato !== 'bozza' || !uuid(p.cantiere_id)
    || !(p.variante.titolo === null || typeof p.variante.titolo === 'string') || typeof p.variante.descrizione !== 'string') throw Error('Contesto Variante non valido')
  const foto = leggiFotoFonti(p.foto), quaderni = leggiFontiCollegate(p.quaderni), manifesto = leggiManifesto(p.manifesto)
  if (manifesto.variante.source_id !== varianteId || foto.length > 8 || foto.some(f => !f.collegata)
    || foto.length !== manifesto.foto.length || foto.some(f => !manifesto.foto.some(m => chiaveFoto(m) === chiaveFoto(f) && m.impronta === f.impronta))
    || quaderni.length !== manifesto.quaderni.length || quaderni.some(q => !q.disponibile || !manifesto.quaderni.some(m => m.source_id === q.id && m.source_version === q.updated_at))) throw Error('Snapshot fonti incoerente')
  let analisi: AnalisiVariante | null = null
  if (value.analisi !== null) {
    const a = value.analisi
    if (!record(a) || !uuid(a.id) || typeof a.data !== 'string' || a.modello !== 'gpt-4.1-mini'
      || typeof a.allineata !== 'boolean' || !record(a.fonti) || !Array.isArray(a.fonti.foto_bytes)
      || !a.fonti.foto_bytes.every(f => record(f) && uuid(f.source_id) && tipoFoto(f.source_type) && impronta(f.sha256))) throw Error('Risultato Variante non valido')
    leggiManifesto(a.fonti.manifesto); leggiAnalisiNota(a.risultato)
    analisi = a as AnalisiVariante
  }
  return { fonti: { variante: p.variante as PacchettoOsservatore['variante'], cantiere_id: p.cantiere_id, foto, quaderni, manifesto }, analisi }
}

/** Adapter only: no galleries, URLs from the client, checklist or economic data. */
export function payloadOsservatoreVariante(p: PacchettoOsservatore, immaginiAutorizzate: readonly string[]): InputOsservatore {
  if (p.foto.length > 8 || immaginiAutorizzate.length !== p.foto.length) throw Error('Immagini selezionate incomplete')
  if (p.foto.some(f => !f.disponibile)) throw Error('Foto collegata non accessibile')
  const testo = previewVariante(p.variante, p.cantiere_id, null, p.quaderni).testoUnificato
  if (!testo.trim() && p.foto.length === 0) throw Error('Nessuna fonte disponibile')
  return { titolo: p.variante.titolo ?? '', testo, immagini: [...immaginiAutorizzate], checklist: [], audio: [], disegni: [], contesto: {} }
}
