import { normalizePriceDescription } from '../normalizer'

import type {
  PriceKnowledgeItem,
  PriceResolutionCandidate,
  PriceResolutionInput,
} from '../types'

export const resolveByDescription = (
  input: PriceResolutionInput,
  knowledgeBase: PriceKnowledgeItem[],
): PriceResolutionCandidate[] => {
  const descrizioneInput = normalizePriceDescription(
    input.descrizione,
  )

  if (!descrizioneInput) {
    return []
  }

  return knowledgeBase
    .filter((item) => {
      const descrizioneItem = normalizePriceDescription(
        item.descrizione,
      )

      return (
        descrizioneItem !== '' &&
        descrizioneItem === descrizioneInput
      )
    })
    .map((item) => ({
      item,
      strategy: 'description',
      confidence: 0.9,
      reasons: [
        'Descrizione corrispondente dopo normalizzazione.',
      ],
    }))
}