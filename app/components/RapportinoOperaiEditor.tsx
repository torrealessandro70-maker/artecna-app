'use client'

import type { CSSProperties } from 'react'
import type { OperaioRapportinoInput } from '../types'
import { calcolaOreRapportino } from '../utils/rapportinoOperai'

type Props = {
  operaiDisponibili: readonly {
    id: string
    nome: string
    costo_orario?: number
  }[]
  value: readonly OperaioRapportinoInput[]
  onChange: (value: OperaioRapportinoInput[]) => void
  disabled?: boolean
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  marginTop: 5,
  padding: 10,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 16,
}

export default function RapportinoOperaiEditor({
  operaiDisponibili,
  value,
  onChange,
  disabled = false,
}: Props) {
  const aggiornaOperaio = (
    id: string,
    modifica: Partial<Pick<OperaioRapportinoInput, 'ora_inizio' | 'ora_fine' | 'pausa_minuti'>>
  ) => {
    if (disabled) return
    onChange(value.map((operaio) =>
      operaio.id === id ? { ...operaio, ...modifica } : operaio
    ))
  }

  return (
    <section
      aria-label="Operai presenti"
      style={{
        display: 'grid',
        gap: 10,
        padding: 14,
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#f8fafc',
      }}
    >
      <div>
        <strong>Operai presenti</strong>
        <div style={{ marginTop: 4, fontSize: 13, color: '#64748b' }}>
          Seleziona gli operai che hanno lavorato oggi in questo cantiere.
        </div>
      </div>

      {operaiDisponibili.map((item) => {
        const operaio = value.find((selezionato) => selezionato.id === item.id)
        const ore = operaio
          ? calcolaOreRapportino(operaio.ora_inizio, operaio.ora_fine, operaio.pausa_minuti)
          : 0

        return (
          <div
            key={item.id}
            role="group"
            aria-label={item.nome}
            style={{
              display: 'grid',
              gap: 10,
              padding: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#fff',
            }}
          >
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              minHeight: 36, cursor: disabled ? 'default' : 'pointer',
            }}>
              <input
                type="checkbox"
                checked={Boolean(operaio)}
                disabled={disabled}
                onChange={(event) => {
                  if (disabled) return
                  if (!event.target.checked) {
                    onChange(value.filter((selezionato) => selezionato.id !== item.id))
                  } else if (!operaio) {
                    onChange([...value, {
                      id: item.id,
                      nome: item.nome,
                      ora_inizio: '',
                      ora_fine: '',
                      pausa_minuti: 0,
                      costo_orario: item.costo_orario,
                    }])
                  }
                }}
                style={{ width: 20, height: 20 }}
              />
              <span style={{ fontWeight: 600 }}>{item.nome}</span>
            </label>

            {operaio && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
                <label style={{ fontSize: 13 }}>
                  Ora inizio
                  <input
                    type="time"
                    value={operaio.ora_inizio}
                    disabled={disabled}
                    onChange={(event) => aggiornaOperaio(item.id, { ora_inizio: event.target.value })}
                    style={inputStyle}
                  />
                </label>
                <label style={{ fontSize: 13 }}>
                  Ora fine
                  <input
                    type="time"
                    value={operaio.ora_fine}
                    disabled={disabled}
                    onChange={(event) => aggiornaOperaio(item.id, { ora_fine: event.target.value })}
                    style={inputStyle}
                  />
                </label>
                <label style={{ gridColumn: '1 / -1', fontSize: 13 }}>
                  Pausa
                  <select
                    value={operaio.pausa_minuti}
                    disabled={disabled}
                    onChange={(event) => aggiornaOperaio(item.id, { pausa_minuti: Number(event.target.value) })}
                    style={{ ...inputStyle, background: '#fff' }}
                  >
                    <option value={0}>Nessuna</option>
                    <option value={15}>15 minuti</option>
                    <option value={30}>30 minuti</option>
                    <option value={45}>45 minuti</option>
                    <option value={60}>60 minuti</option>
                    <option value={90}>90 minuti</option>
                  </select>
                </label>
                {operaio.ora_inizio && operaio.ora_fine && (
                  <div style={{
                    gridColumn: '1 / -1', fontSize: 14, fontWeight: 700,
                    color: ore > 0 ? '#166534' : '#991b1b',
                  }}>
                    {ore > 0
                      ? `Ore lavorate: ${ore.toLocaleString('it-IT', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : 'Controlla gli orari inseriti'}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
