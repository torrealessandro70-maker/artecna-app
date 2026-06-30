import type { RuntimeSourceRecord } from '../sources'
import type { RuntimeFeedItem } from '../feed'

export interface RuntimeEventFactoryInput {
  sources: RuntimeSourceRecord[]
}

export interface RuntimeEventFactory {
  createFeed(input: RuntimeEventFactoryInput): RuntimeFeedItem[]
}
