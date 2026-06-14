'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
}

export default function AttivitaPanel({ cardStyle }: Props) {
  return (
    <div style={cardStyle}>
      <h2>Attività</h2>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>Attività in programma</strong>
          <p style={{ color: '#666', marginTop: 5 }}>
            Qui potrai gestire appuntamenti, lavori futuri e scadenze.
          </p>
        </div>

        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>Prossimo sviluppo</strong>

          <ul style={{ color: '#666', marginTop: 5, paddingLeft: 16 }}>
            <li>Agenda cantieri</li>
            <li>Scadenze pagamenti</li>
            <li>Promemoria operai</li>
          </ul>
        </div>
      </div>
    </div>
  )
}