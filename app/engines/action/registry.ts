import type { ActionHandler } from './types'
import {
  activityNoteActionHandler,
  dailyReportActionHandler,
  documentUploadActionHandler,
} from './handlers'

export const actionHandlerRegistry: ActionHandler[] = [
  dailyReportActionHandler,
  documentUploadActionHandler,
  activityNoteActionHandler,
]
