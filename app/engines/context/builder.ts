import type {
  BuildConstructionContextInput,
  ConstructionContext,
  ContextAlert,
  ContextSuggestion,
  ContextStatistics,
} from './types'

function buildStatistics(timeline: BuildConstructionContextInput['timeline']): ContextStatistics {
  return timeline.reduce<ContextStatistics>(
    (statistics, event) => {
      if (event.source === 'photo') {
        statistics.photos += 1
      }

      if (event.source === 'daily_report') {
        statistics.reports += 1
      }

      if (event.source === 'document') {
        statistics.documents += 1
      }

      return statistics
    },
    {
      photos: 0,
      reports: 0,
      documents: 0,
      sal: 0,
      workers: 0,
    }
  )
}

function hasEventToday(
  timeline: BuildConstructionContextInput['timeline'],
  source: string
) {
  const today = new Date().toISOString().slice(0, 10)

  return timeline.some(
    (event) => event.source === source && String(event.date || '').slice(0, 10) === today
  )
}

function buildAlerts(
  timeline: BuildConstructionContextInput['timeline'],
  statistics: ContextStatistics
): ContextAlert[] {
  const alerts: ContextAlert[] = []

  if (timeline.length === 0) {
    alerts.push({
      id: 'no-recent-activity',
      type: 'no_recent_activity',
      severity: 'info',
      title: 'Nessuna attivita recente',
      description: 'Il Fascicolo non contiene ancora eventi normalizzati.',
    })
  }

  if (!hasEventToday(timeline, 'daily_report')) {
    alerts.push({
      id: 'no-daily-report-today',
      type: 'no_daily_report_today',
      severity: 'warning',
      title: 'Nessun rapportino oggi',
      description: 'Non risultano rapportini registrati nella giornata corrente.',
    })
  }

  if (statistics.documents === 0) {
    alerts.push({
      id: 'no-documents',
      type: 'no_documents',
      severity: 'warning',
      title: 'Documentazione non presente',
      description: 'Non risultano documenti collegati al Fascicolo.',
    })
  }

  if (statistics.photos === 0) {
    alerts.push({
      id: 'no-photos',
      type: 'no_photos',
      severity: 'info',
      title: 'Nessuna foto disponibile',
      description: 'Non risultano foto collegate al Fascicolo.',
    })
  }

  return alerts
}

function buildSuggestions(
  timeline: BuildConstructionContextInput['timeline'],
  statistics: ContextStatistics
): ContextSuggestion[] {
  const suggestions: ContextSuggestion[] = []

  if (statistics.reports === 0) {
    suggestions.push({
      id: 'create-report',
      type: 'create_report',
      title: 'Registra il rapportino giornaliero',
      description: 'Non risultano rapportini per questo cantiere.',
    })
  }

  if (statistics.documents === 0) {
    suggestions.push({
      id: 'upload-document',
      type: 'upload_document',
      title: 'Carica il primo documento',
      description: 'Il fascicolo è ancora privo di documentazione.',
    })
  }

  if (timeline.length === 0) {
    suggestions.push({
      id: 'start-activity',
      type: 'start_activity',
      title: 'Inizia a registrare le attività',
      description: 'Il cantiere non contiene ancora eventi.',
    })
  }

  return suggestions
}

export function buildConstructionContext(
  input: BuildConstructionContextInput
): ConstructionContext {
  const statistics = buildStatistics(input.timeline)

  return {
    cantiereId: input.cantiereId,
    timeline: input.timeline,
    lastActivity: input.timeline[0],
    statistics,
    alerts: buildAlerts(input.timeline, statistics),
    suggestions: buildSuggestions(input.timeline, statistics),
    lastUpdated: new Date(),
  }
}
