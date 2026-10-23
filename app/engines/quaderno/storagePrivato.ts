import type { SupabaseClient } from '@supabase/supabase-js'

export const BUCKET_QUADERNO = 'quaderno-privato'
const prefisso = 'quaderno-storage:'
const prefissoCopia = 'quaderno-sopralluogo:'
export function leggiRiferimentoPrivato(uri: string) {
  const prefix = uri.startsWith(prefisso) ? prefisso : uri.startsWith(prefissoCopia) ? prefissoCopia : null
  return prefix ? { bucket: prefix === prefisso ? BUCKET_QUADERNO : 'quaderno-sopralluoghi', path: decodeURIComponent(uri.slice(prefix.length)) } : null
}
export const riferimentoFileQuaderno = (path: string, bucket = BUCKET_QUADERNO) =>
  (bucket === 'quaderno-sopralluoghi' ? prefissoCopia : prefisso) + encodeURIComponent(path)

export async function leggiImmaginePrivata(supabase: SupabaseClient, path: string, bucket = BUCKET_QUADERNO) {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw error
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Immagine privata non leggibile'))
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Immagine non valida'))
    reader.readAsDataURL(data)
  })
}

// Solo gli URL locali risolti sono sostituiti: nel JSON rimane il riferimento durevole.
export function serializzaSorgentiPrivate(value: unknown, riferimenti: Map<string, string>) {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'string' ? riferimenti.get(item) || item : item)
}

export async function risolviSorgentiPrivate(value: unknown, supabase: SupabaseClient, riferimenti: Map<string, string>) {
  const json = JSON.stringify(value)
  const refs = new Set<string>()
  JSON.parse(json, (_key, item: unknown) => {
    if (typeof item === 'string' && leggiRiferimentoPrivato(item)) refs.add(item)
    return item
  })
  const urls = new Map<string, string>()
  for (const ref of refs) {
    const file = leggiRiferimentoPrivato(ref)!
    const uri = await leggiImmaginePrivata(supabase, file.path, file.bucket)
    urls.set(ref, uri)
    riferimenti.set(uri, ref)
  }
  return JSON.parse(json, (_key, item: unknown) => typeof item === 'string' ? urls.get(item) || item : item)
}

export function ripristinaSorgentiPrivate<T>(value: T, riferimenti: Map<string, string>): T {
  return riferimenti.size === 0 ? value : JSON.parse(serializzaSorgentiPrivate(value, riferimenti))
}
