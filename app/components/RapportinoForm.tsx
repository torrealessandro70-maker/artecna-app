'use client'

import type { CSSProperties } from 'react'
import type { Cantiere } from '../types'

type Props = {
  cantiereRapporto: string
  setCantiereRapporto: (cantiere: string) => void
  data: string
  setData: (data: string) => void
  note: string
  setNote: (note: string) => void
  materiali: string
  setMateriali: (materiali: string) => void
  quantitaMateriali: string
  setQuantitaMateriali: (quantita: string) => void
  costoMateriali: string
  setCostoMateriali: (costo: string) => void
  salvaRapportino: () => void | Promise<void>
  cantieri: Cantiere[]
  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  onClose: () => void
}

export default function RapportinoForm({
  cantiereRapporto,
  setCantiereRapporto,
  data,
  setData,
  note,
  setNote,
  materiali,
  setMateriali,
  quantitaMateriali,
  setQuantitaMateriali,
  costoMateriali,
  setCostoMateriali,
  salvaRapportino,
  cantieri,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
  onClose,
}: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        marginTop: 16,
        padding: 16,
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#f8fafc',
      }}
    >
      <h3 style={{ margin: 0 }}>Nuovo rapportino</h3>

      <label>
        Cantiere
        <select
          value={cantiereRapporto}
          onChange={(event) => setCantiereRapporto(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        >
          <option value="">Seleziona cantiere...</option>
          {cantieri.map((cantiere) => (
            <option key={cantiere.id || cantiere.nome} value={cantiere.nome}>
              {cantiere.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Data
        <input
          type="date"
          value={data}
          onChange={(event) => setData(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        />
      </label>

      <label>
        Note / lavorazioni
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
          rows={4}
        />
      </label>

      <label>
        Materiali
        <input
          value={materiali}
          onChange={(event) => setMateriali(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        />
      </label>

      <label>
        Quantita materiali
        <input
          type="number"
          min="0"
          step="any"
          value={quantitaMateriali}
          onChange={(event) => setQuantitaMateriali(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        />
      </label>

      <label>
        Costo materiali
        <input
          type="number"
          min="0"
          step="0.01"
          value={costoMateriali}
          onChange={(event) => setCostoMateriali(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        />
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void salvaRapportino()}
          style={buttonPrimary}
        >
          Salva rapportino
        </button>
        <button type="button" onClick={onClose} style={buttonSecondary}>
          Chiudi
        </button>
      </div>
    </div>
  )
}
