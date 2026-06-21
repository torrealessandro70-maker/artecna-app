export type ReviewItemStatus =
  | 'proposed'
  | 'confirmed'
  | 'rejected'
  | 'needs_review'

export type ReviewItemSource =
  | 'parser'
  | 'semantic'
  | 'context'
  | 'kernel'
  | 'manual'
  | 'unknown'

export type ReviewItem = {
  id: string
  label: string
  status: ReviewItemStatus
  source: ReviewItemSource
  confidence: number
}

export type ReviewResult = {
  id: string
  createdAt: string
  title: string
  summary: string
  operai: ReviewItem[]
  materiali: ReviewItem[]
  attivita: ReviewItem[]
  lavorazioni: ReviewItem[]
  problemi: ReviewItem[]
  documenti: ReviewItem[]
  foto: ReviewItem[]
  confidence: number
  needsUserConfirmation: boolean
}
