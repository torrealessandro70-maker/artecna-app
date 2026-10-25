import type {
  BuildSopralluogoMemoryInput,
  ComposedMemory,
  MemorySource,
  SopralluogoMemory,
} from './types'

/** Pure composition: descriptions first, then notes; ties use canonical identity/content.
 * Only identical normalized sources are deduplicated. Different identities or versions
 * remain distinct even when their text matches. No implicit fields are collected.
 */
export function buildMemoryFromSources(sources: readonly MemorySource[]): ComposedMemory {
  const canonical = new Map<string, MemorySource>()
  for (const source of sources) {
    const identity = {
      source_id: source.source_id,
      ...(source.source_version !== undefined ? { source_version: source.source_version } : {}),
      ...(source.updated_at !== undefined ? { updated_at: source.updated_at } : {}),
    }
    const normalized: MemorySource = source.source_type === 'descrizione'
      ? { ...identity, source_type: 'descrizione', origine: source.origine, testo: source.testo.trim() }
      : { ...identity, source_type: 'nota', origine: source.origine, titolo: source.titolo?.trim() ?? '', testo: source.testo.trim() }
    const key = JSON.stringify([
      normalized.source_type, normalized.origine, normalized.source_id,
      normalized.source_version ?? null, normalized.updated_at ?? null,
      normalized.source_type === 'nota' ? normalized.titolo : null, normalized.testo,
    ])
    canonical.set(key, normalized)
  }
  const fonti = [...canonical.entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([, source]) => source)
  const testoUnificato = fonti.map(source => source.source_type === 'nota'
    ? [source.titolo, source.testo].filter(Boolean).join('\n')
    : source.testo).filter(Boolean).join('\n\n')
  return { fonti, testoUnificato }
}

export function buildSopralluogoMemory(input: BuildSopralluogoMemoryInput): SopralluogoMemory {
  const descrizioneIniziale = input.descrizioneIniziale?.trim() ?? ''
  const sources: MemorySource[] = [{
    source_type: 'descrizione', source_id: input.sopralluogoId,
    origine: 'sopralluogo', testo: descrizioneIniziale,
  }]
  if (input.quaderno) sources.push({
    source_type: 'nota', source_id: input.sopralluogoId,
    origine: 'quaderno', titolo: input.quaderno.titolo ?? '', testo: input.quaderno.testo ?? '',
  })
  return {
    sopralluogoId: input.sopralluogoId,
    descrizioneIniziale,
    quaderno: input.quaderno ?? null,
    testoUnificato: buildMemoryFromSources(sources).testoUnificato,
    lastUpdated: new Date(),
  }
}
