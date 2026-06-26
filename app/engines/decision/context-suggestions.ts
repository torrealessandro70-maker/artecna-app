import type { DecisionPlan, DecisionProposal } from './types'

type ContextSuggestionInput = {
  id: string
  type: string
  title: string
  description?: string
}

const createDecisionId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function mapSuggestionToDecisionProposal(
  suggestion: ContextSuggestionInput
): DecisionProposal | null {
  if (suggestion.type === 'create_report') {
    return {
      id: `decision-${suggestion.id}`,
      type: 'create_task',
      title: 'Creare rapportino',
      description: suggestion.description,
      status: 'proposed',
      source: 'context',
      confidence: 0.8,
      action: {
        type: 'open_daily_report',
        label: 'Apri rapportino',
      },
      payload: {
        suggestion,
      },
    }
  }

  if (suggestion.type === 'upload_document') {
    return {
      id: `decision-${suggestion.id}`,
      type: 'link_to_site_file',
      title: 'Caricare documento',
      description: suggestion.description,
      status: 'proposed',
      source: 'context',
      confidence: 0.8,
      action: {
        type: 'open_document_upload',
        label: 'Carica documento',
      },
      payload: {
        suggestion,
      },
    }
  }

  if (suggestion.type === 'start_activity') {
    return {
      id: `decision-${suggestion.id}`,
      type: 'create_task',
      title: 'Registrare prima attività',
      description: suggestion.description,
      status: 'proposed',
      source: 'context',
      confidence: 0.8,
      action: {
        type: 'open_activity_note',
        label: 'Registra attività',
      },
      payload: {
        suggestion,
      },
    }
  }

  return null
}

export function buildDecisionsFromContextSuggestions(
  suggestions: ContextSuggestionInput[]
): DecisionPlan {
  const proposals = suggestions
    .map(mapSuggestionToDecisionProposal)
    .filter((proposal): proposal is DecisionProposal => Boolean(proposal))

  return {
    id: createDecisionId('context-plan'),
    createdAt: new Date().toISOString(),
    summary:
      proposals.length > 0
        ? 'Decision Engine ha generato proposte dal Context.'
        : 'Decision Engine non ha individuato proposte dal Context.',
    proposals,
    needsUserConfirmation: proposals.length > 0,
  }
}
