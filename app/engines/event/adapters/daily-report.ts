import type { ConstructionEvent } from '../types'

export type DailyReportEventInput = {
  id?: string | number
  cantiere_id?: string
  cantiere?: string
  data?: string
  data_rapportino?: string
  created_at?: string
  note?: string
  nota?: string
  [key: string]: unknown
}

function resolveDailyReportDate(rapportino: DailyReportEventInput): string {
  return rapportino.data || rapportino.data_rapportino || rapportino.created_at || new Date().toISOString()
}

export function buildDailyReportEvents(rapportini: DailyReportEventInput[]): ConstructionEvent[] {
  return rapportini.map((rapportino, index) => ({
    id: `daily-report-${rapportino.id ?? index}`,
    source: 'daily_report',
    type: 'daily_report_created',
    title: 'Rapportino',
    description: 'Rapportino registrato',
    occurredAt: resolveDailyReportDate(rapportino),
    createdAt: rapportino.created_at,
    entityId: rapportino.id != null ? String(rapportino.id) : undefined,
    entityType: 'daily_report',
    cantiereId: rapportino.cantiere_id || rapportino.cantiere,
    metadata: {
      nota: rapportino.nota,
      note: rapportino.note,
      raw: rapportino,
    },
  }))
}
