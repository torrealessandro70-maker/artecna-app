'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  totalePreventiviImpresa: number
  totaleCostiImpresa: number
  utileTotaleImpresa: number
  margineMedioImpresa: number
  formatMoney: (value: number) => string
}

export default function HomeEconomiaGeneraleCard({
  cardStyle,
  totalePreventiviImpresa,
  totaleCostiImpresa,
  utileTotaleImpresa,
  margineMedioImpresa,
  formatMoney,
}: Props) {
  return (
    <div style={{ ...cardStyle, minWidth: 420, maxWidth: 480 }}>
      <h3>💶 Economia generale</h3>
      <p>Totale preventivi: {formatMoney(totalePreventiviImpresa)}</p>
      <p>Totale costi: {formatMoney(totaleCostiImpresa)}</p>
      <p>
        <strong style={{ color: utileTotaleImpresa >= 0 ? 'green' : 'red' }}>
          Utile totale: {formatMoney(utileTotaleImpresa)}
        </strong>
      </p>
      <p>Margine medio: {margineMedioImpresa.toFixed(1)}%</p>
    </div>
  )
}