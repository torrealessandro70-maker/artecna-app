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
export { extractDocumentTotal } from './total-extractor'
export { runDocumentTotalExtractorSmokeTest } from './total-extractor-smoke-test'