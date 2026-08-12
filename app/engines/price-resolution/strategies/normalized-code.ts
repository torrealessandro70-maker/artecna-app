import { normalizePriceCode } from '../normalizer'
import type {
  PriceKnowledgeItem,
  PriceResolutionCandidate,
  PriceResolutionInput,
} from '../types'

export const resolveByNormalizedCode = (
  input: PriceResolutionInput,
  knowledgeBase: PriceKnowledgeItem[],
): PriceResolutionCandidate[] => {
  const codiceInput = normalizePriceCode(input.codice)

  if (!codiceInput) {
    return []
  }

  return knowledgeBase
    .filter((item) => {
      const codiceItem = normalizePriceCode(item.codice)

      return codiceItem !== '' && codiceItem === codiceInput
    })
    .map((item) => ({
      item,
      strategy: 'normalized_code',
      confidence: 0.98,
      reasons: [
        'Codice prezzario corrispondente dopo normalizzazione.',
      ],
    }))
}