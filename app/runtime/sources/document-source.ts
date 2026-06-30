import type { RuntimeSourceRecord } from './types'

type DocumentCountInput = {
  count?: number
  cantiere?: string
  updatedAt?: string
}

export function createDocumentSource(
  input: DocumentCountInput = {},
): RuntimeSourceRecord[] {
  const count = input.count ?? 0

  if (count <= 0) {
    return []
  }

  return [
    {
      id: `documents-${input.cantiere || 'cantiere'}`,
      kind: 'document',
      title: 'Documenti cantiere',
      description: `${count} documenti collegati al Fascicolo Cantiere.`,
      timestamp: input.updatedAt ? new Date(input.updatedAt) : new Date(),
      sourceId: input.cantiere,
      metadata: {
        documentCount: count,
      },
    },
  ]
}
