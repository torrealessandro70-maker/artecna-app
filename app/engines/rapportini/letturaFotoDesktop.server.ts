import 'server-only'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { risolviFotoDesktopPostgres } from './adapterPortalePostgres.server'
import { LIMITI_ALLEGATI, validaUUIDAllegato, validaMimeAllegato, validaByteSizeAllegato, validaSHA256Allegato } from './contrattoAllegati'
import { ErroreFotoV1, type StorageFotoV1 } from './servizioFotoV1.server'

export interface CapabilityFotoDesktop {
  /** Verifica JWT presso Auth; restituisce il subject verificato e RPC con quel JWT. */
  authorize(token: string): Promise<{ userId: string; list(rapportino: string): Promise<unknown> }>
  /** Il resolver certificato verifica nuovamente membership, stato e reciprocita. */
  resolve(allegato: string, verifiedUser: string): Promise<unknown>
}
function dbError(e: unknown): never {
  const code = e && typeof e === 'object' && 'code' in e ? e.code : null
  throw new ErroreFotoV1(code === '42501' ? 403 : code === 'PR401' ? 401
    : code === 'PR409' ? 404 : code === 'XX001' ? 409 : 503, 'foto_non_disponibile')
}
export const capabilityFotoDesktop: CapabilityFotoDesktop = {
  async authorize(token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new ErroreFotoV1(503, 'auth_non_configurata')
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) throw new ErroreFotoV1(401, 'identita')
    const userId = validaUUIDAllegato(data.user.id)
    return { userId, async list(rapportino) {
      const result = await client.rpc('elenca_foto_rapportino_desktop', { p_rapportino: rapportino })
      if (result.error) dbError(result.error)
      return result.data
    } }
  },
  async resolve(allegato, user) {
    try { return await risolviFotoDesktopPostgres(allegato, user) } catch (e) { dbError(e) }
  },
}
export function validaElencoFotoDesktop(value: unknown, rapportino: string) {
  const r = value as Record<string, unknown> | null
  if (!r || r.versione_contratto !== 1 || r.rapportino_id !== rapportino || !Array.isArray(r.allegati))
    throw new ErroreFotoV1(503, 'registro')
  const ids = new Set<string>(), projections = new Set<string>()
  const allegati = r.allegati.map(a => {
    const id = validaUUIDAllegato(a.allegato_id), foto = validaUUIDAllegato(a.foto_cantiere_id)
    if (a.rapportino_id !== rapportino || ids.has(id) || projections.has(foto)) throw new ErroreFotoV1(503, 'registro')
    ids.add(id); projections.add(foto)
    return { allegato_id: id, foto_cantiere_id: foto, rapportino_id: rapportino,
      mime_type: validaMimeAllegato(a.mime_type), byte_size: validaByteSizeAllegato(a.byte_size) }
  })
  return { versione_contratto: 1, rapportino_id: rapportino, allegati }
}
/** GET con un solo ID. Nessun subject, bucket, path o URL HTTP accettato. */
export function creaLetturaHttpFotoDesktop(deps: { capability: CapabilityFotoDesktop; storage?: Pick<StorageFotoV1, 'read'> }) {
  return async (req: Request) => {
    const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization', 'X-Content-Type-Options': 'nosniff' }
    try {
      if (req.method !== 'GET') throw new ErroreFotoV1(405, 'metodo')
      const url = new URL(req.url), download = url.pathname.endsWith('/download')
      const key = download ? 'allegato_id' : 'rapportino_id'
      if ([...url.searchParams.keys()].some(k => k !== key) || url.searchParams.getAll(key).length !== 1)
        throw new ErroreFotoV1(400, 'parametri')
      let id: string
      try { id = validaUUIDAllegato(url.searchParams.get(key)) } catch { throw new ErroreFotoV1(400, 'id') }
      const bearer = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)
      if (!bearer) throw new ErroreFotoV1(401, 'identita')
      const operation = await deps.capability.authorize(bearer[1])
      const user = validaUUIDAllegato(operation.userId)
      if (!download) return Response.json(validaElencoFotoDesktop(await operation.list(id), id), { headers })
      const r = await deps.capability.resolve(id, user) as Record<string, unknown> | null
      if (!r || r.versione_contratto !== 1 || r.allegato_id !== id || r.bucket !== 'rapportini-v1')
        throw new ErroreFotoV1(503, 'registro')
      const rapportino = validaUUIDAllegato(r.rapportino_id), cantiere = validaUUIDAllegato(r.cantiere_id)
      validaUUIDAllegato(r.foto_cantiere_id)
      // Path autorevole dal resolver, ristretto ulteriormente al contesto restituito.
      const path = r.file_path
      if (typeof path !== 'string' || !new RegExp(`^rapportini/${cantiere}/${rapportino}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path))
        throw new ErroreFotoV1(503, 'registro')
      const mime = validaMimeAllegato(r.mime_type), size = validaByteSizeAllegato(r.byte_size), hash = validaSHA256Allegato(r.sha256)
      if (!deps.storage) throw new ErroreFotoV1(503, 'storage_non_configurato')
      const bytes = await deps.storage.read('rapportini-v1', path, LIMITI_ALLEGATI.byte_size)
      if (!bytes) throw new ErroreFotoV1(404, 'oggetto_assente')
      if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== hash)
        throw new ErroreFotoV1(409, 'oggetto_incoerente')
      return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Type': mime, 'Content-Length': String(size) } })
    } catch (e) {
      const error = e instanceof ErroreFotoV1 ? e : new ErroreFotoV1(503, 'lettura_non_disponibile')
      return Response.json({ codice: error.codice }, { status: error.status, headers })
    }
  }
}
