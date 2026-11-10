'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { formattaImportoScadenza as euro, type Scadenza } from '../engines/contabilita-ditta/scadenziario'
import { nuovaBozzaPagamento, preparaPagamentoScadenza, residuoScadenza, type BozzaPagamentoScadenza } from '../engines/contabilita-ditta/scadenziarioOperativo'
import styles from './ScadenziarioFiscalePanel.module.css'

export default function ScadenzaPagamentoDialog({ riga, oggi, pronta, occupata, onSalva, onChiudi }: {
  riga: Scadenza; oggi: string; pronta: boolean; occupata: boolean
  onSalva: (bozza: BozzaPagamentoScadenza) => Promise<void>; onChiudi: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null), invio = useRef(false), id = useId()
  const [bozza, setBozza] = useState(() => nuovaBozzaPagamento(riga, oggi))
  const [errore, setErrore] = useState('')
  useEffect(() => {
    const d = dialog.current, origine = document.activeElement
    if (d && !d.open) d.showModal()
    return () => { d?.close(); if (origine instanceof HTMLElement && origine.isConnected) origine.focus({ preventScroll: true }) }
  }, [])
  function invia(e: FormEvent) {
    e.preventDefault()
    if (invio.current || occupata || !pronta) return
    try { preparaPagamentoScadenza(riga, bozza) } catch (e) { setErrore(e instanceof Error ? e.message : 'Annotazione non valida.'); return }
    invio.current = true
    void onSalva(bozza).then(onChiudi, e => setErrore(e instanceof Error ? e.message : 'Esito incerto: rileggere, nessun reinvio.')).finally(() => { invio.current = false })
  }
  let anteprima = 'Importi da verificare'
  try {
    const p = preparaPagamentoScadenza(riga, bozza)
    anteprima = `Stato finale: ${p.scadenza.stato}. Residuo: ${euro(residuoScadenza({ ...p.scadenza, importoPagato: p.importoPagato }))}`
  } catch { /* Validation is shown on submit, incomplete fields are not a payment. */ }
  return <dialog ref={dialog} className={styles.modale} aria-labelledby={`${id}-titolo`} onCancel={e => { e.preventDefault(); if (!occupata && !invio.current) onChiudi() }}>
    <h3 id={`${id}-titolo`}>Segna pagato</h3>
    <p>{riga.tipo} · {riga.periodo}</p><p>Importo previsto: {euro(riga.importoCentesimi)}</p>
    <p>Solo annotazione fiscale: nessun pagamento o movimento economico generato. L’importo è il totale pagato complessivo dell’obbligo, non una nuova rata da sommare.</p>
    <form className={styles.form} onSubmit={invia}><fieldset disabled={occupata || !pronta}>
      <label htmlFor={`${id}-importo`}>Importo pagato (€)</label><input id={`${id}-importo`} inputMode="decimal" maxLength={15} value={bozza.importo} onChange={e => setBozza(b => ({ ...b, importo: e.target.value }))} />
      <label htmlFor={`${id}-data`}>Data pagamento</label><input id={`${id}-data`} type="date" required value={bozza.data} onChange={e => setBozza(b => ({ ...b, data: e.target.value }))} />
      <label htmlFor={`${id}-riferimento`}>Riferimento F24/documento</label><input id={`${id}-riferimento`} maxLength={300} value={bozza.riferimento} onChange={e => setBozza(b => ({ ...b, riferimento: e.target.value }))} />
      <label htmlFor={`${id}-nota`}>Nota pagamento</label><textarea id={`${id}-nota`} maxLength={2000} value={bozza.nota} onChange={e => setBozza(b => ({ ...b, nota: e.target.value }))} />
      <label className={styles.inclusione}><input type="checkbox" checked={bozza.chiusuraConfermata} onChange={e => setBozza(b => ({ ...b, chiusuraConfermata: e.target.checked }))} />Confermo esplicitamente che l’obbligo è chiuso, anche senza copertura verificabile</label>
      <p aria-live="polite">{anteprima}</p>
      <p>Importo vuoto resta non noto: nessun residuo inventato. Senza importo pagato la data non viene registrata, come previsto dal contratto esistente. In assenza di copertura o conferma la voce resta Da pagare.</p>
      <button type="submit">Conferma annotazione pagamento</button>
    </fieldset></form>
    {errore && <p role="alert">{errore}</p>}
    {!pronta && <p role="alert">Archivio da rileggere. Chiudi la modale; nessun reinvio automatico.</p>}
    <button type="button" disabled={occupata} onClick={() => { if (!invio.current) onChiudi() }}>Annulla pagamento</button>
  </dialog>
}
