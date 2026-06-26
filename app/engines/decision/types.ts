export type DecisionProposalType =
  | 'create_estimate'
  | 'create_task'
  | 'link_to_site_file'
  | 'create_issue'
  | 'request_user_review'

export type DecisionProposalStatus =
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'executed'

export type DecisionProposalSource =
  | 'note'
  | 'sopralluogo'
  | 'rapportino'
  | 'semantic'
  | 'context'
  | 'manual'
  | 'unknown'

export type DecisionProposal = {
  id: string
  type: DecisionProposalType
  title: string
  description?: string
  status: DecisionProposalStatus
  source: DecisionProposalSource
  confidence: number
  action?: {
    type: string
    label: string
    target?: string
  }
  payload?: Readonly<Record<string, unknown>>
}

export type DecisionPlan = {
  id: string
  createdAt: string
  summary: string
  proposals: DecisionProposal[]
  needsUserConfirmation: boolean
}

export type DecisionContext = {
  text?: string
  source?: DecisionProposalSource
  objective?: string
  constraints?: readonly string[]
  metadata?: Readonly<Record<string, unknown>>
}
