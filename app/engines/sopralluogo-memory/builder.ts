import type {
  BuildSopralluogoMemoryInput,
  SopralluogoMemory,
} from './types'

export function buildSopralluogoMemory(
  input: BuildSopralluogoMemoryInput
): SopralluogoMemory {
  const descrizioneIniziale =
    input.descrizioneIniziale?.trim() ?? ''

  const titoloQuaderno =
    input.quaderno?.titolo?.trim() ?? ''

  const testoQuaderno =
    input.quaderno?.testo?.trim() ?? ''

  const contenutoQuaderno = [
    titoloQuaderno,
    testoQuaderno,
  ]
    .filter(Boolean)
    .join('\n')

  const testoUnificato = [
    descrizioneIniziale,
    contenutoQuaderno,
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    sopralluogoId: input.sopralluogoId,
    descrizioneIniziale,
    quaderno: input.quaderno ?? null,
    testoUnificato,
    lastUpdated: new Date(),
  }
}