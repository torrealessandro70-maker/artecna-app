import type { CockpitSummary, CockpitSummaryInput } from './types'

export function buildCockpitSummary(input: CockpitSummaryInput): CockpitSummary {
  const feedItems = input.feedItems ?? []
  const lastItem = feedItems[0]

  const titles = feedItems.map((item) => item.title)
  const photoCount = feedItems.filter((item) => item.category === 'photo').length
  const reportCount = feedItems.filter(
    (item) => item.metadata?.sourceKind === 'report',
  ).length
const documentCount = feedItems.filter(
  (item) => item.metadata?.sourceKind === 'document',
).length
  const attentionItems = feedItems.filter(
    (item) => item.severity === 'warning' || item.severity === 'error',
  )

  const hasAttention = attentionItems.length > 0

const situationParts = [
  photoCount > 0 ? `${photoCount} foto acquisite` : null,
  reportCount > 0 ? `${reportCount} rapportini registrati` : null,
  documentCount > 0 ? `${documentCount} gruppi documenti collegati` : null,
].filter(Boolean)
  return {
    level: hasAttention ? 'attention' : 'stable',
    title: hasAttention ? 'Situazione da verificare' : 'Situazione stabile',
    situation:
      situationParts.length > 0
        ? `Il Fascicolo contiene ${situationParts.join(' e ')}. Ultimo aggiornamento: ${
            lastItem?.title || 'nessun aggiornamento recente'
          }.`
        : lastItem
          ? `Ultimo aggiornamento: ${lastItem.title}`
          : 'Nessun evento recente rilevato dal Runtime.',
    recentFacts: titles.slice(0, 3),
    attention: hasAttention
      ? attentionItems.slice(0, 3).map((item) => item.title)
      : ['Nessuna criticità rilevata.'],
    suggestions:
      photoCount > 0 || reportCount > 0 || documentCount > 0
        ? ['Verificare il materiale recente collegato al Fascicolo Cantiere.']
        : ['Continuare a monitorare il cantiere dal Cockpit.'],
    nextAction:
      photoCount > 0 || reportCount > 0
        ? 'Controllare foto e rapportini più recenti.'
        : 'Proseguire con il controllo operativo del cantiere.',
    generatedAt: new Date().toISOString(),
    sourceEventCount: feedItems.length,
  }
}
