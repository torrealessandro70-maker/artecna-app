import type { RuntimeEvent } from './types'
import { dispatchEvent } from './listeners'
import { updateRuntimeState } from '../runtime'

export function publishEvent(
  event: RuntimeEvent
): RuntimeEvent {
  updateRuntimeState('event_received')

  dispatchEvent(event)

  return event
}