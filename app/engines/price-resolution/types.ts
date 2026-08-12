export type PriceResolutionStrategy =
  | 'exact_code'
  | 'normalized_code'
  | 'description_unit'
  | 'description'
  | 'similarity'
  | 'ai_fallback'
  | 'no_match'

export type PriceResolutionStatus =
  | 'resolved'
  | 'suggested'
  | 'unresolved'

export type PriceResolutionInput = {
  codice?: string | null
  descrizione: string
  unitaMisura?: string | null
  quantita?: number | null
}

export type PriceKnowledgeItem = {
  id?: string
  codice?: string | null
  descrizione: string
  unita_misura?: string | null
  prezzo_unitario: number
  fonte?: string | null
  regione?: string | null
  anno?: number | null
  versione?: string | null
  tipo_prezzo?: string | null
}

export type PriceResolutionCandidate = {
  item: PriceKnowledgeItem
  strategy: PriceResolutionStrategy
  confidence: number
  reasons: string[]
}

export type PriceResolutionResult = {
  status: PriceResolutionStatus
  strategy: PriceResolutionStrategy
  confidence: number

  matched: boolean
  evaluatedStrategies: number

  input: PriceResolutionInput

  matchedItem?: PriceKnowledgeItem
  prezzoUnitario?: number
  codiceRisolto?: string
  descrizioneRisolta?: string
  unitaMisuraRisolta?: string

  reasons: string[]
  candidates: PriceResolutionCandidate[]
}

export type PriceResolutionOptions = {
  minimumConfidence?: number
  similarityThreshold?: number
  maxCandidates?: number
  enableAiFallback?: boolean
}