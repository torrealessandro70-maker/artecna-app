'use client'

import { useRef, useState } from 'react'
import { filtraExcel, filtriVuoti, leggiExportExcel, totaleExcel, type ExportExcel, type FiltriExcel } from '../engines/contabilita-ditta/riepilogoExcel'
import styles from './RiepilogoExcelPanel.module.css'

const euro = (c: number) => (c / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
type Fonte = { nome: string; dati: ExportExcel }
export function TabellaExport({ titolo, fonte, filtri }: { titolo: string; fonte: Fonte | null; filtri: FiltriExcel }) {
  const [pagina, setPagina] = useState(0)
  const righe = filtraExcel(fonte?.dati.documenti ?? [], filtri)
  const pagine = Math.max(1, Math.ceil(righe.length / 25)); const corrente = Math.min(pagina, pagine - 1)
  return <article className={styles.fonte} aria-label={titolo}>
    <h4>{titolo}</h4>
    {!fonte ? <p>File non caricato: totale non disponibile.</p> : <>
      <p>{fonte.nome} · {fonte.dati.foglio} · {righe.length} documenti nel filtro · {euro(totaleExcel(righe))}</p>
      <div className={styles.scroll} role="region" aria-label={`Documenti ${titolo}`} tabIndex={0}><table>
        <caption>{titolo} — Riepilogo da export Bluenext</caption>
        <thead><tr>{['Data', 'Numero', 'Cliente / fornitore', 'Tipo documento', 'Importo lordo', 'Stato'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
        <tbody>{righe.slice(corrente * 25, (corrente + 1) * 25).map(r => <tr key={r.id}><td>{r.data.split('-').reverse().join('/')}</td><td>{r.numero}</td><td>{r.controparte}</td><td>{r.tipo}</td><td>{euro(r.centesimi)}</td><td>{r.stato}</td></tr>)}</tbody>
      </table></div>
      {!righe.length && <p>Nessun documento incluso nel filtro.</p>}
      <nav aria-label={`Pagine ${titolo}`} className={styles.pagine}><button type="button" disabled={corrente === 0} onClick={() => setPagina(corrente - 1)}>Precedente</button><span>Pagina {corrente + 1} di {pagine}</span><button type="button" disabled={corrente + 1 >= pagine} onClick={() => setPagina(corrente + 1)}>Successiva</button></nav>
      {!!fonte.dati.esclusioni.length && <details><summary>{fonte.dati.esclusioni.length} righe escluse o da verificare — totale limitato alle righe incluse</summary><ul>{fonte.dati.esclusioni.map(e => <li key={e.riga}>Riga {e.riga}: {e.motivo}</li>)}</ul></details>}
    </>}
  </article>
}
export default function RiepilogoExcelPanel() {
  const [fonti, setFonti] = useState<{ emesse: Fonte | null; ricevute: Fonte | null }>({ emesse: null, ricevute: null })
  const [filtri, setFiltri] = useState<FiltriExcel>(filtriVuoti)
  const [errori, setErrori] = useState({ emesse: '', ricevute: '' })
  const [caricamento, setCaricamento] = useState({ emesse: false, ricevute: false })
  const versioni = useRef({ emesse: 0, ricevute: 0 })
  async function carica(tipo: 'emesse' | 'ricevute', file: File | undefined) {
    if (!file) return
    const versione = ++versioni.current[tipo]
    setFonti(f => ({ ...f, [tipo]: null })); setErrori(e => ({ ...e, [tipo]: '' })); setCaricamento(c => ({ ...c, [tipo]: true }))
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error('Scegli un file .xlsx entro 10 MiB.')
      const dati = await leggiExportExcel(await file.arrayBuffer())
      if (versioni.current[tipo] === versione) setFonti(f => ({ ...f, [tipo]: { nome: file.name, dati } }))
    } catch {
      if (versioni.current[tipo] === versione) setErrori(e => ({ ...e, [tipo]: 'File non utilizzabile: verifica formato .xlsx, dimensione entro 10 MiB e intestazioni Data, Numero, Cliente/Fornitore, Tipo documento, Totale. Nessun dato del file precedente resta conteggiato.' }))
    } finally { if (versioni.current[tipo] === versione) setCaricamento(c => ({ ...c, [tipo]: false })) }
  }
  function svuota() {
    versioni.current.emesse++; versioni.current.ricevute++
    setFonti({ emesse: null, ricevute: null }); setErrori({ emesse: '', ricevute: '' }); setCaricamento({ emesse: false, ricevute: false })
  }
  const emesse = fonti.emesse ? filtraExcel(fonti.emesse.dati.documenti, filtri) : null
  const ricevute = fonti.ricevute ? filtraExcel(fonti.ricevute.dati.documenti, filtri) : null
  const periodoValido = !filtri.da || !filtri.a || filtri.da <= filtri.a
  const totaleE = emesse && periodoValido ? totaleExcel(emesse) : null; const totaleR = ricevute && periodoValido ? totaleExcel(ricevute) : null
  const parziale = !!fonti.emesse?.dati.esclusioni.length || !!fonti.ricevute?.dati.esclusioni.length
  const setFiltro = (key: keyof FiltriExcel, value: string) => setFiltri(f => ({ ...f, [key]: value }))
  return <section className={styles.panel} aria-label="Riepilogo fatture">
    <h3>Riepilogo fatture</h3>
    <p><strong>Riepilogo da export Bluenext</strong> · Consultazione separata dai saldi contabili ARTECNA OS. File elaborati in memoria nel browser: alla chiusura della pagina vengono rimossi. Nessuna registrazione nel database.</p>
    <p>Importi lordi; le note di credito riducono i totali. Nessuna IVA stimata e nessuna liquidazione fiscale.</p>
    <div className={styles.carica}>{(['emesse', 'ricevute'] as const).map(tipo => <div key={tipo}><label>Fatture {tipo} (.xlsx)<input type="file" accept=".xlsx" onChange={e => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void carica(tipo, f) }} /></label>{caricamento[tipo] && <p role="status">Lettura in corso…</p>}{errori[tipo] && <p role="alert">{errori[tipo]}</p>}</div>)}<button type="button" onClick={svuota}>Rimuovi entrambi i file</button></div>
    <fieldset className={styles.filtri}><legend>Filtri degli export — indipendenti dai conti ARTECNA</legend>
      <label>Dal<input type="date" value={filtri.da} onChange={e => setFiltro('da', e.target.value)} /></label>
      <label>Al<input type="date" value={filtri.a} onChange={e => setFiltro('a', e.target.value)} /></label>
      <label>Controparte<input type="search" value={filtri.controparte} onChange={e => setFiltro('controparte', e.target.value)} /></label>
      <label>Numero documento<input type="search" value={filtri.numero} onChange={e => setFiltro('numero', e.target.value)} /></label>
      <label>Ordinamento<select value={filtri.ordine} onChange={e => setFiltro('ordine', e.target.value)}><option value="data-desc">Data più recente</option><option value="data-asc">Data meno recente</option><option value="importo-desc">Importo decrescente</option><option value="controparte">Controparte A–Z</option></select></label>
      <button type="button" onClick={() => setFiltri(filtriVuoti)}>Azzera filtri</button>
    </fieldset>
    {!periodoValido && <p role="alert">Intervallo non valido: la data finale precede quella iniziale.</p>}
    <p>{parziale ? 'Copertura limitata: consulta le righe escluse prima di utilizzare i totali.' : 'I totali riguardano soltanto i documenti riconosciuti nei file caricati e nei filtri selezionati.'}</p>
    <dl className={styles.kpi} aria-live="polite">{[
      ['Numero fatture emesse', emesse && periodoValido ? String(emesse.length) : 'Non disponibile'],
      ['Totale lordo emesse', totaleE === null ? 'Non disponibile' : euro(totaleE)],
      ['Numero documenti ricevuti', ricevute && periodoValido ? String(ricevute.length) : 'Non disponibile'],
      ['Totale lordo ricevute', totaleR === null ? 'Non disponibile' : euro(totaleR)],
      ['Differenza lorda emesse − ricevute', totaleE === null || totaleR === null ? 'Non disponibile' : euro(totaleE - totaleR)],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <details><summary>Elenco documenti e righe escluse</summary>
      <TabellaExport key={'emesse' + JSON.stringify(filtri) + (fonti.emesse?.nome ?? '')} titolo="Fatture emesse" fonte={fonti.emesse} filtri={filtri} />
      <TabellaExport key={'ricevute' + JSON.stringify(filtri) + (fonti.ricevute?.nome ?? '')} titolo="Fatture ricevute" fonte={fonti.ricevute} filtri={filtri} />
    </details>
  </section>
}
