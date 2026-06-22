'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  parseReportNarration,
  type ParsedReport,
  type ReportNarrationContext,
} from '../engines/document-intelligence/report-parser'
import { cleanDictationText } from '../utils/cleanDictationText'

export type ReminderActivityDraft = {
  testo: string
  dataSuggerita?: string
  oraSuggerita: string
  origine: 'ai'
}

type Props = {
  testo: string
  onChangeTesto: (testo: string) => void
  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  context: ReportNarrationContext
  onParsedReport: (report: ParsedReport) => void
  onCreateActivityFromReminder: (activity: ReminderActivityDraft) => void
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

const prossimeEvoluzioni = [
  'Operai',
  'Materiali',
  'Lavorazioni',
  'Costi',
  'Timbrature',
]

export default function SmartReportAssistant({
  testo,
  onChangeTesto,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
  context,
  onParsedReport,
  onCreateActivityFromReminder,
}: Props) {
  const [anteprima, setAnteprima] = useState<ParsedReport | null>(null)
  const [ascoltoAttivo, setAscoltoAttivo] = useState(false)
  const [messaggioAttivitaCreata, setMessaggioAttivitaCreata] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const stopRichiestoRef = useRef(true)
  const testoBaseRef = useRef('')
  const testoCorrenteRef = useRef('')

  useEffect(() => {
    return () => {
      stopRichiestoRef.current = true
      recognitionRef.current?.abort()
    }
  }, [])

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
    testoBaseRef.current = testo.trimEnd()
    testoCorrenteRef.current = testoBaseRef.current
    recognition.lang = 'it-IT'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      setAscoltoAttivo(true)
    }

    recognition.onresult = (event) => {
      const partiFinali: string[] = []
      const partiIntermedie: string[] = []

      for (let i = 0; i < event.results.length; i++) {
        const frase = String(event.results[i][0].transcript || '').trim()

        if (!frase) continue

        if (event.results[i].isFinal) {
          partiFinali.push(frase)
        } else {
          partiIntermedie.push(frase)
        }
      }

      const trascrizione = [...partiFinali, ...partiIntermedie].join(' ')
      const prossimoTesto = cleanDictationText(
        testoBaseRef.current && trascrizione
          ? `${testoBaseRef.current}\n${trascrizione}`
          : testoBaseRef.current || trascrizione
      )

      testoCorrenteRef.current = prossimoTesto
      onChangeTesto(prossimoTesto)
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

  const preparaRapportino = () => {
    const report = parseReportNarration(testo, context)

    setMessaggioAttivitaCreata('')
    setAnteprima(report)
    onParsedReport(report)
  }

  const creaAttivitaDaPromemoria = (
    promemoria: ParsedReport['promemoriaSuggeriti'][number]
  ) => {
    setMessaggioAttivitaCreata('')
    const oraInserita = window.prompt('A che ora?')

    if (oraInserita === null) return

    const oraSuggerita = oraInserita.trim()

    if (!oraSuggerita) {
      alert('Inserisci un orario per creare l’attività.')
      return
    }

    onCreateActivityFromReminder({
      testo: promemoria.testo,
      dataSuggerita: promemoria.dataSuggerita,
      oraSuggerita,
      origine: 'ai',
    })
    setMessaggioAttivitaCreata(
      'Evento aggiunto alle attività. Per creare eventi reali serve collegare Google Calendar.'
    )
  }

  const disabledButtonStyle: CSSProperties = {
    opacity: 0.6,
    cursor: 'not-allowed',
  }

  return (
    <section
      style={{
        display: 'grid',
        gap: 12,
        padding: 16,
        border: '1px solid #c7d2fe',
        borderRadius: 10,
        background: '#eef2ff',
      }}
    >
      <div>
        <h3 style={{ margin: '0 0 6px' }}>🎙️ Racconta la giornata</h3>
        <p style={{ margin: 0, color: '#475569' }}>
          Detta o scrivi quello che è successo oggi in cantiere. ARTECNA userà
          questo racconto per aiutarti a compilare il rapportino.
        </p>
      </div>

      <textarea
        value={testo}
        onChange={(event) => onChangeTesto(event.target.value)}
        placeholder="Racconta liberamente la giornata in cantiere..."
        rows={5}
        style={{ ...inputStyle, width: '100%' }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={avviaDettatura}
          disabled={ascoltoAttivo}
          style={{
            ...buttonSecondary,
            ...(ascoltoAttivo ? disabledButtonStyle : {}),
          }}
        >
          🎤 Avvia dettatura
        </button>
        <button
          type="button"
          onClick={fermaDettatura}
          disabled={!ascoltoAttivo}
          style={{
            ...buttonSecondary,
            ...(!ascoltoAttivo ? disabledButtonStyle : {}),
            backgroundColor: ascoltoAttivo ? '#dc2626' : undefined,
            color: ascoltoAttivo ? '#fff' : undefined,
          }}
        >
          ⏹ Ferma
        </button>
        <button
          type="button"
          onClick={preparaRapportino}
          style={buttonPrimary}
        >
          🤖 Prepara rapportino
        </button>
      </div>

      {anteprima && (
        <section
          style={{
            display: 'grid',
            gap: 10,
            padding: 14,
            border: '1px solid #a5b4fc',
            borderRadius: 8,
            background: '#fff',
          }}
        >
          <h4 style={{ margin: 0 }}>Anteprima rapportino AI</h4>

          <div
            style={{
              width: 'fit-content',
              padding: '6px 10px',
              borderRadius: 999,
              background: anteprima.confidence >= 0.7 ? '#dcfce7' : '#fef3c7',
              color: anteprima.confidence >= 0.7 ? '#166534' : '#92400e',
              fontWeight: 700,
            }}
          >
            {anteprima.confidence >= 0.7
              ? '✓ Campi compilati automaticamente'
              : '⚠ Verificare i dati estratti'}
          </div>

          <div>
            <strong>Cantiere:</strong> {anteprima.cantiere || 'Non rilevato'}
          </div>
          <div>
            <strong>Data:</strong> {anteprima.data || 'Non rilevata'}
          </div>

          <div>
            <strong>Operai:</strong>
            {anteprima.operai.length > 0 ? (
              <pre style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>
                {JSON.stringify(anteprima.operai, null, 2)}
              </pre>
            ) : (
              ' Nessuno'
            )}
          </div>

          <div>
            <strong>Materiali:</strong>
            {anteprima.materiali.length > 0 ? (
              <pre style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>
                {JSON.stringify(anteprima.materiali, null, 2)}
              </pre>
            ) : (
              ' Nessuno'
            )}
          </div>

          <div>
            <strong>Lavorazioni:</strong>{' '}
            {anteprima.lavorazioni.length > 0
              ? anteprima.lavorazioni.join(', ')
              : 'Nessuna'}
          </div>
          <div>
            <strong>☑ Cosa si deve fare:</strong>
            {anteprima.attivitaDaFare.length > 0 ? (
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {anteprima.attivitaDaFare.map((attivita) => (
                  <li key={attivita}>{attivita}</li>
                ))}
              </ul>
            ) : (
              ' Nessuna attività riconosciuta'
            )}
          </div>
          {anteprima.promemoriaSuggeriti.length > 0 && (
            <div
              style={{
                padding: 12,
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                background: '#eff6ff',
              }}
            >
              <strong>📅 Promemoria suggeriti</strong>
              <p style={{ margin: '6px 0' }}>
                Vuoi creare un promemoria/evento?
              </p>
              <ul
                style={{
                  display: 'grid',
                  gap: 8,
                  margin: 0,
                  paddingLeft: 20,
                }}
              >
                {anteprima.promemoriaSuggeriti.map((promemoria) => (
                  <li
                    key={`${promemoria.testo}-${promemoria.dataSuggerita || ''}`}
                  >
                    {promemoria.testo}
                    {promemoria.dataSuggerita
                      ? ` (${promemoria.dataSuggerita})`
                      : ''}
                    <button
                      type="button"
                      onClick={() => creaAttivitaDaPromemoria(promemoria)}
                      style={{ ...buttonPrimary, marginLeft: 8 }}
                    >
                      ➕ Crea attività
                    </button>
                  </li>
                ))}
              </ul>
              {messaggioAttivitaCreata && (
                <p
                  role="status"
                  style={{ margin: '10px 0 0', color: '#166534' }}
                >
                  {messaggioAttivitaCreata}
                </p>
              )}
            </div>
          )}
          <div>
            <strong>Note:</strong> {anteprima.note || 'Nessuna'}
          </div>

          <div>
            <strong>Warnings:</strong>
            {anteprima.warnings.length > 0 ? (
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {anteprima.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              ' Nessuno'
            )}
          </div>

          <div>
            <strong>Confidence:</strong> {anteprima.confidence}
          </div>
        </section>
      )}

      <aside
        style={{
          padding: 12,
          border: '1px solid #dbeafe',
          borderRadius: 8,
          background: '#fff',
        }}
      >
        <strong>Prossima evoluzione</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {prossimeEvoluzioni.map((voce) => (
            <li key={voce}>{voce}</li>
          ))}
        </ul>
      </aside>
    </section>
  )
}
