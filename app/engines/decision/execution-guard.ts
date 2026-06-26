import type { DecisionProposal } from './types'

export function canExecuteDecisionProposal(proposal: DecisionProposal): boolean {
  return proposal.status === 'accepted'
}
