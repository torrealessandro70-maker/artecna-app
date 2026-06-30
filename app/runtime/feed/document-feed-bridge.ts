import { runtimeEventFactory } from '../events'
import { createDocumentSource } from '../sources'
import type { RuntimeFeedItem } from './types'

type RuntimeDocumentCountInput = {
  count?: number
  cantiere?: string
  updatedAt?: string
}

export function createDocumentRuntimeFeed(
  input: RuntimeDocumentCountInput = {},
): RuntimeFeedItem[] {
  const sources = createDocumentSource(input)

  return runtimeEventFactory.createFeed({ sources })
}
