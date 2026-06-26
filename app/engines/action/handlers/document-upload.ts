import type { ActionHandler } from '../types'

export const documentUploadActionHandler: ActionHandler = {
  type: 'open_document_upload',
  handle: () => ({
    success: false,
    executed: false,
    reason: 'Handler non ancora operativo',
  }),
}
