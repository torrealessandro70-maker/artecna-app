'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import VistaOperativa from './VistaOperativa'
import AccontoCompilazioneVista from './AccontoCompilazioneVista'
import { calcolaIncassi, leggiIncassiFatturazione, type ClientIncassi, type RiepilogoIncassi, type SnapshotIncassi } from '../engines/contabilita-ditta/incassiFatturazione'
import { EVENTO_FATTURE_AGGIORNATE } from '../engines/contabilita-ditta/modificaFattura'
import { centesimi } from '../engines/contabilita-ditta/riepilogo'

const euro = (n: number) => (n / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const oggi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function IndicatoriIncassi({ dati }: { dati: RiepilogoIncassi | null }) {
  return <div data-incassi-kpi style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', borderBottom: '1px solid #cbd5e1' }}><dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
    {([['totale', 'Totale incassi verificati'], ['fatturato', 'Quota coperta da fatture valide'], ['senzaFattura', 'Quota senza fattura collegata'], ['riconciliare', 'Quota da riconciliare']] as const).map(([key, label]) =>
      <div key={key}><dt>{label}</dt><dd style={{ margin: 0, fontWeight: 700 }}>{dati ? euro(dati[key]) : 'Non disponibile'}</dd></div>)}
  </dl></div>
}

export default function IncassiFatturazionePanel({ client }: { client: ClientIncassi }) {
  const [periodo, setPeriodo] = useState(() => ({ da: oggi().slice(0, 4) + '-01-01', a: oggi() }))
  const [richiesta, setRichiesta] = useState(0)
  const [lettura, setLettura] = useState<{ client: ClientIncassi; richiesta: number; da: string; a: string; snapshot?: SnapshotIncassi; errore?: string } | null>(null)
  const [dettaglio, setDettaglio] = useState(false), [cerca, setCerca] = useState(''), [cantiere, setCantiere] = useState(''), [cliente, setCliente] = useState('')
  const [stato, setStato] = useState('tutti'), [pagina, setPagina] = useState(0), [notaId, setNotaId] = useState<string | null>(null)
  const ritorno = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    let attivo = true
    void leggiIncassiFatturazione(client, periodo.da, periodo.a).then(snapshot => {
      if (attivo) setLettura({ client, richiesta, ...periodo, snapshot })
    }).catch(error => { if (attivo) setLettura({ client, richiesta, ...periodo, errore: error instanceof Error ? error.message : 'Lettura non disponibile' }) })
    return () => { attivo = false }
  }, [client, periodo, richiesta])
  useEffect(() => {
    const aggiorna = () => { setRichiesta(r => r + 1); setNotaId(null) }
    const eventi = ['artecna-incassi-lordi-aggiornati', 'artecna-clienti-incassi-aggiornati', EVENTO_FATTURE_AGGIORNATE]
    eventi.forEach(e => window.addEventListener(e, aggiorna))
    const auth = client.auth?.onAuthStateChange(aggiorna)
    return () => { eventi.forEach(e => window.removeEventListener(e, aggiorna)); auth?.data.subscription.unsubscribe() }
  }, [client])
  const valida = lettura?.client === client && lettura.richiesta === richiesta && lettura.da === periodo.da && lettura.a === periodo.a
  const snapshot = valida ? lettura.snapshot : undefined
  const calcolo = useMemo(() => {
    if (!snapshot) return { dati: null, errore: '' }
    try { return { dati: calcolaIncassi(snapshot), errore: '' } } catch { return { dati: null, errore: 'Quadratura o identità non verificabili. Nessun totale stimato.' } }
  }, [snapshot])
  const errore = calcolo.errore || (valida ? lettura.errore : '')
  const righe = calcolo.dati?.righe ?? []
  const selezionate = righe.filter(r => (!cantiere || r.cantiere_id === cantiere) && (!cliente || r.cliente === cliente)
    && (!cerca || `${r.cliente} ${r.cantiere ?? ''} ${r.descrizione ?? ''} ${r.metodo}`.toLocaleLowerCase('it').includes(cerca.toLocaleLowerCase('it')))
    && (stato === 'tutti' || (stato === 'fatturato' ? r.fatturato > 0 : stato === 'senza' ? r.senzaFattura > 0 : r.riconciliare > 0)))
  const totalePagine = Math.max(1, Math.ceil(selezionate.length / 20)), corrente = Math.min(pagina, totalePagine - 1)
  const clienti = [...new Set(righe.map(r => r.cliente))].sort(), cantieri = [...new Map(righe.map(r => [r.cantiere_id, r.cantiere ?? r.cantiere_id])).entries()]
  const comune = <>
    <form key={`${periodo.da}:${periodo.a}`} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); setPeriodo({ da: String(f.get('da')), a: String(f.get('a')) }); setPagina(0); setNotaId(null) }}>
      <label>Incassi dal <input type="date" name="da" required defaultValue={periodo.da} /></label>{' '}
      <label>al <input type="date" name="a" required defaultValue={periodo.a} /></label>{' '}
      <button type="submit">Applica periodo</button>{' '}<button type="button" onClick={() => setRichiesta(r => r + 1)}>Aggiorna incassi</button>
    </form>
    <IndicatoriIncassi dati={calcolo.dati} />
    <p role="status">{errore || (!valida ? 'Caricamento: nessuno zero sostitutivo.' : snapshot ? 'Registro degli incassi verificati; copertura documentale corrente.' : 'Dati non disponibili.')}</p>
    <p>Importi lordi, per data effettiva del pagamento. I filtri del dettaglio non modificano i quattro totali del periodo.</p>
    <p>Senza fattura collegata non significa IVA 0%, esenzione o assenza di obblighi fiscali. Avvisi e scadenze restano indipendenti.</p>
    {snapshot && <p>Fonte: incassi lordi verificati e quote documentali · Fotografia {new Date(snapshot.fotografia).toLocaleString('it-IT')}.
      {' '}{snapshot.storici_da_riconciliare} movimenti nel registro storico non fatturati, esclusi da questi totali per evitare duplicazioni.</p>}
  </>
  return <section aria-label="Incassi e fatturazione" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16 }}>
    <h3>Incassi e fatturazione</h3>{comune}
    <button type="button" ref={ritorno} onClick={() => setDettaglio(true)}>Dettaglio per cliente e cantiere</button>
    {dettaglio && <VistaOperativa titolo="Incassi e fatturazione" etichettaRitorno="← Torna a Economia generale" onChiudi={() => setDettaglio(false)} ritornoFocusRef={ritorno}>
      {comune}
      <fieldset><legend>Filtra posizioni</legend>
        <label>Cerca <input type="search" value={cerca} onChange={e => { setCerca(e.target.value); setPagina(0) }} /></label>{' '}
        <label>Cliente <select value={cliente} onChange={e => { setCliente(e.target.value); setPagina(0) }}><option value="">Tutti</option>{clienti.map(c => <option key={c}>{c}</option>)}</select></label>{' '}
        <label>Cantiere <select value={cantiere} onChange={e => { setCantiere(e.target.value); setPagina(0) }}><option value="">Tutti</option>{cantieri.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>{' '}
        <label>Copertura <select value={stato} onChange={e => { setStato(e.target.value); setPagina(0) }}><option value="tutti">Tutte</option><option value="fatturato">Con quota fatturata</option><option value="senza">Senza fattura collegata</option><option value="riconciliare">Da riconciliare</option></select></label>
      </fieldset>
      <p>{selezionate.length} movimenti · Pagina {corrente + 1} di {totalePagine}</p>
      <button type="button" disabled={corrente === 0} onClick={() => setPagina(corrente - 1)}>Precedente</button>{' '}
      <button type="button" disabled={corrente + 1 >= totalePagine} onClick={() => setPagina(corrente + 1)}>Successiva</button>
      <div role="region" aria-label="Movimenti incassi" tabIndex={0} style={{ overflowX: 'auto' }}>
        <table><caption>Un UUID per pagamento; collegare una fattura non crea un altro incasso</caption><thead><tr>{['Cliente / cantiere', 'Data / metodo', 'Lordo ricevuto', 'Fatturato', 'Senza fattura', 'Da riconciliare', 'Documenti e stato fiscale', 'Note'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
          <tbody>{selezionate.slice(corrente * 20, corrente * 20 + 20).map(r => <tr key={r.id}>
            <td>{r.cliente}<br />{r.cantiere ?? r.cantiere_id}</td><td>{r.data}<br />{r.metodo}<br />Fonte: {r.fonte}</td>
            <td>{euro(r.totale)}</td><td>{euro(r.fatturato)}</td><td>{euro(r.senzaFattura)}</td><td>{euro(r.riconciliare)}</td>
            <td>{r.quote.length ? r.quote.map(q => <p key={q.id}>Fattura {q.numero ?? q.fattura_id}: {euro(centesimi(q.importo) ?? 0)}{q.revocata ? ' · collegamento revocato' : q.valida ? ' · copertura valida' : ' · da verificare'}</p>) : 'Nessuna fattura collegata'}
              <p>Stato fiscale: {r.fiscale.stato}{r.fiscale.termine ? ` · Termine ${r.fiscale.termine}` : ''}</p>
              <p>Destinazione: {r.imputazione}. Nessun saldo netto calcolato dal lordo.</p></td>
            <td>{r.nota && <details><summary>Leggi nota</summary><p>{r.nota}</p></details>}<button type="button" disabled={!snapshot} onClick={() => setNotaId(r.acconto_id)}>Annota scelta gestionale</button></td>
          </tr>)}</tbody></table>
      </div>
    </VistaOperativa>}
    {notaId && snapshot && <AccontoCompilazioneVista key={`${snapshot.autore}:${notaId}`} id={notaId} utenteId={snapshot.autore} annotazioneGestionale
      onChiudi={() => setNotaId(null)} onPersistito={async () => { setRichiesta(r => r + 1) }} />}
  </section>
}
