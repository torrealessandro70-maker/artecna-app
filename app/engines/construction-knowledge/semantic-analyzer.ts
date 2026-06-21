import { constructionLexicon } from './lexicon'
import type {
  ConstructionEntity,
  ConstructionEntityType,
  ConstructionSemanticAnalysisInput,
  ConstructionSemanticAnalysisResult,
} from './types'

const lexiconGroups: Array<{
  terms: readonly string[]
  type: ConstructionEntityType
}> = [
  { terms: constructionLexicon.zone, type: 'zona' },
  { terms: constructionLexicon.materiali, type: 'materiale' },
  { terms: constructionLexicon.lavorazioni, type: 'lavorazione' },
  { terms: constructionLexicon.attivita, type: 'attivita' },
  { terms: constructionLexicon.dateRelative, type: 'data' },
]

export function analyzeConstructionSemantics(
  input: ConstructionSemanticAnalysisInput
): ConstructionSemanticAnalysisResult {
  const inputTokens = input.text
    .split(/[^a-zA-ZÀ-ÖØ-öø-ÿ0-9_]+/)
    .filter(Boolean)
  const tokensByNormalizedText = new Map<string, string>()

  for (const token of inputTokens) {
    const normalizedToken = token.toLocaleLowerCase('it-IT')

    if (!tokensByNormalizedText.has(normalizedToken)) {
      tokensByNormalizedText.set(normalizedToken, token)
    }
  }

  const entities: ConstructionEntity[] = []
  const matchedTerms = new Set<string>()

  for (const group of lexiconGroups) {
    for (const term of group.terms) {
      if (!tokensByNormalizedText.has(term) || matchedTerms.has(term)) {
        continue
      }

      entities.push({
        text: tokensByNormalizedText.get(term) ?? term,
        type: group.type,
        normalizedText: term,
        confidence: 0.9,
        source: 'lexicon',
      })
      matchedTerms.add(term)
    }
  }

  return {
    inputText: input.text,
    entities,
    summary: 'Analisi semantica V1 completata',
  }
}
