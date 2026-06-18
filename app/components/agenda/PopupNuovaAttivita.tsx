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
  type VoceChecklistAttivita,
} from './utils'

type Props = {
  aperto: boolean
  attivitaInModifica?: AttivitaAgenda | null
  opzioniCollegamento: OpzioneCollegamento[]
  onChiudi: () => void
  onSalva: (attivita: AttivitaAgenda) => void
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function PopupNuovaAttivita({
  aperto,
  attivitaInModifica = null,
  opzioniCollegamento,
  onChiudi,
  onSalva,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const collegamentoIniziale = attivitaInModifica?.collegamento
  const valoreCollegamentoIniziale = collegamentoIniziale
    ? `${collegamentoIniziale.tipo}:${
        collegamentoIniziale.id || collegamentoIniziale.etichetta
      }`
    : ''
  const [titolo, setTitolo] = useState(attivitaInModifica?.titolo || '')
  const [descrizione, setDescrizione] = useState(
    attivitaInModifica?.descrizione || ''
  )
  const [checklist, setChecklist] = useState<VoceChecklistAttivita[]>(() =>
    (attivitaInModifica?.checklist || []).map((voce) => ({ ...voce }))
  )
  const [data, setData] = useState(attivitaInModifica?.data || dataLocale())
  const [ora, setOra] = useState(attivitaInModifica?.ora || '09:00')
  const [tipo, setTipo] = useState<TipoAttivita>(
    attivitaInModifica?.tipo || 'Sopralluogo'
  )
  const [stato, setStato] = useState<StatoAttivita>(
    attivitaInModifica?.stato || 'da_fare'
  )
  const [tipoCollegamento, setTipoCollegamento] =
    useState<TipoCollegamento | ''>(collegamentoIniziale?.tipo || '')
  const [valoreCollegamento, setValoreCollegamento] = useState(
    valoreCollegamentoIniziale
  )

  if (!aperto) return null

  const opzioniDisponibili = tipoCollegamento
    ? opzioniCollegamento.filter((opzione) => opzione.tipo === tipoCollegamento)
    : []
  const opzioneInizialeMancante =
    collegamentoIniziale &&
    collegamentoIniziale.tipo === tipoCollegamento &&
    valoreCollegamentoIniziale &&
    !opzioniDisponibili.some(
      (opzione) => opzione.valore === valoreCollegamentoIniziale
    )
      ? {
          ...collegamentoIniziale,
          valore: valoreCollegamentoIniziale,
        }
      : null
  const opzioniFiltrate = opzioneInizialeMancante
    ? [...opzioniDisponibili, opzioneInizialeMancante]
    : opzioniDisponibili
  const checklistValida = checklist.filter((voce) => voce.testo.trim())
  const checklistCompletata =
    checklistValida.length > 0 && checklistValida.every((voce) => voce.completata)

  const salva = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const opzione = opzioniFiltrate.find(
      (elemento) => elemento.valore === valoreCollegamento
    )

    onSalva({
      id: attivitaInModifica?.id || crypto.randomUUID(),
      titolo: titolo.trim(),
      descrizione: descrizione.trim(),
      data,
      ora,
      tipo,
      stato,
      checklist: checklistValida.map((voce) => ({
        ...voce,
        testo: voce.testo.trim(),
      })),
      collegamento: opzione
        ? { tipo: opzione.tipo, id: opzione.id, etichetta: opzione.etichetta }
        : undefined,
      createdAt: attivitaInModifica?.createdAt || new Date().toISOString(),
    })
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
        <h2 style={{ margin: '0 0 18px' }}>
          {attivitaInModifica ? 'Modifica attività' : 'Nuova attività'}
        </h2>

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

          <section
            aria-labelledby="titolo-checklist-attivita"
            style={{
              padding: 14,
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              background: '#f8fafc',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <strong id="titolo-checklist-attivita" style={{ fontSize: 17 }}>
                ✓ Checklist
              </strong>
              <button
                type="button"
                onClick={() =>
                  setChecklist((correnti) => [
                    ...correnti,
                    { id: crypto.randomUUID(), testo: '', completata: false },
                  ])
                }
                style={{
                  ...buttonSecondary,
                  minHeight: 46,
                  padding: '9px 14px',
                  fontWeight: 800,
                }}
              >
                + Nuova voce
              </button>
            </div>

            {checklist.length === 0 ? (
              <div style={{ marginTop: 10, color: '#64748b', fontSize: 14 }}>
                Nessuna voce. Aggiungi i passaggi operativi dell’attività.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
                {checklist.map((voce, indice) => (
                  <div
                    key={voce.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <input
                      type="checkbox"
                      checked={voce.completata}
                      onChange={(event) =>
                        setChecklist((correnti) =>
                          correnti.map((item) =>
                            item.id === voce.id
                              ? { ...item, completata: event.target.checked }
                              : item
                          )
                        )
                      }
                      aria-label={`Completa voce ${indice + 1}`}
                      style={{ width: 26, height: 26, flex: '0 0 26px' }}
                    />
                    <input
                      value={voce.testo}
                      onChange={(event) =>
                        setChecklist((correnti) =>
                          correnti.map((item) =>
                            item.id === voce.id
                              ? { ...item, testo: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="Scrivi una voce..."
                      aria-label={`Testo voce ${indice + 1}`}
                      style={{ ...stileCampo, minWidth: 0, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setChecklist((correnti) =>
                          correnti.filter((item) => item.id !== voce.id)
                        )
                      }
                      aria-label={`Elimina voce ${indice + 1}`}
                      style={{
                        width: 46,
                        height: 46,
                        flex: '0 0 46px',
                        border: '1px solid #fecaca',
                        borderRadius: 9,
                        background: '#fff',
                        color: '#991b1b',
                        fontSize: 22,
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {checklistCompletata && stato !== 'completata' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginTop: 12,
                  padding: 11,
                  border: '1px solid #86efac',
                  borderRadius: 10,
                  background: '#f0fdf4',
                  color: '#166534',
                }}
              >
                <span>Tutte le voci sono completate.</span>
                <button
                  type="button"
                  onClick={() => setStato('completata')}
                  style={{
                    ...buttonPrimary,
                    minHeight: 44,
                    padding: '9px 13px',
                    background: '#16a34a',
                  }}
                >
                  Completa attività
                </button>
              </div>
            )}
          </section>

          <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
            Note
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
            {attivitaInModifica ? 'Salva modifiche' : 'Salva attività'}
          </button>
        </div>
      </form>
    </div>
  )
}
