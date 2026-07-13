import type { DocumentInsights } from '@/app/engines/document-intelligence'

type Props = {
  insights: DocumentInsights
}

export function DocumentInsightsCard({ insights }: Props) {
  const { profile } = insights

  return (
    <section
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: 16,
        background: '#ffffff',
        display: 'grid',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>
          Document Intelligence
        </div>
        <h3 style={{ margin: 0, fontSize: 18 }}>
          Documento analizzato
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
          <strong>Totale:</strong>{' '}
          {insights.amounts.total
            ? `${insights.amounts.total.toFixed(2)} €`
            : 'Non rilevato'}
        </div>

        <div>
          <strong>Lavorazioni:</strong>{' '}
          {profile.hasItems ? 'presenti' : 'non rilevate'}
        </div>

        <div>
          <strong>IVA:</strong>{' '}
          {profile.hasVat ? 'presente' : 'non rilevata'}
        </div>
      </div>

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
    </section>
  )
}