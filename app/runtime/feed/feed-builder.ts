import type { RuntimeFeedItem } from './types'

export interface CreateRuntimeFeedItemInput {
  id: string
  timestamp?: Date
  title: string
  description?: string
  category: RuntimeFeedItem['category']
  severity?: RuntimeFeedItem['severity']
  source: RuntimeFeedItem['source']
  priority?: RuntimeFeedItem['priority']
  metadata?: RuntimeFeedItem['metadata']
}

export function createRuntimeFeedItem(
  input: CreateRuntimeFeedItemInput,
): RuntimeFeedItem {
  return {
    id: input.id,
    timestamp: input.timestamp ?? new Date(),
    title: input.title,
    description: input.description,
    category: input.category,
    severity: input.severity ?? 'info',
    source: input.source,
    priority: input.priority,
    metadata: input.metadata,
  }
}

export function createRuntimeFeedSnapshot(
  items: RuntimeFeedItem[],
): RuntimeFeedItem[] {
  return [...items].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  )
}
