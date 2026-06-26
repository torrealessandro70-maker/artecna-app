import {
  buildDailyReportEvents,
  type DailyReportEventInput,
} from './adapters/daily-report'
import { buildDocumentEvents } from './adapters/document'
import { buildPhotoEvents, type PhotoEventInput } from './adapters/photo'
import type { EventAdapter } from './types'

export const eventAdapterRegistry: EventAdapter[] = [
  {
    source: 'photo',
    build: (input) => buildPhotoEvents((input.photos || []) as PhotoEventInput[]),
  },
  {
    source: 'daily_report',
    build: (input) =>
      buildDailyReportEvents(
        (input.dailyReports || []) as DailyReportEventInput[]
      ),
  },
  {
    source: 'document',
    build: (input) => buildDocumentEvents(input.documents),
  },
]
