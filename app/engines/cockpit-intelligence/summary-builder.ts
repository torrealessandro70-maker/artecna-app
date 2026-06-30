import type { CockpitSummary, CockpitSummaryInput } from './types'

export function buildCockpitSummary(input: CockpitSummaryInput): CockpitSummary {
  const feedItems = input.feedItems ?? []
  const lastItem = feedItems[0]

  const titles = feedItems.map((item) => item.title)

  const attentionItems = titles.filter((title) => {
    const normalizedTitle = title.toLowerCase()

    return (
      normalizedTitle.includes('errore') ||
      normalizedTitle.includes('attenzione') ||
      normalizedTitle.includes('warning') ||
      normalizedTitle.includes('critic')
    )
  })

  const hasAttention = attentionItems.length > 0

  return {
    level: hasAttention ? 'attention' : 'stable',
    title: hasAttention ? 'Situazione da verificare' : 'Situazione stabile',
    situation: lastItem
      ? `Ultimo aggiornamento: ${lastItem.title}`
      : 'Nessun evento recente rilevato dal Runtime.',
    recentFacts: titles.slice(0, 3),
    attention: hasAttention ? attentionItems.slice(0, 3) : ['Nessuna criticità rilevata.'],
    suggestions: hasAttention
      ? ['Verificare gli eventi che richiedono attenzione nel Runtime Feed.']
      : ['Continuare a monitorare il cantiere dal Cockpit.'],
    nextAction: hasAttention
      ? 'Aprire il Runtime Feed e verificare gli eventi segnalati.'
      : 'Proseguire con il controllo operativo del cantiere.',
    generatedAt: new Date().toISOString(),
    sourceEventCount: feedItems.length,
  }
}
