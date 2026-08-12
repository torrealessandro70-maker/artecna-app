export type PreventivoQualityLevel =
  | 'excellent'
  | 'good'
  | 'review'
  | 'weak'
  | 'critical'

export type PreventivoQualitySummary = {
  perfect: number
  reliable: number
  review: number
  weak: number
  none: number
  total: number
  reviewNeeded: number
  score: number
  level: PreventivoQualityLevel
  label: string
}
