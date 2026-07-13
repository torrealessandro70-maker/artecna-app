import { classifyDocument } from './classifier'
import type { DocumentAnalysisResult } from './types'

export async function analyzeDocument(
  file: File
): Promise<DocumentAnalysisResult> {
  const classification = classifyDocument(file)
  const documentId = crypto.randomUUID()

  return {
    id: documentId,
    pipelineVersion: '0.1.0',
    analyzedAt: new Date().toISOString(),
    status: 'completed',
    metadata: {
      id: documentId,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    },
    classification,
    extractedText: '',
    rows: [],
    entities: [],
    destinations: [],
    warnings: [],
    suggestions: [],
  }
}

export { runDocumentTotalExtractorSmokeTest } from './total-extractor-smoke-test'

export {
  extractDocumentTotal,
  extractDocumentTotalDetailed,
} from './total-extractor'

export type { ExtractDocumentTotalResult } from './total-extractor'
export { classifyDocument } from './document-classifier'
export type { DocumentKind } from './document-classifier'
export { runDocumentClassifierSmokeTest } from './document-classifier-smoke-test'
export * from './document-profile'
export * from './document-insights'
export * from './document-insights-smoke-test'
export type * from './types'
export * from './pipeline'
export * from './pdf-reader'
export * from './image-reader'
export * from './pdf-ocr'
export * from './destination-resolver'
export * from './action-builder'
export * from './action-runner'