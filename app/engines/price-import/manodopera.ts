import type { SupabaseClient } from '@supabase/supabase-js'

export type CampiManodopera = {
  incidenza_manodopera?: number | null
  prezzo_manodopera?: number | null
}

function numeroOpzionale(value: unknown, label: string, massimo?: number): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null
  if (typeof value !== 'number' && typeof value !== 'string') throw Error(`${label}: numero non valido.`)
  const text=String(value).trim()
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) throw Error(`${label}: numero non valido.`)
  const number=Number(text.replace(',', '.'))
  if (!Number.isFinite(number) || number < 0 || (massimo !== undefined && number > massimo))
    throw Error(`${label}: valore fuori intervallo${massimo === undefined ? '' : ' 0–100'}.`)
  return number
}

// Nessun calcolo dell'altro campo e nessun arrotondamento del valore ufficiale.
export function normalizzaCampiManodopera(input: {incidenza_manodopera?: unknown;prezzo_manodopera?: unknown}): CampiManodopera {
  const result: CampiManodopera={}
  if (input.incidenza_manodopera !== undefined)
    result.incidenza_manodopera=numeroOpzionale(input.incidenza_manodopera,'% Manodopera',100)
  if (input.prezzo_manodopera !== undefined)
    result.prezzo_manodopera=numeroOpzionale(input.prezzo_manodopera,'Manodopera €/U.M.')
  return result
}

export function campiManodoperaDisponibili(rows: readonly Record<string,unknown>[]): boolean {
  return rows.length > 0 && rows.every(row =>
    Object.prototype.hasOwnProperty.call(row,'incidenza_manodopera') &&
    Object.prototype.hasOwnProperty.call(row,'prezzo_manodopera'))
}

// SELECT * funziona anche prima della migration. Nessuna colonna nuova richiesta.
// Tabella vuota o risposta non verificabile: nessuna persistenza dei campi nuovi.
export async function leggiSupportoManodopera(db: SupabaseClient): Promise<boolean> {
  const {data,error}=await db.from('prezzi_lavorazioni').select('*').order('id').range(0,0)
  if (error) throw Error(error.message)
  return campiManodoperaDisponibili(data||[])
}

export function formattaManodopera(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—'
    : Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})
}
