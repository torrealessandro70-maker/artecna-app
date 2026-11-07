import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { StorageRemover } from './storageWorker.server'

/** Existing server-side credential names, no ENV writes, no fallback to anon.
 * No request is made by constructing the adapter. It is not wired to a route. */
export function configuredStorageRemover(): StorageRemover | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return undefined
  try {
    const parsed = new URL(url)
    if (parsed.origin !== 'https://axuiaiglbahygsmeoypy.supabase.co' || parsed.pathname !== '/' || parsed.search || parsed.hash) return undefined
    if (!key.startsWith('sb_secret_') && JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'service_role') return undefined
    return createStorageRemover(createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) }) },
    }))
  } catch { return undefined }
}

export function createStorageRemover(client: Pick<SupabaseClient, 'storage'>): StorageRemover {
  return {
    async remove(bucket, path) {
      // Identity comes exclusively from the canonical DB claim, never HTTP input.
      if (!bucket || bucket.includes('/') || !path) return { ok: false, permanent: true, reason: 'INVALID_OBJECT_IDENTITY' }
      const { error } = await client.storage.from(bucket).remove([path])
      if (!error) return { ok: true } // successful removal of an absent key is idempotent
      const status = Number(error.status ?? (/^\d+$/.test(error.statusCode ?? '') ? error.statusCode : 0))
      const code = error.statusCode
      if (code === 'NoSuchKey' && [400, 404].includes(status)) return { ok: true }
      // A missing bucket, ambiguous 404 or forbidden request is not proof that
      // this object was deleted. No raw response/credentials are logged.
      return { ok: false, permanent: status >= 400 && status < 500 && ![408,409,429].includes(status), reason: `STORAGE_HTTP_${status || 'UNKNOWN'}` }
    },
  }
}
