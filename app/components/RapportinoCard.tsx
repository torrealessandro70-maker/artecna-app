'use client'

import type { CSSProperties } from 'react'

type Props = {
  rapportino: any
  index: number
  fotoCantiere: any[]
  setFotoRapportinoAperte: (foto: any[]) => void
  preparaModificaRapportino: (r: any) => void
  eliminaRapportino: (id?: string) => void | Promise<void>
  generaPdfRapportinoFotografico: (r: any) => void | Promise<void>
  buttonSecondary: CSSProperties
}

export default function RapportinoCard({
  rapportino: r,
  index,
  fotoCantiere,
  setFotoRapportinoAperte,
  preparaModificaRapportino,
  eliminaRapportino,
  generaPdfRapportinoFotografico,
  buttonSecondary,
}: Props) {
  return (
    <div
      key={r.id || index}
      style={{
        padding: 12,
        border: '1px solid #ddd',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      <strong>{r.cantiere}</strong> — {r.data} — {r.ore} ore
      <br />
      {r.note}

      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => preparaModificaRapportino(r)}
          style={buttonSecondary}
        >
          Modifica
        </button>

        <button
          onClick={() => {
            const fotoCollegate = fotoCantiere.filter(
              (f) =>
                f.cantiere === r.cantiere &&
                String(f.data_foto || '') === String(r.data || '')
            )

            setFotoRapportinoAperte(fotoCollegate)
          }}
          style={{
            ...buttonSecondary,
            marginLeft: 6,
            backgroundColor: '#0f172a',
            color: '#fff',
          }}
        >
          📸 Apri foto
        </button>

        <button
          onClick={() => eliminaRapportino(r.id)}
          style={{
            marginLeft: 8,
            padding: '10px 14px',
            backgroundColor: '#d9534f',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Elimina
        </button>

        <button
          onClick={() => generaPdfRapportinoFotografico(r)}
          style={{
            ...buttonSecondary,
            marginLeft: 6,
            backgroundColor: '#2563eb',
            color: '#fff',
          }}
        >
          📄 PDF foto
        </button>
      </div>
    </div>
  )
}