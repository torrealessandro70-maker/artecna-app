import 'server-only'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { LIMITI_ALLEGATI, costruisciPathAllegato, validaRichiestaPrenotazioneAllegato,
  validaUUIDAllegato, type RichiestaPrenotazioneAllegato } from './contrattoAllegati'

export class ErroreFotoV1 extends Error {
  constructor(readonly status: number, readonly codice: string) { super(codice) }
}
/** Adapter fidati server: authorize deve verificare identita e ambito, mai il payload. */
export interface RegistroFotoV1 {
  canale: 'mobile' | 'desktop'
  authorize(req: Request, input: RichiestaPrenotazioneAllegato): Promise<{
    reserve(): Promise<unknown>
    finalize(id: string, lease: string): Promise<unknown>
  }>
}
export interface StorageFotoV1 {
  /** Restituisce null SOLO per oggetto assente; altri errori devono essere eccezioni.
   * L'adapter deve limitare il download a maxBytes e non seguire path client. */
  read(bucket: 'rapportini-v1', path: string, maxBytes: number): Promise<Uint8Array | null>
  /** Create-only atomico: nessun upsert/overwrite. 'exists' non certifica i byte. */
  create(bucket: 'rapportini-v1', path: string, bytes: Uint8Array, mime: string): Promise<'created' | 'exists'>
}
export type EsitoUploadFotoV1 = {
  versione_contratto: 1
  rapportino_id: string
  allegato: { allegato_id: string; chiave_client_allegato: string; stato: 'finalizzato'; mime_type: string; byte_size: number }
}
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
export async function verificaBytesFotoV1(bytes: Uint8Array, input: RichiestaPrenotazioneAllegato) {
  if (!bytes.length || bytes.length > LIMITI_ALLEGATI.byte_size || bytes.length !== input.byte_size)
    throw new ErroreFotoV1(400, 'dimensione')
  if (hash(bytes) !== input.sha256) throw new ErroreFotoV1(400, 'hash')
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: LIMITI_ALLEGATI.pixel, animated: true })
    const m = await image.metadata()
    const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[m.format as 'jpeg' | 'png' | 'webp']
    if (mime !== input.mime_type || !m.width || !m.height || m.width * m.height > LIMITI_ALLEGATI.pixel
      || (m.pages ?? 1) !== 1) throw new Error('Formato non valido')
    // Decodifica completa: leggere soltanto gli header non certifica un'immagine.
    await image.raw().toBuffer()
  } catch { throw new ErroreFotoV1(400, 'immagine') }
}
async function ricevi(req: Request): Promise<Uint8Array> {
  if (!req.body) throw new ErroreFotoV1(400, 'bytes_assenti')
  const reader = req.body.getReader(), chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > LIMITI_ALLEGATI.byte_size) { await reader.cancel(); throw new ErroreFotoV1(413, 'dimensione') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks, total)
}
function reservation(value: unknown, input: RichiestaPrenotazioneAllegato) {
  if (!value || typeof value !== 'object') throw new ErroreFotoV1(503, 'registro')
  const r = value as Record<string, unknown>
  if (r.versione_contratto !== 1) throw new ErroreFotoV1(503, 'registro')
  if (r.esito === 'scaduto_persistito_con_conflitto' && r.stato === 'scaduto'
    && r.upload_necessario === false && r.lease_id === null && r.lease_until === null)
    throw new ErroreFotoV1(409, 'scaduta_persistita') // RPC autocommit gia conclusa.
  if (r.esito !== 'successo' || r.bucket !== 'rapportini-v1' || r.file_path !== costruisciPathAllegato(input)
    || r.mime_type !== input.mime_type || r.byte_size !== input.byte_size)
    throw new ErroreFotoV1(503, 'registro')
  const id = validaUUIDAllegato(r.allegato_id)
  if (r.stato === 'finalizzato' && r.upload_necessario === false && r.lease_id === null && r.lease_until === null)
    return { id, path: r.file_path as string, lease: null }
  if (r.stato !== 'prenotato' || r.upload_necessario !== true || typeof r.lease_until !== 'string'
    || !Number.isFinite(Date.parse(r.lease_until)) || Date.parse(r.lease_until) <= Date.now())
    throw new ErroreFotoV1(409, 'lease')
  return { id, path: r.file_path as string, lease: validaUUIDAllegato(r.lease_id) }
}
export function creaServizioFotoV1(deps: { mobile: RegistroFotoV1; desktop?: RegistroFotoV1; storage?: StorageFotoV1 }) {
  return async (req: Request): Promise<EsitoUploadFotoV1> => {
    try {
      if (req.method !== 'POST') throw new ErroreFotoV1(405, 'metodo')
      const origin = req.headers.get('origin')
      if ((origin && origin !== new URL(req.url).origin) || req.headers.get('sec-fetch-site') === 'cross-site')
        throw new ErroreFotoV1(403, 'origine')
      const encoded = req.headers.get('x-artecna-foto')
      if (!encoded || encoded.length > 2048) throw new ErroreFotoV1(400, 'metadati')
      let input: RichiestaPrenotazioneAllegato
      try { input = validaRichiestaPrenotazioneAllegato(JSON.parse(encoded)) }
      catch { throw new ErroreFotoV1(400, 'metadati') }
      if (req.headers.get('content-type') !== input.mime_type) throw new ErroreFotoV1(400, 'mime')
      const bearer = req.headers.get('authorization')
      if (bearer && !/^Bearer \S+$/i.test(bearer)) throw new ErroreFotoV1(401, 'identita')
      // Nessun fallback Desktop -> Mobile, neppure quando e presente un cookie.
      const channel = bearer ? 'desktop' : 'mobile'
      const registry = channel === 'desktop' ? deps.desktop : deps.mobile
      if (!registry || registry.canale !== channel) throw new ErroreFotoV1(503, 'canale_non_disponibile')
      const operation = await registry.authorize(req, input)
      if (!deps.storage) throw new ErroreFotoV1(503, 'storage_non_configurato')
      const bytes = await ricevi(req)
      await verificaBytesFotoV1(bytes, input)
      const r = reservation(await operation.reserve(), input)
      let stored = await deps.storage.read('rapportini-v1', r.path, LIMITI_ALLEGATI.byte_size)
      if (stored === null && r.lease !== null) {
        try {
          const created = await deps.storage.create('rapportini-v1', r.path, bytes, input.mime_type)
          if (created !== 'created' && created !== 'exists') throw new ErroreFotoV1(503, 'storage')
        } catch {
          // Anche una risposta persa puo aver creato l'oggetto. Nessuna cancellazione compensativa.
        }
        stored = await deps.storage.read('rapportini-v1', r.path, LIMITI_ALLEGATI.byte_size)
      }
      if (stored === null) throw new ErroreFotoV1(503, 'oggetto_assente')
      if (stored.length !== bytes.length || hash(stored) !== input.sha256) throw new ErroreFotoV1(409, 'oggetto_incoerente')
      if (r.lease !== null) {
        let final: unknown
        try { final = await operation.finalize(r.id, r.lease) }
        catch (e) {
          if (e instanceof ErroreFotoV1 && e.status < 500) throw e
          // Retry bounded dello stesso id/lease; la RPC controlla finalizzazione gia committata.
          final = await operation.finalize(r.id, r.lease)
        }
        const f = final as Record<string, unknown> | null
        if (f?.versione_contratto === 1 && f.allegato_id === r.id
          && f.esito === 'scaduto_persistito_con_conflitto' && f.stato === 'scaduto')
          throw new ErroreFotoV1(409, 'scaduta_persistita')
        if (!f || f.versione_contratto !== 1 || f.esito !== 'successo' || f.allegato_id !== r.id || f.stato !== 'finalizzato')
          throw new ErroreFotoV1(503, 'finalizzazione')
        validaUUIDAllegato(f.foto_cantiere_id)
      }
      return { versione_contratto: 1, rapportino_id: input.rapportino_id,
        allegato: { allegato_id: r.id, chiave_client_allegato: input.chiave_client_allegato,
          stato: 'finalizzato', mime_type: input.mime_type, byte_size: input.byte_size } }
    } catch (e) {
      if (e instanceof ErroreFotoV1) throw e
      throw new ErroreFotoV1(503, 'servizio_non_disponibile')
    }
  }
}
/** Gestore HTTP iniettabile; nessuna configurazione/credenziale implicita. */
export function creaHttpFotoV1(deps: Parameters<typeof creaServizioFotoV1>[0]) {
  const upload = creaServizioFotoV1(deps)
  return async (req: Request) => {
    try { return Response.json(await upload(req), { headers: { 'Cache-Control': 'no-store' } }) }
    catch (e) {
      const error = e instanceof ErroreFotoV1 ? e : new ErroreFotoV1(503, 'servizio_non_disponibile')
      return Response.json({ codice: error.codice }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
    }
  }
}
