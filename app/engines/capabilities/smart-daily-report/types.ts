import type { ReviewItem, ReviewResult } from '../../review'

export type DailyReport = {
  id: string
  createdAt: string
  reportDate: string
  title: string
  summary: string
  workers: ReviewItem[]
  materials: ReviewItem[]
  activities: ReviewItem[]
  operations: ReviewItem[]
  issues: ReviewItem[]
  suggestedPhotos: ReviewItem[]
  review: ReviewResult
  confidence: number
  needsConfirmation: boolean
}
