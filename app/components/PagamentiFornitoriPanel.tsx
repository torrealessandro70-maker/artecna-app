'use client'

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Debito = {
  id: string
  fornitore_nome: string | null
  fattura_id: string | null
  origine_debito: 'fattura' | 'manuale' | null
  data_scadenza: string | null
  importo_totale: number | null
  importo_pagato: number | null
  revisione_debito: number
  verificato_at: string | null
  annullato_at: string | null
}

function verifica(d: Debito) {
  if (d.annullato_at) return 'Annullato'
  if (!d.origine_debito) return 'Da verificare · origine o collegamento documentale non confermato'
  if (!d.verificato_at) return 'Da verificare · conferma gestionale mancante'
  return d.importo_totale === d.importo_pagato ? 'Verificato · saldato' : 'Verificato · aperto'
}

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const importo = (n: number | null) => n === null ? 'Sconosciuto' : euro.format(n)

export default function PagamentiFornitoriPanel({ cardStyle, fatturaId }: {
  cardStyle: CSSProperties
  fatturaId?: string
}) {
  const [righe, setRighe] = useState<Debito[]>([])
  const [errore, setErrore] = useState('')
  const [attesa, setAttesa] = useState(false)
  const [selezionato, setSelezionato] = useState('')
  const [nome, setNome] = useState('')
  const leggi = useCallback(async () => {
    const { data, error } = await supabase.rpc('leggi_debiti_fornitori', { p_fattura: fatturaId ?? null })
    setRighe(error ? [] : data ?? [])
    if (error) setErrore(error.message)
  }, [fatturaId])

  useEffect(() => {
    const controller = new AbortController()
    void supabase.rpc('leggi_debiti_fornitori', { p_fattura: fatturaId ?? null })
      .abortSignal(controller.signal).then(({ data, error }) => {
        if (controller.signal.aborted) return
        setRighe(error ? [] : data ?? [])
        setErrore(error?.message ?? '')
      })
    return () => controller.abort()
  }, [fatturaId])
  const dettaglio = righe.find(d => d.id === selezionato) ?? (fatturaId ? righe[0] : undefined)

  async function registra(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAttesa(true); setErrore('')
    try {
      const { data, error } = await supabase.rpc('registra_debito_fornitore', {
        p_fattura: fatturaId ?? null, p_fornitore: fatturaId ? null : nome,
      })
      if (error) { setErrore(error.message); return }
      setNome(''); setSelezionato(data); await leggi()
    } finally { setAttesa(false) }
  }

  async function salva(e: FormEvent<HTMLFormElement>, debito: Debito) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const annulla = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'annulla'
    if (annulla && !window.confirm('Annullare questo debito? Il documento resta registrato.')) return
    setAttesa(true); setErrore('')
    try {
      const { error } = await supabase.rpc('verifica_debito_fornitore', {
        p_id: debito.id, p_revisione: debito.revisione_debito,
        p_scadenza: annulla ? null : form.get('scadenza'),
        p_dovuto: annulla ? null : form.get('dovuto'),
        p_pagato: annulla ? null : form.get('pagato'), p_annulla: annulla,
      })
      if (error) { setErrore(error.message); return }
      await leggi()
    } finally { setAttesa(false) }
  }

  return <section style={cardStyle} aria-label="Debiti fornitori">
    <h2>Pagamenti fornitori</h2>
    {errore && <p role="alert">{errore}</p>}
    <button type="button" disabled={attesa} onClick={() => { setErrore(''); void leggi() }}>Rileggi debiti</button>
    {(!fatturaId || righe.length === 0) && <form onSubmit={registra}>
      {!fatturaId && <label>Fornitore <input required value={nome} onChange={e => setNome(e.target.value)} /></label>}
      <button disabled={attesa}>{fatturaId ? 'Registra debito della fattura' : 'Registra debito manuale'}</button>
    </form>}
    <table><thead><tr>{['Fornitore', 'Documento / origine', 'Scadenza', 'Dovuto', 'Già pagato', 'Residuo', 'Verifica'].map(t => <th key={t}>{t}</th>)}</tr></thead>
      <tbody>{righe.map(d => <tr key={d.id}>
        <td><button type="button" onClick={() => setSelezionato(d.id)}>{d.fornitore_nome || 'Fornitore sconosciuto'}</button></td>
        <td>{d.fattura_id ?? (d.origine_debito === 'manuale' ? 'Manuale' : 'Origine da verificare')}</td>
        <td>{d.data_scadenza ?? 'Sconosciuta'}{d.data_scadenza && !d.verificato_at ? ' · da verificare' : ''}</td>
        <td>{importo(d.importo_totale)}</td><td>{importo(d.importo_pagato)}</td>
        <td>{d.importo_totale === null || d.importo_pagato === null ? 'Sconosciuto' :
          d.importo_pagato < 0 || d.importo_totale <= 0 || d.importo_pagato > d.importo_totale ? 'Incoerente' :
          importo(d.importo_totale - d.importo_pagato)}</td>
        <td>{verifica(d)}</td>
      </tr>)}</tbody>
    </table>
    {dettaglio && <section aria-label="Dettaglio debito">
      <p>{dettaglio.id} · {verifica(dettaglio)}</p>
      {dettaglio.origine_debito && !dettaglio.annullato_at && <form
        key={dettaglio.id + ':' + dettaglio.revisione_debito} onSubmit={e => salva(e, dettaglio)}>
        <label>Scadenza <input type="date" name="scadenza" required defaultValue={dettaglio.data_scadenza ?? ''} /></label>
        <label>Dovuto <input type="number" name="dovuto" min="0.01" step="0.01" required defaultValue={dettaglio.importo_totale ?? ''} /></label>
        <label>Totale già pagato <input type="number" name="pagato" min="0" step="0.01" required defaultValue={dettaglio.importo_pagato ?? ''} /></label>
        <button disabled={attesa} value="verifica">Verifica scadenza e saldo</button>
        <button disabled={attesa} formNoValidate value="annulla">Annulla debito</button>
      </form>}
    </section>}
  </section>
}
