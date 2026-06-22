'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { cleanDictationText } from '../utils/cleanDictationText'

export type ActivityOrigin = 'manuale' | 'ai' | 'fascicolo'

export type Activity = {
  id: string
  testo: string
  completata: boolean
  origine: ActivityOrigin
  dataCreazione: string
  dataSuggerita?: string
  oraSuggerita?: string
}

export type RapportinoActivity = Activity

type Props = {
  attivita: RapportinoActivity[]
  onChangeAttivita: (attivita: RapportinoActivity[]) => void
  onActivitiesChange?: (attivita: RapportinoActivity[]) => void
  buttonSecondary: CSSProperties
}

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean
  readonly [index: number]: { transcript: string }
}

type SpeechRecognitionEventLike = {
  readonly results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const nuovaAttivita = (): RapportinoActivity => ({
  id: crypto.randomUUID(),
  testo: '',
  completata: false,
  origine: 'manuale',
  dataCreazione: new Date().toISOString(),
})

const iconaOrigine: Record<ActivityOrigin, string> = {
  manuale: '✍',
  ai: '🤖',
  fascicolo: '📂',
}

export default function RapportinoActivities({
  attivita,
  onChangeAttivita,
  onActivitiesChange,
  buttonSecondary,
}: Props) {
  const [ascoltoAttivo, setAscoltoAttivo] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const stopRichiestoRef = useRef(true)
  const attivitaRef = useRef(attivita)
  const attivitaDettataIdRef = useRef<string | null>(null)
  const testoBaseRef = useRef('')
  const testoCorrenteRef = useRef('')

  useEffect(() => {
    attivitaRef.current = attivita
  }, [attivita])

  useEffect(() => {
    return () => {
      stopRichiestoRef.current = true
      recognitionRef.current?.abort()
    }
  }, [])

  const comunicaAttivita = (prossimeAttivita: RapportinoActivity[]) => {
    attivitaRef.current = prossimeAttivita
    onChangeAttivita(prossimeAttivita)
    onActivitiesChange?.(prossimeAttivita)
  }

  const aggiornaTestoDettato = (testo: string) => {
    let id = attivitaDettataIdRef.current
    let prossimeAttivita = attivitaRef.current

    if (!id) {
      id = crypto.randomUUID()
      attivitaDettataIdRef.current = id
      prossimeAttivita = [
        ...prossimeAttivita,
        {
          id,
          testo,
          completata: false,
          origine: 'manuale',
          dataCreazione: new Date().toISOString(),
        },
      ]
    } else {
      prossimeAttivita = prossimeAttivita.map((voce) =>
        voce.id === id ? { ...voce, testo } : voce
      )
    }

    comunicaAttivita(prossimeAttivita)
  }

  const avviaDettatura = () => {
    if (recognitionRef.current) return

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('La dettatura vocale non e supportata da questo browser.')
      return
    }

    const recognition = new SpeechRecognition()

    recognitionRef.current = recognition
    stopRichiestoRef.current = false
    attivitaDettataIdRef.current = null
    testoBaseRef.current = ''
    testoCorrenteRef.current = ''
    recognition.lang = 'it-IT'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setAscoltoAttivo(true)

    recognition.onresult = (event) => {
      const partiFinali: string[] = []
      const partiIntermedie: string[] = []

      for (let i = 0; i < event.results.length; i++) {
        const frase = String(event.results[i][0].transcript || '').trim()

        if (!frase) continue
        if (event.results[i].isFinal) partiFinali.push(frase)
        else partiIntermedie.push(frase)
      }

      const trascrizione = [...partiFinali, ...partiIntermedie].join(' ')
      const prossimoTesto = cleanDictationText(
        [testoBaseRef.current, trascrizione].filter(Boolean).join(' ')
      )

      if (!prossimoTesto) return

      testoCorrenteRef.current = prossimoTesto
      aggiornaTestoDettato(prossimoTesto)
    }

    recognition.onerror = (event) => {
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
      ) {
        stopRichiestoRef.current = true
        alert('Errore durante la dettatura vocale.')
      }
    }

    recognition.onend = () => {
      if (stopRichiestoRef.current) {
        recognitionRef.current = null
        setAscoltoAttivo(false)
        return
      }

      testoBaseRef.current = testoCorrenteRef.current.trimEnd()

      window.setTimeout(() => {
        if (stopRichiestoRef.current || recognitionRef.current !== recognition) {
          return
        }

        try {
          recognition.start()
        } catch {
          recognitionRef.current = null
          stopRichiestoRef.current = true
          setAscoltoAttivo(false)
        }
      }, 100)
    }

    recognition.start()
  }

  const fermaDettatura = () => {
    stopRichiestoRef.current = true
    recognitionRef.current?.stop()
    setAscoltoAttivo(false)
  }

  const aggiungiAttivita = (dopoIndice?: number) => {
    const nuova = nuovaAttivita()

    if (dopoIndice === undefined) {
      comunicaAttivita([...attivita, nuova])
      return
    }

    comunicaAttivita([
      ...attivita.slice(0, dopoIndice + 1),
      nuova,
      ...attivita.slice(dopoIndice + 1),
    ])
  }

  const aggiornaAttivita = (
    id: string,
    modifiche: Partial<Omit<RapportinoActivity, 'id'>>
  ) => {
    comunicaAttivita(
      attivita.map((voce) =>
        voce.id === id ? { ...voce, ...modifiche } : voce
      )
    )
  }

  const eliminaAttivita = (id: string) => {
    comunicaAttivita(attivita.filter((voce) => voce.id !== id))
  }

  const gestisciInvio = (
    event: KeyboardEvent<HTMLInputElement>,
    indice: number
  ) => {
    if (event.key !== 'Enter') return

    event.preventDefault()
    aggiungiAttivita(indice)
  }

  return (
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
      <h3 style={{ margin: 0, fontSize: 16 }}>☑ Cosa si deve fare</h3>

      {attivita.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {attivita.map((voce, indice) => (
            <div
              key={voce.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 24px 1fr 36px',
                alignItems: 'center',
                minHeight: 40,
                padding: '0 6px',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                background: '#f8fafc',
              }}
            >
              <input
                type="checkbox"
                checked={voce.completata}
                onChange={(event) =>
                  aggiornaAttivita(voce.id, {
                    completata: event.target.checked,
                  })
                }
                aria-label={`Completa attività ${indice + 1}`}
              />

              <span
                title={`Origine: ${voce.origine}`}
                aria-label={`Origine ${voce.origine}`}
                style={{ fontSize: 15, textAlign: 'center' }}
              >
                {iconaOrigine[voce.origine]}
              </span>

              <div style={{ display: 'grid', minWidth: 0 }}>
                <input
                  value={voce.testo}
                  onChange={(event) =>
                    aggiornaAttivita(voce.id, { testo: event.target.value })
                  }
                  onKeyDown={(event) => gestisciInvio(event, indice)}
                  placeholder="Scrivi un'attività..."
                  style={{
                    width: '100%',
                    padding: '8px 4px',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: '#0f172a',
                    fontSize: 15,
                    textDecoration: voce.completata ? 'line-through' : 'none',
                  }}
                />
                {(voce.dataSuggerita || voce.oraSuggerita) && (
                  <small
                    style={{ padding: '0 4px 6px', color: '#64748b' }}
                  >
                    {[voce.dataSuggerita, voce.oraSuggerita]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                )}
              </div>

              <button
                type="button"
                onClick={() => eliminaAttivita(voce.id)}
                aria-label={`Elimina attività ${indice + 1}`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => aggiungiAttivita()}
        style={{ ...buttonSecondary, justifySelf: 'start' }}
      >
        ➕ Aggiungi attività
      </button>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={avviaDettatura}
          disabled={ascoltoAttivo}
          style={buttonSecondary}
        >
          🎤 Detta attività
        </button>
        <button
          type="button"
          onClick={fermaDettatura}
          disabled={!ascoltoAttivo}
          style={{
            ...buttonSecondary,
            backgroundColor: ascoltoAttivo ? '#dc2626' : undefined,
            color: ascoltoAttivo ? '#fff' : undefined,
          }}
        >
          ⏹ Ferma
        </button>
      </div>
    </section>
  )
}
