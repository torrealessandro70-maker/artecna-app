'use client'

import type { CSSProperties } from 'react'
import type {
  DecisionPlan,
  DecisionProposal,
} from '@/app/engines/decision'

type Props = {
  plan: DecisionPlan
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  onCancelProposal?: (proposalId: string) => void
  onExecuteProposal?: (proposal: DecisionProposal) => void
}
const getProposalLabel = (
  type: DecisionPlan['proposals'][number]['type'],
) => {
  switch (type) {
    case 'create_estimate':
      return 'Crea preventivo'
    case 'create_task':
      return 'Crea attività'
    case 'link_to_site_file':
      return 'Collega al fascicolo'
    case 'create_issue':
      return 'Registra problema'
    case 'request_user_review':
      return 'Richiedi verifica'
    default:
      return 'Azione proposta'
  }
}

export default function WorkflowPreview({
  plan,
  buttonPrimary,
  buttonSecondary,
  onCancelProposal,
  onExecuteProposal,
}: Props) {
  if (plan.proposals.length === 0) return null

  return (
    <section
      style={{
        marginTop: 18,
        padding: 16,
        border: '1px solid #bfdbfe',
        borderRadius: 14,
        background: '#eff6ff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#1d4ed8',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            🤖 Workflow Preview
          </div>

          <h2
            style={{
              margin: '6px 0 0',
              fontSize: 20,
              color: '#0f172a',
            }}
          >
            ARTECNA sta per eseguire
          </h2>

          <p
            style={{
              margin: '8px 0 0',
              color: '#475569',
            }}
          >
            {plan.summary}
          </p>
        </div>

        {plan.needsUserConfirmation && (
          <span
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: '#fef3c7',
              color: '#92400e',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Conferma richiesta
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 10,
          marginTop: 16,
        }}
      >
        {plan.proposals.map((proposal) => (
          <article
            key={proposal.id}
            style={{
              padding: 14,
              border: '1px solid #dbeafe',
              borderRadius: 12,
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                >
                  {proposal.title || getProposalLabel(proposal.type)}
                </div>

                {proposal.description && (
                  <div
                    style={{
                      marginTop: 6,
                      color: '#475569',
                    }}
                  >
                    {proposal.description}
                  </div>
                )}
              </div>

              <span
                style={{
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: '#e2e8f0',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
<span
  style={{
    padding: '4px 8px',
    borderRadius: 999,
    background:
      proposal.status === 'proposed'
        ? '#dbeafe'
        : proposal.status === 'accepted'
          ? '#dcfce7'
          : proposal.status === 'executed'
            ? '#ede9fe'
            : '#fee2e2',
    color: '#1e293b',
    fontSize: 12,
    fontWeight: 700,
  }}
>
  {proposal.status}
</span>
                {Math.round(proposal.confidence * 100)}%
              </span>
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                color: '#64748b',
              }}
            >
              Origine: {proposal.source}
            </div>

            {proposal.action?.target && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: '#64748b',
                }}
              >
                Destinazione: {proposal.action.target}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
             <button
  type="button"
  style={buttonPrimary}
  onClick={() => onExecuteProposal?.(proposal)}
  disabled={!onExecuteProposal}
>
  Esegui
</button>

            <button
  type="button"
  style={buttonSecondary}
  onClick={() => onCancelProposal?.(proposal.id)}
  disabled={!onCancelProposal}
>
  Annulla
</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}