import type { DecisionProposal } from './types'
import { canExecuteDecisionProposal } from './execution-guard'

export function acceptDecisionProposal(
  proposal: DecisionProposal
): DecisionProposal {
  return {
    ...proposal,
    status: 'accepted',
  }
}

export function rejectDecisionProposal(
  proposal: DecisionProposal
): DecisionProposal {
  return {
    ...proposal,
    status: 'rejected',
  }
}

export function markDecisionProposalExecuted(
  proposal: DecisionProposal
): DecisionProposal {
  if (!canExecuteDecisionProposal(proposal)) {
    return proposal
  }

  return {
    ...proposal,
    status: 'executed',
  }
}
