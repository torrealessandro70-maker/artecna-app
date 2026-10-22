import type { SupabaseClient } from '@supabase/supabase-js'

export const BUCKET_QUADERNO = 'quaderno-privato'
const prefisso = 'quaderno-storage:'
export const riferimentoFileQuaderno = (path: string) => prefisso + encodeURIComponent(path)

export async function leggiImmaginePrivata(supabase: SupabaseClient, path: string) {
  const { data, error } = await supabase.storage.from(BUCKET_QUADERNO).download(path)
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
    if (typeof item === 'string' && item.startsWith(prefisso)) refs.add(item)
    return item
  })
  const urls = new Map<string, string>()
  for (const ref of refs) {
    const uri = await leggiImmaginePrivata(supabase, decodeURIComponent(ref.slice(prefisso.length)))
    urls.set(ref, uri)
    riferimenti.set(uri, ref)
  }
  return JSON.parse(json, (_key, item: unknown) => typeof item === 'string' ? urls.get(item) || item : item)
}

export function ripristinaSorgentiPrivate<T>(value: T, riferimenti: Map<string, string>): T {
  return riferimenti.size === 0 ? value : JSON.parse(serializzaSorgentiPrivate(value, riferimenti))
}
