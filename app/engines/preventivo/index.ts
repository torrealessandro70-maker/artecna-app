export type {
  PreventivoSource,
  PreventivoSourceType,
  PreventivoVoce,
  PreventivoReviewIssue,
  PreventivoReviewIssueSeverity,
  PreventivoRevision,
PreventivoTotals,
  CreatePreventivoRevisionInput,
} from './types'

export { createPreventivoRevisionFromDocument } from './document-adapter'
export { createPreventivoRevisionFromAi } from './ai-adapter'

export {
  buildPreventivoReviewIssues,
  buildPreventivoRevisionReview,
} from './review-builder'

export {
  addPreventivoVoce,
  updatePreventivoVoce,
  removePreventivoVoce,
  movePreventivoVoce,
} from './review-actions'

import type { CreatePreventivoRevisionInput, PreventivoRevision } from './types'
import { createPreventivoRevisionFromAi } from './ai-adapter'
import { createPreventivoRevisionFromDocument } from './document-adapter'

export const createPreventivoRevision = (
  input: CreatePreventivoRevisionInput,
): PreventivoRevision => {
  if (input.sourceType === 'ai') {
    return createPreventivoRevisionFromAi(input)
  }

  return createPreventivoRevisionFromDocument(input)
}

export {
  calculatePreventivoVoceTotale,
  calculatePreventivoTotals,
} from './totals'

export { runPreventivoEngineSmokeTest } from './smoke-test'