import { createSalSource } from '../sources'
import { createRuntimeFeedItem, createRuntimeFeedSnapshot } from './feed-builder'
import type { RuntimeFeedItem } from './types'

type RuntimeSalCountInput = {
  count?: number
  cantiere?: string
  updatedAt?: string
}

export function createSalRuntimeFeed(
  input: RuntimeSalCountInput = {},
): RuntimeFeedItem[] {
  const salSources = createSalSource(input)

  const items = salSources.map((salSource) =>
    createRuntimeFeedItem({
      id: `sal-${salSource.id}`,
      timestamp: salSource.timestamp,
      title: 'SAL cantiere collegati',
      description:
        salSource.description || 'Stati Avanzamento Lavori collegati al Fascicolo Cantiere.',
      category: 'workflow',
      severity: 'success',
      source: 'user',
      priority: 2,
      metadata: {
        ...salSource.metadata,
        sourceId: salSource.sourceId,
        sourceKind: 'sal',
      },
    }),
  )

  return createRuntimeFeedSnapshot(items)
}
