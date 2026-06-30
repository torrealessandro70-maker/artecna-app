import { createReportSource } from '../sources'
import { createRuntimeFeedItem, createRuntimeFeedSnapshot } from './feed-builder'
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
  const reportSources = createReportSource(reports)

  const items = reportSources.map((reportSource) =>
    createRuntimeFeedItem({
      id: `report-${reportSource.id}`,
      timestamp: reportSource.timestamp,
      title: 'Rapportino cantiere registrato',
      description:
        reportSource.description || 'Nuovo rapportino collegato al Fascicolo Cantiere.',
      category: 'workflow',
      severity: 'success',
      source: 'user',
      priority: 2,
      metadata: {
        ...reportSource.metadata,
        sourceId: reportSource.sourceId,
        sourceKind: reportSource.kind,
      },
    }),
  )

  return createRuntimeFeedSnapshot(items)
}
