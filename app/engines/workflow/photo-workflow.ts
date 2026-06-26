import type { WorkflowInput, WorkflowResult } from './types'

export function buildPhotoWorkflow(input: WorkflowInput): WorkflowResult {
  const hasWorkflowContext =
    Boolean(input.cantiereName) && typeof input.photoCount === 'number'

  return {
    id: 'photo-workflow-v1',
    name: 'Photo Workflow V1',
    description:
      'Descrive il percorso operativo che parte da una foto aggiunta e arriva a una proposta in attesa di conferma utente.',
   summary: hasWorkflowContext
  ? `Photo Workflow pronto per il cantiere '${input.cantiereName}' con ${input.photoCount} foto nel contesto.`
  : 'Photo Workflow pronto.',

state: 'waiting_user',

input,
    executesActions: false,
    needsUserConfirmation: true,
    pipeline: {
      event: {
        status: 'pending',
      },
      context: {
        status: 'pending',
      },
      decision: {
        status: 'pending',
      },
      action: {
        status: 'pending',
      },
    },
    metadata: {
      workflowType: 'photo',
      version: '1.0',
      generatedAt: new Date().toISOString(),
    },
    steps: [
      {
        id: 'photo-added',
        title: 'Photo Added',
        description: 'Una foto viene aggiunta al contesto operativo del cantiere.',
        status: 'described',
        metadata: {
          entityId: input.entityId,
          cantiereId: input.cantiereId,
          occurredAt: input.occurredAt,
        },
      },
      {
        id: 'event-generated',
        title: 'Event Generated',
        description: "L'Event Engine potra' rappresentare il fatto come evento photo_added.",
        engine: 'event',
        status: 'described',
        metadata: {
          eventType: 'photo_added',
        },
      },
      {
        id: 'context-updated',
        title: 'Context Updated',
        description: 'Il Context Engine potra aggiornare context.statistics.photos.',
        engine: 'context',
        status: 'described',
        metadata: {
          contextField: 'statistics.photos',
        },
      },
      {
        id: 'decision-proposed',
        title: 'Decision Proposed',
        description:
          'Il Decision Engine potra proporre la creazione di un rapportino se mancano rapportini collegati.',
        engine: 'decision',
        status: 'described',
        metadata: {
          proposal: 'Creare rapportino',
        },
      },
      {
        id: 'action-available',
        title: 'Action Available',
        description:
          "L'Action Engine potra esporre l'azione open_daily_report senza eseguirla.",
        engine: 'action',
        status: 'described',
        metadata: {
          action: 'open_daily_report',
        },
      },
      {
        id: 'waiting-user-confirmation',
        title: 'Waiting User Confirmation',
        description:
          "La UI mostra la proposta e attende una conferma esplicita prima di qualunque azione.",
        engine: 'ui',
        status: 'waiting_user_confirmation',
      },
    ],
  }
}
