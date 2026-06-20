export type EngineName =
  | 'document_intelligence'
  | 'fascicle'
  | 'knowledge'
  | 'workflow'
  | 'blueprint'
  | 'ai_assistant'
  | 'decision'
  | 'communication'
  | 'time'
  | 'analytics'
  | 'identity'

export type EngineContext = {
  correlationId: string
  requestedAt: string
  actorId?: string
  fascicleId?: string
  metadata?: Record<string, string | number | boolean | null>
}

export type EngineRequest<TPayload = unknown> = {
  id: string
  engine: EngineName
  action: string
  payload: TPayload
  context: EngineContext
}

export type EngineEvent<TPayload = unknown> = {
  id: string
  engine: EngineName
  type: string
  occurredAt: string
  payload?: TPayload
}

export type EngineResponse<TData = unknown> = {
  requestId: string
  engine: EngineName
  success: boolean
  data: TData | null
  events: EngineEvent[]
  errors: string[]
}
