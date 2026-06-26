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

export type WorkflowResult = {
  id: string
  name: string
  description: string
  summary?: string
  input: WorkflowInput
  steps: WorkflowStep[]
  executesActions: false
  needsUserConfirmation: true
  pipeline?: {
    event?: {
      status: 'pending'
    }
    context?: {
      status: 'pending'
    }
    decision?: {
      status: 'pending'
    }
    action?: {
      status: 'pending'
    }
  }
  metadata?: {
    workflowType: string
    version: string
    generatedAt: string
  }
}
