'use client'

import type { CSSProperties } from 'react'

type Props = {
  testo: string
  onChangeTesto: (testo: string) => void
  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

const prossimeEvoluzioni = [
  'Operai',
  'Materiali',
  'Lavorazioni',
  'Costi',
  'Timbrature',
]

export default function SmartReportAssistant({
  testo,
  onChangeTesto,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const disabledButtonStyle: CSSProperties = {
    opacity: 0.6,
    cursor: 'not-allowed',
  }

  return (
    <section
      style={{
        display: 'grid',
        gap: 12,
        padding: 16,
        border: '1px solid #c7d2fe',
        borderRadius: 10,
        background: '#eef2ff',
      }}
    >
      <div>
        <h3 style={{ margin: '0 0 6px' }}>🎙️ Racconta la giornata</h3>
        <p style={{ margin: 0, color: '#475569' }}>
          Detta o scrivi quello che è successo oggi in cantiere. ARTECNA userà
          questo racconto per aiutarti a compilare il rapportino.
        </p>
      </div>

      <textarea
        value={testo}
        onChange={(event) => onChangeTesto(event.target.value)}
        placeholder="Racconta liberamente la giornata in cantiere..."
        rows={5}
        style={{ ...inputStyle, width: '100%' }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled
          style={{ ...buttonSecondary, ...disabledButtonStyle }}
        >
          🎤 Avvia dettatura
        </button>
        <button
          type="button"
          disabled
          style={{ ...buttonSecondary, ...disabledButtonStyle }}
        >
          ⏹ Ferma
        </button>
        <button
          type="button"
          disabled
          style={{ ...buttonPrimary, ...disabledButtonStyle }}
        >
          🤖 Prepara rapportino
        </button>
      </div>

      <aside
        style={{
          padding: 12,
          border: '1px solid #dbeafe',
          borderRadius: 8,
          background: '#fff',
        }}
      >
        <strong>Prossima evoluzione</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {prossimeEvoluzioni.map((voce) => (
            <li key={voce}>{voce}</li>
          ))}
        </ul>
      </aside>
    </section>
  )
}
