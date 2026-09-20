'use client'

import { useState } from 'react'
import RapportinoForm from '../components/RapportinoForm'

type OperaioAccesso = {
  id: string
  nome: string
}

type OperaioDisponibile = {
  id: string
  nome: string
}

type OrariOperaio = {
  oraInizio: string
  oraFine: string
  pausaMinuti: number
}
type CantiereAccesso = {
  id: string
  nome: string
}

const calcolaOre = (
  oraInizio: string,
  oraFine: string,
  pausaMinuti: number
) => {
  if (!oraInizio || !oraFine) return 0

  const [inizioOre, inizioMinuti] = oraInizio.split(':').map(Number)
  const [fineOre, fineMinuti] = oraFine.split(':').map(Number)

  const minutiInizio = inizioOre * 60 + inizioMinuti
  const minutiFine = fineOre * 60 + fineMinuti

  const minutiLavorati =
    minutiFine - minutiInizio - Math.max(0, pausaMinuti)

  if (minutiLavorati <= 0) return 0

  return minutiLavorati / 60
}

export default function RapportinoOperaiPage() {
  const [pin, setPin] = useState('')
  const [operaio, setOperaio] = useState<OperaioAccesso | null>(null)

  const [cantieri, setCantieri] = useState<CantiereAccesso[]>([])
  const [operaiDisponibili, setOperaiDisponibili] =
    useState<OperaioDisponibile[]>([])
  const [operaiPresentiIds, setOperaiPresentiIds] =
    useState<string[]>([])
const [orariOperai, setOrariOperai] =
  useState<Record<string, OrariOperaio>>({})

  const [cantiereId, setCantiereId] = useState('')
  const [cantiereSelezionato, setCantiereSelezionato] =
    useState<CantiereAccesso | null>(null)

  const [statoRapportino, setStatoRapportino] = useState<{
    data: string
    presente: boolean
  } | null>(null)
const [dataRapportino, setDataRapportino] = useState('')
  const [errore, setErrore] = useState('')
  const [accessoInCorso, setAccessoInCorso] = useState(false)
  const [statoInCorso, setStatoInCorso] = useState(false)
  const [mostraForm, setMostraForm] = useState(false)
const [note, setNote] = useState('')
const [materiali, setMateriali] = useState('')
const [quantitaMateriali, setQuantitaMateriali] = useState('')
const [costoMateriali, setCostoMateriali] = useState('')
const [fotoRapportinoAperte, setFotoRapportinoAperte] = useState<any[]>([])
const operaiRapportinoPreparati = operaiDisponibili
  .filter((item) => operaiPresentiIds.includes(item.id))
  .map((item) => {
    const orari = orariOperai[item.id] || {
      oraInizio: '',
      oraFine: '',
      pausaMinuti: 0,
    }

    return {
      id: item.id,
      nome: item.nome,
      ora_inizio: orari.oraInizio,
      ora_fine: orari.oraFine,
      pausa_minuti: orari.pausaMinuti,
      ore: calcolaOre(
        orari.oraInizio,
        orari.oraFine,
        orari.pausaMinuti
      ),
    }
  })


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
      setOperaiDisponibili(risultato.operai || [])
      setCantieri(risultato.cantieri || [])

      setCantiereId('')
      setCantiereSelezionato(null)
      setStatoRapportino(null)
      setOperaiPresentiIds([])
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
    setOperaiPresentiIds([])
    setOrariOperai({})
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
})

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
    })
if (risultato.presente) {
  setMostraForm(false)
}
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
    setOperaiPresentiIds([])
    setCantiereId('')
    setCantiereSelezionato(null)
    setStatoRapportino(null)
    setMostraForm(false)
    setPin('')
    setErrore('')
setOrariOperai({})
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
  setOperaiPresentiIds([operaio.id])
setOrariOperai({})
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

{mostraForm &&
  cantiereSelezionato &&
  statoRapportino &&
  !statoRapportino.presente && (
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
<section
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

    <div
      style={{
        marginTop: 4,
        fontSize: 13,
        color: '#64748b',
      }}
    >
      Seleziona gli operai che hanno lavorato oggi in questo cantiere.
    </div>
  </div>

  {operaiDisponibili.map((item) => {
    const selezionato = operaiPresentiIds.includes(item.id)

    const orari = orariOperai[item.id] || {
  oraInizio: '',
  oraFine: '',
  pausaMinuti: 0,
}

    const ore = calcolaOre(
  orari.oraInizio,
  orari.oraFine,
  orari.pausaMinuti
)

    return (
      <div
        key={item.id}
        style={{
          display: 'grid',
          gap: 10,
          padding: 10,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#fff',
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: 36,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={selezionato}
            onChange={() => {
              setOperaiPresentiIds((correnti) =>
                selezionato
                  ? correnti.filter((id) => id !== item.id)
                  : [...correnti, item.id]
              )

              if (selezionato) {
                setOrariOperai((correnti) => {
                  const aggiornati = { ...correnti }
                  delete aggiornati[item.id]
                  return aggiornati
                })
              }
            }}
            style={{
              width: 20,
              height: 20,
            }}
          />

          <span style={{ fontWeight: 600 }}>
            {item.nome}
          </span>
        </label>

        {selezionato && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
gap: 10,
}}
>
  <label style={{ fontSize: 13 }}>
    Ora inizio
    <input
      type="time"
      value={orari.oraInizio}
      onChange={(event) => {
        const valore = event.target.value

        setOrariOperai((correnti) => ({
          ...correnti,
          [item.id]: {
            ...orari,
            oraInizio: valore,
          },
        }))
      }}
      style={{
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 5,
        padding: 10,
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        fontSize: 16,
      }}
    />
  </label>

  <label style={{ fontSize: 13 }}>
    Ora fine
    <input
      type="time"
      value={orari.oraFine}
      onChange={(event) => {
        const valore = event.target.value

        setOrariOperai((correnti) => ({
          ...correnti,
          [item.id]: {
            ...orari,
            oraFine: valore,
          },
        }))
      }}
      style={{
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 5,
        padding: 10,
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        fontSize: 16,
      }}
    />
  </label>

  <label
    style={{
      gridColumn: '1 / -1',
      fontSize: 13,
    }}
  >
    Pausa
    <select
      value={orari.pausaMinuti}
      onChange={(event) => {
        const pausaMinuti = Number(event.target.value)

        setOrariOperai((correnti) => ({
          ...correnti,
          [item.id]: {
            ...orari,
            pausaMinuti,
          },
        }))
      }}
      style={{
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 5,
        padding: 10,
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        background: '#fff',
        fontSize: 16,
      }}
    >
      <option value={0}>Nessuna</option>
      <option value={15}>15 minuti</option>
      <option value={30}>30 minuti</option>
      <option value={45}>45 minuti</option>
      <option value={60}>60 minuti</option>
      <option value={90}>90 minuti</option>
    </select>
  </label>

  {orari.oraInizio && orari.oraFine && (
    <div
      style={{
        gridColumn: '1 / -1',
        fontSize: 14,
        fontWeight: 700,
        color: ore > 0 ? '#166534' : '#991b1b',
      }}
    >
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
<RapportinoForm
  cantiereRapporto={cantiereSelezionato.nome}
  setCantiereRapporto={() => {}}
data={dataRapportino}
setData={(nuovaData) => {
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
  rapportinoInModifica={null}
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
  onSalvaPortale={() => {}}
/>

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