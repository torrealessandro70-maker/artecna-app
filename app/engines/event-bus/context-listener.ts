import type { RuntimeEvent } from './types'
import { buildConstructionContext } from '../context'

export function handleContextEvent(
  event: RuntimeEvent
): void {
  if (event.type !== 'photo_added') {
    return
  }

  buildConstructionContext({
    cantiereId:
      typeof event.payload?.cantiereId === 'string'
        ? event.payload.cantiereId
        : '',
    timeline: [],
  })
}