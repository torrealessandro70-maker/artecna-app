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
    </>
  )
}
