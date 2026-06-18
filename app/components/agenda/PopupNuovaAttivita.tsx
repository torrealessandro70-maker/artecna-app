'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import {
  TIPI_ATTIVITA,
  dataLocale,
  type AttivitaAgenda,
  type OpzioneCollegamento,
  type StatoAttivita,
  type TipoAttivita,
  type TipoCollegamento,
} from './utils'

type Props = {
  aperto: boolean
  opzioniCollegamento: OpzioneCollegamento[]
  onChiudi: () => void
  onSalva: (attivita: AttivitaAgenda) => void
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function PopupNuovaAttivita({
  aperto,
  opzioniCollegamento,
  onChiudi,
  onSalva,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [data, setData] = useState(dataLocale())
  const [ora, setOra] = useState('09:00')
  const [tipo, setTipo] = useState<TipoAttivita>('Sopralluogo')
  const [stato, setStato] = useState<StatoAttivita>('da_fare')
  const [tipoCollegamento, setTipoCollegamento] =
    useState<TipoCollegamento | ''>('')
  const [valoreCollegamento, setValoreCollegamento] = useState('')

  if (!aperto) return null

  const opzioniFiltrate = tipoCollegamento
    ? opzioniCollegamento.filter((opzione) => opzione.tipo === tipoCollegamento)
    : []

  const salva = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const opzione = opzioniFiltrate.find(
      (elemento) => elemento.valore === valoreCollegamento
    )

    onSalva({
      id: crypto.randomUUID(),
      titolo: titolo.trim(),
      descrizione: descrizione.trim(),
      data,
      ora,
      tipo,
      stato,
      collegamento: opzione
        ? { tipo: opzione.tipo, id: opzione.id, etichetta: opzione.etichetta }
        : undefined,
      createdAt: new Date().toISOString(),
    })

    setTitolo('')
    setDescrizione('')
    setData(dataLocale())
    setOra('09:00')
    setTipo('Sopralluogo')
    setStato('da_fare')
    setTipoCollegamento('')
    setValoreCollegamento('')
  }

  const stileCampo: CSSProperties = {
    width: '100%',
    minHeight: 50,
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    background: '#fff',
    fontSize: 16,
  }

  return (
    <div
      role="presentation"
      onClick={onChiudi}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        display: 'grid',
        placeItems: 'center',
        padding: 18,
        background: 'rgba(15,23,42,0.5)',
      }}
    >
      <form
        onSubmit={salva}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 620px)',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 22,
          borderRadius: 18,
          background: '#fff',
          boxShadow: '0 24px 70px rgba(15,23,42,0.3)',
        }}
      >
        <h2 style={{ margin: '0 0 18px' }}>Nuova attività</h2>

        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
            Titolo
            <input
              value={titolo}
              onChange={(event) => setTitolo(event.target.value)}
              autoFocus
              required
              style={stileCampo}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
            Descrizione
            <textarea
              value={descrizione}
              onChange={(event) => setDescrizione(event.target.value)}
              style={{ ...stileCampo, minHeight: 90, resize: 'vertical' }}
            />
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
              Data
              <input
                type="date"
                value={data}
                onChange={(event) => setData(event.target.value)}
                required
                style={stileCampo}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
              Ora
              <input
                type="time"
                value={ora}
                onChange={(event) => setOra(event.target.value)}
                required
                style={stileCampo}
              />
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
              Tipo attività
              <select
                value={tipo}
                onChange={(event) => setTipo(event.target.value as TipoAttivita)}
                style={stileCampo}
              >
                {TIPI_ATTIVITA.map((valore) => (
                  <option key={valore} value={valore}>
                    {valore}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
              Stato
              <select
                value={stato}
                onChange={(event) => setStato(event.target.value as StatoAttivita)}
                style={stileCampo}
              >
                <option value="da_fare">Da fare</option>
                <option value="completata">Completata</option>
              </select>
            </label>
          </div>

          <fieldset
            style={{
              margin: 0,
              padding: 14,
              border: '1px solid #e2e8f0',
              borderRadius: 12,
            }}
          >
            <legend style={{ padding: '0 6px', fontWeight: 800 }}>
              Collegamento al Fascicolo (opzionale)
            </legend>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 12,
              }}
            >
              <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
                Collega a
                <select
                  value={tipoCollegamento}
                  onChange={(event) => {
                    setTipoCollegamento(event.target.value as TipoCollegamento | '')
                    setValoreCollegamento('')
                  }}
                  style={stileCampo}
                >
                  <option value="">Nessun collegamento</option>
                  <option value="sopralluogo">Sopralluogo</option>
                  <option value="cantiere">Cantiere</option>
                  <option value="cliente">Cliente</option>
                  <option value="preventivo">Preventivo</option>
                </select>
              </label>

              {tipoCollegamento && (
                <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
                  Fascicolo
                  <select
                    value={valoreCollegamento}
                    onChange={(event) => setValoreCollegamento(event.target.value)}
                    style={stileCampo}
                  >
                    <option value="">Seleziona...</option>
                    {opzioniFiltrate.map((opzione) => (
                      <option key={opzione.valore} value={opzione.valore}>
                        {opzione.etichetta}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </fieldset>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 20,
          }}
        >
          <button
            type="button"
            onClick={onChiudi}
            style={{ ...buttonSecondary, minHeight: 50, padding: '11px 18px' }}
          >
            Annulla
          </button>
          <button
            type="submit"
            style={{ ...buttonPrimary, minHeight: 50, padding: '11px 20px' }}
          >
            Salva attività
          </button>
        </div>
      </form>
    </div>
  )
}
