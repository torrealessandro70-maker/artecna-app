export type ConstructionEntityType =
  | 'operaio'
  | 'cliente'
  | 'cantiere'
  | 'zona'
  | 'materiale'
  | 'attrezzatura'
  | 'documento'
  | 'lavorazione'
  | 'attivita'
  | 'fornitore'
  | 'mezzo'
  | 'rischio'
  | 'difetto'
  | 'data'
  | 'quantita'
  | 'stato_avanzamento'
  | 'unknown'

export type ConstructionEntity = {
  text: string
  type: ConstructionEntityType
  normalizedText: string
  confidence: number
  source: 'lexicon' | 'rule' | 'unknown'
}

export type ConstructionSemanticAnalysisInput = {
  text: string
}

export type ConstructionSemanticAnalysisResult = {
  inputText: string
  entities: ConstructionEntity[]
  summary: string
}
