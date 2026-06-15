'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  timbratureOggi: any[]
}

export default function HomeTimbratureCard({
  cardStyle,
  timbratureOggi,
}: Props) {
  return (
    <div style={cardStyle}>
      <h3>🕒 Timbrature</h3>

      <p>Timbrature oggi: {timbratureOggi.length}</p>

      {timbratureOggi.slice(0, 5).map((t, i) => (
        <div key={t.id || i}>
          {t.operaio_nome} — {t.cantiere} — {t.ora_entrata || '-'} /{' '}
          {t.ora_uscita || '-'}
        </div>
      ))}
    </div>
  )
}