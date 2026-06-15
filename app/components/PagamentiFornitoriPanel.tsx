'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
}

export default function PagamentiFornitoriPanel({ cardStyle }: Props) {
  return (
    <div style={cardStyle}>
      <h2>Pagamenti fornitori</h2>

      <p style={{ color: '#666' }}>
        Pagina fornitori attiva.
      </p>
    </div>
  )
}