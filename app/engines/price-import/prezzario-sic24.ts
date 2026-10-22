import type { SupabaseClient } from '@supabase/supabase-js'

export type VocePrezzarioSic24 = {
  id: string; codice: string; descrizione: string | null; unita_misura: string | null
  prezzo_unitario: number | null; incidenza_manodopera: number | null; prezzo_manodopera: number | null
  fonte: string; versione: string; anno: number | null; tipo_prezzo: string
}

export async function leggiPrezzarioSic24(db: SupabaseClient): Promise<VocePrezzarioSic24[]> {
  const rows: VocePrezzarioSic24[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from('prezzi_lavorazioni')
      .select('id,codice,descrizione,unita_misura,prezzo_unitario,incidenza_manodopera,prezzo_manodopera,fonte,versione,anno,tipo_prezzo')
      .eq('fonte', 'Regione Sicilia').eq('tipo_prezzo', 'regional_price_list').eq('versione', 'SIC24')
      .like('codice', 'SIC24\\_%').order('codice').order('id').range(from, from + 499)
    if (error) throw Error(error.message)
    const page = (data || []) as VocePrezzarioSic24[]
    if (page.some(row => row.fonte !== 'Regione Sicilia' || row.tipo_prezzo !== 'regional_price_list' ||
        row.versione !== 'SIC24' || !row.codice?.startsWith('SIC24_'))) {
      throw Error('Risposta prezzario SIC24 non coerente con i filtri richiesti.')
    }
    rows.push(...page)
    if (page.length < 500) return rows
  }
}

export function cercaPrezzarioSic24(rows: readonly VocePrezzarioSic24[], search: string): VocePrezzarioSic24[] {
  const query = search.trim().toLowerCase()
  return rows.filter(row => `${row.codice} ${row.descrizione || ''}`.toLowerCase().includes(query))
}
