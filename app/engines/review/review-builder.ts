import type { ReviewItem, ReviewResult } from './types'

type SemanticReviewEntity = {
  text: string
  type: string
  confidence: number
}

type ReviewCollection =
  | 'operai'
  | 'materiali'
  | 'attivita'
  | 'lavorazioni'
  | 'problemi'
  | 'documenti'

const collectionByEntityType: Record<string, ReviewCollection> = {
  operaio: 'operai',
  materiale: 'materiali',
  attivita: 'attivita',
  lavorazione: 'lavorazioni',
  difetto: 'problemi',
  rischio: 'problemi',
  documento: 'documenti',
}

export function buildReviewFromSemanticEntities(input: {
  title?: string
  summary?: string
  entities: SemanticReviewEntity[]
}): ReviewResult {
  const createdAt = new Date().toISOString()
  const collections: Record<ReviewCollection, ReviewItem[]> = {
    operai: [],
    materiali: [],
    attivita: [],
    lavorazioni: [],
    problemi: [],
    documenti: [],
  }
  const usedConfidences: number[] = []

  for (const entity of input.entities) {
    const collection = collectionByEntityType[entity.type]

    if (!collection) {
      continue
    }

    collections[collection].push({
      id: `${entity.type}-${createdAt}-${usedConfidences.length}`,
      label: entity.text,
      status: 'proposed',
      source: 'semantic',
      confidence: entity.confidence,
    })
    usedConfidences.push(entity.confidence)
  }

  const confidence = usedConfidences.length
    ? usedConfidences.reduce((total, value) => total + value, 0) /
      usedConfidences.length
    : 0

  return {
    id: `review-${createdAt}`,
    createdAt,
    title: input.title ?? 'Review ARTECNA OS',
    summary: input.summary ?? 'Proposta generata dalle entita semantiche',
    ...collections,
    foto: [],
    confidence,
    needsUserConfirmation: true,
  }
}
