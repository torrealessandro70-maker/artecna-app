import { createRuntimeFeedItem, createRuntimeFeedSnapshot } from '../feed'
import type { RuntimeFeedCategory, RuntimeFeedItem } from '../feed'
import type { RuntimeSourceKind } from '../sources'
import type {
  RuntimeEventFactory,
  RuntimeEventFactoryInput,
} from './types'

function mapSourceKindToFeedCategory(
  kind: RuntimeSourceKind,
): RuntimeFeedCategory {
  switch (kind) {
    case 'photo':
      return 'photo'
    case 'report':
      return 'workflow'
    case 'document':
      return 'document'
    case 'economy':
      return 'material'
    case 'worker':
      return 'worker'
    case 'activity':
      return 'workflow'
    default:
      return 'system'
  }
}

export const runtimeEventFactory: RuntimeEventFactory = {
  createFeed(input: RuntimeEventFactoryInput): RuntimeFeedItem[] {
    const items = input.sources.map((source) =>
      createRuntimeFeedItem({
        id: `${source.kind}-${source.id}`,
        timestamp: source.timestamp,
        title: source.title,
        description: source.description,
        category: mapSourceKindToFeedCategory(source.kind),
        severity: 'success',
        source: 'user',
        priority: 2,
        metadata: {
          ...source.metadata,
          sourceKind: source.kind,
          sourceId: source.sourceId,
        },
      }),
    )

    return createRuntimeFeedSnapshot(items)
  },
}
