export type ConstructionEventSource =
  | 'photo'
  | 'daily_report'
  | 'document'
  | 'sal'
  | 'economy'
  | 'worker'
  | 'ai'
  | 'system'

export type ConstructionEvent = {
  id: string
  source: ConstructionEventSource
  type: string
  title: string
  description?: string
  occurredAt: string
  createdAt?: string
  entityId?: string
  entityType?: string
  cantiereId?: string
  metadata?: Record<string, unknown>
}

export type TimelineEvent = {
  id: string
  source: ConstructionEventSource
  icon: string
  title: string
  description: string
  date: string
}

export type EventBuilderInput = {
  photos?: unknown[]
  dailyReports?: unknown[]
  documents?: unknown[]
}

export type EventAdapter = {
  source: ConstructionEvent['source']
  build: (input: EventBuilderInput) => ConstructionEvent[]
}
