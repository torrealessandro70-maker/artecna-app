import type { TimelineEvent } from '../event'

export type ContextStatistics = {
  photos: number
  reports: number
  documents: number
  sal: number
  workers: number
}

export type ContextAlert = {
  id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description?: string
}

export type ContextSuggestion = {
  id: string
  type: string
  title: string
  description?: string
}

export type ConstructionContext = {
  cantiereId: string
  timeline: TimelineEvent[]
  lastActivity?: TimelineEvent
  statistics: ContextStatistics
  alerts: ContextAlert[]
  suggestions: ContextSuggestion[]
  lastUpdated: Date
}

export type BuildConstructionContextInput = {
  cantiereId: string
  timeline: TimelineEvent[]
}
