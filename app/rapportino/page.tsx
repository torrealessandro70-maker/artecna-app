'use client'

import { useState } from 'react'
import RapportinoForm from '../components/RapportinoForm'
import RapportinoOperaiEditor from '../components/RapportinoOperaiEditor'
import type { OperaioRapportinoInput } from '../types'
import { preparaOperaiRapportino } from '../utils/rapportinoOperai'
import {
  applicaOperaiRiconosciuti,
  type PropostaOperaioRiconosciuto,
} from '../utils/applicaOperaiRiconosciuti'

type OperaioAccesso = {
  id: string
  nome: string
}

type OperaioDisponibile = {
  id: string
  nome: string
  costo_orario?: number
}

type CantiereAccesso = {
  id: string
  nome: string
}

export default function RapportinoOperaiPage() {
  const [pin, setPin] = useState('')
  const [operaio, setOperaio] = useState<OperaioAccesso | null>(null)
const [fotoRapportino, setFotoRapportino] = useState<string[]>([])
  const [cantieri, setCantieri] = useState<CantiereAccesso[]>([])
  const [operaiDisponibili, setOperaiDisponibili] =
    useState<OperaioDisponibile[]>([])
  const [operaiRapportino, setOperaiRapportino] =
    useState<OperaioRapportinoInput[]>([])
const [rapportinoEsistente, setRapportinoEsistente] = useState<any>(null)
const [timbratureRapportino, setTimbratureRapportino] = useState<any[]>([])

  const [cantiereId, setCantiereId] = useState('')
  const [cantiereSelezionato, setCantiereSelezionato] =
    useState<CantiereAccesso | null>(null)

  const [statoRapportino, setStatoRapportino] = useState<{
  data: string
  presente: boolean
  rapportinoId?: string
} | null>(null)
const [dataRapportino, setDataRapportino] = useState('')
  const [errore, setErrore] = useState('')
  const [accessoInCorso, setAccessoInCorso] = useState(false)
  const [statoInCorso, setStatoInCorso] = useState(false)
  const [mostraForm, setMostraForm] = useState(false)
  const [messaggioApplicazioneOperai, setMessaggioApplicazioneOperai] = useState('')
const [note, setNote] = useState('')
const [materiali, setMateriali] = useState('')
const [quantitaMateriali, setQuantitaMateriali] = useState('')
const [costoMateriali, setCostoMateriali] = useState('')
const [fotoRapportinoAperte, setFotoRapportinoAperte] = useState<any[]>([])
const operaiRapportinoPreparati = preparaOperaiRapportino(operaiRapportino)
  .sort((a, b) =>
    operaiDisponibili.findIndex((item) => item.id === a.id) -
    operaiDisponibili.findIndex((item) => item.id === b.id)
  )


  const applicaProposteOperaiRiconosciuti = (
    proposte: readonly PropostaOperaioRiconosciuto[]
  ) => {
    if (statoInCorso) return
    const anagrafica = operaiDisponibili.map(({ id, nome, costo_orario }) => ({
      id, nome, costo_orario,
    }))
    const risultato = applicaOperaiRiconosciuti(operaiRapportino, proposte, anagrafica)
    setOperaiRapportino(risultato.operai)
    const daVerificare = risultato.esiti.some((esito) =>
      esito.stato === 'conflitto' || esito.stato === 'escluso' || esito.orariDaCompletare
    )
    setMessaggioApplicazioneOperai(daVerificare
      ? 'Applicazione completata con elementi da verificare: controlla gli operai e gli orari. I conflitti non sono stati applicati.'
      : 'Operai riconosciuti applicati.')
  }

  const accedi = async () => {
    const pinPulito = pin.trim()

    if (!pinPulito || accessoInCorso) return

    setErrore('')
    setAccessoInCorso(true)

    try {
      const risposta = await fetch('/api/rapportino/accesso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
  pin: pinPulito,
}),
      })

      const risultato = await risposta.json()

      if (!risposta.ok) {
        setErrore(risultato?.error || 'Accesso non riuscito')
        return
      }

      setOperaio(risultato.operaio)
      setOperaiDisponibili(
        (Array.isArray(risultato.operai) ? risultato.operai : []).filter(
          (item: OperaioDisponibile) =>
            typeof item?.id === 'string' && item.id.trim().length > 0
        )
      )
      setCantieri(risultato.cantieri || [])

      setCantiereId('')
      setCantiereSelezionato(null)
      setStatoRapportino(null)
      setOperaiRapportino([])
      setMostraForm(false)
      setPin('')
    } catch {
      setErrore('Connessione non disponibile')
    } finally {
      setAccessoInCorso(false)
    }
  }

  const continua = async () => {
    if (!cantiereId || statoInCorso) return

    setMostraForm(false)
    setCantiereSelezionato(null)
    setStatoRapportino(null)
    setOperaiRapportino([])
setRapportinoEsistente(null)
setTimbratureRapportino([])
setNote('')
setMateriali('')
setQuantitaMateriali('')
setCostoMateriali('')

    const cantiere = cantieri.find(
      (item) => item.id === cantiereId
    )

    if (!cantiere) {
      setErrore('Cantiere non valido')
      return
    }

    setErrore('')
    setStatoInCorso(true)

    try {
      const risposta = await fetch('/api/rapportino/stato', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
       body: JSON.stringify({
  cantiereId: cantiere.id,
  data: dataRapportino || undefined,
}),
      })

      const risultato = await risposta.json()

      if (!risposta.ok) {
        setErrore(
          risultato?.error ||
            'Impossibile controllare il rapportino'
        )
        return
      }

      setCantiereSelezionato(cantiere)

setStatoRapportino({
  data: risultato.data,
  presente: Boolean(risultato.presente),
  rapportinoId: risultato.rapportino?.id
    ? String(risultato.rapportino.id)
    : undefined,
})

setRapportinoEsistente(risultato.rapportino || null)

setTimbratureRapportino(
  Array.isArray(risultato.timbrature)
    ? risultato.timbrature
    : []
)

setDataRapportino(risultato.data)

    } catch {
      setErrore('Connessione non disponibile')
    } finally {
      setStatoInCorso(false)
    }
  }
const controllaDataRapportino = async (nuovaData: string) => {
  if (!cantiereSelezionato || !nuovaData) return

  setErrore('')
  setStatoInCorso(true)

  try {
    const risposta = await fetch('/api/rapportino/stato', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cantiereId: cantiereSelezionato.id,
        data: nuovaData,
      }),
    })

    const risultato = await risposta.json()

    if (!risposta.ok) {
      setErrore(
        risultato?.error ||
          'Impossibile controllare il rapportino'
      )
      return
    }

    setDataRapportino(risultato.data)

    setStatoRapportino({
  data: risultato.data,
  presente: Boolean(risultato.presente),
  rapportinoId: risultato.rapportino?.id
    ? String(risultato.rapportino.id)
    : undefined,
})

setRapportinoEsistente(risultato.rapportino || null)

setTimbratureRapportino(
  Array.isArray(risultato.timbrature)
    ? risultato.timbrature
    : []
)

if (risultato.presente) {
  setMostraForm(false)
}
  } catch {
    setErrore('Connessione non disponibile')
  } finally {
    setStatoInCorso(false)
  }
}

const salvaRapportinoPortale = async () => {
if (!operaio || !cantiereSelezionato || !dataRapportino) {
  setErrore('Operaio, cantiere e data sono obbligatori')
  return
}
  const operaiValidi = operaiRapportinoPreparati.filter(
    (operaio) => operaio.nome && operaio.ore > 0
  )

 if (operaiValidi.length === 0) {

  setErrore('Inserisci gli orari di almeno un operaio')
  return
}

 setErrore('')
setStatoInCorso(true)

try {
    const risposta = await fetch('/api/rapportino/salva', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cantiereId: cantiereSelezionato.id,
rapportinoId: statoRapportino?.rapportinoId || undefined,
compilatoDaOperaioId: operaio.id,
compilatoDaNome: operaio.nome,
        data: dataRapportino,
        note,
        materiali,
        quantitaMateriali,
        operai: operaiValidi.map(({ id, nome, ora_inizio, ora_fine, pausa_minuti, ore }) => ({
          id, nome, ora_inizio, ora_fine, pausa_minuti, ore,
        })),
        foto: fotoRapportino,
      }),
    })

const testoRisposta = await risposta.text()

let risultato: any = {}

try {
  risultato = testoRisposta
    ? JSON.parse(testoRisposta)
    : {}
} catch {
  risultato = {
    error: testoRisposta || `Errore HTTP ${risposta.status}`,
  }
}

    

  if (!risposta.ok) {
  setErrore(
    `Errore ${risposta.status}: ` +
      (risultato?.error || 'Salvataggio rapportino non riuscito')
  )
  return
}

    setStatoRapportino({
      data: dataRapportino,
      presente: true,
    })
setFotoRapportino([])
setNote('')
setMateriali('')
setQuantitaMateriali('')
setCostoMateriali('')
setOperaiRapportino([])

    setMostraForm(false)
  } catch {
    setErrore('Connessione non disponibile')
  } finally {
    setStatoInCorso(false)
  }
}

  const esci = () => {
    setOperaio(null)
    setCantieri([])
    setOperaiDisponibili([])
    setOperaiRapportino([])
    setCantiereId('')
    setCantiereSelezionato(null)
    setStatoRapportino(null)
    setMostraForm(false)
    setPin('')
    setErrore('')
setNote('')
setMateriali('')
setQuantitaMateriali('')
setCostoMateriali('')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          margin: '0 auto',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 20,
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26 }}>
          Rapportino giornaliero
        </h1>

        <p style={{ color: '#64748b', marginTop: 8 }}>
          Portale operai ARTECNA
        </p>

        {!operaio ? (
          <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
            <label style={{ fontWeight: 700 }}>
              PIN operaio
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void accedi()
                  }
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: 6,
                  padding: 12,
                  fontSize: 18,
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                }}
              />
            </label>

            {errore && (
              <div
                role="alert"
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: '#fef2f2',
                  color: '#991b1b',
                }}
              >
                {errore}
              </div>
            )}

            <button
              type="button"
              disabled={!pin.trim() || accessoInCorso}
              onClick={() => void accedi()}
              style={{
                minHeight: 48,
                border: 0,
                borderRadius: 10,
                background: '#2563eb',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                cursor: accessoInCorso ? 'wait' : 'pointer',
                opacity: !pin.trim() || accessoInCorso ? 0.6 : 1,
              }}
            >
              {accessoInCorso ? 'Accesso...' : 'Accedi'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
            <div
              style={{
                padding: 14,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 10,
              }}
            >
{errore && (
  <div
    role="alert"
    style={{
      padding: 12,
      borderRadius: 8,
      background: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#991b1b',
      fontWeight: 600,
    }}
  >
    {errore}
  </div>
)}
              <strong>{operaio.nome}</strong>
              <div style={{ color: '#166534', marginTop: 4 }}>
                Accesso effettuato
              </div>
            </div>

            <label style={{ fontWeight: 700 }}>
              Cantiere
              <select
                value={cantiereId}
                onChange={(event) => setCantiereId(event.target.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: 6,
                  padding: 12,
                  minHeight: 48,
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  background: '#fff',
                  fontSize: 16,
                }}
              >
                <option value="">Seleziona cantiere...</option>

                {cantieri.map((cantiere) => (
                  <option key={cantiere.id} value={cantiere.id}>
                    {cantiere.nome}
                  </option>
                ))}
              </select>
            </label>

           <button
  type="button"
  disabled={!cantiereId || statoInCorso}
  onClick={() => void continua()}
  style={{
    minHeight: 48,
    border: 0,
    borderRadius: 10,
    background: '#2563eb',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    opacity: cantiereId && !statoInCorso ? 1 : 0.6,
  }}
>
  {statoInCorso ? 'Controllo...' : 'Continua'}
</button>
{cantiereSelezionato && statoRapportino && (
  <div
    style={{
      padding: 16,
      borderRadius: 10,
      border: statoRapportino.presente
        ? '1px solid #bbf7d0'
        : '1px solid #fde68a',
      background: statoRapportino.presente
        ? '#f0fdf4'
        : '#fffbeb',
    }}
  >
    <strong>{cantiereSelezionato.nome}</strong>

    <div
      style={{
        marginTop: 8,
        fontWeight: 700,
        color: statoRapportino.presente
          ? '#166534'
          : '#92400e',
      }}
    >
      {statoRapportino.presente
        ? 'Rapportino di oggi già inviato'
        : 'Rapportino di oggi non ancora inviato'}
    </div>

    {!statoRapportino.presente && !mostraForm && (
      <button
        type="button"
        onClick={() => {
  setOperaiRapportino([])
  setMessaggioApplicazioneOperai('')
  setMostraForm(true)
}}
        style={{
          width: '100%',
          minHeight: 48,
          marginTop: 14,
          border: 0,
          borderRadius: 10,
          background: '#2563eb',
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Compila rapportino
      </button>
    )}
  </div>
)}

{statoRapportino &&
  statoRapportino.presente &&
  statoRapportino.rapportinoId &&
  !mostraForm && (
    <button
      type="button"
     onClick={() => {
  if (!rapportinoEsistente) return

  setNote(String(rapportinoEsistente.note || ''))
  setMateriali(String(rapportinoEsistente.materiali || ''))
  setQuantitaMateriali(
    String(rapportinoEsistente.quantita_materiali || '')
  )
const operaiRicostruiti: OperaioRapportinoInput[] = []

timbratureRapportino.forEach((timbratura) => {
  const operaioId = String(timbratura.operaio_id || '').trim()
  if (!operaioId) return

  const item = operaiDisponibili.find(
    (disponibile) => disponibile.id === operaioId
  )
  if (!item) return

  if (operaiRicostruiti.some((operaio) => operaio.id === item.id)) {
    return
  }

  operaiRicostruiti.push({
    id: item.id,
    nome: item.nome,
    ora_inizio: timbratura.ora_entrata || '',
    ora_fine: timbratura.ora_uscita || '',
    pausa_minuti: 0,
    costo_orario: item.costo_orario,
  })
})
setOperaiRapportino(operaiRicostruiti)
  setMessaggioApplicazioneOperai('')
  setMostraForm(true)
}}
      style={{
        width: '100%',
        minHeight: 48,
        marginTop: 14,
        border: 0,
        borderRadius: 10,
        background: '#2563eb',
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      Apri / Modifica rapportino
    </button>
  )}

{mostraForm &&
  cantiereSelezionato &&
  statoRapportino && (
    <section
      style={{
        display: 'grid',
        gap: 14,
        padding: 16,
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            color: '#64748b',
          }}
        >
          Cantiere
        </div>
        <strong>{cantiereSelezionato.nome}</strong>
      </div>

      <div>
        <div
          style={{
            fontSize: 13,
            color: '#64748b',
          }}
        >
          Data
        </div>
        <strong>{statoRapportino.data}</strong>
      </div>

      <div>
        <div
          style={{
            fontSize: 13,
            color: '#64748b',
          }}
        >
          Compilato da
        </div>
        <strong>{operaio.nome}</strong>
      </div>
<RapportinoOperaiEditor
  operaiDisponibili={operaiDisponibili}
  value={operaiRapportino}
  onChange={setOperaiRapportino}
  disabled={statoInCorso}
/>
<section
  style={{
    display: 'grid',
    gap: 10,
    padding: 14,
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    background: '#fff',
  }}
>
  <strong>Foto del lavoro</strong>

  <input
    type="file"
    accept="image/*"
    capture="environment"
    multiple
    onChange={(event) => {
      const files = Array.from(event.target.files || [])

      files.forEach((file) => {
        const reader = new FileReader()

        reader.onload = () => {
          if (typeof reader.result !== 'string') return

          setFotoRapportino((correnti) => [
            ...correnti,
            reader.result as string,
          ])
        }

        reader.readAsDataURL(file)
      })

      event.target.value = ''
    }}
  />

  {fotoRapportino.length > 0 && (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}
    >
      {fotoRapportino.map((foto, indice) => (
        <div key={indice} style={{ position: 'relative' }}>
          <img
            src={foto}
            alt={`Foto ${indice + 1}`}
            style={{
              width: '100%',
              aspectRatio: '1',
              objectFit: 'cover',
              borderRadius: 8,
            }}
          />

          <button
            type="button"
            onClick={() =>
              setFotoRapportino((correnti) =>
                correnti.filter((_, i) => i !== indice)
              )
            }
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 0,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )}
</section>
<RapportinoForm
  cantiereRapporto={cantiereSelezionato.nome}
  setCantiereRapporto={() => {}}
data={dataRapportino}
setData={(nuovaData) => {
  setMessaggioApplicazioneOperai('')
  setDataRapportino(nuovaData)
  void controllaDataRapportino(nuovaData)
}}

  note={note}
  setNote={setNote}
  materiali={materiali}
  setMateriali={setMateriali}
  quantitaMateriali={quantitaMateriali}
  setQuantitaMateriali={setQuantitaMateriali}
  costoMateriali={costoMateriali}
  setCostoMateriali={setCostoMateriali}
  salvaRapportino={() => {}}
  aggiornaRapportino={() => {}}
  rapportinoInModifica={
  statoRapportino?.presente && statoRapportino.rapportinoId
    ? statoRapportino.rapportinoId
    : null
}
  cantieri={cantieri}
  inputStyle={{}}
  buttonPrimary={{}}
  buttonSecondary={{}}
  ascoltoRapportino={false}
  operaiAnagrafica={operaiDisponibili}
  operaiRapportinoTemp={operaiRapportinoPreparati.map((item) => ({
    nome: item.nome,
    ora_inizio: item.ora_inizio,
    ora_fine: item.ora_fine,
    ore: item.ore,
    costo_orario: 0,
  }))}
  setOperaiRapportinoTemp={() => {}}
  setPopupFotoRapportino={() => {}}
  fotoCantiere={[]}
  setFotoRapportinoAperte={setFotoRapportinoAperte}
  onClose={() => setMostraForm(false)}
  modalitaPortaleOperai
  onSalvaPortale={salvaRapportinoPortale}
  onApplicaOperaiRiconosciuti={applicaProposteOperaiRiconosciuti}
  applicazioneOperaiDisabilitata={statoInCorso}
/>
{messaggioApplicazioneOperai && (
  <p role="status" style={{ margin: '12px 0', color: '#475569' }}>
    {messaggioApplicazioneOperai}
  </p>
)}

      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: '#f8fafc',
          color: '#475569',
        }}
      >
        Nel prossimo passaggio inseriremo operai presenti,
        orari, lavori eseguiti, materiali e foto.
      </div>

      <button
        type="button"
        onClick={() => setMostraForm(false)}
        style={{
          minHeight: 44,
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          background: '#fff',
          fontWeight: 700,
        }}
      >
        Chiudi
      </button>
    </section>
 )}
            <button
              type="button"
              onClick={esci}
              style={{
                minHeight: 44,
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                background: '#fff',
                fontWeight: 700,
              }}
            >
              Cambia operaio
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
