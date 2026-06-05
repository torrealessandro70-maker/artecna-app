'use client'

'use client'

import type { CSSProperties } from 'react'

type Props = {
  economiaDataDa: string
  setEconomiaDataDa: (v: string) => void
  economiaDataA: string
  setEconomiaDataA: (v: string) => void
  buttonSecondary: CSSProperties
}

export default function FiltroPeriodoEconomia({
  economiaDataDa,
  setEconomiaDataDa,
  economiaDataA,
  setEconomiaDataA,
  buttonSecondary,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 16,
        padding: 12,
        border: '1px solid #ddd',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      <strong>Filtro periodo:</strong>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>Da</span>

        <input
          type="date"
          value={economiaDataDa}
          onChange={(e) => setEconomiaDataDa(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>A</span>

        <input
          type="date"
          value={economiaDataA}
          onChange={(e) => setEconomiaDataA(e.target.value)}
        />
      </div>

      <button
        onClick={() => {
          setEconomiaDataDa('')
          setEconomiaDataA('')
        }}
        style={buttonSecondary}
      >
        Reset
      </button>
    </div>
  )
}