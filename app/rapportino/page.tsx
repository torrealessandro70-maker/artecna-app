'use client'

import { useState } from 'react'

type OperaioAccesso = {
  id: string
  nome: string
}

type CantiereAccesso = {
  id: string
  nome: string
}

export default function RapportinoOperaiPage() {
  const [pin, setPin] = useState('')
  const [operaio, setOperaio] = useState<OperaioAccesso | null>(null)
  const [cantieri, setCantieri] = useState<CantiereAccesso[]>([])
  const [cantiereId, setCantiereId] = useState('')
  const [errore, setErrore] = useState('')
  const [accessoInCorso, setAccessoInCorso] = useState(false)

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
      setCantieri(risultato.cantieri || [])
      setCantiereId('')
      setPin('')
    } catch {
      setErrore('Connessione non disponibile')
    } finally {
      setAccessoInCorso(false)
    }
  }

const [cantiereSelezionato, setCantiereSelezionato] =
  useState<CantiereAccesso | null>(null)

const [statoRapportino, setStatoRapportino] = useState<{
  data: string
  presente: boolean
} | null>(null)

const [statoInCorso, setStatoInCorso] = useState(false)
const [mostraForm, setMostraForm] = useState(false)

const continua = async () => {
  if (!cantiereId || statoInCorso) return
setMostraForm(false)
setCantiereSelezionato(null)
setStatoRapportino(null)

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
  } catch {
    setErrore('Connessione non disponibile')
  } finally {
    setStatoInCorso(false)
  }
}

  const esci = () => {
    setOperaio(null)
    setCantieri([])
    setCantiereId('')
    setPin('')
    setErrore('')
setCantiereSelezionato(null)
setStatoRapportino(null)
setMostraForm(false)
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
        onClick={() => setMostraForm(true)}
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