'use client'

import type { CSSProperties } from 'react'
import type { FotoCantiere, Rapportino } from '../types'

type Props = {
  rapportino: Rapportino
  index: number
  fotoCantiere: FotoCantiere[]
  setFotoRapportinoAperte: (foto: FotoCantiere[]) => void
  preparaModificaRapportino: (r: Rapportino) => void
  eliminaRapportino: (id?: string) => void | Promise<void>
  generaPdfRapportinoFotografico: (r: Rapportino) => void | Promise<void>
  buttonSecondary: CSSProperties
}

const normalizzaDataFotoRapportino = (valore?: string | null) =>
  String(valore || '').slice(0, 10)

const fotoCollegataAlRapportino = (
  foto: FotoCantiere,
  rapportino: Rapportino
) => {
  const fotoRapportinoId = (foto as any).rapportino_id

  if (fotoRapportinoId && rapportino.id) {
    return String(fotoRapportinoId) === String(rapportino.id)
  }

  const stessoCantiere =
    String(foto.cantiere || '').trim() ===
    String(rapportino.cantiere || '').trim()
  const stessaData =
    normalizzaDataFotoRapportino(foto.data_foto) ===
    normalizzaDataFotoRapportino(rapportino.data)
  const categoriaCompatibile =
    !foto.categoria ||
    String(foto.categoria).toLowerCase() === 'rapportino'

  return stessoCantiere && stessaData && categoriaCompatibile
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
  const fotoCollegate = fotoCantiere.filter((foto) =>
    fotoCollegataAlRapportino(foto, r)
  )

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
      <div style={{ marginTop: 6, color: '#475569' }}>
        Foto collegate: {fotoCollegate.length}
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => preparaModificaRapportino(r)}
          style={buttonSecondary}
        >
          Modifica
        </button>

        <button
          onClick={() => {
            if (fotoCollegate.length === 0) {
              alert('Nessuna foto collegata a questo rapportino')
              return
            }

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
