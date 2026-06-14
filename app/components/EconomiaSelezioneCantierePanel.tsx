'use client'

import type { CSSProperties } from 'react'
import SelectCantiere from './SelectCantiere'
import UploadPreventivoBox from './UploadPreventivoBox'

type Props = {
  cantieri: any[]
  cantiereScheda: string | null
  setCantiereScheda: (value: string) => void

  ricercaCantiereEconomia: string
  setRicercaCantiereEconomia: (value: string) => void

  mostraConclusiEconomia: boolean
  setMostraConclusiEconomia: (value: boolean) => void

  dragAttivo: boolean
  setDragAttivo: (value: boolean) => void
  caricaFilePreventivo: (file: File) => void | Promise<void>
  handleUploadPreventivo: (
  e: React.ChangeEvent<HTMLInputElement>
) => void | Promise<void>

  inputStyle: CSSProperties
  buttonSecondary: CSSProperties
}

export default function EconomiaSelezioneCantierePanel({
  cantieri,
  cantiereScheda,
  setCantiereScheda,
  ricercaCantiereEconomia,
  setRicercaCantiereEconomia,
  mostraConclusiEconomia,
  setMostraConclusiEconomia,
  dragAttivo,
  setDragAttivo,
  caricaFilePreventivo,
  handleUploadPreventivo,
  inputStyle,
  buttonSecondary,
}: Props) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <input
          placeholder="Cerca cantiere..."
          value={ricercaCantiereEconomia}
          onChange={(e) => setRicercaCantiereEconomia(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={() =>
            setMostraConclusiEconomia(!mostraConclusiEconomia)
          }
          style={buttonSecondary}
        >
          {mostraConclusiEconomia
            ? 'Nascondi conclusi'
            : 'Mostra conclusi'}
        </button>
      </div>

      <SelectCantiere
        cantieri={cantieri}
        value={cantiereScheda || ''}
        onChange={setCantiereScheda}
        inputStyle={{
          padding: 8,
          width: 260,
          marginBottom: 15,
        }}
        buttonSecondary={buttonSecondary}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragAttivo(true)
        }}
        onDragLeave={() => setDragAttivo(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDragAttivo(false)

          const file = e.dataTransfer.files?.[0]

          if (!file) return

          await caricaFilePreventivo(file)
        }}
        style={{
          padding: 20,
          border: dragAttivo
            ? '2px solid #2563eb'
            : '2px dashed #cbd5e1',
          borderRadius: 12,
          background: dragAttivo ? '#eff6ff' : '#f8fafc',
          marginBottom: 15,
          textAlign: 'center',
          cursor: cantiereScheda ? 'pointer' : 'not-allowed',
          opacity: cantiereScheda ? 1 : 0.6,
        }}
      >
        <UploadPreventivoBox
          cantiereScheda={cantiereScheda || ''}
          handleUploadPreventivo={handleUploadPreventivo}
        />
      </div>
    </>
  )
}