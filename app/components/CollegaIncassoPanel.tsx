'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { centesimi } from '../engines/contabilita-ditta/riepilogo'
import { disponibilita, eseguiAttribuzione, leggiAttribuzioni, recuperaOperazione, situazioneImporti, type ClientAttribuzioni, type LetturaAttribuzioni, type Operazione } from '../engines/contabilita-ditta/attribuzioni'

const euro = (n: number | null) => n === null ? 'Non determinabile' : (n / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
export default function CollegaIncassoPanel({ client, fatturaId, onChiudi, onConfermato }: { client: ClientAttribuzioni; fatturaId: string; onChiudi: () => void; onConfermato?: () => void | Promise<void> }) {
  const key = `artecna-attribuzione-pendente:${fatturaId}`
  const [lettura, setLettura] = useState<LetturaAttribuzioni | null>(null)
  const [errore, setErrore] = useState(''), [messaggio, setMessaggio] = useState('')
  const [acconto, setAcconto] = useState(''), [importo, setImporto] = useState(''), [verificato, setVerificato] = useState(false)
  const [attesa, setAttesa] = useState(false)
  const gate = useRef(false)
  const [pendente, setPendente] = useState<Operazione | null>(() => { try { return typeof window === 'undefined' ? null : recuperaOperazione(sessionStorage.getItem(key), fatturaId) } catch { return null } })
  const rileggi = useCallback(async () => { try { const dati = await leggiAttribuzioni(client, fatturaId); setErrore(''); setLettura(dati) } catch (e) { setLettura(null); setErrore(e instanceof Error ? e.message : 'Lettura non disponibile') } }, [client, fatturaId])
  useEffect(() => {
    let attivo = true
    void leggiAttribuzioni(client, fatturaId).then(dati => { if (attivo) { setErrore(''); setLettura(dati) } }).catch(e => { if (attivo) { setLettura(null); setErrore(e instanceof Error ? e.message : 'Lettura non disponibile') } })
    return () => { attivo = false }
  }, [client, fatturaId])
  useEffect(() => { if (!pendente) return; const blocca = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }; window.addEventListener('beforeunload', blocca); return () => window.removeEventListener('beforeunload', blocca) }, [pendente])
  async function esegui(op: Operazione) {
    if (gate.current) return
    gate.current = true
    // Il journal conserva soltanto l'identità/payload della richiesta confermata,
    // mai un movimento nuovo o credenziali. Nessuna scrittura DB al caricamento.
    try { sessionStorage.setItem(key, JSON.stringify(op)) } catch { gate.current = false; setErrore('Impossibile conservare l’identità della richiesta: operazione non inviata.'); return }
    setPendente(op); setAttesa(true); setMessaggio('')
    let confermato = false
    try {
      const r = await eseguiAttribuzione(client, op)
      confermato = r.confermato
      setMessaggio(r.messaggio)
      if (r.confermato || r.rifiutato) { sessionStorage.removeItem(key); setPendente(null) }
      if (r.confermato) { await rileggi(); await onConfermato?.(); window.dispatchEvent(new Event('artecna-clienti-incassi-aggiornati')); setImporto(''); setVerificato(false) }
    } catch { setMessaggio(confermato ? 'Operazione confermata; aggiornamento delle letture non riuscito. Riapri il pannello senza ripetere l’attribuzione.' : 'Esito non confermato: recupera la stessa richiesta. Non inviare una nuova attribuzione.') }
    finally { gate.current = false; setAttesa(false) }
  }
  const quota = lettura ? situazioneImporti(lettura.fattura.totale, lettura.attribuito).quota : null
  return <div role="dialog" aria-modal="true" aria-label="Collega incasso" style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 10000, overflow: 'auto', padding: 20 }}><section style={{ maxWidth: 1000, margin: 'auto', background: '#fff', color: '#111827', padding: 24, borderRadius: 12 }}>
    <h2>Collega incasso</h2><button type="button" disabled={attesa || !!pendente} onClick={onChiudi}>Chiudi collegamenti</button>
    {errore && <p role="alert">{errore}</p>}{messaggio && <p role="status">{messaggio}</p>}
    {pendente && <p>Richiesta con esito da recuperare. Puoi ricaricare questa pagina: l’identità resta conservata in questa scheda. <button type="button" disabled={attesa} onClick={() => void esegui(pendente)}>Recupera stessa richiesta</button></p>}
    {!lettura && !errore && <p>Caricamento collegamenti…</p>}
    {lettura && <>
      <h3>Fattura {lettura.fattura.numero_fattura}</h3><p>{lettura.fattura.data_fattura || 'Data mancante'} — {lettura.fattura.cliente}</p>
      <p>Totale documento: {euro(centesimi(lettura.fattura.totale))} · Quote collegate: {euro(centesimi(lettura.attribuito))}</p>
      <p>Quota ancora da attribuire: {euro(quota)}. <strong>Da riconciliare</strong>: residuo da incassare non verificato.</p>
      <p>Il cumulativo storico dichiarato ({euro(centesimi(lettura.fattura.importo_incassato))}) non viene sommato ai collegamenti e non genera movimenti. L’assenza di quote non significa fattura non pagata. Non si ricostruisce un saldo storico.</p>
      <p>Disponibili soltanto acconti con ID Cantiere coerente. Gli incassi non fatturati ({lettura.incassi_non_fatturati_ambigui}) restano separati: senza identità comune potrebbero rappresentare la stessa entrata.</p>
      <table><caption>Incassi disponibili — fonte acconti_cantiere</caption><thead><tr><th>Data / descrizione</th><th>Origine</th><th>Originale</th><th>Attribuito</th><th>Disponibilità</th><th>Scelta</th></tr></thead><tbody>{lettura.acconti.map(a => <tr key={a.id}><td>{a.data_incasso || 'Data mancante'} — {a.descrizione || 'Acconto'}</td><td>{a.provenienza}</td><td>{euro(centesimi(a.importo))}</td><td>{euro(centesimi(a.attribuito))}</td><td>{euro(disponibilita(a))}</td><td><input aria-label={`Seleziona ${a.descrizione || a.id}`} type="radio" name="acconto" checked={acconto === a.id} disabled={attesa || !!pendente || !disponibilita(a)} onChange={() => setAcconto(a.id)} /></td></tr>)}</tbody></table>
      <label>Quota da attribuire <input value={importo} onChange={e => setImporto(e.target.value)} inputMode="decimal" disabled={attesa || !!pendente} /></label>
      <label style={{ display: 'block', margin: '12px 0' }}><input type="checkbox" checked={verificato} disabled={attesa || !!pendente} onChange={e => setVerificato(e.target.checked)} />Ho verificato che è una fattura ordinaria valida, non una nota di credito/acconto/saldo ambiguo, che il totale dichiarato è corretto e che questo acconto appartiene al medesimo cliente/Cantiere senza duplicare un’altra entrata.</label>
      <button type="button" disabled={attesa || !!pendente || !verificato || !acconto || !(centesimi(importo.replace(',', '.'))! > 0)} onClick={() => { if (window.confirm('Confermare questa sola attribuzione? Fattura, movimento e cumulativo non saranno modificati.')) void esegui({ tipo: 'collega', id: crypto.randomUUID(), fattura: fatturaId, acconto, importo: importo.replace(',', '.') }) }}>Conferma collegamento</button>
      <h3>Collegamenti e storico</h3>{!lettura.collegamenti.length && <p>Nessun collegamento registrato: situazione da riconciliare.</p>}
      {lettura.collegamenti.map(l => <div key={l.id}><p>{euro(centesimi(l.importo))} · {l.creato_at} · Autore {l.creato_da} · Acconto {l.acconto_id} · {l.scollegato_at ? 'Scollegato' : 'Attivo'}</p>{!l.scollegato_at && <button type="button" disabled={attesa || !!pendente} onClick={() => { if (window.confirm('Scollegare soltanto questa quota? Il movimento e la fattura saranno conservati.')) void esegui({ tipo: 'scollega', id: crypto.randomUUID(), fattura: fatturaId, collegamento: l.id }) }}>Scollega quota</button>}</div>)}
    </>}
  </section></div>
}
