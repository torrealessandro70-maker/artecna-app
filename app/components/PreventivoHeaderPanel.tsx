'use client'

import type { CSSProperties } from 'react'

type Props = {
  preventivoCantiere: number
  mostraPreventiviCantiere: boolean
  setMostraPreventiviCantiere: (v: boolean) => void
  formatMoney: (v: number) => string
  buttonSecondary: CSSProperties
}

export default function PreventivoHeaderPanel({
  preventivoCantiere,
  mostraPreventiviCantiere,
  setMostraPreventiviCantiere,
  formatMoney,
  buttonSecondary,
}: Props) {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>Preventivo totale:</strong>{' '}
      {formatMoney(preventivoCantiere)}

      <button
        onClick={() =>
          setMostraPreventiviCantiere(!mostraPreventiviCantiere)
        }
        style={{
          ...buttonSecondary,
          marginLeft: 10,
        }}
      >
        {mostraPreventiviCantiere
          ? 'Nascondi anteprima'
          : 'Vedi anteprima preventivi'}
      </button>
    </div>
  )
}