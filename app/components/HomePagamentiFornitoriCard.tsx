'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  pagamentiFornitori: any[]
  parseImporto: (value: any) => number
  formatMoney: (value: number) => string
  labelTotale?: string
}

export default function HomePagamentiFornitoriCard({
  cardStyle,
  pagamentiFornitori,
  parseImporto,
  formatMoney,
  labelTotale = 'Totale fornitori',
}: Props) {
  const totale = pagamentiFornitori.reduce(
    (tot, p) => tot + parseImporto(p.importo_totale),
    0
  )

  return (
    <div style={cardStyle}>
      <h3>🧾 Pagamenti fornitori</h3>
      <p>Fornitori registrati: {pagamentiFornitori.length}</p>
      <p>{labelTotale}: {formatMoney(totale)}</p>
    </div>
  )
}