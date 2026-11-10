'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import CollegaIncassoPanel, { CollegaIncassoAzione } from './CollegaIncassoPanel'
import { cantiereDocumento, type ClientAttribuzioni } from '../engines/contabilita-ditta/attribuzioni'
import { leggiFontiDitta, type ClientLettura } from '../engines/contabilita-ditta/lettura'
import { costruisciRiepilogo, fontiInCaricamento, periodoPreset, type Fonti, type Periodo } from '../engines/contabilita-ditta/riepilogo'
import { EVENTO_FATTURE_AGGIORNATE } from '../engines/contabilita-ditta/modificaFattura'
import styles from './RiepilogoDittaPanel.module.css'
import ProspettoIvaPanel from './ProspettoIvaPanel'

const euro = (c: number) => (c / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
function oggiLocale() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const colori = { Disponibile: '#166534', Limitato: '#92400e', 'Non calcolabile': '#9f1239' }

import VistaOperativa from './VistaOperativa'

export type DestinazioneEconomia = 'fatture-emesse' | 'fatture-fornitori' | 'pagamenti-operai'
type NavigazioneEconomia = { onApri?: (destinazione: DestinazioneEconomia) => void; rigaCostiGenerali?: ReactNode }
const destinazioni: Record<string, { destinazione: DestinazioneEconomia; etichetta: string }> = {
  emesse: { destinazione: 'fatture-emesse', etichetta: 'Apri fatture emesse' },
  ricevute: { destinazione: 'fatture-fornitori', etichetta: 'Apri fatture ricevute' },
  cumulativo: { destinazione: 'fatture-emesse', etichetta: 'Apri fatture emesse' },
  operai: { destinazione: 'pagamenti-operai', etichetta: 'Apri pagamenti operai' },
}
const ambito = (i: { ambito: string }) => i.ambito === 'progressivo' ? 'Progressivo complessivo dichiarato oggi — non filtrato per periodo' : i.ambito === 'riferimento' ? 'Alla data di riferimento — storico richiesto' : 'Documenti / movimenti nel periodo'

/** Vista pura rispetto al DB: periodo e dettagli cambiano soltanto stato React. */
export function RiepilogoDittaVista({ fonti, fotografia, onCollega, onApri, rigaCostiGenerali }: { fonti: Fonti; fotografia: string; onCollega?: (id: string) => void } & NavigazioneEconomia) {
  const [tipo, setTipo] = useState<'mese' | 'trimestre' | 'anno' | 'personalizzato'>('trimestre')
  const [riferimento, setRiferimento] = useState(oggiLocale)
  const [manuale, setManuale] = useState<Periodo>(() => periodoPreset('trimestre', oggiLocale()))
  const periodo = useMemo(() => tipo === 'personalizzato' ? manuale : periodoPreset(tipo, riferimento), [tipo, manuale, riferimento])
  const indicatori = useMemo(() => costruisciRiepilogo(fonti, periodo), [fonti, periodo])
  const [dettaglioId, setDettaglioId] = useState<string | null>(null)
  const ritornoFocusRef = useRef<HTMLButtonElement | null>(null)
  const i = indicatori.find(indicatore => indicatore.id === dettaglioId)
  return <section aria-label="Riepilogo ditta">
    <h3>Riepilogo ditta</h3>
    <fieldset className={styles.periodo}>
      <legend>Periodo di consultazione</legend>
      <label>Periodo <select value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}><option value="mese">Mese</option><option value="trimestre">Trimestre</option><option value="anno">Anno</option><option value="personalizzato">Intervallo personalizzato</option></select></label>
      {tipo !== 'personalizzato' ? <label>Data nel periodo <input type="date" value={riferimento} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setRiferimento(e.target.value) }} /></label> : <>
        <label>Dal <input type="date" value={manuale.da} onChange={e => setManuale(p => ({ ...p, da: e.target.value }))} /></label>
        <label>Al <input type="date" value={manuale.a} onChange={e => setManuale(p => ({ ...p, a: e.target.value }))} /></label>
      </>}
    </fieldset>
    <p className={styles.fotografia} aria-live="polite">Documenti e movimenti: {periodo.da || 'data mancante'} → {periodo.a || 'data mancante'}. Residui richiesti al {periodo.a || 'data mancante'}. Fotografia delle letture: {fotografia || 'in caricamento'}.</p>
    <div className={styles.scorrimentoFonti} role="region" aria-label="Tabella riepilogo ditta" tabIndex={0}>
      <table className={styles.riepilogo}>
        <caption>Indicatori esistenti — valori e ambiti separati</caption>
        <thead><tr><th scope="col">Area</th><th scope="col">Valore periodo / ambito</th><th scope="col">Stato</th><th scope="col">Azione</th></tr></thead>
        <tbody>{indicatori.map(indicatore => <tr key={indicatore.id} aria-label={indicatore.nome}>
          <th scope="row">{indicatore.nome}</th>
          <td><strong>{indicatore.centesimi === null ? 'Non determinabile' : euro(indicatore.centesimi)}</strong><small>{ambito(indicatore)}</small></td>
          <td style={{ color: colori[indicatore.stato] }}>{indicatore.stato}</td>
          <td><div className={styles.azioniRiga}>
            <button type="button" onClick={event => { ritornoFocusRef.current = event.currentTarget; setDettaglioId(indicatore.id) }}>Mostra dettaglio</button>
            {onApri && destinazioni[indicatore.id] && <button type="button" onClick={() => onApri(destinazioni[indicatore.id].destinazione)}>{destinazioni[indicatore.id].etichetta}</button>}
          </div></td>
        </tr>)}{rigaCostiGenerali}</tbody>
      </table>
    </div>
    <ProspettoIvaPanel fonti={fonti} periodo={periodo} />
    <details className={styles.qualita}><summary>Fonti, limiti e qualità dei dati</summary>
      <p>Contabilità ordinaria · IVA trimestrale. Il trimestre è un filtro di consultazione, non una liquidazione IVA.</p>
      <p>Disponibile significa calcolabile sulle fonti caricate, non che tutte le fatture esterne siano state importate. Nessun utile definitivo, reddito imponibile, IVA da versare o saldo banca.</p>
      <p>Acconti, incassi non fatturati e cumulativi sulle fatture restano separati: possono rappresentare lo stesso denaro. Nessun consolidamento arbitrario.</p>
      <p>Materiali, assegnazioni, SAL e costi delle presenze non vengono sommati ai documenti o ai pagamenti di questo riepilogo.</p>
      <p>Spese, magazzino e attrezzature: consultazione separata, non utile contabile o fiscale e non sommate ai documenti del riepilogo.</p>
      {indicatori.map(indicatore => <div key={indicatore.id}><strong>{indicatore.nome}</strong><p>{indicatore.significato}</p><p>{indicatore.limite}</p>
        {!!indicatore.avvisi.length && <ul aria-label={'Segnalazioni ' + indicatore.nome}>{indicatore.avvisi.map((a, n) => <li key={n}>{a}</li>)}</ul>}
      </div>)}
    </details>
    {i && <VistaOperativa titolo={i.nome} etichettaRitorno="← Torna a Economia generale" onChiudi={() => setDettaglioId(null)} ritornoFocusRef={ritornoFocusRef}>
      <article className={styles.indicatore} aria-label={i.nome}>
        <strong style={{ color: colori[i.stato] }}>{i.stato}</strong>
        <p className={styles.valore}>{i.centesimi === null ? 'Non determinabile' : euro(i.centesimi)}</p>
        <p>{ambito(i)}</p>
        <details><summary>Significato e limiti</summary><p>{i.significato}</p><p>{i.limite}</p>
          {!!i.avvisi.length && <ul aria-label={'Segnalazioni ' + i.nome}>{i.avvisi.map((a, n) => <li key={n}>{a}</li>)}</ul>}
        </details>
        <details><summary>Contratto indicatore</summary>
          <dl><dt>Fonte autorevole</dt><dd>{i.fonte || 'Collegamenti verificati non disponibili'}</dd><dt>Campo importo</dt><dd>{i.importo}</dd><dt>Campo data</dt><dd>{i.data}</dd><dt>Formula</dt><dd>{i.formula}</dd><dt>Esclusioni</dt><dd>{i.esclusioni}</dd></dl>
        </details>
        <details className={styles.fonti}><summary>Dettaglio delle fonti ({i.dettagli.length})</summary>
          {!i.dettagli.length ? <p>Nessuna riga disponibile per questo prospetto. Un errore o un caricamento non equivale a un archivio vuoto.</p> : <div className={styles.scorrimentoFonti} role="region" aria-label={`Fonti — ${i.nome}`} tabIndex={0}><table className={styles.tabellaFonti} style={{ borderCollapse: 'collapse', width: '100%' }}>
            <caption>Righe incluse ed escluse — {i.nome}</caption>
            <thead><tr>{['Fonte / ID', 'Documento o movimento', 'Data dichiarata', 'Importo originale', 'Contributo al totale', 'Qualità / scadenza / IVA'].map(t => <th key={t} scope="col" style={{ textAlign: 'left', padding: 6 }}>{t}</th>)}</tr></thead>
            <tbody>{i.dettagli.map((d, n) => <tr key={`${d.id}:${n}`}><td style={{ padding: 6 }}>{d.fonte}<br /><span className={styles.identificativo}>{d.id}</span>{d.fonte === 'fatture_emesse' && onCollega && <div className={styles.azione}><CollegaIncassoAzione cantiereId={cantiereDocumento(fonti.fatture_emesse.righe, d.id)} onClick={() => onCollega(d.id)} /></div>}</td><td>{d.documento}{d.url && <p><a href={d.url} target="_blank" rel="noopener noreferrer">Apri documento originale</a></p>}</td><td>{d.data || 'Data mancante'}</td><td>{d.originale || 'Mancante'}</td><td>{d.incluso && i.centesimi !== null && d.centesimi !== null ? euro(d.centesimi) : 'Escluso / non sommato'}</td><td>{d.motivo || 'Incluso secondo il contratto indicatore'}<br />{d.scadenza}<br />{d.iva}</td></tr>)}</tbody>
          </table></div>}
        </details>
      </article>
    </VistaOperativa>}
  </section>
}

export default function RiepilogoDittaPanel({ client, onApri, rigaCostiGenerali }: { client: ClientLettura & ClientAttribuzioni } & NavigazioneEconomia) {
  const [collegaId, setCollegaId] = useState<string | null>(null)
  const [richiesta, setRichiesta] = useState(0)
  const [risultato, setRisultato] = useState<{ client: ClientLettura; richiesta: number; fonti: Fonti; fotografia: string } | null>(null)
  useEffect(() => {
    let obsoleto = false
    void leggiFontiDitta(client).then(fonti => { if (!obsoleto) setRisultato({ client, richiesta, fonti, fotografia: new Date().toLocaleString('it-IT') }) })
    return () => { obsoleto = true }
  }, [client, richiesta])
  useEffect(() => { const aggiorna = () => setRichiesta(r => r + 1); window.addEventListener('artecna-clienti-incassi-aggiornati', aggiorna); window.addEventListener(EVENTO_FATTURE_AGGIORNATE, aggiorna); return () => { window.removeEventListener('artecna-clienti-incassi-aggiornati', aggiorna); window.removeEventListener(EVENTO_FATTURE_AGGIORNATE, aggiorna) } }, [])
  const valido = risultato?.client === client && risultato.richiesta === richiesta
  return <>
    <button type="button" onClick={() => setRichiesta(r => r + 1)}>Aggiorna letture ditta</button>
    <RiepilogoDittaVista onApri={onApri} rigaCostiGenerali={rigaCostiGenerali} onCollega={setCollegaId} fonti={valido ? risultato.fonti : fontiInCaricamento()} fotografia={valido ? risultato.fotografia : ''} />
    {collegaId && <CollegaIncassoPanel key={collegaId} client={client} fatturaId={collegaId} cantiereId={valido ? cantiereDocumento(risultato.fonti.fatture_emesse.righe, collegaId) : undefined} onChiudi={() => setCollegaId(null)} />}
  </>
}
