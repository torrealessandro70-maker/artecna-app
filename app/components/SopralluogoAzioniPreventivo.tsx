'use client'

import type { CSSProperties } from 'react'

type Props = {
  sopralluogoAperto: any
  preventivoAiGenerato: any
  generaPreventivoDaSopralluogo: (s: any) => void | Promise<void>
  generaPreventivoAiDaSopralluogo: (s: any) => void | Promise<void>
  apriPreventivoAiGeneratoInModifica: () => void
  convertiSopralluogoInCantiere: (s: any) => void | Promise<void>
  generaPdfSopralluogo: (s: any) => void | Promise<void>
  buttonPrimary: CSSProperties
}

export default function SopralluogoAzioniPreventivo({
  sopralluogoAperto,
  preventivoAiGenerato,
  generaPreventivoDaSopralluogo,
  generaPreventivoAiDaSopralluogo,
  apriPreventivoAiGeneratoInModifica,
  convertiSopralluogoInCantiere,
  generaPdfSopralluogo,
  buttonPrimary,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={() => generaPreventivoDaSopralluogo(sopralluogoAperto)}
        style={{
          ...buttonPrimary,
          backgroundColor: '#7c3aed',
        }}
      >
        🧾 Genera preventivo
      </button>

      <button
        type="button"
        onClick={() => generaPreventivoAiDaSopralluogo(sopralluogoAperto)}
        style={{
          ...buttonPrimary,
          backgroundColor: '#9333ea',
        }}
      >
        🤖 Genera preventivo AI
      </button>

      {preventivoAiGenerato && (
        <button
          type="button"
          onClick={apriPreventivoAiGeneratoInModifica}
          style={{
            ...buttonPrimary,
            backgroundColor: '#059669',
          }}
        >
          📂 Apri preventivo AI generato
        </button>
      )}

      <button
        type="button"
        onClick={() => convertiSopralluogoInCantiere(sopralluogoAperto)}
        style={{
          ...buttonPrimary,
          backgroundColor: '#15803d',
        }}
      >
        🏗 Converti in cantiere
      </button>

      <button
        type="button"
        onClick={() => generaPdfSopralluogo(sopralluogoAperto)}
        style={{
          ...buttonPrimary,
          backgroundColor: '#2563eb',
        }}
      >
        📄 Genera PDF
      </button>
    </>
  )
}