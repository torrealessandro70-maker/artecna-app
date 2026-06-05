'use client'

import { useState } from 'react'
import type { Cantiere } from '../types'

type Props = {
  cantieri: Cantiere[]
  value: string
  onChange: (nome: string) => void
  inputStyle: React.CSSProperties
  buttonSecondary: React.CSSProperties
}

export default function SelectCantiere({
  cantieri,
  value,
  onChange,
  inputStyle,
  buttonSecondary,
}: Props) {
  const [ricerca, setRicerca] = useState('')
  const [mostraConclusi, setMostraConclusi] = useState(false)

  const cantieriFiltrati = cantieri.filter((c) => {
    const nomeOk = String(c.nome || '')
      .toLowerCase()
      .includes(ricerca.toLowerCase())

    const statoOk =
      mostraConclusi || !c.lavori_conclusi

    return nomeOk && statoOk
  })

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <input
          placeholder="Cerca cantiere..."
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          style={inputStyle}
        />

        <button
          type="button"
          onClick={() => setMostraConclusi(!mostraConclusi)}
          style={buttonSecondary}
        >
          {mostraConclusi
            ? 'Nascondi conclusi'
            : 'Mostra conclusi'}
        </button>
      </div>

      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">Seleziona cantiere...</option>

        {cantieriFiltrati.map((c) => (
          <option key={c.id || c.nome} value={c.nome}>
            {c.lavori_conclusi ? '✅ ' : '🏗️ '}
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  )
}