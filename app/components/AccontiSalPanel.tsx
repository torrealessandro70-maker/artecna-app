'use client'

import type { CSSProperties } from 'react'

type Props = {
  totaleAccontiCantiere: number
  residuoDaIncassare: number
  mostraAcconti: boolean
  buttonSecondary: CSSProperties
  formatMoney: (value: number) => string
  setMostraAcconti: (value: boolean) => void
}

export default function AccontiSalPanel({
  totaleAccontiCantiere,
  residuoDaIncassare,
  mostraAcconti,
  buttonSecondary,
  formatMoney,
  setMostraAcconti,
}: Props) {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>Acconti / SAL ricevuti:</strong>{' '}
      {formatMoney(totaleAccontiCantiere)}

      <button
        onClick={() => setMostraAcconti(!mostraAcconti)}
        style={{ ...buttonSecondary, marginLeft: 10 }}
      >
        {mostraAcconti ? 'Nascondi' : 'Gestisci acconti'}
      </button>

      <div style={{ marginTop: 10 }}>
        <strong>Residuo da incassare:</strong>{' '}
        <span
          style={{
            color:
              residuoDaIncassare > 0
                ? 'red'
                : residuoDaIncassare === 0
                ? 'green'
                : '#f59e0b',
            fontWeight: 700,
          }}
        >
          {formatMoney(residuoDaIncassare)}
        </span>
      </div>
    </div>
  )
}