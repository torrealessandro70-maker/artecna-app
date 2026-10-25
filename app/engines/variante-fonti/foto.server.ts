import 'server-only'
import { createHash } from 'node:crypto'
import type { FotoFonte } from './contratto'
import { ErroreOsservatore, type FotoLettaOsservatore } from './servizio'
import { capabilityFotoDesktop, creaLetturaHttpFotoDesktop } from '../rapportini/letturaFotoDesktop.server'
import { storageFotoV1Configurato } from '../rapportini/storageFotoV1.server'
import { leggiBlobFotoDesktop } from '../rapportini/letturaFotoDesktop'
import { LIMITI_ALLEGATI } from '../rapportini/contrattoAllegati'

const MAX = LIMITI_ALLEGATI.byte_size
function risultato(bytes: Uint8Array, mime: string): FotoLettaOsservatore {
  if (bytes.length === 0 || bytes.length > MAX || !['image/jpeg', 'image/png', 'image/webp'].includes(mime))
    throw new ErroreOsservatore(409, 'Formato o dimensione foto non supportati')
  const magic = mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mime === 'image/png' ? Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP'
  if (!magic) throw new ErroreOsservatore(409, 'Byte immagine non coerenti')
  return { dataUrl: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`, sha256: createHash('sha256').update(bytes).digest('hex') }
}
async function bytesLimitati(response: Response) {
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX) throw new ErroreOsservatore(409, 'Foto non leggibile')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.length
      if (size > MAX) { await reader.cancel(); throw new ErroreOsservatore(409, 'Foto troppo grande') }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks)
}

/** Never accepts a browser URL. URLs below are from the authorized DB snapshot. */
export async function leggiFotoOsservatore(f: FotoFonte, token: string, fetcher: typeof fetch = fetch): Promise<FotoLettaOsservatore> {
  if (f.foto.allegato_v1_id) {
    const read = creaLetturaHttpFotoDesktop({ capability: capabilityFotoDesktop, storage: storageFotoV1Configurato() })
    // Reuse the Gallery reader's exact triple-ID/registry check as well as the
    // server resolver. This prevents another attachment ID being substituted.
    const blob = await leggiBlobFotoDesktop({ allegato: f.foto.allegato_v1_id, rapportino: f.foto.rapportino_id ?? '', foto: f.source_id },
      token, AbortSignal.timeout(15000), async (input, init) => read(new Request(new URL(String(input), 'https://internal.invalid'), init)))
    return risultato(new Uint8Array(await blob.arrayBuffer()), blob.type)
  }
  const value = f.foto.file_url || f.foto.immagine_base64
  const inline = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
  if (inline) {
    if (inline[2].length > MAX * 4 / 3 + 4) throw new ErroreOsservatore(409, 'Foto troppo grande')
    return risultato(Buffer.from(inline[2], 'base64'), inline[1])
  }
  // Legacy public Storage only; no arbitrary hosts, redirects or private URLs.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) throw new ErroreOsservatore(503, 'Lettura foto non configurata')
  let url: URL
  try { url = new URL(value) } catch { throw new ErroreOsservatore(409, 'Foto priva di una risorsa leggibile') }
  const prefix = '/storage/v1/object/public/preventivi/'
  if (url.origin !== new URL(base).origin || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || !url.pathname.startsWith(prefix) || !f.foto.file_path || decodeURIComponent(url.pathname.slice(prefix.length)) !== f.foto.file_path
    || f.foto.file_path.split('/').some(part => part === '.' || part === '..' || part.includes('\\')))
    throw new ErroreOsservatore(409, 'Origine immagine non supportata: nessuna richiesta esterna eseguita')
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(15000) })
  return risultato(await bytesLimitati(response), response.headers.get('content-type')?.split(';')[0] ?? '')
}
