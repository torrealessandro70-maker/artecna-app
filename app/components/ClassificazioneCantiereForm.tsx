'use client'

import { useId, useRef, useState } from 'react'
import { statoLavori, type ClassificazioneCantiere, type DestinazioneCantiere, type StatoLavori } from '../engines/economia/classificazioneCantieri'

const etichetteStato: Record<StatoLavori, string> = {
  da_precisare: 'Da precisare',
  in_programma: 'In programma',
  in_corso: 'In corso',
  concluso: 'Concluso',
}

export type SalvaClassificazione = (
  id: string, prima: ClassificazioneCantiere, destinazione: DestinazioneCantiere | null,
  stato: StatoLavori | 'mantieni', conferma: boolean,
) => Promise<void>

export default function ClassificazioneCantiereForm({ id, corrente, salva }: {
  id: string; corrente: ClassificazioneCantiere; salva: SalvaClassificazione
}) {
  const campo = useId()
  const [destinazione, setDestinazione] = useState(corrente.destinazione_amministrativa ?? null)
  const [stato, setStato] = useState(statoLavori(corrente))
  const [conferma, setConferma] = useState(false)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState('')
  const richiesta = useRef(false)
  const cambiaDestinazione = destinazione !== (corrente.destinazione_amministrativa ?? null)
  const cambiaStato = destinazione === 'cantiere_lavori' && stato !== statoLavori(corrente)
  const consentiSalvataggio = (cambiaDestinazione || cambiaStato) && (!cambiaDestinazione || conferma)

  async function salvaScelta() {
    if (richiesta.current || !consentiSalvataggio) return
    richiesta.current = true
    setInCorso(true)
    setErrore('')
    try {
      await salva(id, corrente, destinazione, cambiaStato ? stato : 'mantieni', conferma)
    } catch (error) {
      setErrore(error instanceof Error ? error.message : 'Classificazione non salvata.')
    } finally {
      richiesta.current = false
      setInCorso(false)
    }
  }

  return (
    <fieldset disabled={inCorso} style={{ padding: 12, margin: '12px 0', display: 'grid', gap: 8 }}>
      <legend>Classificazione cantiere</legend>
      <label htmlFor={campo}>Destinazione</label>
      <select id={campo} value={destinazione ?? ''} onChange={event => {
        const valore = event.currentTarget.value
        setDestinazione(valore === 'cantiere_lavori' || valore === 'archivio_acquisti_personali' ? valore : null)
        setConferma(false)
      }}>
        <option value="">Da classificare</option>
        <option value="cantiere_lavori">Cantiere lavori</option>
        <option value="archivio_acquisti_personali">Archivio acquisti personali</option>
      </select>
      {destinazione === 'cantiere_lavori' ? <>
        <label htmlFor={campo + '-stato'}>Stato lavori</label>
        <select id={campo + '-stato'} value={stato} onChange={event => setStato(event.currentTarget.value as StatoLavori)}>
          <option value="da_precisare">Da precisare</option>
          <option value="in_programma">In programma</option>
          <option value="in_corso">In corso</option>
          <option value="concluso">Concluso</option>
        </select>
      </> : <p>Stato lavori: {destinazione === 'archivio_acquisti_personali' ? 'Non applicabile' : etichetteStato[statoLavori(corrente)]}</p>}
      {cambiaDestinazione && <label>
        <input type="checkbox" checked={conferma} onChange={event => setConferma(event.currentTarget.checked)} />
        {' '}Confermo il cambio di destinazione nei riepiloghi.
      </label>}
      <button type="button" disabled={!consentiSalvataggio || inCorso} onClick={salvaScelta}>
        {inCorso ? 'Salvataggio…' : 'Salva classificazione'}
      </button>
      {errore && <p role="alert">{errore}</p>}
    </fieldset>
  )
}
