import { buildMemoryFromSources } from './builder'
import { buildVarianteMemorySources, type BuildVarianteMemorySourcesInput } from './variante'

export type FonteQuadernoCollegata = {
  id: string
  titolo: string
  testo: string
  updated_at: string
  source_version: string
  aggiornato: boolean
  disponibile: boolean
}

export function previewVariante(
  variante: BuildVarianteMemorySourcesInput['variante'],
  cantiere_id: string,
  contratto: string | null,
  fonti: readonly FonteQuadernoCollegata[]
) {
  return buildMemoryFromSources(buildVarianteMemorySources({
    variante, cantiere_id,
    contestoContrattuale: contratto ? { preventivo_contrattuale_id: contratto } : undefined,
    // Preview uses the content actually read now, never pretends to read a historical snapshot.
    quaderni: fonti.filter(f => f.disponibile).map(f => ({
      id: f.id, titolo: f.titolo, testo: f.testo, updated_at: f.updated_at,
    })),
  }))
}

export function leggiFontiCollegate(data: unknown): FonteQuadernoCollegata[] {
  if (!Array.isArray(data) || !data.every(f => f &&
    ['id','titolo','testo','updated_at','source_version'].every(k => typeof f[k] === 'string') &&
    typeof f.aggiornato === 'boolean' && typeof f.disponibile === 'boolean')) {
    throw new Error('Risposta fonti non valida')
  }
  return data
}
