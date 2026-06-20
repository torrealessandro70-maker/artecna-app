'use client'

import type { CSSProperties } from 'react'
import RapportiniList from './RapportiniList'

type Props = {
  cardStyle: CSSProperties
  rapportiniFiltrati: any[]
  fotoCantiere: any[]
  setFotoRapportinoAperte: (foto: any[]) => void
  preparaModificaRapportino: (rapportino: any) => void
  eliminaRapportino: (id?: string) => void | Promise<void>
  generaPdfRapportinoFotografico: (
    rapportino: any
  ) => void | Promise<void>
  buttonSecondary: CSSProperties
}

export default function RapportiniPanel({
  cardStyle,
  rapportiniFiltrati,
  fotoCantiere,
  setFotoRapportinoAperte,
  preparaModificaRapportino,
  eliminaRapportino,
  generaPdfRapportinoFotografico,
  buttonSecondary,
}: Props) {
  const cantieriCoinvolti = new Set(
    rapportiniFiltrati
      .map((rapportino) => String(rapportino.cantiere || '').trim())
      .filter(Boolean)
  ).size

  const totaleOreRapportini = rapportiniFiltrati.reduce(
    (totale, rapportino) => {
      const ore = parseFloat(String(rapportino.ore || 0).replace(',', '.'))

      return totale + (Number.isNaN(ore) ? 0 : ore)
    },
    0
  )

  return (
    <section style={cardStyle}>
      <h2>📅 Diario di Cantiere</h2>
      <p style={{ color: '#64748b' }}>
        Riepilogo operativo dei rapportini salvati per cantiere.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          margin: '18px 0',
        }}
      >
        <div
          style={{
            padding: 14,
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            background: '#f8fafc',
          }}
        >
          <div style={{ color: '#64748b', fontSize: 13 }}>
            Numero rapportini
          </div>
          <strong style={{ display: 'block', marginTop: 4, fontSize: 22 }}>
            {rapportiniFiltrati.length}
          </strong>
        </div>

        <div
          style={{
            padding: 14,
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            background: '#f8fafc',
          }}
        >
          <div style={{ color: '#64748b', fontSize: 13 }}>
            Cantieri coinvolti
          </div>
          <strong style={{ display: 'block', marginTop: 4, fontSize: 22 }}>
            {cantieriCoinvolti}
          </strong>
        </div>

        <div
          style={{
            padding: 14,
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            background: '#f8fafc',
          }}
        >
          <div style={{ color: '#64748b', fontSize: 13 }}>
            Totale ore rapportini
          </div>
          <strong style={{ display: 'block', marginTop: 4, fontSize: 22 }}>
            {totaleOreRapportini.toLocaleString('it-IT', {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
      </div>

      <RapportiniList
        rapportiniFiltrati={rapportiniFiltrati}
        fotoCantiere={fotoCantiere}
        setFotoRapportinoAperte={setFotoRapportinoAperte}
        preparaModificaRapportino={preparaModificaRapportino}
        eliminaRapportino={eliminaRapportino}
        generaPdfRapportinoFotografico={generaPdfRapportinoFotografico}
        buttonSecondary={buttonSecondary}
      />
    </section>
  )
}
