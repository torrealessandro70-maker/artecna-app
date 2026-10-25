import type { MemorySource, MemorySourceIdentity } from './types'

/** Resolved textual snapshot: no lookup, extraction or project copy is performed here. */
export type QuadernoMemorySnapshot = Readonly<{
  id: string
  titolo: string
  testo: string
  updated_at: string
  source_version?: string
}>

export type NotaIntegrativaMemory = Readonly<MemorySourceIdentity & {
  titolo?: string
  testo: string
}>

/** References only: contract lines, amounts and prices are not narrative sources. */
export type ContestoContrattualeMemory = Readonly<{
  preventivo_contrattuale_id: string
  preventivo_sorgente_id?: string | null
}>

export type BuildVarianteMemorySourcesInput = Readonly<{
  variante: Readonly<{
    id: string
    stato: 'bozza'
    titolo?: string | null
    descrizione: string
    source_version?: string
    updated_at?: string
  }>
  cantiere_id: string
  contestoContrattuale?: ContestoContrattualeMemory
  noteIntegrative?: readonly NotaIntegrativaMemory[]
  quaderni?: readonly QuadernoMemorySnapshot[]
}>

/** Collects narrative sources only. The existing composer owns normalization,
 * ordering and deduplication. A titled description is represented as a note so
 * title and body remain separate using the unchanged MemorySource contract.
 */
export function buildVarianteMemorySources(input: BuildVarianteMemorySourcesInput): MemorySource[] {
  if (input.variante.stato !== 'bozza') throw new Error('La Memory Variante richiede una bozza')
  const variante = input.variante
  return [
    {
      source_id: variante.id,
      source_type: 'nota',
      origine: 'variante',
      ...(variante.source_version !== undefined ? { source_version: variante.source_version } : {}),
      ...(variante.updated_at !== undefined ? { updated_at: variante.updated_at } : {}),
      titolo: variante.titolo ?? '',
      testo: variante.descrizione,
    },
    ...(input.noteIntegrative ?? []).map((nota): MemorySource => ({
      source_id: nota.source_id,
      source_type: 'nota',
      origine: 'variante',
      ...(nota.source_version !== undefined ? { source_version: nota.source_version } : {}),
      ...(nota.updated_at !== undefined ? { updated_at: nota.updated_at } : {}),
      titolo: nota.titolo,
      testo: nota.testo,
    })),
    ...(input.quaderni ?? []).map((quaderno): MemorySource => ({
      source_id: quaderno.id,
      source_type: 'nota',
      origine: 'quaderno',
      // updated_at is the existing project revision token, not the file format version.
      source_version: quaderno.source_version ?? quaderno.updated_at,
      updated_at: quaderno.updated_at,
      titolo: quaderno.titolo,
      testo: quaderno.testo,
    })),
  ]
}
