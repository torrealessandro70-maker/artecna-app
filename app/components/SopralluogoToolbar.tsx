'use client'

import type { CSSProperties } from 'react'

type Props = {
  mostraGestioneFotoSopralluogo: boolean
  setMostraGestioneFotoSopralluogo: (v: boolean) => void

  mostraFotoPreventivoSopralluogo: boolean
  setMostraFotoPreventivoSopralluogo: (v: boolean) => void

  setPopupFotoSopralluogo: (v: boolean) => void

  buttonPrimary: CSSProperties
}

export default function SopralluogoToolbar({
  mostraGestioneFotoSopralluogo,
  setMostraGestioneFotoSopralluogo,
  mostraFotoPreventivoSopralluogo,
  setMostraFotoPreventivoSopralluogo,
  setPopupFotoSopralluogo,
  buttonPrimary,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        marginTop: 16,
        marginBottom: 16,
      }}
    >
      <button
        type="button"
        onClick={() => setPopupFotoSopralluogo(true)}
        style={{
          ...buttonPrimary,
          backgroundColor: '#0f172a',
        }}
      >
        📸 Carica foto sopralluogo
      </button>

      <button
        type="button"
        onClick={() => {
          setMostraGestioneFotoSopralluogo(
            !mostraGestioneFotoSopralluogo
          )
          setMostraFotoPreventivoSopralluogo(false)
        }}
        style={{
          ...buttonPrimary,
          backgroundColor: '#16a34a',
        }}
      >
        {mostraGestioneFotoSopralluogo
          ? 'Nascondi gestione foto'
          : '🗑 Gestisci / elimina foto'}
      </button>

      <button
        type="button"
        onClick={() => {
          setMostraFotoPreventivoSopralluogo(
            !mostraFotoPreventivoSopralluogo
          )
          setMostraGestioneFotoSopralluogo(false)
        }}
        style={{
          ...buttonPrimary,
          backgroundColor: '#2563eb',
        }}
      >
        {mostraFotoPreventivoSopralluogo
          ? 'Nascondi foto preventivo'
          : '🖼 Foto da usare nel preventivo'}
      </button>
    </div>
  )
}