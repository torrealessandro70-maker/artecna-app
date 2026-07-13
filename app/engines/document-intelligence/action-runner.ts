import type {
  DocumentInsights,
  DocumentProfile,
} from './types'
import type { DocumentActionId } from './action-builder'

export type DocumentWorkflowIntent =
  | {
      type: 'OPEN_PREVENTIVO_AI'
      payload: {
        profile: DocumentProfile
        insights: DocumentInsights
      }
    }
  | {
      type: 'REGISTER_PREVENTIVO'
      payload: {
        profile: DocumentProfile
        insights: DocumentInsights
      }
    }
  | {
      type: 'REGISTER_FATTURA_FORNITORE'
      payload: {
        profile: DocumentProfile
        insights: DocumentInsights
      }
    }
  | {
      type: 'CONNECT_SAL'
      payload: {
        profile: DocumentProfile
        insights: DocumentInsights
      }
    }
  | {
      type: 'ARCHIVE_FASCICOLO'
      payload: {
        profile: DocumentProfile
        insights: DocumentInsights
      }
    }

export const buildDocumentWorkflowIntent = (
  actionId: DocumentActionId,
  insights: DocumentInsights,
): DocumentWorkflowIntent => {
  if (actionId === 'open-preventivo-ai') {
    return {
      type: 'OPEN_PREVENTIVO_AI',
      payload: {
        profile: insights.profile,
        insights,
      },
    }
  }

  if (actionId === 'register-preventivo') {
    return {
      type: 'REGISTER_PREVENTIVO',
      payload: {
        profile: insights.profile,
        insights,
      },
    }
  }

  if (actionId === 'register-fattura-fornitore') {
    return {
      type: 'REGISTER_FATTURA_FORNITORE',
      payload: {
        profile: insights.profile,
        insights,
      },
    }
  }

  if (actionId === 'connect-sal') {
    return {
      type: 'CONNECT_SAL',
      payload: {
        profile: insights.profile,
        insights,
      },
    }
  }

  return {
    type: 'ARCHIVE_FASCICOLO',
    payload: {
      profile: insights.profile,
      insights,
    },
  }
}