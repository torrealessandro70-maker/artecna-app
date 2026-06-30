export type RuntimeFeedSeverity =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type RuntimeFeedCategory =
  | 'runtime'
  | 'workflow'
  | 'decision'
  | 'action'
  | 'context'
  | 'photo'
  | 'document'
  | 'material'
  | 'worker'
  | 'ai'
  | 'review'
  | 'system'

export type RuntimeFeedSource =
  | 'runtime'
  | 'context-engine'
  | 'workflow-engine'
  | 'decision-engine'
  | 'action-engine'
  | 'review-engine'
  | 'document-intelligence'
  | 'construction-knowledge'
  | 'user'

export interface RuntimeFeedItem {
  id: string

  timestamp: Date

  title: string

  description?: string

  category: RuntimeFeedCategory

  severity: RuntimeFeedSeverity

  source: RuntimeFeedSource

  priority?: 1 | 2 | 3 | 4 | 5

  metadata?: Record<string, unknown>
}
