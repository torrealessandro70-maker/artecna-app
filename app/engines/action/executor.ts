import type { ActionRequest, ActionResult } from './types'
import { actionHandlerRegistry } from './registry'

export function executeAction(
  action: ActionRequest
): Promise<ActionResult> | ActionResult {
  const handler = actionHandlerRegistry.find(
    (registeredHandler) => registeredHandler.type === action.type
  )

  if (!handler) {
    return {
      success: false,
      executed: false,
      reason: 'Nessun handler registrato per questa azione',
      metadata: {
        actionType: action.type,
      },
    }
  }

  return handler.handle(action)
}
