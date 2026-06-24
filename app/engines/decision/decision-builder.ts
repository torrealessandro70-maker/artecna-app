import type {
  DecisionContext,
  DecisionPlan,
  DecisionProposal,
  DecisionProposalSource,
} from './types'

const createDecisionId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const normalizzaTesto = (testo?: string) =>
  String(testo || '').toLowerCase()

const contiene = (testo: string, parole: string[]) =>
  parole.some((parola) => testo.includes(parola))

const creaProposta = (
  type: DecisionProposal['type'],
  title: string,
  description: string,
  source: DecisionProposalSource,
  confidence: number,
  payload?: Readonly<Record<string, unknown>>
): DecisionProposal => ({
  id: createDecisionId('decision'),
  type,
  title,
  description,
  status: 'proposed',
  source,
  confidence,
  payload,
})

export class DecisionBuilder {
  build(context: DecisionContext): DecisionPlan {
    const testo = normalizzaTesto(context.text)
    const source = context.source || 'unknown'
    const proposals: DecisionProposal[] = []

    const parlaDiDanno =
      contiene(testo, [
        'marcio',
        'marcita',
        'rotto',
        'rotta',
        'caduto',
        'crollato',
        'staccato',
        'fessura',
        'crepa',
        'umidità',
        'infiltrazione',
      ])

    const parlaDiPreventivo =
      contiene(testo, [
        'preventivo',
        'prezzo',
        'computo',
        'costo',
        'quantificare',
        'misura',
        'ml',
        'mq',
        'cm',
      ])

    const parlaDiVerifica =
      contiene(testo, [
        'verificare',
        'controllare',
        'rilievo',
        'misurare',
        'ancorato',
        'muro',
        'sezione',
      ])

    if (parlaDiDanno || parlaDiPreventivo) {
      proposals.push(
        creaProposta(
          'create_estimate',
          'Creare bozza preventivo',
          'Il testo contiene elementi che possono generare una bozza di preventivo o computo.',
          source,
          0.86,
          { text: context.text }
        )
      )
    }

    if (parlaDiVerifica || parlaDiDanno) {
      proposals.push(
        creaProposta(
          'create_task',
          'Creare attività di verifica',
          'Il testo indica una verifica tecnica da programmare o completare.',
          source,
          0.82,
          { text: context.text }
        )
      )
    }

    if (parlaDiDanno) {
      proposals.push(
        creaProposta(
          'create_issue',
          'Registrare problema nel fascicolo',
          'Il testo descrive un problema o difetto da collegare al fascicolo del cantiere.',
          source,
          0.88,
          { text: context.text }
        )
      )
    }

    if (testo.trim().length > 0) {
      proposals.push(
        creaProposta(
          'link_to_site_file',
          'Collegare la nota al fascicolo',
          'La nota può essere archiviata nel fascicolo del cantiere per mantenere traccia dell’osservazione.',
          source,
          0.75,
          { text: context.text }
        )
      )
    }

    return {
      id: createDecisionId('plan'),
      createdAt: new Date().toISOString(),
      summary:
        proposals.length > 0
          ? 'Decision Engine V1 ha generato proposte da confermare.'
          : 'Decision Engine V1 non ha individuato azioni da proporre.',
      proposals,
      needsUserConfirmation: proposals.length > 0,
    }
  }
}