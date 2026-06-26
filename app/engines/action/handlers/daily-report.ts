import type { ActionHandler } from '../types'

export const dailyReportActionHandler: ActionHandler = {
  type: 'open_daily_report',
  handle: () => ({
    success: false,
    executed: false,
    reason: 'Handler non ancora operativo',
  }),
}
