import {
  normalizePriceDescription,
  normalizeUnitOfMeasure,
} from '../normalizer'

import type {
  PriceKnowledgeItem,
  PriceResolutionCandidate,
  PriceResolutionInput,
} from '../types'

export const resolveByDescriptionAndUnit = (
  input: PriceResolutionInput,
  knowledgeBase: PriceKnowledgeItem[],
): PriceResolutionCandidate[] => {
  const descrizioneInput = normalizePriceDescription(input.descrizione)
  const unitaInput = normalizeUnitOfMeasure(input.unitaMisura)

  if (!descrizioneInput || !unitaInput) {
    return []
  }

  return knowledgeBase
    .filter((item) => {
      const descrizioneItem = normalizePriceDescription(item.descrizione)
      const unitaItem = normalizeUnitOfMeasure(item.unita_misura)

      return (
        descrizioneItem !== '' &&
        unitaItem !== '' &&
        descrizioneItem === descrizioneInput &&
        unitaItem === unitaInput
      )
    })
    .map((item) => ({
      item,
      strategy: 'description_unit',
      confidence: 0.95,
      reasons: [
        'Descrizione e unità di misura corrispondenti dopo normalizzazione.',
      ],
    }))
}