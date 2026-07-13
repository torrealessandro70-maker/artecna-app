import type { DocumentInsights } from './types'

export type DocumentActionId =
  | 'open-preventivo-ai'
  | 'register-preventivo'
  | 'register-fattura-fornitore'
  | 'connect-sal'
  | 'archive-fascicolo'

export type DocumentSuggestedAction = {
  id: DocumentActionId
  title: string
  description: string
  primary: boolean
}

export const buildDocumentSuggestedActions = (
  insights: Pick<DocumentInsights, 'destination'>,
): DocumentSuggestedAction[] => {
  const destination = insights.destination?.suggested
  const actions: DocumentSuggestedAction[] = []

  if (destination === 'preventivo_ai') {
    actions.push({
      id: 'open-preventivo-ai',
      title: 'Apri nel Preventivo AI',
      description: 'Genera una revisione del documento nel Preventivo Engine.',
      primary: true,
    })
  }

  if (destination === 'preventivo_ufficiale') {
    actions.push({
      id: 'register-preventivo',
      title: 'Registra nel Registro Preventivi',
      description: 'Salva il documento come preventivo ufficiale del cantiere.',
      primary: true,
    })
  }

  if (destination === 'fattura_fornitore') {
    actions.push({
      id: 'register-fattura-fornitore',
      title: 'Registra come fattura fornitore',
      description: 'Collega il documento ai costi del cantiere.',
      primary: true,
    })
  }

  if (destination === 'sal') {
    actions.push({
      id: 'connect-sal',
      title: 'Collega allo Stato Avanzamento Lavori',
      description: 'Usa il documento come riferimento SAL.',
      primary: true,
    })
  }

  actions.push({
    id: 'archive-fascicolo',
    title: 'Archivia nel Fascicolo',
    description: 'Conserva il documento nel fascicolo del cantiere.',
    primary: actions.length === 0,
  })

  return actions
}