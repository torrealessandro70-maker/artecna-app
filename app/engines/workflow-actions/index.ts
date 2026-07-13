import type { DecisionProposal } from '@/app/engines/decision'

export type WorkflowActionResult = {
  success: boolean
  message: string
}

export const executeWorkflowProposal = async (
  proposal: DecisionProposal,
): Promise<WorkflowActionResult> => {
  switch (proposal.type) {
    case 'create_estimate':
      return {
        success: true,
        message: 'Workflow OK: richiesta di creazione preventivo ricevuta.',
      }

    case 'create_task':
      return {
        success: false,
        message: 'Task Engine non ancora collegato.',
      }

    case 'link_to_site_file':
      return {
        success: false,
        message: 'Fascicolo Engine non ancora collegato.',
      }

    case 'create_issue':
      return {
        success: false,
        message: 'Issue Engine non ancora collegato.',
      }

    case 'request_user_review':
      return {
        success: false,
        message: 'Revisione manuale richiesta.',
      }

    default:
      return {
        success: false,
        message: 'Azione non supportata.',
      }
  }
}