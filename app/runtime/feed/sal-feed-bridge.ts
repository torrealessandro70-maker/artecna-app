import { runtimeEventFactory } from '../events'
import { createSalSource } from '../sources'
import type { RuntimeFeedItem } from './types'

type RuntimeSalCountInput = {
  count?: number
  cantiere?: string
  updatedAt?: string
}

export function createSalRuntimeFeed(
  input: RuntimeSalCountInput = {},
): RuntimeFeedItem[] {
  const sources = createSalSource(input)

  return runtimeEventFactory.createFeed({ sources })
}
