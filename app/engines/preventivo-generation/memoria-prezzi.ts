import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceKnowledgeItem } from '../price-resolution/types'

export async function leggiMemoriaPrezziPreventivo(db: SupabaseClient): Promise<{ righe: PriceKnowledgeItem[]; autorizzata: boolean }> {
  const righe: PriceKnowledgeItem[] = []
  for (let da = 0; ; da += 500) {
    const r = await db.rpc('leggi_memoria_prezzi_preventivo', { p_da: da, p_limite: 500 })
    if (r.error?.code === '42501') return { righe: [], autorizzata: false }
    if (r.error || !Array.isArray(r.data)) throw Error('Lettura Memoria prezzi non disponibile')
    for (const row of r.data) {
      if (typeof row?.id !== 'string' || typeof row.descrizione !== 'string' || typeof row.prezzo_unitario !== 'number' ||
        !Number.isFinite(row.prezzo_unitario) || row.prezzo_unitario <= 0 ||
        (row.unita_misura !== null && typeof row.unita_misura !== 'string') ||
        (row.fonte !== null && typeof row.fonte !== 'string')) throw Error('Risposta Memoria prezzi non valida')
      righe.push({ id: row.id, descrizione: row.descrizione, unita_misura: row.unita_misura,
        prezzo_unitario: row.prezzo_unitario, fonte: row.fonte })
    }
    if (r.data.length < 500) return { righe, autorizzata: true }
  }
}
