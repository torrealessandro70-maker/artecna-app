'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'

type Props = {
  filtroFotoCantiere: string
  setFiltroFotoCantiere: (v: string) => void

  fotoCantiereSelezionate: string[]
  setFotoCantiereSelezionate: Dispatch<SetStateAction<string[]>>

  categoriaFotoMultipla: string
  setCategoriaFotoMultipla: (v: string) => void

  aggiornaCategoriaFotoSelezionate: () => void | Promise<void>

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function FotoCantiereFiltri({
  filtroFotoCantiere,
  setFiltroFotoCantiere,

  fotoCantiereSelezionate,
  setFotoCantiereSelezionate,

  categoriaFotoMultipla,
  setCategoriaFotoMultipla,

  aggiornaCategoriaFotoSelezionate,

  buttonPrimary,
  buttonSecondary,
}: Props) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 10,
          marginBottom: 15,
        }}
      >
        {[
          'tutte',
          'prima',
          'durante',
          'dopo',
          'problema',
          'rapportino',
          'sal',
          'extra',
        ].map((tipo) => (
          <button
            key={tipo}
            onClick={() => setFiltroFotoCantiere(tipo)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background:
                filtroFotoCantiere === tipo
                  ? '#2563eb'
                  : '#e2e8f0',
              color:
                filtroFotoCantiere === tipo
                  ? '#fff'
                  : '#111',
            }}
          >
            {tipo.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: 10,
          marginBottom: 15,
          padding: 10,
          borderRadius: 10,
          background: '#f1f5f9',
        }}
      >
        <strong>
          Selezionate: {fotoCantiereSelezionate.length}
        </strong>

        <select
          value={categoriaFotoMultipla}
          onChange={(e) =>
            setCategoriaFotoMultipla(e.target.value)
          }
          style={{
            padding: 8,
            borderRadius: 8,
            border: '1px solid #cbd5e1',
          }}
        >
          <option value="prima">📷 Prima</option>
          <option value="durante">🔨 Durante</option>
          <option value="dopo">✅ Dopo</option>
          <option value="problema">⚠️ Problema</option>
          <option value="rapportino">📝 Rapportino</option>
          <option value="sal">📊 SAL</option>
          <option value="extra">📁 Extra</option>
        </select>

        <button
          onClick={aggiornaCategoriaFotoSelezionate}
          style={buttonPrimary}
        >
          Applica categoria
        </button>

        <button
          onClick={() => setFotoCantiereSelezionate([])}
          style={buttonSecondary}
        >
          Deseleziona
        </button>
      </div>
    </>
  )
}