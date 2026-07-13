import type { DocumentInsights } from '@/app/engines/document-intelligence'

type Props = {
  insights?: DocumentInsights
}

const labels: Record<string, string> = {
  preventivo_ufficiale: 'Registro Preventivi',
  preventivo_ai: 'Preventivo AI',
  fattura_fornitore: 'Fattura fornitore',
  sal: 'SAL',
  materiali: 'Materiali',
  attrezzi: 'Attrezzi',
  archivio_fascicolo: 'Archivio Fascicolo',
}

export default function DocumentDestinationSelector({ insights }: Props) {
  const destination = insights?.destination

  return (
    <section
      aria-labelledby="document-intelligence-destinazioni"
      style={{
        padding: 16,
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#f8fafc',
      }}
    >
      <h3 id="document-intelligence-destinazioni" style={{ marginTop: 0 }}>
        Destinazione documento
      </h3>

      {!destination && (
        <p style={{ color: '#64748b', marginBottom: 0 }}>
          Carica un documento per ricevere una destinazione suggerita.
        </p>
      )}

      {destination && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <strong>Destinazione suggerita:</strong>{' '}
            {labels[destination.suggested] || destination.suggested}
          </div>

          <div>
            <strong>Affidabilità:</strong>{' '}
            {Math.round(destination.confidence * 100)}%
          </div>

          {destination.reasons.length > 0 && (
            <div>
              <strong>Motivo:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {destination.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {destination.alternatives.length > 0 && (
            <div>
              <strong>Alternative:</strong>{' '}
              {destination.alternatives
                .map((item) => labels[item] || item)
                .join(', ')}
            </div>
          )}
        </div>
      )}
    </section>
  )
}