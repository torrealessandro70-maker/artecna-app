'use client'

import type { CSSProperties } from 'react'

type Props = {
  fatturaEmessaAperta: any
  setFatturaEmessaAperta: (v: any) => void

  cantieri: any[]
  formatMoney: (v: any) => string

  aggiornaFatturaEmessa: () => void | Promise<void>
  eliminaFatturaEmessa: () => void | Promise<void>

  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function PopupDettaglioFatturaEmessa({
  fatturaEmessaAperta,
  setFatturaEmessaAperta,
  cantieri,
  formatMoney,
  aggiornaFatturaEmessa,
  eliminaFatturaEmessa,
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
          maxWidth: 750,
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <h3>🧾 Dettaglio fattura emessa</h3>

        <p>
          <strong>Numero:</strong> {fatturaEmessaAperta.numero_fattura}
        </p>

        <p>
          <strong>Data:</strong> {fatturaEmessaAperta.data_fattura}
        </p>

        <p>
          <strong>Cliente:</strong> {fatturaEmessaAperta.cliente}
        </p>

        <div style={{ marginTop: 10 }}>
          <strong>Cantiere collegato</strong>

          <select
            value={fatturaEmessaAperta.cantiere || ''}
            onChange={(e) =>
              setFatturaEmessaAperta({
                ...fatturaEmessaAperta,
                cantiere: e.target.value,
              })
            }
            style={{
              ...inputStyle,
              marginTop: 6,
              width: '100%',
            }}
          >
            <option value="">Nessun cantiere collegato</option>

            {cantieri.map((c) => (
              <option key={c.id || c.nome} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <p>
          <strong>Imponibile:</strong>{' '}
          {formatMoney(Number(fatturaEmessaAperta.imponibile || 0))}
        </p>

        <p>
          <strong>IVA:</strong>{' '}
          {formatMoney(Number(fatturaEmessaAperta.iva || 0))}
        </p>

        <p>
          <strong>Totale:</strong>{' '}
          {formatMoney(Number(fatturaEmessaAperta.totale || 0))}
        </p>

        <div style={{ marginTop: 10 }}>
          <strong>Importo incassato</strong>

          <input
            type="number"
            value={fatturaEmessaAperta.importo_incassato || 0}
            onChange={(e) =>
              setFatturaEmessaAperta({
                ...fatturaEmessaAperta,
                importo_incassato: e.target.value,
              })
            }
            style={{
              ...inputStyle,
              marginTop: 6,
              width: '100%',
            }}
          />
        </div>

        <p>
          <strong>Stato:</strong> {fatturaEmessaAperta.stato}
        </p>

        {fatturaEmessaAperta.note && (
          <div style={{ marginTop: 12 }}>
            <strong>Note</strong>

            <div
              style={{
                marginTop: 6,
                padding: 10,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#f8fafc',
                whiteSpace: 'pre-wrap',
              }}
            >
              {fatturaEmessaAperta.note}
            </div>
          </div>
        )}

        {fatturaEmessaAperta.xml_url && (
          <div style={{ marginTop: 12 }}>
            <a
              href={fatturaEmessaAperta.xml_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...buttonSecondary,
                display: 'inline-block',
                textDecoration: 'none',
              }}
            >
              📄 Apri XML
            </a>
          </div>
        )}

        {fatturaEmessaAperta.pdf_url && (
          <div style={{ marginTop: 12 }}>
            <a
              href={fatturaEmessaAperta.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...buttonPrimary,
                display: 'inline-block',
                textDecoration: 'none',
              }}
            >
              📕 Apri PDF fattura
            </a>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 16,
          }}
        >
          <button onClick={aggiornaFatturaEmessa} style={buttonPrimary}>
            💾 Salva modifiche
          </button>

          <button
            onClick={eliminaFatturaEmessa}
            style={{
              ...buttonSecondary,
              backgroundColor: '#dc2626',
              color: '#fff',
            }}
          >
            🗑 Elimina
          </button>

          <button
            onClick={() => setFatturaEmessaAperta(null)}
            style={buttonSecondary}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}