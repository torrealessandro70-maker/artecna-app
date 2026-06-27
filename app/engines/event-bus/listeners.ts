import type { RuntimeEvent } from './types'

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
  listeners.forEach((listener) => listener(event))
}