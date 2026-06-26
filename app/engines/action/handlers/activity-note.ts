import type { ActionHandler } from '../types'

export const activityNoteActionHandler: ActionHandler = {
  type: 'open_activity_note',
  handle: () => ({
    success: false,
    executed: false,
    reason: 'Handler non ancora operativo',
  }),
}
