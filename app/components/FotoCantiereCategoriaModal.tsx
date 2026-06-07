'use client'

import type { CSSProperties } from 'react'

type Props = {
  popupCategoriaFotoCantiere: boolean
  fotoDaCaricare: string[]
  categoriaFotoDaSalvare: string
  setCategoriaFotoDaSalvare: (v: string) => void
  setPopupCategoriaFotoCantiere: (v: boolean) => void
  setCategoriaFoto: (v: string) => void
  salvaFotoCantiere: () => void | Promise<void>
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function FotoCantiereCategoriaModal({
  popupCategoriaFotoCantiere,
  fotoDaCaricare,
  categoriaFotoDaSalvare,
  setCategoriaFotoDaSalvare,
  setPopupCategoriaFotoCantiere,
  setCategoriaFoto,
  salvaFotoCantiere,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  if (!popupCategoriaFotoCantiere) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 30000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 420,
          padding: 20,
          boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Classifica foto cantiere</h3>

        <p style={{ color: '#475569' }}>
          Stai per salvare {fotoDaCaricare.length} foto. Scegli dove inserirle.
        </p>

        <select
          value={categoriaFotoDaSalvare}
          onChange={(e) => setCategoriaFotoDaSalvare(e.target.value)}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            marginTop: 10,
          }}
        >
          <option value="prima">📷 Prima</option>
          <option value="durante">🔨 Durante</option>
          <option value="dopo">✅ Dopo</option>
          <option value="problema">⚠ Problema</option>
        </select>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            onClick={() => setPopupCategoriaFotoCantiere(false)}
            style={buttonSecondary}
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={async () => {
              setCategoriaFoto(categoriaFotoDaSalvare)
              await salvaFotoCantiere()
              setPopupCategoriaFotoCantiere(false)
            }}
            style={buttonPrimary}
          >
            Conferma e salva
          </button>
        </div>
      </div>
    </div>
  )
}
