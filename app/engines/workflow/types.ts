export type WorkflowStep = {
  id: string
  title: string
  description: string
  engine?: 'event' | 'context' | 'decision' | 'action' | 'ui'
  status: 'described' | 'waiting_user_confirmation'
  metadata?: Readonly<Record<string, unknown>>
}

export type WorkflowInput = {
  type: 'photo'
  entityId?: string
  cantiereId?: string
  cantiereName?: string | null
  photoCount?: number
  lastActivityTitle?: string
  occurredAt?: string
  metadata?: Readonly<Record<string, unknown>>
}

export type WorkflowPipelineStatus =
  | 'pending'
  | 'completed'
  | 'skipped'
  | 'failed'

export type WorkflowPipeline = {
  event?: { status: WorkflowPipelineStatus }
  context?: { status: WorkflowPipelineStatus }
  decision?: { status: WorkflowPipelineStatus }
  action?: { status: WorkflowPipelineStatus }
}
export type WorkflowState =
  | 'created'
  | 'running'
  | 'waiting_user'
  | 'completed'
export type WorkflowResult = {
  id: string
  name: string
  description: string
  summary?: string
state: WorkflowState
  input: WorkflowInput
  steps: WorkflowStep[]

  executesActions: false
  needsUserConfirmation: true

  pipeline?: WorkflowPipeline

  metadata?: {
    workflowType: string
    version: string
    generatedAt: string
  }
}