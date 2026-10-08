import 'server-only'
import sharp from 'sharp'
import { LIMITI_ALLEGATI, validaUUIDAllegato, validaMimeAllegato } from './contrattoAllegati'
import { ErroreFotoV1, type StorageFotoV1 } from './servizioFotoV1.server'

const failure = () => new ErroreFotoV1(503, 'storage_non_disponibile')
function pathFoto(bucket: string, path: string) {
  if (bucket !== 'rapportini-v1' || typeof path !== 'string') throw failure()
  const parts = path.split('/')
  if (parts.length !== 4 || parts[0] !== 'rapportini') throw failure()
  try {
    validaUUIDAllegato(parts[1]); validaUUIDAllegato(parts[2])
    const match = parts[3].match(/^([0-9a-f-]{36})\.(jpg|png|webp)$/)
    if (!match) throw failure()
    validaUUIDAllegato(match[1])
    return ({ jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const)[match[2] as 'jpg' | 'png' | 'webp']
  } catch { throw failure() }
}
async function bounded(response: Response, limit: number) {
  const length = response.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) { await response.body?.cancel(); throw failure() }
  if (!response.body) throw failure()
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.length
      if (total > limit) { await reader.cancel(); throw failure() }
      chunks.push(value)
    }
    return Buffer.concat(chunks, total)
  } finally { reader.releaseLock() }
}
/** REST privato con streaming limitato; fetch iniettabile esclusivamente server.
 * I chiamanti devono passare SOLO il path autorevole del registro/resolver.
 * Nessun metodo delete, move, upsert, URL pubblico o signed upload. */
export function creaStorageFotoV1(config: { url: string; serviceRoleKey: string; fetcher?: typeof fetch; timeoutMs?: number }): StorageFotoV1 {
  let origin: string
  try {
    const url = new URL(config.url)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/'
      || !((url.protocol === 'https:' && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname))
        || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw failure()
    const key = config.serviceRoleKey
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)
      || JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'service_role') throw failure()
    // Controllo di configurazione, NON verifica crittografica: Storage verifica la chiave.
    origin = url.origin
  } catch { throw new ErroreFotoV1(503, 'storage_non_configurato') }
  const fetcher = config.fetcher ?? fetch, timeoutMs = config.timeoutMs ?? 20_000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw failure()
  async function request<T>(path: string, init: RequestInit, consume: (r: Response) => Promise<T>): Promise<T> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${origin}/storage/v1/object/rapportini-v1/${path}`, {
        ...init, redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, ...init.headers },
      })
      return await consume(response)
    } catch { throw failure() } finally { clearTimeout(timer) }
  }
  async function errorCode(r: Response): Promise<string | null> {
    try {
      const body = JSON.parse((await bounded(r, 8192)).toString())
      if (typeof body.code === 'string') return body.code
      // Compatibilita esplicita con l'errore duplicate dello Storage SDK storico.
      if (body.error === 'Duplicate') return 'Duplicate'
      return null
    } catch { return null }
  }
  return {
    async read(bucket, path, maxBytes) {
      const mime = pathFoto(bucket, path)
      if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > LIMITI_ALLEGATI.byte_size) throw failure()
      return request(path, { method: 'GET' }, async r => {
        if (!r.ok) {
          const code = await errorCode(r)
          if (r.status === 404 && code === 'NoSuchKey') return null
          // Bucket assente, diniego, 404 ambiguo e rete NON significano oggetto assente.
          throw failure()
        }
        if (r.headers.get('content-type')?.split(';')[0].trim() !== mime) { await r.body?.cancel(); throw failure() }
        const bytes = await bounded(r, maxBytes)
        if (!bytes.length) throw failure()
        return bytes
      })
    },
    async create(bucket, path, bytes, declaredMime) {
      const mime = pathFoto(bucket, path)
      if (validaMimeAllegato(declaredMime) !== mime || !bytes.length || bytes.length > LIMITI_ALLEGATI.byte_size) throw failure()
      try {
        const image = sharp(bytes, { failOn: 'warning', limitInputPixels: LIMITI_ALLEGATI.pixel, animated: true })
        const m = await image.metadata()
        if (({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[m.format ?? ''] !== mime
          || !m.width || !m.height || m.width * m.height > LIMITI_ALLEGATI.pixel || (m.pages ?? 1) !== 1) throw failure()
        await image.raw().toBuffer()
      } catch { throw failure() }
      return request(path, { method: 'POST', headers: { 'Content-Type': mime, 'Content-Length': String(bytes.length), 'x-upsert': 'false' },
        body: new Uint8Array(bytes) }, async r => {
        if (r.ok) { await bounded(r, 8192); return 'created' as const }
        const code = await errorCode(r)
        if ((r.status === 409 && ['ResourceAlreadyExists', 'KeyAlreadyExists', 'already_exists'].includes(code ?? ''))
          || (r.status === 400 && code === 'Duplicate')) return 'exists' as const
        throw failure()
      })
    },
  }
}
/** Nessuna ENV viene creata/modificata. Configurazione assente/invalida -> adapter assente. */
export function storageFotoV1Configurato(): StorageFotoV1 | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return undefined
  try { return creaStorageFotoV1({ url, serviceRoleKey }) } catch { return undefined }
}
