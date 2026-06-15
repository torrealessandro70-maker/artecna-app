'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  operaiAnagrafica: any[]
  formatMoney: (value: number) => string
}

export default function HomeAnagraficaOperaiCard({
  cardStyle,
  operaiAnagrafica,
  formatMoney,
}: Props) {
  return (
    <div style={cardStyle}>
      <h3>👷 Anagrafica operai</h3>
      <p>Operai registrati: {operaiAnagrafica.length}</p>

      {operaiAnagrafica.slice(0, 5).map((o, i) => (
        <div key={o.id || i}>
          {o.nome} — {o.qualifica || '-'} —{' '}
          {formatMoney(Number(o.costo_orario || 0))}
        </div>
      ))}
    </div>
  )
}