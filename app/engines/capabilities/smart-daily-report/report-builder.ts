import type { ReviewResult } from '../../review'
import type { DailyReport } from './types'

export function buildSmartDailyReport(review: ReviewResult): DailyReport {
  return {
    id: `daily-report-${review.id}`,
    createdAt: review.createdAt,
    reportDate: review.createdAt.slice(0, 10),
    title: review.title,
    summary: review.summary,
    workers: review.operai,
    materials: review.materiali,
    activities: review.attivita,
    operations: review.lavorazioni,
    issues: review.problemi,
    suggestedPhotos: review.foto,
    review,
    confidence: review.confidence,
    needsConfirmation: true,
  }
}
