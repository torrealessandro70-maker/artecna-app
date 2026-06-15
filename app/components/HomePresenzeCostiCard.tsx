'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  costoTotaleTimbratureOggi: number
  presenzeOggi: number
  formatMoney: (value: number) => string
}

export default function HomePresenzeCostiCard({
  cardStyle,
  costoTotaleTimbratureOggi,
  presenzeOggi,
  formatMoney,
}: Props) {
  return (
    <div style={cardStyle}>
      <h3>📋 Presenze / costi</h3>
      <p>Manodopera oggi: {formatMoney(costoTotaleTimbratureOggi)}</p>
      <p>Presenze oggi: {presenzeOggi}</p>
    </div>
  )
}