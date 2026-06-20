export type DocumentType =
  | 'preventivo'
  | 'fattura'
  | 'computo'
  | 'sal'
  | 'planimetria'
  | 'documento_tecnico'
  | 'immagine'
  | 'altro'

export type DocumentClassificationResult = {
  type: DocumentType
  confidence: number
  reasons: string[]
}

export type DocumentMetadata = {
  id: string
  fileName: string
  mimeType: string
  size: number
  extension?: string
  fingerprint?: string
  pageCount?: number
  uploadedAt?: string
}

export type DocumentEntity = {
  id: string
  type: string
  value: string | number | boolean | null
  normalizedValue?: string | number | boolean | null
  confidence: number
  sourceText?: string
  page?: number
}

export type DocumentRow = {
  id: string
  index: number
  values: Record<string, string | number | boolean | null>
  confidence: number
  sourceText?: string
  page?: number
}

export type DocumentDestination = {
  type:
    | 'preventivo_ufficiale'
    | 'documento_tecnico'
    | 'lavorazioni'
    | 'sal'
    | 'materiali'
    | 'fattura_fornitore'
    | 'archivio_fascicolo'
  label: string
  eligible: boolean
  confidence: number
  reasons: string[]
  requirements: string[]
}

export type DocumentWarning = {
  code: string
  message: string
  severity: 'info' | 'warning' | 'error'
  page?: number
  entityId?: string
  rowId?: string
}

export type DocumentSuggestion = {
  id: string
  type: string
  title: string
  description: string
  confidence: number
  destination?: DocumentDestination['type']
  entityIds?: string[]
  rowIds?: string[]
}

export type DocumentAnalysisResult = {
  id: string
  pipelineVersion: string
  analyzedAt: string
  status: 'completed' | 'partial' | 'failed'
  metadata: DocumentMetadata
  classification: DocumentClassificationResult
  extractedText?: string
  entities: DocumentEntity[]
  rows: DocumentRow[]
  destinations: DocumentDestination[]
  warnings: DocumentWarning[]
  suggestions: DocumentSuggestion[]
}
