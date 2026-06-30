import type { RuntimeSourceRecord } from './types'

type ReportInput = {
  id?: string
  cantiere?: string
  data?: string
  note?: string
  created_at?: string
}

export function createReportSource(
  reports: ReportInput[] = [],
): RuntimeSourceRecord[] {
  return reports.map((report, index) => {
    const timestampValue = report.data || report.created_at

    return {
      id: report.id || `report-${index}`,
      kind: 'report',
      title: 'Rapportino cantiere',
      description: report.note,
      timestamp: timestampValue ? new Date(timestampValue) : new Date(),
      sourceId: report.cantiere,
      metadata: {
        reportId: report.id,
      },
    }
  })
}
