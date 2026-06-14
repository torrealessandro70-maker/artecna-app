'use client'

import SelectCantiere from './SelectCantiere'

export default function CantieriAnalisiDocumentoPanel(props: any) {
  const p = props

  return (
    <div style={p.cardStyle}>
      <h2>Analisi documento cantiere</h2>

      <div style={{ marginBottom: 20 }}>
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
      </div>

      <div
        style={{
          border: '2px dashed #cbd5e1',
          borderRadius: 12,
          padding: 20,
          background: '#f8fafc',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Carica documento da analizzare</h3>

        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          style={p.inputStyle}
        />

        <p style={{ marginTop: 10, color: '#64748b' }}>
          Puoi caricare un PDF, una foto o un’immagine del documento del
          cantiere.
        </p>
      </div>
    </div>
  )
}