import type { RuntimeEvent } from './types'
import { dispatchEvent } from './listeners'

export function publishEvent(
  event: RuntimeEvent
): RuntimeEvent {
  dispatchEvent(event)

  return event
}