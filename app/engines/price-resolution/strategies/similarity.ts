import { calculateDescriptionSimilarity } from '../similarity'
import { normalizeUnitOfMeasure } from '../normalizer'

import type {
  PriceKnowledgeItem,
  PriceResolutionCandidate,
  PriceResolutionInput,
} from '../types'

export const resolveBySimilarity = (
  input: PriceResolutionInput,
  knowledgeBase: PriceKnowledgeItem[],
): PriceResolutionCandidate[] => {
  const unitaInput = normalizeUnitOfMeasure(input.unitaMisura)

  return knowledgeBase
    .map((item) => {
      const similarity = calculateDescriptionSimilarity(
        input.descrizione,
        item.descrizione,
      )

      const unitaItem = normalizeUnitOfMeasure(item.unita_misura)

      const unitaCompatibile =
        !unitaInput ||
        !unitaItem ||
        unitaInput === unitaItem

      const confidence = unitaCompatibile
        ? similarity
        : similarity * 0.75

      return {
        item,
        strategy: 'similarity' as const,
        confidence,
        reasons: [
          unitaCompatibile
            ? 'Descrizione simile con unità di misura compatibile.'
            : 'Descrizione simile, ma unità di misura differente.',
        ],
      }
    })
    .filter((candidate) => candidate.confidence >= 0.6)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
}