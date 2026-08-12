export type ConfidenceLevel =
  | 'perfect'
  | 'reliable'
  | 'review'
  | 'weak'
  | 'none'

export type ConfidenceBadge = {
  level: ConfidenceLevel
  icon: string
  label: string
  color: string
  description: string
  reviewNeeded: boolean
}
