'use client'

import type { CSSProperties } from 'react'

type Props = {
  nuovaFatturaEmessa: any
  setNuovaFatturaEmessa: (v: any) => void
  setPopupNuovaFatturaEmessa: (v: boolean) => void
  salvaNuovaFatturaEmessa: () => void | Promise<void>

  cantieri: any[]

  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function PopupNuovaFatturaEmessa({
  nuovaFatturaEmessa,
  setNuovaFatturaEmessa,
  setPopupNuovaFatturaEmessa,
  salvaNuovaFatturaEmessa,
  cantieri,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
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
        <h3>🧾 Nuova fattura emessa</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 10,
            marginTop: 12,
          }}
        >
          <input
            placeholder="Numero fattura"
            value={nuovaFatturaEmessa.numero_fattura}
            onChange={(e) =>
              setNuovaFatturaEmessa({
                ...nuovaFatturaEmessa,
                numero_fattura: e.target.value,
              })
            }
            style={inputStyle}
          />

          <input
            type="date"
            value={nuovaFatturaEmessa.data_fattura}
            onChange={(e) =>
              setNuovaFatturaEmessa({
                ...nuovaFatturaEmessa,
                data_fattura: e.target.value,
              })
            }
            style={inputStyle}
          />

          <input
            placeholder="Cliente"
            value={nuovaFatturaEmessa.cliente}
            onChange={(e) =>
              setNuovaFatturaEmessa({
                ...nuovaFatturaEmessa,
                cliente: e.target.value,
              })
            }
            style={inputStyle}
          />

          <select
            value={nuovaFatturaEmessa.cantiere}
            onChange={(e) =>
              setNuovaFatturaEmessa({
                ...nuovaFatturaEmessa,
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
            placeholder="Imponibile"
            value={nuovaFatturaEmessa.imponibile}
            onChange={(e) =>
              setNuovaFatturaEmessa({
                ...nuovaFatturaEmessa,
                imponibile: e.target.value,
              })
            }
            style={inputStyle}
          />

          <input
            type="number"
            placeholder="IVA %"
            value={nuovaFatturaEmessa.iva}
            onChange={(e) =>
              setNuovaFatturaEmessa({
                ...nuovaFatturaEmessa,
                iva: e.target.value,
              })
            }
            style={inputStyle}
          />

          <input
            type="number"
            placeholder="Importo incassato"
            value={nuovaFatturaEmessa.importo_incassato}
            onChange={(e) =>
              setNuovaFatturaEmessa({
                ...nuovaFatturaEmessa,
                importo_incassato: e.target.value,
              })
            }
            style={inputStyle}
          />

          <select
            value={nuovaFatturaEmessa.stato}
            onChange={(e) =>
              setNuovaFatturaEmessa({
                ...nuovaFatturaEmessa,
                stato: e.target.value,
              })
            }
            style={inputStyle}
          >
            <option value="emessa">Emessa</option>
            <option value="parziale">Parziale</option>
            <option value="incassata">Incassata</option>
            <option value="scaduta">Scaduta</option>
          </select>
        </div>

        <textarea
          placeholder="Note..."
          value={nuovaFatturaEmessa.note}
          onChange={(e) =>
            setNuovaFatturaEmessa({
              ...nuovaFatturaEmessa,
              note: e.target.value,
            })
          }
          style={{
            ...inputStyle,
            marginTop: 10,
            minHeight: 80,
            width: '100%',
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 16,
          }}
        >
          <button onClick={salvaNuovaFatturaEmessa} style={buttonPrimary}>
            💾 Salva fattura
          </button>

          <button
            onClick={() => setPopupNuovaFatturaEmessa(false)}
            style={buttonSecondary}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}