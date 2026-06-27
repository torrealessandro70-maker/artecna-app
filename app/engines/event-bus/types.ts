export type RuntimeEventType =
  | 'photo_added'

export type RuntimeEvent = {
  id: string
  type: RuntimeEventType
  occurredAt: string
  payload?: Readonly<Record<string, unknown>>
}