'use client'

import type { CSSProperties } from 'react'

type Props = {
  dataDa: string
  setDataDa: (v: string) => void
  dataA: string
  setDataA: (v: string) => void
  cantiereGrafico: string
  setCantiereGrafico: (v: string) => void
  cantieri: any[]
  inputStyle: CSSProperties
}

export default function FiltroPresenzeCostiPanel({
  dataDa,
  setDataDa,
  dataA,
  setDataA,
  cantiereGrafico,
  setCantiereGrafico,
  cantieri,
  inputStyle,
}: Props) {
  return (
    <div
      style={{
        marginTop: 20,
        marginBottom: 15,
        padding: 14,
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        background: '#f8fafc',
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>
        🔎 Filtra presenze e costi
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        <label>
          <strong>Dal</strong>
          <input
            type="date"
            value={dataDa}
            onChange={(e) => setDataDa(e.target.value)}
            style={{ ...inputStyle, width: '100%', marginTop: 6 }}
          />
        </label>

        <label>
          <strong>Al</strong>
          <input
            type="date"
            value={dataA}
            onChange={(e) => setDataA(e.target.value)}
            style={{ ...inputStyle, width: '100%', marginTop: 6 }}
          />
        </label>

        <label>
          <strong>Cantiere</strong>
          <select
            value={cantiereGrafico}
            onChange={(e) => setCantiereGrafico(e.target.value)}
            style={{ ...inputStyle, width: '100%', marginTop: 6 }}
          >
            <option value="">Tutti i cantieri</option>
            {cantieri.map((c, i) => (
              <option key={i} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}