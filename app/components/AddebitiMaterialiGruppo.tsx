'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import VistaOperativa from './VistaOperativa'
import { applicaComuni, anteprimaGruppo, costoQuota, creaGruppo, euroInput, leggiQuoteGruppo,
  preparaRiga, ricarico, ripartisci, type AnteprimaGruppo, type CampiComuni, type RigaGruppo } from '../engines/economia/addebitiGruppo'
import type { QuotaAddebito } from '../engines/economia/addebitiCliente'

const euro = (v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
export default function AddebitiMaterialiGruppo({ fatturaId, chiudi }: { fatturaId: string; chiudi: () => void }) {
  const [quote, setQuote] = useState<QuotaAddebito[]>([]), [righe, setRighe] = useState<RigaGruppo[]>([])
  const [caricamento, setCaricamento] = useState(true), [errore, setErrore] = useState(''), [esito, setEsito] = useState('')
  const [cantiere, setCantiere] = useState(''), [selezione, setSelezione] = useState<string[]>([])
  const [comuni, setComuni] = useState<CampiComuni>({}), [modoPrezzo, setModoPrezzo] = useState('nessuno')
  const [percentuale, setPercentuale] = useState(''), [totale, setTotale] = useState(''), [prezziConfermati, setPrezziConfermati] = useState(false)
  const [anteprima, setAnteprima] = useState<AnteprimaGruppo | null>(null), [invio, setInvio] = useState(false), [incerto, setIncerto] = useState(false)
  const lock = useRef(false), attiva = useRef(true), richiesta = useRef<string | null>(null)
  useEffect(() => {
    attiva.current = true
    void leggiQuoteGruppo(supabase, fatturaId).then(q => {
      if (!attiva.current) return
      setQuote(q); setRighe(q.filter(r => r.disponibile > 0).map(preparaRiga)); setCantiere(q[0]?.cantiere_id ?? '')
    }).catch(() => { if (attiva.current) setErrore('Quote non disponibili o non autorizzate. Nessun invio possibile.') })
      .finally(() => { if (attiva.current) setCaricamento(false) })
    return () => { attiva.current = false }
  }, [fatturaId])
  const modificabile = !invio && !incerto && !esito
  const disponibili = quote.filter(q => q.cantiere_id === cantiere && q.disponibile > 0)
  const scelte = righe.filter(r => selezione.includes(r.materiale_id))
  const cantieri = [...new Map(quote.map(q => [q.cantiere_id, q.cantiere])).entries()]
  function invalida() { setAnteprima(null); setPrezziConfermati(false); setErrore('') }
  function modifica(id: string, campo: keyof RigaGruppo, valore: string | boolean) {
    if (lock.current || !modificabile) return
    setRighe(old => old.map(r => r.materiale_id === id ? { ...r, [campo]: valore,
      ...(campo === 'aliquota' || campo === 'iva_inclusa' ? { iva_confermata: false } : {}) } : r)); invalida()
  }
  function applica() {
    if (!modificabile || lock.current || !scelte.length) return
    try {
      let nuove = applicaComuni(righe, selezione, comuni)
      if (modoPrezzo !== 'nessuno') {
        const costi = scelte.map(r => costoQuota(quote.find(q => q.materiale_id === r.materiale_id)!, r.quantita))
        const prezzi = modoPrezzo === 'totale' ? ripartisci(totale, costi) : costi.map(c => ricarico(c, percentuale))
        nuove = nuove.map(r => { const i = scelte.findIndex(s => s.materiale_id === r.materiale_id); return i < 0 ? r : { ...r, importo: euroInput(prezzi[i]) } })
      }
      setRighe(nuove); invalida()
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Valori comuni non validi') }
  }
  async function verifica() {
    if (lock.current || !modificabile || !prezziConfermati) return
    lock.current = true; setInvio(true); setErrore('')
    try { const p = await anteprimaGruppo(supabase, cantiere, scelte); if (attiva.current) setAnteprima(p) }
    catch (e) { if (attiva.current) setErrore(e instanceof Error ? e.message : 'Anteprima non disponibile') }
    finally { lock.current = false; if (attiva.current) setInvio(false) }
  }
  async function conferma() {
    if (lock.current || !modificabile || !anteprima || !prezziConfermati) return
    lock.current = true; setInvio(true); setErrore('')
    const key = `artecna-addebiti-gruppo:${fatturaId}:${cantiere}`
    try {
      if (sessionStorage.getItem(key)) throw Error('Richiesta precedente da verificare nelle Varianti prima di procedere')
      richiesta.current = crypto.randomUUID()
      // Conservare l'identità anche se il trasporto termina con esito incerto.
      sessionStorage.setItem(key, JSON.stringify({ richiesta: richiesta.current, token: anteprima.token }))
      const r = await creaGruppo(supabase, richiesta.current, cantiere, scelte, anteprima)
      if (attiva.current) setEsito(`Una sola Variante in bozza creata (${r.varianteId}). Contratto invariato fino all’approvazione ordinaria.`)
      sessionStorage.removeItem(key)
    } catch (e) { if (attiva.current) { setIncerto(true); setErrore(e instanceof Error ? e.message : 'Esito incerto: verificare le Varianti') } }
    finally { lock.current = false; if (attiva.current) setInvio(false) }
  }
  return <VistaOperativa titolo="Addebiti aggiuntivi di gruppo" etichettaRitorno="← Torna alla fattura fornitore" onChiudi={chiudi} occupata={invio}>
    <p>Solo quote già assegnate direttamente al Cantiere. Il percorso Economia resta nella propria raccolta.</p>
    <p>Il costo è proposto soltanto come base di prezzo: non costituisce un prezzo commerciale concordato. Nessun ribasso contrattuale automatico sugli extra.</p>
    {caricamento && <p role="status">Lettura quote disponibili…</p>}
    <fieldset disabled={!modificabile || caricamento} style={{ minWidth: 0 }}>
      <label>Cantiere destinatario <select value={cantiere} onChange={e => { setCantiere(e.target.value); setSelezione([]); invalida() }}>{cantieri.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
      <p>{disponibili.length} quote disponibili · {scelte.length} selezionate</p>
      <button type="button" onClick={() => { setSelezione(disponibili.map(q => q.materiale_id)); invalida() }}>Seleziona tutti</button>{' '}
      <button type="button" onClick={() => { setSelezione([]); invalida() }}>Deseleziona tutti</button>
      <div style={{ overflowX: 'auto' }}><table><caption>Quote già contabilizzate — prezzi cliente modificabili</caption>
        <thead><tr>{['Selezione', 'Descrizione e origine', 'Quantità / UM', 'Costo quota originale', 'Prezzo cliente totale', 'IVA', 'Accordo'].map(t => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>{quote.filter(q => q.cantiere_id === cantiere).map(q => {
          const r = righe.find(s => s.materiale_id === q.materiale_id)
          if (!r) return <tr key={q.materiale_id}><td colSpan={7}>{q.descrizione} · Quota già riservata, non selezionabile</td></tr>
          return <tr key={q.materiale_id}>
            <td><input type="checkbox" aria-label={`Seleziona quota ${q.materiale_id}`} checked={selezione.includes(q.materiale_id)} onChange={e => { setSelezione(old => e.target.checked ? [...old, q.materiale_id] : old.filter(id => id !== q.materiale_id)); invalida() }} /></td>
            <td><label>Descrizione <input value={r.descrizione} onChange={e => modifica(q.materiale_id, 'descrizione', e.target.value)} /></label><small style={{ display: 'block', overflowWrap: 'anywhere' }}>Fattura {fatturaId} · Riga {q.fattura_riga_id} · Quota {q.materiale_id}</small></td>
            <td><label>Quantità addebitabile <input inputMode="decimal" value={r.quantita} onChange={e => modifica(q.materiale_id, 'quantita', e.target.value)} /></label>{q.unita_misura} · disponibile {q.disponibile}</td>
            <td>{euro(q.costo)} per {q.quantita} {q.unita_misura}. Sorgente non modificabile.</td>
            <td><label>Prezzo cliente totale <input inputMode="decimal" value={r.importo} onChange={e => modifica(q.materiale_id, 'importo', e.target.value)} /></label></td>
            <td><label>Trattamento importo <select value={r.iva_inclusa ? 'lordo' : 'netto'} onChange={e => modifica(q.materiale_id, 'iva_inclusa', e.target.value === 'lordo')}><option value="netto">IVA esclusa</option><option value="lordo">IVA inclusa</option></select></label>
              <label>Aliquota IVA <input placeholder="Da confermare" inputMode="decimal" value={r.aliquota} onChange={e => modifica(q.materiale_id, 'aliquota', e.target.value)} /></label>
              <label><input type="checkbox" checked={r.iva_confermata} onChange={e => modifica(q.materiale_id, 'iva_confermata', e.target.checked)} />IVA esplicitamente confermata</label></td>
            <td><label>Motivazione <input value={r.motivo} onChange={e => modifica(q.materiale_id, 'motivo', e.target.value)} /></label><label>Riferimento accordo cliente <input value={r.riferimento} onChange={e => modifica(q.materiale_id, 'riferimento', e.target.value)} /></label></td>
          </tr>
        })}</tbody></table></div>
      <section aria-label="Campi comuni"><h3>Applica alle quote selezionate</h3><p>Si applicano soltanto i campi comuni modificati. Gli altri valori personalizzati restano invariati.</p>
        <label>Motivazione comune <input value={comuni.motivo ?? ''} onChange={e => setComuni(c => ({ ...c, motivo: e.target.value }))} /></label>
        <label>Accordo comune <input value={comuni.riferimento ?? ''} onChange={e => setComuni(c => ({ ...c, riferimento: e.target.value }))} /></label>
        <label>Aliquota comune <input placeholder="Da confermare" value={comuni.aliquota ?? ''} onChange={e => setComuni(c => ({ ...c, aliquota: e.target.value, iva_confermata: false }))} /></label>
        <label>Importi comuni <select value={comuni.iva_inclusa === undefined ? '' : comuni.iva_inclusa ? 'lordo' : 'netto'} onChange={e => { if (e.target.value) setComuni(c => ({ ...c, iva_inclusa: e.target.value === 'lordo', iva_confermata: false })) }}><option value="">Non modificare</option><option value="netto">IVA esclusa</option><option value="lordo">IVA inclusa</option></select></label>
        <label><input type="checkbox" checked={comuni.iva_confermata === true} onChange={e => setComuni(c => ({ ...c, iva_confermata: e.target.checked }))} />Conferma IVA comune</label>
        <label>Operazione prezzi <select value={modoPrezzo} onChange={e => setModoPrezzo(e.target.value)}><option value="nessuno">Conserva prezzi per riga</option><option value="ricarico">Ricarico sul costo della quantità selezionata</option><option value="totale">Ripartisci importo cliente complessivo</option></select></label>
        {modoPrezzo === 'ricarico' && <label>Ricarico percentuale <input inputMode="decimal" value={percentuale} onChange={e => setPercentuale(e.target.value)} /></label>}
        {modoPrezzo === 'totale' && <><label>Importo cliente complessivo <input inputMode="decimal" value={totale} onChange={e => setTotale(e.target.value)} /></label><p>Ripartizione proporzionale ai costi delle quantità selezionate, con distribuzione dei centesimi residui. L’importo comprende l’IVA solo per le righe impostate IVA inclusa.</p></>}
        <button type="button" disabled={!scelte.length} onClick={applica}>Applica a tutti</button>
        <button type="button" onClick={() => setComuni({})}>Azzera campi comuni senza modificare le righe</button>
      </section>
      <label><input type="checkbox" checked={prezziConfermati} onChange={e => { setPrezziConfermati(e.target.checked); setAnteprima(null) }} />Confermo prezzi cliente e riferimenti dell’accordo per le quote selezionate</label>
      <button type="button" disabled={!scelte.length || !prezziConfermati} onClick={() => void verifica()}>Verifica anteprima completa</button>
    </fieldset>
    {invio && <p role="status">Verifica o invio in corso…</p>}{errore && <p role="alert">{errore}</p>}
    {anteprima && <section aria-label="Anteprima gruppo"><h3>Anteprima prima della scrittura</h3>
      <table><thead><tr><th>Descrizione</th><th>Quantità / UM</th><th>Costo originale quota</th><th>Importo inserito / IVA</th><th>Netto cliente</th></tr></thead>
        <tbody>{anteprima.righe.map(p => { const r = scelte.find(s => s.materiale_id === p.materiale_id)!; return <tr key={p.materiale_id}><td>{r.descrizione}</td><td>{p.quantita} {p.unita_misura}</td><td>{euro(p.costo_originale_quota)}</td><td>{r.importo} · {r.iva_inclusa ? 'IVA inclusa' : 'IVA esclusa'} · {r.aliquota}%</td><td>{euro(p.netto)}</td></tr> })}</tbody></table>
      <p>Totale netto extra: {euro(anteprima.netto)}. Contratto attuale: {euro(anteprima.contratto_attuale)}. Solo dopo approvazione: {euro(anteprima.contratto_dopo_approvazione)}.</p>
      <button type="button" disabled={!modificabile} onClick={() => void conferma()}>Conferma una sola Variante in bozza</button>
    </section>}{esito && <p role="status">{esito}</p>}
  </VistaOperativa>
}
