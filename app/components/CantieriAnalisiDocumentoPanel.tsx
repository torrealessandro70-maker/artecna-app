'use client'

import SelectCantiere from './SelectCantiere'

export default function CantieriAnalisiDocumentoPanel(props: any) {
  const p = props

  const totaleVociAnalizzate = (p.vociAnalizzate || []).reduce(
    (tot: number, voce: any) => tot + Number(voce.totale || 0),
    0
  )

  return (
    <div style={p.integrato ? undefined : p.cardStyle}>
      <h2>{p.integrato ? 'Analisi documento' : 'Analisi documento cantiere'}</h2>

      {!p.integrato && <div style={{ marginBottom: 20 }}>
        <strong>Seleziona cantiere</strong>

        <div style={{ marginTop: 10 }}>
          <SelectCantiere
            cantieri={p.cantieri}
            value={p.cantiereAnalisiDocumento || ''}
            onChange={p.setCantiereAnalisiDocumento}
            inputStyle={{
              padding: 8,
              width: 260,
              marginBottom: 15,
            }}
            buttonSecondary={p.buttonSecondary}
          />
        </div>
      </div>}

      <div
        style={{
          border: '2px dashed #cbd5e1',
          borderRadius: 12,
          padding: 20,
          background: '#f8fafc',
          marginBottom: 20,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Carica documento da analizzare</h3>

        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          style={p.inputStyle}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return

            await p.caricaFileAnalisiDocumento(file)

            e.target.value = ''
          }}
        />

        <p style={{ marginTop: 10, color: '#64748b' }}>
          Puoi caricare un PDF, una foto o un’immagine del documento del
          cantiere.
        </p>

        {p.nomeFileAnalisiDocumento && (
          <p style={{ marginTop: 10 }}>
            <strong>File caricato:</strong> {p.nomeFileAnalisiDocumento}
          </p>
        )}
      </div>

      {p.fileAnalisiDocumento && (
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
            {p.importoRilevatoDocumento || 'Non rilevato'}
          </p>

          <p>
            <strong>Voci analizzate:</strong> {(p.vociAnalizzate || []).length}
          </p>

          <p>
            <strong>Totale voci:</strong>{' '}
            {totaleVociAnalizzate.toLocaleString('it-IT', {
              style: 'currency',
              currency: 'EUR',
            })}
          </p>

          {p.testoEstrattoDocumento && (
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
                {p.testoEstrattoDocumento}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
