import type { RuntimeEvent } from './types'
import { handleContextEvent } from './context-listener'
export type RuntimeEventListener = (
  event: RuntimeEvent
) => void

const listeners: RuntimeEventListener[] = []

export function registerListener(
  listener: RuntimeEventListener
): void {
  listeners.push(listener)
}

export function dispatchEvent(
  event: RuntimeEvent
): void {
  handleContextEvent(event)

  listeners.forEach((listener) => listener(event))
}