'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  pagamentiOperai: any[]
  operaiAnagrafica: any[]
}

export default function HomePagamentiOperaiCard({
  cardStyle,
  pagamentiOperai,
  operaiAnagrafica,
}: Props) {
  return (
    <div style={cardStyle}>
      <h3>💳 Pagamenti operai</h3>
      <p>Pagamenti registrati: {pagamentiOperai.length}</p>
      <p>Operai: {operaiAnagrafica.length}</p>
    </div>
  )
}