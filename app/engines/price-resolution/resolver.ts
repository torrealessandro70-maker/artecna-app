import type {
  PriceKnowledgeItem,
  PriceResolutionInput,
  PriceResolutionOptions,
  PriceResolutionResult,
} from './types'

import { priceResolutionStrategies } from './strategies'

export const resolvePrice = (
  input: PriceResolutionInput,
  knowledgeBase: PriceKnowledgeItem[],
  options: PriceResolutionOptions = {},
): PriceResolutionResult => {
  const { minimumConfidence = 1 } = options

  void minimumConfidence

  const candidates = priceResolutionStrategies
    .flatMap((strategy) => strategy(input, knowledgeBase))
    .sort((a, b) => b.confidence - a.confidence)

  if (candidates.length > 0) {
    const best = candidates[0]

    return {
      status: 'resolved',
      strategy: best.strategy,
      confidence: best.confidence,

      matched: true,
      evaluatedStrategies: priceResolutionStrategies.length,

      input,

      matchedItem: best.item,

      prezzoUnitario: best.item.prezzo_unitario,
      codiceRisolto: best.item.codice ?? undefined,
      descrizioneRisolta: best.item.descrizione,
      unitaMisuraRisolta: best.item.unita_misura ?? undefined,

      reasons: best.reasons,

      candidates,
    }
  }

  return {
    status: 'unresolved',
    strategy: 'no_match',
    confidence: 0,

    matched: false,
    evaluatedStrategies: priceResolutionStrategies.length,

    input,

    reasons: [
      'Nessuna strategia ha trovato una corrispondenza.',
    ],

    candidates: [],
  }
}