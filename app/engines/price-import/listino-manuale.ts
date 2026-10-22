import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUnitOfMeasure } from '../price-resolution/normalizer'
import { normalizzaCampiManodopera, type CampiManodopera } from './manodopera'

export type VoceListino = CampiManodopera & {
  id: string; codice: string; descrizione: string; unita_misura: string
  prezzo_unitario: number; categoria: string | null; zona: string | null
  regione: string | null; note: string | null; updated_at: string | null
  tipo_prezzo: string; fonte: string; versione: string
}
export type FormListino = {
  codice: string; descrizione: string; unita_misura: string; prezzo_unitario: string
  categoria: string; zona: string; regione: string; note: string
  incidenza_manodopera?: string; prezzo_manodopera?: string
}
export function preparaVoceListino(form: FormListino) {
  const descrizione = form.descrizione.trim()
  const unita_misura = normalizeUnitOfMeasure(form.unita_misura)
  const prezzo_unitario = Number(form.prezzo_unitario.trim().replace(',', '.'))
  if (!descrizione || !unita_misura || !Number.isFinite(prezzo_unitario) || prezzo_unitario <= 0) {
    throw Error('Descrizione, U.M. e prezzo maggiore di zero sono obbligatori.')
  }
  return { descrizione, unita_misura, prezzo_unitario,
    categoria: form.categoria.trim() || null, zona: form.zona.trim() || null,
    regione: form.regione.trim() || null, note: form.note.trim() || null,
    ...normalizzaCampiManodopera(form) }
}
export async function leggiListinoManuale(db: SupabaseClient): Promise<VoceListino[]> {
  const rows: VoceListino[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from('prezzi_lavorazioni').select('*')
      .eq('tipo_prezzo', 'artecna').order('id').range(from, from + 499)
    if (error) throw Error(error.message)
    rows.push(...(data || []))
    if ((data || []).length < 500) return rows
  }
}
export async function eliminaVoceListinoArtecna(db: SupabaseClient, voce: VoceListino) {
  if (!voce.id?.trim() || voce.tipo_prezzo !== 'artecna') throw Error('Voce non eliminabile dal Listino ARTECNA.')
  const { data, error } = await db.from('prezzi_lavorazioni').delete()
    .eq('id', voce.id).eq('tipo_prezzo', 'artecna').select('id').single()
  if (error) throw Error(error.message)
  if (!data || data.id !== voce.id) throw Error('Eliminazione non confermata. Rileggere il Listino ARTECNA.')
}
export async function salvaVoceListino(db: SupabaseClient, form: FormListino, existing?: VoceListino, manodoperaPersistente = false) {
  const { incidenza_manodopera, prezzo_manodopera, ...legacy } = preparaVoceListino(form)
  if (!manodoperaPersistente && [incidenza_manodopera,prezzo_manodopera].some(v=>v!==null&&v!==undefined))
    throw Error('Campi manodopera non disponibili: verificare la migration prima del salvataggio.')
  const fields = { ...legacy, ...(manodoperaPersistente ? normalizzaCampiManodopera(form) : {}) }
  if (existing) {
    if (existing.tipo_prezzo !== 'artecna') throw Error('Voce non modificabile dal Listino ARTECNA.')
    const { data: current, error: readError } = await db.from('prezzi_lavorazioni').select('id,tipo_prezzo,codice')
      .eq('id', existing.id).eq('tipo_prezzo', 'artecna').single()
    if (readError) throw Error(readError.message)
    if (!current || current.id !== existing.id || current.tipo_prezzo !== 'artecna') throw Error('Voce non modificabile dal Listino ARTECNA.')
    const codice = form.codice.trim() || current.codice || `ART_${crypto.randomUUID()}`
    if (/^SIC24/i.test(codice) && codice !== current.codice) throw Error('Il codice SIC24 è riservato al prezzario regionale.')
    const update = db.from('prezzi_lavorazioni').update({ ...fields, codice, updated_at: new Date().toISOString() })
      .eq('id', existing.id).eq('tipo_prezzo', 'artecna')
    const guarded = current.codice === null ? update.is('codice', null) : update.eq('codice', current.codice)
    const { error } = await guarded.select('id').single()
    if (error) throw Error(error.message)
  } else {
    const codice = form.codice.trim() || `ART_${crypto.randomUUID()}`
    if (/^SIC24/i.test(codice)) throw Error('Il codice SIC24 è riservato al prezzario regionale.')
    const { error } = await db.from('prezzi_lavorazioni').insert({ ...fields, codice,
      fonte: 'ARTECNA', tipo_prezzo: 'artecna', versione: 'manuale' })
    if (error) throw Error(error.message)
  }
}
