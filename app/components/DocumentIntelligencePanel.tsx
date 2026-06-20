'use client'

type Props = {
  titolo?: string
  fileAnalisiDocumento: any
  nomeFileAnalisiDocumento: string
  testoEstrattoDocumento: string
  importoRilevatoDocumento: string
  vociAnalizzate: any[]
  caricaFileAnalisiDocumento: (file: File) => void | Promise<void>
  inputStyle: any
}

const destinazioni = [
  'Preventivo ufficiale',
  'Documento tecnico',
  'Importa lavorazioni',
  'SAL',
  'Materiali',
  'Fattura fornitore',
  'Archivio Fascicolo',
]

export default function DocumentIntelligencePanel({
  titolo = 'Document Intelligence',
  fileAnalisiDocumento,
  nomeFileAnalisiDocumento,
  testoEstrattoDocumento,
  importoRilevatoDocumento,
  vociAnalizzate,
  caricaFileAnalisiDocumento,
  inputStyle,
}: Props) {
  const totaleVociAnalizzate = (vociAnalizzate || []).reduce(
    (tot: number, voce: any) => tot + Number(voce.totale || 0),
    0
  )

  return (
    <>
      <div
        style={{
          border: '2px dashed #cbd5e1',
          borderRadius: 12,
          padding: 20,
          background: '#f8fafc',
          marginBottom: 20,
        }}
      >
        <h3 style={{ marginTop: 0 }}>{titolo}</h3>

        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          style={inputStyle}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return

            await caricaFileAnalisiDocumento(file)

            e.target.value = ''
          }}
        />

        <p style={{ marginTop: 10, color: '#64748b' }}>
          Estrae testo, importi e voci da PDF o immagini. L&apos;analisi non
          modifica automaticamente preventivi, SAL o costi.
        </p>

        {nomeFileAnalisiDocumento && (
          <p style={{ marginTop: 10 }}>
            <strong>File caricato:</strong> {nomeFileAnalisiDocumento}
          </p>
        )}
      </div>

      {fileAnalisiDocumento && (
        <div
          style={{
            padding: 12,
            border: '1px solid #d1d5db',
            borderRadius: 10,
            background: '#fff',
            marginBottom: 20,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Risultato analisi</h3>

          <p>
            <strong>Importo rilevato:</strong>{' '}
            {importoRilevatoDocumento || 'Non rilevato'}
          </p>

          <p>
            <strong>Voci analizzate:</strong> {(vociAnalizzate || []).length}
          </p>

          <p>
            <strong>Totale voci:</strong>{' '}
            {totaleVociAnalizzate.toLocaleString('it-IT', {
              style: 'currency',
              currency: 'EUR',
            })}
          </p>

          {testoEstrattoDocumento && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer' }}>
                Vedi testo estratto
              </summary>

              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 8,
                  background: '#f8fafc',
                  maxHeight: 260,
                  overflow: 'auto',
                }}
              >
                {testoEstrattoDocumento}
              </pre>
            </details>
          )}
        </div>
      )}

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
    </>
  )
}
