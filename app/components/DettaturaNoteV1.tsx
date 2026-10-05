'use client'

import { useEffect, useRef, useState } from 'react'

type Risultato = { isFinal: boolean; 0: { transcript: string } }
type Riconoscimento = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((event: { results: ArrayLike<Risultato> }) => void) | null
  onerror: (() => void) | null; onend: (() => void) | null
  start: () => void; stop: () => void; abort: () => void
}
type Costruttore = new () => Riconoscimento
type Props = { testo: string; onTesto: (testo: string) => void; contesto: string; disabled: boolean }

export default function DettaturaNoteV1({ testo, onTesto, contesto, disabled }: Props) {
  const [stato, setStato] = useState<'inattivo' | 'ascolto' | 'fine' | 'errore' | 'non_supportato'>('inattivo')
  const riconoscimento = useRef<Riconoscimento | null>(null)
  const corrente = useRef({ testo, onTesto, contesto, disabled })
  corrente.current = { testo, onTesto, contesto, disabled }
  const interrompi = () => {
    const attivo = riconoscimento.current
    riconoscimento.current = null
    if (attivo) {
      attivo.onresult = attivo.onerror = attivo.onend = null
      try { attivo.abort() } catch { /* Il browser può avere già terminato l'ascolto. */ }
    }
  }
  useEffect(() => {
    const browser = window as unknown as { SpeechRecognition?: Costruttore; webkitSpeechRecognition?: Costruttore }
    setStato(browser.SpeechRecognition || browser.webkitSpeechRecognition ? 'inattivo' : 'non_supportato')
    return interrompi
  }, [contesto, disabled])

  const avvia = () => {
    if (disabled || riconoscimento.current) return
    const browser = window as unknown as { SpeechRecognition?: Costruttore; webkitSpeechRecognition?: Costruttore }
    const Classe = browser.SpeechRecognition || browser.webkitSpeechRecognition
    if (!Classe) { setStato('non_supportato'); return }
    try {
      const attivo = new Classe()
      riconoscimento.current = attivo
      const origine = contesto
      let prossima = 0
      const valido = () => riconoscimento.current === attivo && corrente.current.contesto === origine && !corrente.current.disabled
      attivo.lang = 'it-IT'
      attivo.continuous = true
      attivo.interimResults = false
      attivo.onresult = event => {
        if (!valido()) return
        for (; prossima < event.results.length; prossima++) {
          const risultato = event.results[prossima]
          if (!risultato.isFinal) break
          const frase = risultato[0].transcript.trim()
          if (!frase) continue
          const precedente = corrente.current.testo
          const nuovo = precedente + (precedente && !/\s$/.test(precedente) ? ' ' : '') + frase
          corrente.current.testo = nuovo
          corrente.current.onTesto(nuovo)
        }
      }
      attivo.onerror = () => {
        if (!valido()) return
        interrompi()
        setStato('errore')
      }
      attivo.onend = () => {
        if (!valido()) return
        interrompi()
        setStato('inattivo')
      }
      setStato('ascolto')
      attivo.start()
    } catch {
      interrompi()
      setStato('errore')
    }
  }
  const ferma = () => {
    if (!riconoscimento.current || disabled) return
    setStato('fine')
    try { riconoscimento.current.stop() } catch { interrompi(); setStato('errore') }
  }
  return <div>
    <button type="button" style={{ minHeight: 44, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8 }}
      disabled={disabled || stato === 'non_supportato' || stato === 'fine'}
      aria-label={stato === 'ascolto' ? 'Ferma dettatura note' : 'Detta lavori eseguiti e note'}
      onClick={stato === 'ascolto' ? ferma : avvia}>{stato === 'ascolto' ? 'Ferma' : '🎤 Detta'}</button>
    <p role={stato === 'errore' ? 'alert' : 'status'} aria-live="polite" style={{ margin: '6px 0', fontSize: 14 }}>
      {stato === 'ascolto' ? 'Sto ascoltando...' : stato === 'fine' ? 'Completamento dettatura...'
        : stato === 'errore' ? 'Dettatura non riuscita. Puoi riprovare o scrivere il testo.'
          : stato === 'non_supportato' ? 'Dettatura non disponibile su questo dispositivo/browser.' : ''}
    </p>
  </div>
}
