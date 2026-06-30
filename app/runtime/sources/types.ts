export type RuntimeSourceKind =
  | 'photo'
  | 'report'
  | 'document'
  | 'economy'
  | 'worker'
  | 'activity'

export type RuntimeSourceRecord = {
  id: string
  kind: RuntimeSourceKind
  title: string
  description?: string
  timestamp: Date
  sourceId?: string
  metadata?: Record<string, unknown>
}
