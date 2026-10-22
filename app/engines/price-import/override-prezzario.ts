import type { SupabaseClient } from '@supabase/supabase-js'
import { preparaVoceListino, type FormListino, type VoceListino } from './listino-manuale'
import type { VocePrezzarioSic24 } from './prezzario-sic24'

export type OverridePrezzario = VoceListino & { origine_prezzario_id: string }
type Origine = VocePrezzarioSic24 & { categoria?: string | null; zona?: string | null; regione?: string | null; origine_prezzario_id?: string | null }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function origineRegionaleValida(row: Origine): boolean {
  return uuid.test(row.id) && row.tipo_prezzo === 'regional_price_list' && row.fonte === 'Regione Sicilia' &&
    !row.origine_prezzario_id && Number.isInteger(row.anno) && row.anno! >= 2000 && row.anno! <= 2099 &&
    row.versione === `SIC${String(row.anno).slice(-2)}` &&
    (row.codice.startsWith(`${row.versione}_`) && /^SIC\d{2}_\d+(?:\.\d+)+$/.test(row.codice) || /^\d+(?:\.\d+)+$/.test(row.codice))
}

export async function validaOriginePrezzario(db: SupabaseClient, attesa: Origine, overrideId?: string): Promise<Origine> {
  if (!origineRegionaleValida(attesa) || attesa.id === overrideId) throw Error('Origine prezzario ufficiale non valida.')
  const { data, error } = await db.from('prezzi_lavorazioni').select('*').eq('id', attesa.id).single()
  if (error) throw Error(error.message)
  if (!data || !origineRegionaleValida(data) || data.id !== attesa.id || data.id === overrideId ||
    ['codice', 'fonte', 'versione', 'anno', 'tipo_prezzo'].some(key => data[key] !== attesa[key as keyof Origine]))
    throw Error('Origine modificata o non univoca. Ricaricare il prezzario.')
  return data
}

export async function caricaOverridePerOrigine(db: SupabaseClient, ids: readonly string[]): Promise<Record<string, OverridePrezzario>> {
  const unique = [...new Set(ids)]
  if (unique.some(id => !uuid.test(id))) throw Error('Identità origine non valida.')
  const result: Record<string, OverridePrezzario> = {}
  for (let from = 0; from < unique.length; from += 200) {
    const batch = unique.slice(from, from + 200)
    const { data, error } = await db.from('prezzi_lavorazioni').select('*')
      .eq('tipo_prezzo', 'artecna').in('origine_prezzario_id', batch)
    if (error) throw Error(error.message)
    for (const row of (data || []) as OverridePrezzario[]) {
      if (!batch.includes(row.origine_prezzario_id) || row.tipo_prezzo !== 'artecna' || !uuid.test(row.id) ||
        row.id === row.origine_prezzario_id || result[row.origine_prezzario_id]) throw Error('Personalizzazione non univoca o non valida.')
      result[row.origine_prezzario_id] = row
    }
  }
  return result
}

const conflitto = 'Esiste già una personalizzazione per questa voce. Riaprire Modifica personalizzazione.'
export async function creaOverrideDaPrezzario(db: SupabaseClient, origine: Origine, form: FormListino): Promise<OverridePrezzario> {
  const official = await validaOriginePrezzario(db, origine)
  const existing = await caricaOverridePerOrigine(db, [official.id])
  if (existing[official.id]) throw Error(conflitto)
  const fields = preparaVoceListino(form)
  const { data, error } = await db.from('prezzi_lavorazioni').insert({ ...fields, codice: `ART_${crypto.randomUUID()}`,
    fonte: 'ARTECNA', tipo_prezzo: 'artecna', versione: 'manuale', origine_prezzario_id: official.id,
    updated_at: new Date().toISOString() }).select('*').single()
  if (error) throw Error(error.code === '23505' ? conflitto : error.message)
  if (!data || data.tipo_prezzo !== 'artecna' || data.origine_prezzario_id !== official.id || !uuid.test(data.id) || data.id === official.id)
    throw Error('Salvataggio non confermato. Ricaricare le personalizzazioni prima di riprovare.')
  return data
}

async function verificaOverride(db: SupabaseClient, origine: Origine, voce: OverridePrezzario) {
  if (voce.tipo_prezzo !== 'artecna' || !uuid.test(voce.id) || voce.origine_prezzario_id !== origine.id || voce.id === origine.id)
    throw Error('Personalizzazione non valida.')
  await validaOriginePrezzario(db, origine, voce.id)
  const current = (await caricaOverridePerOrigine(db, [origine.id]))[origine.id]
  if (!current || current.id !== voce.id) throw Error('Personalizzazione cambiata. Ricaricare il prezzario.')
  return current
}

export async function aggiornaOverridePrezzario(db: SupabaseClient, origine: Origine, voce: OverridePrezzario, form: FormListino): Promise<OverridePrezzario> {
  await verificaOverride(db, origine, voce)
  const { data, error } = await db.from('prezzi_lavorazioni').update({ ...preparaVoceListino(form), updated_at: new Date().toISOString() })
    .eq('id', voce.id).eq('tipo_prezzo', 'artecna').eq('origine_prezzario_id', origine.id).select('*').single()
  if (error) throw Error(error.message)
  if (!data || data.id !== voce.id || data.tipo_prezzo !== 'artecna' || data.origine_prezzario_id !== origine.id)
    throw Error('Aggiornamento non confermato. Ricaricare il prezzario.')
  return data
}

// Il chiamante deve ottenere conferma esplicita prima di invocare questa funzione.
export async function rimuoviOverridePrezzario(db: SupabaseClient, origine: Origine, voce: OverridePrezzario) {
  await verificaOverride(db, origine, voce)
  const { data, error } = await db.from('prezzi_lavorazioni').delete()
    .eq('id', voce.id).eq('tipo_prezzo', 'artecna').eq('origine_prezzario_id', origine.id).select('id').single()
  if (error) throw Error(error.message)
  if (!data || data.id !== voce.id) throw Error('Rimozione non confermata. Ricaricare il prezzario.')
}

export function formPersonalizzazione(origine: Origine, voce?: OverridePrezzario): FormListino {
  const row = voce || origine
  const text = (v: unknown) => v == null ? '' : String(v)
  return { codice: voce?.codice || '', descrizione: row.descrizione || '', unita_misura: row.unita_misura || '',
    prezzo_unitario: text(row.prezzo_unitario), incidenza_manodopera: text(row.incidenza_manodopera),
    prezzo_manodopera: text(row.prezzo_manodopera), categoria: row.categoria || '', zona: row.zona || 'Catania',
    regione: row.regione || 'Sicilia', note: voce?.note || '' }
}
