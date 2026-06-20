'use client'

const destinazioni = [
  'Preventivo ufficiale',
  'Documento tecnico',
  'Importa lavorazioni',
  'SAL',
  'Materiali',
  'Fattura fornitore',
  'Archivio Fascicolo',
]

export default function DocumentDestinationSelector() {
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
      <h3
        id="document-intelligence-destinazioni"
        style={{ margin: '0 0 6px' }}
      >
        Destinazioni
      </h3>

      <p style={{ margin: '0 0 12px', color: '#64748b' }}>
        Le destinazioni saranno disponibili in un passaggio successivo.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {destinazioni.map((destinazione) => (
          <button
            key={destinazione}
            type="button"
            disabled
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              background: '#e2e8f0',
              color: '#64748b',
              cursor: 'not-allowed',
            }}
          >
            {destinazione}
          </button>
        ))}
      </div>
    </section>
  )
}
