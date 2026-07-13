import type { RuntimeEvent } from '../../engines/event-bus'
import type { RuntimeFeedItem } from './types'
import { createRuntimeFeedItem } from './feed-builder'

export function createRuntimeFeedItemFromEvent(
  event: RuntimeEvent,
): RuntimeFeedItem {
  switch (event.type) {
    case 'photo_added':
      return createRuntimeFeedItem({
        id: `feed-${event.id}`,
        timestamp: new Date(event.occurredAt),
        title: 'Foto acquisita',
        description: 'Una nuova foto e stata collegata al fascicolo del cantiere.',
        category: 'photo',
        severity: 'success',
        source: 'user',
        priority: 2,
        metadata: event.payload,
      })

    default:
      return createRuntimeFeedItem({
        id: `feed-${event.id}`,
        timestamp: new Date(event.occurredAt),
        title: 'Evento Runtime ricevuto',
        description: `Evento ${event.type} registrato dal Runtime.`,
        category: 'runtime',
        severity: 'info',
        source: 'runtime',
        priority: 1,
        metadata: event.payload,
      })
  }
}
