import { eventAdapterRegistry } from './registry'
import type {
  ConstructionEvent,
  ConstructionEventSource,
  EventBuilderInput,
  TimelineEvent,
} from './types'

const SOURCE_ICONS: Record<ConstructionEventSource, string> = {
  photo: '📸',
  daily_report: '📝',
  document: '📄',
  sal: '📊',
  economy: '💰',
  worker: '👷',
  ai: '🤖',
  system: '⚙️',
}

function getSourceIcon(source: ConstructionEventSource): string {
  return SOURCE_ICONS[source] || SOURCE_ICONS.system
}

function getEventDate(event: ConstructionEvent): string {
  return event.occurredAt || event.createdAt || ''
}

function compareEventsByDateDesc(a: TimelineEvent, b: TimelineEvent): number {
  const dateA = new Date(a.date).getTime()
  const dateB = new Date(b.date).getTime()

  return (Number.isNaN(dateB) ? 0 : dateB) - (Number.isNaN(dateA) ? 0 : dateA)
}

export function buildTimelineEventsFromConstructionEvents(
  events: ConstructionEvent[]
): TimelineEvent[] {
  return events
    .map((event) => ({
      id: event.id,
      source: event.source,
      icon: getSourceIcon(event.source),
      title: event.title,
      description: event.description || '',
      date: getEventDate(event),
    }))
    .sort(compareEventsByDateDesc)
}

export function buildTimelineEvents(input: EventBuilderInput): TimelineEvent[] {
  const constructionEvents = eventAdapterRegistry.flatMap((adapter) =>
    adapter.build(input)
  )

  return buildTimelineEventsFromConstructionEvents(constructionEvents)
}
