import type {
  PriceKnowledgeItem,
  PriceResolutionCandidate,
  PriceResolutionInput,
} from '../types'

const cleanExactCode = (
  value?: string | null,
): string => {
  return value?.trim() ?? ''
}

export const resolveByExactCode = (
  input: PriceResolutionInput,
  knowledgeBase: PriceKnowledgeItem[],
): PriceResolutionCandidate[] => {
  const codiceInput = cleanExactCode(input.codice)

  if (!codiceInput) {
    return []
  }

  return knowledgeBase
    .filter((item) => {
      const codiceItem = cleanExactCode(item.codice)

      return codiceItem !== '' && codiceItem === codiceInput
    })
    .map((item) => ({
      item,
      strategy: 'exact_code',
      confidence: 1,
      reasons: [
        'Codice prezzario esattamente corrispondente.',
      ],
    }))
}