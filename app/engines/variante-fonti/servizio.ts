import { payloadOsservatoreVariante, leggiOsservatore, leggiAnalisiNota, record, uuid, type FotoFonte, type PacchettoOsservatore } from './contratto'
import type { InputOsservatore } from '../osservatore/analizza'

export type FotoLettaOsservatore = { dataUrl: string; sha256: string }
export type DipendenzeOsservatore = {
  authorize(token: string): Promise<{ userId: string; read(variante: string): Promise<unknown> }>
  photo(foto: FotoFonte, token: string): Promise<FotoLettaOsservatore>
  analyze(input: InputOsservatore): Promise<unknown>
  save(user: string, variante: string, id: string, fonti: { manifesto: PacchettoOsservatore['manifesto']; foto_bytes: { source_id: string; source_type: string; sha256: string }[] }, risultato: unknown): Promise<void>
}
export class ErroreOsservatore extends Error { constructor(readonly status: number, message: string) { super(message) } }

async function bodyLimitato(req: Request) {
  const reader = req.body?.getReader()
  if (!reader) throw new ErroreOsservatore(400, 'Richiesta non valida')
  let size = 0, text = ''
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.length
      if (size > 2048) { await reader.cancel(); throw new ErroreOsservatore(413, 'Richiesta troppo grande') }
      text += decoder.decode(next.value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } finally { reader.releaseLock() }
}

/** Explicit POST only. The browser supplies IDs, never authoritative sources/URLs. */
export function creaServizioOsservatoreVariante(deps: DipendenzeOsservatore) {
  return async (req: Request) => {
    const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' }
    try {
      if (req.method !== 'POST') throw new ErroreOsservatore(405, 'Metodo non consentito')
      const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1]
      if (!token) throw new ErroreOsservatore(401, 'Accesso richiesto')
      const body = await bodyLimitato(req)
      if (!record(body) || Object.keys(body).sort().join(',') !== 'richiesta_id,variante_id'
        || !uuid(body.variante_id) || !uuid(body.richiesta_id)) throw new ErroreOsservatore(400, 'Identificativi non validi')
      const user = await deps.authorize(token)
      if (!uuid(user.userId)) throw new ErroreOsservatore(401, 'Identita non valida')
      const lettura = leggiOsservatore(await user.read(body.variante_id), body.variante_id)
      // Lost response of the latest request: no automatic repeated AI call.
      if (lettura.analisi?.id === body.richiesta_id) return Response.json(lettura, { headers })
      if (lettura.fonti.foto.some(f => !f.disponibile)) throw new ErroreOsservatore(409, 'Foto collegata non più accessibile: scollega il riferimento prima di analizzare')
      const fotoBytes = [], immagini = []
      for (const f of lettura.fonti.foto) {
        const image = await deps.photo(f, token)
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(image.dataUrl) || !/^[0-9a-f]{64}$/.test(image.sha256))
          throw new ErroreOsservatore(409, 'Foto non disponibile per Osservatore')
        immagini.push(image.dataUrl)
        fotoBytes.push({ source_id: f.source_id, source_type: f.source_type, sha256: image.sha256 })
      }
      const payload = payloadOsservatoreVariante(lettura.fonti, immagini)
      const risultato = leggiAnalisiNota(await deps.analyze(payload))
      await deps.save(user.userId, body.variante_id, body.richiesta_id, { manifesto: lettura.fonti.manifesto, foto_bytes: fotoBytes }, risultato)
      return Response.json(leggiOsservatore(await user.read(body.variante_id), body.variante_id), { headers })
    } catch (error) {
      const code = record(error) ? error.code : undefined
      const status = error instanceof ErroreOsservatore ? error.status : code === '42501' ? 403 : error instanceof SyntaxError ? 400 : 503
      return Response.json({ error: error instanceof ErroreOsservatore ? error.message : 'Analisi non confermata. Rileggi lo stato; nessun tentativo automatico.' }, { status, headers })
    }
  }
}
