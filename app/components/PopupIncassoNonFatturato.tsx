'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'

type Props = {
  nuovoIncassoNonFatturato: any
  setNuovoIncassoNonFatturato: Dispatch<SetStateAction<any>>
  cantieri: any[]

  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties

  salvaIncassoNonFatturato: () => void | Promise<void>
  setPopupIncassoNonFatturato: Dispatch<SetStateAction<boolean>>
}

export default function PopupIncassoNonFatturato({
  nuovoIncassoNonFatturato,
  setNuovoIncassoNonFatturato,
  cantieri,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
  salvaIncassoNonFatturato,
  setPopupIncassoNonFatturato,
}: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          width: '100%',
          maxWidth: 700,
        }}
      >
        <h3>➕ Incasso non fatturato</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 10,
            marginTop: 12,
          }}
        >
          <input
            type="date"
            value={nuovoIncassoNonFatturato.data_incasso}
            onChange={(e) =>
              setNuovoIncassoNonFatturato({
                ...nuovoIncassoNonFatturato,
                data_incasso: e.target.value,
              })
            }
            style={inputStyle}
          />

          <input
            placeholder="Cliente"
            value={nuovoIncassoNonFatturato.cliente}
            onChange={(e) =>
              setNuovoIncassoNonFatturato({
                ...nuovoIncassoNonFatturato,
                cliente: e.target.value,
              })
            }
            style={inputStyle}
          />

          <select
            value={nuovoIncassoNonFatturato.cantiere}
            onChange={(e) =>
              setNuovoIncassoNonFatturato({
                ...nuovoIncassoNonFatturato,
                cantiere: e.target.value,
              })
            }
            style={inputStyle}
          >
            <option value="">Seleziona cantiere</option>

            {cantieri.map((c) => (
              <option key={c.id || c.nome} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Importo incassato"
            value={nuovoIncassoNonFatturato.importo}
            onChange={(e) =>
              setNuovoIncassoNonFatturato({
                ...nuovoIncassoNonFatturato,
                importo: e.target.value,
              })
            }
            style={inputStyle}
          />

          <input
            placeholder="Metodo pagamento"
            value={nuovoIncassoNonFatturato.metodo}
            onChange={(e) =>
              setNuovoIncassoNonFatturato({
                ...nuovoIncassoNonFatturato,
                metodo: e.target.value,
              })
            }
            style={inputStyle}
          />
        </div>

        <textarea
          placeholder="Descrizione lavoro / note fiscali..."
          value={nuovoIncassoNonFatturato.descrizione}
          onChange={(e) =>
            setNuovoIncassoNonFatturato({
              ...nuovoIncassoNonFatturato,
              descrizione: e.target.value,
            })
          }
          style={{
            ...inputStyle,
            marginTop: 10,
            minHeight: 80,
            width: '100%',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={salvaIncassoNonFatturato} style={buttonPrimary}>
            💾 Salva incasso
          </button>

          <button
            type="button"
            onClick={() => setPopupIncassoNonFatturato(false)}
            style={buttonSecondary}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}