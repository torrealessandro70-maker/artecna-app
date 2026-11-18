'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import VistaOperativa from './VistaOperativa'
import { anteprimaAddebito, creaAddebito, quoteAddebito, type AnteprimaAddebito, type DatiAddebito, type QuotaAddebito } from '../engines/economia/addebitiCliente'

const euro = (v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
type Client = Pick<SupabaseClient, 'rpc'>
export default function AddebitoClienteFattura({ fatturaId, client = supabase }: { fatturaId: string; client?: Client }) {
  const [quote, setQuote] = useState<QuotaAddebito[] | null>(null), [errore, setErrore] = useState('')
  const [dati, setDati] = useState<DatiAddebito | null>(null), [anteprima, setAnteprima] = useState<AnteprimaAddebito | null>(null)
  const [busy, setBusy] = useState(false), [esito, setEsito] = useState(''), [incerto, setIncerto] = useState(false)
  const lock = useRef(false), ritorno = useRef<HTMLButtonElement | null>(null)
  const pending = useRef<{ firma: string; id: string } | null>(null)
  useEffect(() => {
    let active = true
    void quoteAddebito(client, fatturaId).then(rows => { if (active) setQuote(rows) }).catch(e => { if (active) setErrore(e instanceof Error ? e.message : 'Lettura non disponibile') })
    return () => { active = false }
  }, [client, fatturaId])
  function apri(q: QuotaAddebito, button: HTMLButtonElement) {
    ritorno.current = button; setAnteprima(null); setEsito(''); setErrore(''); setIncerto(false)
    setDati({ materiale: q.materiale_id, quantita: String(q.disponibile), importo: '', ivaInclusa: false, aliquota: '0',
      descrizione: q.descrizione, motivo: '', riferimento: '' })
  }
  function modifica<K extends keyof DatiAddebito>(key: K, value: DatiAddebito[K]) {
    if (lock.current || incerto) return
    setDati(old => old && { ...old, [key]: value }); setAnteprima(null)
  }
  async function verifica() {
    if (!dati || lock.current) return
    lock.current = true; setBusy(true); setErrore('')
    try { setAnteprima(await anteprimaAddebito(client, dati)) }
    catch (e) { setErrore(e instanceof Error ? e.message : 'Anteprima fallita') }
    finally { lock.current = false; setBusy(false) }
  }
  async function conferma() {
    if (!dati || !anteprima || lock.current || esito) return
    lock.current = true; setBusy(true); setErrore('')
    const firma = JSON.stringify([fatturaId, dati, anteprima.token]), key = `artecna-addebito:${fatturaId}:${dati.materiale}`
    try {
      const saved = sessionStorage.getItem(key)
      if (!pending.current && saved) pending.current = JSON.parse(saved)
      if (pending.current && pending.current.firma !== firma) throw Error('Richiesta precedente da verificare nelle varianti prima di creare un altro addebito')
      pending.current ??= { firma, id: crypto.randomUUID() }
      sessionStorage.setItem(key, JSON.stringify(pending.current))
      const r = await creaAddebito(client, dati, anteprima, pending.current.id)
      setEsito(`Variante in bozza creata (${r.variante_id}). Il contratto resta invariato fino all’approvazione ordinaria.`)
      sessionStorage.removeItem(key); pending.current = null; setIncerto(false)
      setQuote(await quoteAddebito(client, fatturaId))
    } catch (e) { setIncerto(true); setErrore(e instanceof Error ? e.message : 'Esito incerto: verificare le varianti') }
    finally { lock.current = false; setBusy(false) }
  }
  const quota = dati && quote?.find(q => q.materiale_id === dati.materiale)
  return <section aria-label="Addebiti aggiuntivi al cliente">
    <h4>Addebiti aggiuntivi al cliente</h4>
    <p>Utilizza una quota già assegnata come costo al cantiere. Nessuna seconda assegnazione, fattura emessa o incasso. Le quote Economia seguono la propria raccolta e Variante.</p>
    {quote === null && !errore && <p role="status">Verifica quote fattura…</p>}
    {quote?.length === 0 && <p>Nessuna quota costo con collegamento UUID disponibile. I costi storici senza collegamento richiedono riconciliazione; non riassegnare il materiale.</p>}
    {quote?.map(q => <div key={q.materiale_id}><span>{q.descrizione} · {q.cantiere} · {q.quantita} {q.unita_misura} · costo {euro(q.costo)} · quota non riservata {q.disponibile}</span>{' '}
      <button type="button" disabled={busy || q.disponibile <= 0} onClick={e => apri(q, e.currentTarget)}>Addebita al cliente</button></div>)}
    {!dati && errore && <p role="alert">{errore}</p>}
    {dati && <VistaOperativa titolo="Addebita al cliente" contesto={quota?.cantiere} etichettaRitorno="← Torna alla fattura fornitore" ritornoFocusRef={ritorno} occupata={busy} onChiudi={() => { if (!lock.current) { setDati(null); setAnteprima(null) } }}>
      <p>Fattura UUID {fatturaId} · Riga sorgente UUID {quota?.fattura_riga_id} · Quota UUID {dati.materiale} · Cantiere UUID {quota?.cantiere_id}</p>
      <fieldset disabled={busy || incerto || !!esito}>
        <label>Quantità della quota ({quota?.unita_misura}) <input value={dati.quantita} onChange={e => modifica('quantita', e.target.value)} inputMode="decimal" /></label>
        <label>Prezzo totale da addebitare <input value={dati.importo} onChange={e => modifica('importo', e.target.value)} inputMode="decimal" /></label>
        <label>Importo <select value={dati.ivaInclusa ? 'lordo' : 'netto'} onChange={e => modifica('ivaInclusa', e.target.value === 'lordo')}><option value="netto">IVA esclusa</option><option value="lordo">IVA inclusa</option></select></label>
        <label>Aliquota IVA dell’addebito (%) <input value={dati.aliquota} onChange={e => modifica('aliquota', e.target.value)} inputMode="decimal" /></label>
        <label>Descrizione Variante <textarea value={dati.descrizione} onChange={e => modifica('descrizione', e.target.value)} maxLength={2000} /></label>
        <label>Motivazione <textarea value={dati.motivo} onChange={e => modifica('motivo', e.target.value)} maxLength={2000} /></label>
        <label>Riferimento accordo cliente <input value={dati.riferimento} onChange={e => modifica('riferimento', e.target.value)} maxLength={500} /></label>
        <button type="button" onClick={() => void verifica()}>Verifica anteprima addebito</button>
      </fieldset>
      <p>Il ribasso del contratto originario non si applica a questo extra. Il prezzo inserito è quello concordato per l’addebito.</p>
      {anteprima && <div aria-label="Anteprima addebito"><p>Costo originale della quota: {euro(anteprima.costo_originale_quota)}</p>
        <p>Addebito netto: {euro(anteprima.netto)}</p><p>Contratto attuale: {euro(anteprima.contratto_attuale)}</p>
        <p>Solo dopo approvazione: {euro(anteprima.contratto_dopo_approvazione)}</p>
        <button type="button" disabled={busy || !!esito} onClick={() => void conferma()}>{incerto ? 'Verifica la stessa richiesta' : 'Conferma creazione Variante in bozza'}</button></div>}
      {busy && <p role="status">Verifica in corso…</p>}{errore && <p role="alert">{errore}</p>}{esito && <p role="status">{esito}</p>}
    </VistaOperativa>}
  </section>
}
