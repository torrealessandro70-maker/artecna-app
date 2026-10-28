'use client'

import { useEffect, useMemo, useState } from 'react'
import CollegaIncassoPanel from './CollegaIncassoPanel'
import type { ClientAttribuzioni } from '../engines/contabilita-ditta/attribuzioni'
import { leggiFontiDitta, type ClientLettura } from '../engines/contabilita-ditta/lettura'
import { costruisciRiepilogo, fontiInCaricamento, periodoPreset, type Fonti, type Periodo } from '../engines/contabilita-ditta/riepilogo'

const euro = (c: number) => (c / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
function oggiLocale() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const colori = { Disponibile: '#166534', Limitato: '#92400e', 'Non calcolabile': '#9f1239' }

/** Vista pura rispetto al DB: periodo e dettagli cambiano soltanto stato React. */
export function RiepilogoDittaVista({ fonti, fotografia, onCollega }: { fonti: Fonti; fotografia: string; onCollega?: (id: string) => void }) {
  const [tipo, setTipo] = useState<'mese' | 'trimestre' | 'anno' | 'personalizzato'>('trimestre')
  const [riferimento, setRiferimento] = useState(oggiLocale)
  const [manuale, setManuale] = useState<Periodo>(() => periodoPreset('trimestre', oggiLocale()))
  const periodo = useMemo(() => tipo === 'personalizzato' ? manuale : periodoPreset(tipo, riferimento), [tipo, manuale, riferimento])
  const indicatori = useMemo(() => costruisciRiepilogo(fonti, periodo), [fonti, periodo])
  return <section aria-label="Riepilogo ditta">
    <h3>Riepilogo ditta</h3>
    <p>Contabilità ordinaria · IVA trimestrale. Il trimestre è un filtro di consultazione, non una liquidazione IVA.</p>
    <p>Disponibile significa calcolabile sulle fonti caricate, non che tutte le fatture esterne siano state importate. Nessun utile definitivo, reddito imponibile, IVA da versare o saldo banca.</p>
    <fieldset style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 12 }}>
      <legend>Periodo di consultazione</legend>
      <label>Periodo <select value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}><option value="mese">Mese</option><option value="trimestre">Trimestre</option><option value="anno">Anno</option><option value="personalizzato">Intervallo personalizzato</option></select></label>
      {tipo !== 'personalizzato' ? <label>Data nel periodo <input type="date" value={riferimento} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setRiferimento(e.target.value) }} /></label> : <>
        <label>Dal <input type="date" value={manuale.da} onChange={e => setManuale(p => ({ ...p, da: e.target.value }))} /></label>
        <label>Al <input type="date" value={manuale.a} onChange={e => setManuale(p => ({ ...p, a: e.target.value }))} /></label>
      </>}
    </fieldset>
    <p aria-live="polite">Documenti e movimenti: {periodo.da || 'data mancante'} → {periodo.a || 'data mancante'}. Residui richiesti al {periodo.a || 'data mancante'}. Fotografia delle letture: {fotografia || 'in caricamento'}.</p>
    <p>Acconti, incassi non fatturati e cumulativi sulle fatture restano separati: possono rappresentare lo stesso denaro. Nessun consolidamento arbitrario.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
      {indicatori.map(i => <article key={i.id} aria-label={i.nome} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 14, minWidth: 0 }}>
        <h4 style={{ margin: '0 0 8px' }}>{i.nome}</h4>
        <strong style={{ color: colori[i.stato] }}>{i.stato}</strong>
        <p style={{ fontSize: 24, fontWeight: 700 }}>{i.centesimi === null ? 'Non determinabile' : euro(i.centesimi)}</p>
        <p>{i.ambito === 'progressivo' ? 'Progressivo complessivo dichiarato oggi — non filtrato per periodo' : i.ambito === 'riferimento' ? 'Alla data di riferimento — storico richiesto' : 'Documenti / movimenti nel periodo'}</p>
        <p>{i.significato}</p><p>{i.limite}</p>
        {!!i.avvisi.length && <ul aria-label={`Segnalazioni ${i.nome}`}>{i.avvisi.map((a, n) => <li key={n}>{a}</li>)}</ul>}
        <details><summary>Contratto indicatore</summary>
          <dl><dt>Fonte autorevole</dt><dd>{i.fonte || 'Collegamenti verificati non disponibili'}</dd><dt>Campo importo</dt><dd>{i.importo}</dd><dt>Campo data</dt><dd>{i.data}</dd><dt>Formula</dt><dd>{i.formula}</dd><dt>Esclusioni</dt><dd>{i.esclusioni}</dd></dl>
        </details>
        <details><summary>Dettaglio delle fonti ({i.dettagli.length})</summary>
          {!i.dettagli.length ? <p>Nessuna riga disponibile per questo prospetto. Un errore o un caricamento non equivale a un archivio vuoto.</p> : <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <caption>Righe incluse ed escluse — {i.nome}</caption>
            <thead><tr>{['Fonte / ID', 'Documento o movimento', 'Data dichiarata', 'Importo originale', 'Contributo al totale', 'Qualità / scadenza / IVA'].map(t => <th key={t} scope="col" style={{ textAlign: 'left', padding: 6 }}>{t}</th>)}</tr></thead>
            <tbody>{i.dettagli.map((d, n) => <tr key={`${d.id}:${n}`}><td style={{ padding: 6, overflowWrap: 'anywhere' }}>{d.fonte}<br />{d.id}{d.fonte === 'fatture_emesse' && onCollega && <p><button type="button" onClick={() => onCollega(d.id)}>Collega incasso</button></p>}</td><td>{d.documento}{d.url && <p><a href={d.url} target="_blank" rel="noopener noreferrer">Apri documento originale</a></p>}</td><td>{d.data || 'Data mancante'}</td><td>{d.originale || 'Mancante'}</td><td>{d.incluso && i.centesimi !== null && d.centesimi !== null ? euro(d.centesimi) : 'Escluso / non sommato'}</td><td>{d.motivo || 'Incluso secondo il contratto indicatore'}<br />{d.scadenza}<br />{d.iva}</td></tr>)}</tbody>
          </table></div>}
        </details>
      </article>)}
    </div>
    <p>Materiali, assegnazioni, SAL e costi delle presenze non vengono sommati ai documenti o ai pagamenti di questo riepilogo.</p>
  </section>
}

export default function RiepilogoDittaPanel({ client }: { client: ClientLettura & ClientAttribuzioni }) {
  const [collegaId, setCollegaId] = useState<string | null>(null)
  const [richiesta, setRichiesta] = useState(0)
  const [risultato, setRisultato] = useState<{ client: ClientLettura; richiesta: number; fonti: Fonti; fotografia: string } | null>(null)
  useEffect(() => {
    let obsoleto = false
    void leggiFontiDitta(client).then(fonti => { if (!obsoleto) setRisultato({ client, richiesta, fonti, fotografia: new Date().toLocaleString('it-IT') }) })
    return () => { obsoleto = true }
  }, [client, richiesta])
  useEffect(() => { const aggiorna = () => setRichiesta(r => r + 1); window.addEventListener('artecna-clienti-incassi-aggiornati', aggiorna); return () => window.removeEventListener('artecna-clienti-incassi-aggiornati', aggiorna) }, [])
  const valido = risultato?.client === client && risultato.richiesta === richiesta
  return <>
    <button type="button" onClick={() => setRichiesta(r => r + 1)}>Aggiorna letture ditta</button>
    <RiepilogoDittaVista onCollega={setCollegaId} fonti={valido ? risultato.fonti : fontiInCaricamento()} fotografia={valido ? risultato.fotografia : ''} />
    {collegaId && <CollegaIncassoPanel key={collegaId} client={client} fatturaId={collegaId} onChiudi={() => setCollegaId(null)} />}
  </>
}
