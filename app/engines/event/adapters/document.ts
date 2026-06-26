import type { ConstructionEvent } from '../types'

export type DocumentEventInput = {
  id?: string | number
  cantiere_id?: string
  cantiere?: string
  data_documento?: string
  data?: string
  created_at?: string
  [key: string]: unknown
}

function toDocumentEventInput(document: unknown): DocumentEventInput {
  return typeof document === 'object' && document !== null
    ? (document as DocumentEventInput)
    : {}
}

function resolveDocumentDate(document: DocumentEventInput): string {
  return (
    document.data_documento ||
    document.created_at ||
    document.data ||
    new Date().toISOString()
  )
}

export function buildDocumentEvents(documents?: unknown[]): ConstructionEvent[] {
  return (documents || []).map((document, index) => {
    const normalizedDocument = toDocumentEventInput(document)

    return {
      id: `document-${normalizedDocument.id ?? index}`,
      source: 'document',
      type: 'document_added',
      title: 'Documento caricato',
      description: 'Documento aggiunto al fascicolo',
      occurredAt: resolveDocumentDate(normalizedDocument),
      createdAt: normalizedDocument.created_at,
      entityId:
        normalizedDocument.id != null ? String(normalizedDocument.id) : undefined,
      entityType: 'document',
      cantiereId: normalizedDocument.cantiere_id || normalizedDocument.cantiere,
      metadata: {
        raw: document,
      },
    }
  })
}
