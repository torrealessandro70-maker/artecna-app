'use client'

import type { CSSProperties } from 'react'
import SelectCantiere from './SelectCantiere'

type Props = {
  cantieri: any[]
  cantiereScheda: string | null
  setCantiereScheda: (value: string) => void

  ricercaCantiereEconomia: string
  setRicercaCantiereEconomia: (value: string) => void

  mostraConclusiEconomia: boolean
  setMostraConclusiEconomia: (value: boolean) => void

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

    </>
  )
}
