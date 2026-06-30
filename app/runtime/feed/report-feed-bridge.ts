import { runtimeEventFactory } from '../events'
import { createReportSource } from '../sources'
import type { RuntimeFeedItem } from './types'

type RuntimeReportInput = {
  id?: string
  cantiere?: string
  data?: string
  note?: string
  created_at?: string
}

export function createReportRuntimeFeed(
  reports: RuntimeReportInput[] = [],
): RuntimeFeedItem[] {
  const sources = createReportSource(reports)

  return runtimeEventFactory.createFeed({ sources })
}
