import { createDocumentSource } from '../sources'
import { createRuntimeFeedItem, createRuntimeFeedSnapshot } from './feed-builder'
import type { RuntimeFeedItem } from './types'

type RuntimeDocumentCountInput = {
  count?: number
  cantiere?: string
  updatedAt?: string
}

export function createDocumentRuntimeFeed(
  input: RuntimeDocumentCountInput = {},
): RuntimeFeedItem[] {
  const documentSources = createDocumentSource(input)

  const items = documentSources.map((documentSource) =>
    createRuntimeFeedItem({
      id: `document-${documentSource.id}`,
      timestamp: documentSource.timestamp,
      title: 'Documenti cantiere collegati',
      description:
        documentSource.description || 'Documenti collegati al Fascicolo Cantiere.',
      category: 'document',
      severity: 'success',
      source: 'user',
      priority: 2,
      metadata: {
        ...documentSource.metadata,
        sourceId: documentSource.sourceId,
        sourceKind: documentSource.kind,
      },
    }),
  )

  return createRuntimeFeedSnapshot(items)
}
