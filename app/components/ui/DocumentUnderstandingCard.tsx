import type { DocumentInsights } from '@/app/engines/document-intelligence'

type Props = {
  insights?: DocumentInsights
  onAction?: (actionId: string) => void
}
const destinationLabels: Record<string, string> = {
  preventivo_ufficiale: 'Registro Preventivi',
  preventivo_ai: 'Preventivo AI',
  fattura_fornitore: 'Fattura fornitore',
  sal: 'SAL',
  materiali: 'Materiali',
  attrezzi: 'Attrezzi',
  archivio_fascicolo: 'Archivio Fascicolo',
}

export function DocumentUnderstandingCard({
  insights,
  onAction,
}: Props) {
  if (!insights) {
    return null
  }

  const { profile, destination } = insights

  return (
    <section
      style={{
        padding: 16,
        border: '1px solid #c7d2fe',
        borderRadius: 14,
        background: '#eef2ff',
        display: 'grid',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4338ca' }}>
          ARTECNA Document Intelligence
        </div>
        <h3 style={{ margin: 0 }}>
          ARTECNA ha capito questo documento
        </h3>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <div>
          <strong>Tipo:</strong> {profile.kind}
        </div>

        <div>
          <strong>Affidabilità:</strong>{' '}
          {Math.round(profile.confidence * 100)}%
        </div>

        <div>
          <strong>Totale rilevato:</strong>{' '}
          {profile.total
            ? `${profile.total.value.toFixed(2)} €`
            : 'Non rilevato'}
        </div>

        <div>
          <strong>Destinazione consigliata:</strong>{' '}
          {destination
            ? destinationLabels[destination.suggested] ||
              destination.suggested
            : 'Non disponibile'}
        </div>
      </div>

      {destination?.reasons.length ? (
        <div>
          <strong>Motivazione</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {destination.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {insights.warnings.length > 0 && (
        <div>
          <strong>Avvisi</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {insights.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {insights.suggestions.length > 0 && (
        <div>
          <strong>Suggerimenti</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {insights.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
        {insights.actions.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 12,
            borderTop: '1px solid #c7d2fe',
            display: 'grid',
            gap: 8,
          }}
        >
          <strong>Azioni consigliate</strong>

          {insights.actions.map((action) => (
           <button
  key={action.id}
  type="button"
  title={action.description}
  onClick={() => onAction?.(action.id)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: action.primary
                  ? '1px solid #4f46e5'
                  : '1px solid #cbd5e1',
                background: action.primary ? '#4f46e5' : '#ffffff',
                color: action.primary ? '#ffffff' : '#0f172a',
                fontWeight: action.primary ? 700 : 600,
                cursor: 'pointer',
              }}
            >
              {action.title}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}