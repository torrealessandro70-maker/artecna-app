'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  totaleRapportini: number
  totaleRapportiniOggi: number
  oreTotaliOggi: number
}

export default function HomeRapportiniCard({
  cardStyle,
  totaleRapportini,
  totaleRapportiniOggi,
  oreTotaliOggi,
}: Props) {
  return (
    <div style={cardStyle}>
      <h3>📄 Rapportini</h3>
      <p>Totale rapportini: {totaleRapportini}</p>
      <p>Rapportini oggi: {totaleRapportiniOggi}</p>
      <p>Ore oggi: {oreTotaliOggi}</p>
    </div>
  )
}