import type { SupabaseClient } from '@supabase/supabase-js'
import { FONTI, type Fonti, type Fonte, type Lettura, type Riga } from './riepilogo'

export type ClientLettura = Pick<SupabaseClient, 'from'>
// Stesse tabelle dei loader desktop, stessa sessione autorizzata; nessun bypass,
// fallback anonimo, RPC di scrittura o accesso ai materiali derivati.
export async function leggiFonte(client: ClientLettura, fonte: Fonte): Promise<Lettura> {
  const righe: Riga[] = [], ids = new Set<string>()
  let attese: number | null = null
  try {
    for (let offset = 0; ; offset += 500) {
      const { data, count, error } = await client.from(fonte).select('*', { count: 'exact' }).order('id', { ascending: true }).range(offset, offset + 499)
      if (error || !Array.isArray(data)) return { stato: righe.length ? 'parziale' : 'errore', righe, limite: 'Lettura non disponibile o non autorizzata. Nessun aggiramento dei permessi.' }
      if (!Number.isSafeInteger(count) || count === null || count < 0 || (attese !== null && attese !== count)) return { stato: 'parziale', righe, limite: 'Completezza della lettura non certificata o archivio cambiato: aggiorna le letture.' }
      attese = count
      for (const r of data as Riga[]) {
        const id = typeof r.id === 'string' && r.id.trim() ? r.id : typeof r.id === 'number' && Number.isSafeInteger(r.id) ? String(r.id) : ''
        if (!id || ids.has(id)) return { stato: 'parziale', righe, limite: 'Identità mancanti/ripetute durante la paginazione: rileggere la fonte.' }
        ids.add(id); righe.push(r)
      }
      if (data.length < 500) return righe.length === attese ? { stato: 'pronta', righe } : { stato: 'parziale', righe, limite: 'Numero di record diverso dal conteggio atteso.' }
    }
  } catch { return { stato: righe.length ? 'parziale' : 'errore', righe, limite: 'Errore di caricamento: nessuno zero sostitutivo.' } }
}
export async function leggiFontiDitta(client: ClientLettura): Promise<Fonti> {
  const pairs = await Promise.all(FONTI.map(async fonte => [fonte, await leggiFonte(client, fonte)] as const))
  return Object.fromEntries(pairs) as Fonti
}
