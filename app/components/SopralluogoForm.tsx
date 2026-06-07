'use client'

import type { CSSProperties } from 'react'

type Props = {
  clienteSopralluogo: string
  setClienteSopralluogo: (v: string) => void

  telefonoSopralluogo: string
  setTelefonoSopralluogo: (v: string) => void

  indirizzoSopralluogo: string
  setIndirizzoSopralluogo: (v: string) => void

  geolocalizzazioneSopralluogo: string
  setGeolocalizzazioneSopralluogo: (v: string) => void

  rilevaGeolocalizzazioneSopralluogo: () => void | Promise<void>

  dataSopralluogo: string
  setDataSopralluogo: (v: string) => void

  oraSopralluogo: string
  setOraSopralluogo: (v: string) => void

  promemoriaSopralluogo: string
  setPromemoriaSopralluogo: (v: string) => void

  tipoLavoroSopralluogo: string
  setTipoLavoroSopralluogo: (v: string) => void

  noteSopralluogo: string
  setNoteSopralluogo: (v: string) => void

  salvaSopralluogo: () => void | Promise<void>

  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function SopralluogoForm({
  clienteSopralluogo,
  setClienteSopralluogo,
  telefonoSopralluogo,
  setTelefonoSopralluogo,
  indirizzoSopralluogo,
  setIndirizzoSopralluogo,
  geolocalizzazioneSopralluogo,
  setGeolocalizzazioneSopralluogo,
  rilevaGeolocalizzazioneSopralluogo,
  dataSopralluogo,
  setDataSopralluogo,
  oraSopralluogo,
  setOraSopralluogo,
  promemoriaSopralluogo,
  setPromemoriaSopralluogo,
  tipoLavoroSopralluogo,
  setTipoLavoroSopralluogo,
  noteSopralluogo,
  setNoteSopralluogo,
  salvaSopralluogo,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
      <input
        placeholder="Cliente"
        value={clienteSopralluogo}
        onChange={(e) => setClienteSopralluogo(e.target.value)}
      />

      <input
        placeholder="Telefono"
        value={telefonoSopralluogo}
        onChange={(e) => setTelefonoSopralluogo(e.target.value)}
      />

      <input
        placeholder="Indirizzo"
        value={indirizzoSopralluogo}
        onChange={(e) => setIndirizzoSopralluogo(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          placeholder="Geolocalizzazione"
          value={geolocalizzazioneSopralluogo}
          onChange={(e) =>
            setGeolocalizzazioneSopralluogo(e.target.value)
          }
          style={{ flex: 1 }}
        />

        <button
          type="button"
          onClick={rilevaGeolocalizzazioneSopralluogo}
          style={buttonSecondary}
        >
          📍 Usa posizione attuale
        </button>
      </div>

      <input
        type="date"
        value={dataSopralluogo}
        onChange={(e) => setDataSopralluogo(e.target.value)}
      />

      <div>
        <label>Ora appuntamento</label>

        <input
          type="time"
          value={oraSopralluogo}
          onChange={(e) => setOraSopralluogo(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div>
        <label>Promemoria</label>

        <input
          type="text"
          placeholder="Es: chiamare cliente prima"
          value={promemoriaSopralluogo}
          onChange={(e) =>
            setPromemoriaSopralluogo(e.target.value)
          }
          style={inputStyle}
        />
      </div>

      <input
        placeholder="Tipo lavoro"
        value={tipoLavoroSopralluogo}
        onChange={(e) =>
          setTipoLavoroSopralluogo(e.target.value)
        }
      />

      <textarea
        placeholder="Note sopralluogo"
        value={noteSopralluogo}
        onChange={(e) => setNoteSopralluogo(e.target.value)}
        style={{ minHeight: 100 }}
      />

      <button
        onClick={salvaSopralluogo}
        style={buttonPrimary}
      >
        💾 Salva sopralluogo
      </button>
    </div>
  )
}