'use client'

import { useEffect, useRef } from 'react'
import { categoriePreflight, type EsitoPreflight } from '../utils/preflightEliminazione'

export default function PreflightEliminazioneDialog({ esito, onChiudi, onSegnaConcluso }: {
  esito: EsitoPreflight; onChiudi: () => void; onSegnaConcluso?: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { dialog?.close(); previous?.focus() }
  }, [])
  const bloccato = esito.stato === 'bloccato'
  return <dialog ref={ref} aria-labelledby="titolo-preflight-eliminazione"
    onCancel={event => { event.preventDefault(); onChiudi() }}
    style={{ width: 'min(540px, calc(100vw - 32px))', maxHeight: '85vh', overflowY: 'auto',
      boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 12, padding: 20 }}>
    <h2 id="titolo-preflight-eliminazione">{bloccato ? 'Eliminazione bloccata' : 'Verifica non disponibile'}</h2>
    <p>{bloccato
      ? esito.entita === 'cantiere'
        ? 'Questo cantiere contiene dati economici o storici e non può essere eliminato in sicurezza.'
        : 'Questo sopralluogo contiene dati collegati e non può essere eliminato in sicurezza.'
      : 'Non è stato possibile completare la verifica. Nessuna eliminazione avviata. Riprova più tardi.'}</p>
    {bloccato && <ul>{esito.categorie.map(c => <li key={c}>{categoriePreflight[c]}</li>)}</ul>}
    {bloccato && esito.entita === 'cantiere' && onSegnaConcluso &&
      <p>Puoi conservarne lo storico segnando i lavori come conclusi. Il comando apre la modifica esistente: salva per confermare.</p>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-end' }}>
      <button type="button" onClick={onChiudi}>Chiudi</button>
      {bloccato && esito.azione_consigliata === 'segna_concluso' && onSegnaConcluso &&
        <button type="button" onClick={onSegnaConcluso}>Segna come concluso</button>}
    </div>
  </dialog>
}
