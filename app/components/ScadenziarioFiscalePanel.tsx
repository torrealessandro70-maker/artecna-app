'use client'

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { BadgeNotifiche } from './CentroNotifiche'
import VistaOperativa from './VistaOperativa'
import { applicaScadenzaLocale, bozzaDaScadenza, formattaImportoScadenza as euro, nuovaBozzaScadenza, riepilogaScadenze, STATI_SCADENZA, TIPI_SCADENZA, validaBozzaScadenza, type BozzaScadenza, type Scadenza, type TotaleScadenze } from '../engines/contabilita-ditta/scadenziario'
import { dataValida } from '../engines/contabilita-ditta/riepilogo'
import styles from './ScadenziarioFiscalePanel.module.css'
import ScadenzaPagamentoDialog from './ScadenzaPagamentoDialog'
import { AzioniDocumentoScadenza, RegistroDocumentiFiscali, type CollegamentoDocumentiFiscali } from './DocumentiFiscaliPanel'
import { evidenzaScadenza, filtraScadenze, FILTRI_SCADENZE, pagatoCentesimi, preparaPagamentoScadenza, residuoScadenza, totaleScaduto, type BozzaPagamentoScadenza, type FiltroScadenze } from '../engines/contabilita-ditta/scadenziarioOperativo'

export type CollegamentoScadenziario = {
  documenti?: CollegamentoDocumentiFiscali
  righe: Scadenza[]; archiviate?: Scadenza[]; pronta: boolean; occupata: boolean; errore: string
  onRileggi: () => void
  onSalva: (riga: Scadenza, modificaId: string | null, opzioni?: { revisioneAttesa?: string; chiusuraConfermata: boolean }) => Promise<void>
  onPagamento?: (id: string, bozza: BozzaPagamentoScadenza, revisioneAttesa?: string) => Promise<void>
  onArchivia: (id: string, motivo: string, revisioneAttesa?: string) => Promise<void>
}

const oggiLocale = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function Totale({ valore }: { valore: TotaleScadenze }) {
  return <><strong>{valore.centesimi === null ? 'Non determinabile' : valore.importiMancanti && !valore.note ? 'Da verificare' : euro(valore.centesimi)}</strong>
    <small>{valore.importiMancanti ? `Parziale: ${valore.importiMancanti} importi mancanti; nessuno zero sostitutivo.` : 'Solo importi manuali inclusi.'}{valore.riepilogative > 0 && ` ${valore.riepilogative} voci riepilogative escluse.`}</small></>
}

/** La bozza resta soltanto nello stato del componente: nessun archivio o writer. */
export default function ScadenziarioFiscalePanel({ persistenza, apertoEsterno, onChiudiEsterno, scadenzaDaNotifica, badgeScadenziario = 0 }: { persistenza?: CollegamentoScadenziario; apertoEsterno?: boolean; onChiudiEsterno?: () => void; scadenzaDaNotifica?: string; badgeScadenziario?: number } = {}) {
  const [righeLocali, setRighe] = useState<Scadenza[]>([])
  const righe = persistenza ? persistenza.righe : righeLocali
  const documenti = persistenza?.documenti
  const [aperto, setAperto] = useState(false)
  const [oggi, setOggi] = useState(oggiLocale)
  const [bozza, setBozza] = useState<BozzaScadenza | null>(null)
  const [modificaId, setModificaId] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState('')
  const [errore, setErrore] = useState('')
  const ritornoRef = useRef<HTMLButtonElement | null>(null)
  const progressivoRef = useRef(0)
  const richiestaRef = useRef<string | null>(null)
  const invioRef = useRef(false)
  const [archiviaId, setArchiviaId] = useState<string | null>(null)
  const [motivoArchivio, setMotivoArchivio] = useState('')
  const [archiviaRevisione, setArchiviaRevisione] = useState<string | undefined>()
  const [revisioneModifica, setRevisioneModifica] = useState<string | undefined>()
  const [chiusuraConfermata, setChiusuraConfermata] = useState(false)
  const [filtro, setFiltro] = useState<FiltroScadenze>('Aperte')
  const [pagamento, setPagamento] = useState<Scadenza | null>(null)
  const prefisso = useId()
  const riepilogo = useMemo(() => riepilogaScadenze(righe, oggi), [righe, oggi])
  const filtroVisibile = scadenzaDaNotifica ? 'Tutte' : filtro
  const elenco = filtraScadenze([...righe, ...(persistenza?.archiviate || [])], filtroVisibile)
  const rigaNotifica = useRef<HTMLTableRowElement>(null)
  const destinazionePresente = elenco.some(r => r.id === scadenzaDaNotifica && !r.archiviataAt)
  useEffect(() => {
    if (destinazionePresente) rigaNotifica.current?.focus()
  }, [scadenzaDaNotifica, destinazionePresente])
  const scaduto = totaleScaduto(righe, oggi)
  const personalizzato = bozza && !(TIPI_SCADENZA as readonly string[]).includes(bozza.tipo)
  function imposta<K extends keyof BozzaScadenza>(campo: K, valore: BozzaScadenza[K]) { setBozza(b => b ? { ...b, [campo]: valore } : b) }
  function registra(event: FormEvent) {
    event.preventDefault()
    if (!bozza || invioRef.current || (persistenza && (!persistenza.pronta || persistenza.occupata))) return
    try {
      if (bozza.stato === 'Pagato' && !chiusuraConfermata) throw Error('Confermare esplicitamente che l’obbligo è chiuso.')
      if (persistenza && !modificaId && !richiestaRef.current) richiestaRef.current = crypto.randomUUID()
      const id = modificaId || (persistenza ? richiestaRef.current! : `locale-${progressivoRef.current + 1}`)
      const riga = validaBozzaScadenza(bozza, id)
      if (persistenza) {
        invioRef.current = true
        void persistenza.onSalva(riga, modificaId, { revisioneAttesa: revisioneModifica, chiusuraConfermata }).then(() => {
          setBozza(null); setModificaId(null); setErrore(''); richiestaRef.current = null
          setMessaggio('Scadenza salvata nell’archivio. Nessun pagamento generato.')
        }, error => setErrore(error instanceof Error ? error.message : 'Scrittura non confermata. Rileggere.')).finally(() => { invioRef.current = false })
        return
      }
      const aggiornate = applicaScadenzaLocale(righe, { ...righe.find(r => r.id === modificaId), ...riga }, modificaId)
      if (!modificaId) progressivoRef.current++
      setRighe(aggiornate); setBozza(null); setModificaId(null); setErrore('')
      setMessaggio('Bozza aggiornata solo in memoria. Nessun pagamento registrato e nessun dato sincronizzato.')
    } catch (error) { setErrore(error instanceof Error ? error.message : 'Bozza non valida.') }
  }
  const kpi = <dl className={styles.kpi}>
    <div><dt>Prossima scadenza aperta</dt><dd>{riepilogo.prossima ? `${riepilogo.prossima.dataScadenza} · ${riepilogo.prossima.tipo} · ${euro(riepilogo.prossima.importoCentesimi)}` : 'Nessuna data futura inserita'}</dd></div>
    <div><dt>Previsto entro 30 giorni</dt><dd><Totale valore={riepilogo.entro30} /></dd></div>
    <div><dt>Previsto entro 60 giorni</dt><dd><Totale valore={riepilogo.entro60} /></dd></div>
    <div><dt>Previsto entro 90 giorni</dt><dd><Totale valore={riepilogo.entro90} /></dd></div>
    <div><dt>Scadenze aperte</dt><dd>{riepilogo.aperte} · di cui {riepilogo.scadute} oltre data</dd></div>
    <div><dt>Totale scaduto</dt><dd>{scaduto === null ? 'Non determinabile' : euro(scaduto)}<small>Residui noti inclusi. Importi previsti o pagati mancanti non sono sostituiti con zero.</small></dd></div>
  </dl>
  return <section className={styles.sezione} aria-label="Scadenziario fiscale e contributivo">
    <h3>Scadenziario fiscale e contributivo <BadgeNotifiche count={badgeScadenziario} /></h3>
    {persistenza ? <p><strong>Archivio scadenze manuali.</strong> Nessun calcolo fiscale o pagamento automatico. Le modifiche non inviate restano bozze.</p> : <p><strong>Bozza locale non salvata.</strong> Le voci si perdono ricaricando la pagina o lasciando Economia generale. Nessun dato inviato al server.</p>}
    {persistenza && <><p role="status">{persistenza.errore || (persistenza.pronta ? 'Archivio caricato.' : 'Archivio non disponibile / in caricamento: nessuno zero sostitutivo.')}</p><button type="button" disabled={persistenza.occupata} onClick={persistenza.onRileggi}>Rileggi archivio</button></>}
    {(!persistenza || persistenza.pronta) && kpi}
    <button type="button" ref={ritornoRef} onClick={() => { setOggi(oggiLocale()); setAperto(true) }}>Apri scadenziario locale</button>
    {(aperto || apertoEsterno) && <VistaOperativa titolo="Scadenziario fiscale e contributivo" etichettaRitorno="← Torna a Economia generale" ritornoFocusRef={ritornoRef} occupata={persistenza?.occupata} onChiudi={() => { setAperto(false); onChiudiEsterno?.() }}>
      <div className={styles.sezione}>
        {persistenza ? <><p>Scadenze persistenti. Salva esplicitamente; nessun salvataggio implicito o fallback in memoria.</p><p role="status">{persistenza.errore || (persistenza.pronta ? 'Archivio caricato.' : 'Archivio non disponibile / in caricamento.')}</p><button type="button" disabled={persistenza.occupata} onClick={persistenza.onRileggi}>Rileggi archivio</button></> : <p><strong>Solo bozze in memoria.</strong> Nessun archivio fiscale/F24 collegato. Chiudere questa vista conserva le bozze; ricaricare o lasciare Economia generale le perde.</p>}
        <p>Importi e date inseriti manualmente da documenti verificati. Nessun calcolo di imposte, contributi, compensazioni o proroghe; il prospetto IVA gestionale non alimenta queste scadenze.</p>
        <label>Data di consultazione <input type="date" value={oggi} onChange={e => { if (dataValida(e.target.value)) setOggi(e.target.value) }} /></label>
        {(!persistenza || persistenza.pronta) && kpi}
        <p>Finestre cumulative dalla data di consultazione, estremi inclusi: 60/90 giorni comprendono anche i primi 30. Le voci Pagato sono escluse dai totali aperti. I KPI 30/60/90 restano importi previsti, non saldi residui; le annotazioni pagate sono nei dettagli.</p>
        {riepilogo.scadute > 0 && <p role="status">Oltre data: {riepilogo.scadute} scadenze aperte, escluse dalle finestre future. Importi noti: <Totale valore={riepilogo.arretrati} /></p>}
        <p role="status">{messaggio}</p>
        {documenti && <RegistroDocumentiFiscali documenti={documenti} />}
        <label className={styles.filtri}>Mostra scadenze <select aria-label="Filtro scadenze" value={filtroVisibile} disabled={Boolean(scadenzaDaNotifica)} onChange={e => setFiltro(e.target.value as FiltroScadenze)}>{FILTRI_SCADENZE.map(f => <option key={f}>{f}</option>)}</select></label>
        {!bozza && <button type="button" disabled={!!persistenza && (!persistenza.pronta || persistenza.occupata)} onClick={() => { setBozza(nuovaBozzaScadenza()); setModificaId(null); setRevisioneModifica(undefined); setChiusuraConfermata(false); setErrore(''); setMessaggio(''); richiestaRef.current = null }}>{persistenza ? 'Nuova scadenza' : 'Nuova scadenza locale'}</button>}
        {bozza && <form className={styles.form} onSubmit={registra}>
          <fieldset disabled={persistenza?.occupata}><legend>{persistenza ? (modificaId ? 'Modifica scadenza' : 'Nuova scadenza') : modificaId ? 'Modifica bozza locale' : 'Nuova bozza locale'}</legend>
            <label htmlFor={`${prefisso}-tipo`}>Tipo</label><select id={`${prefisso}-tipo`} value={personalizzato ? 'Altro' : bozza.tipo} onChange={e => { const tipo = e.target.value; setBozza(b => b ? { ...b, tipo: tipo === 'Altro' ? '' : tipo, includiNeiTotali: tipo !== 'F24' } : b) }}>
              {TIPI_SCADENZA.map(t => <option key={t}>{t}</option>)}<option>Altro</option>
            </select>
            {personalizzato && <><label htmlFor={`${prefisso}-altro`}>Altro tributo / contributo</label><input id={`${prefisso}-altro`} value={bozza.tipo} maxLength={80} required onChange={e => imposta('tipo', e.target.value)} /></>}
            <label htmlFor={`${prefisso}-periodo`}>Periodo di riferimento</label><input id={`${prefisso}-periodo`} value={bozza.periodo} maxLength={120} placeholder="Es. T4 2026 / rata 1" required onChange={e => imposta('periodo', e.target.value)} />
            <label htmlFor={`${prefisso}-data`}>Data scadenza</label><input id={`${prefisso}-data`} type="date" value={bozza.dataScadenza} required onChange={e => imposta('dataScadenza', e.target.value)} />
            <label htmlFor={`${prefisso}-importo`}>Importo previsto (€) — vuoto se da verificare</label><input id={`${prefisso}-importo`} inputMode="decimal" value={bozza.importo} maxLength={24} onChange={e => imposta('importo', e.target.value)} />
            <label htmlFor={`${prefisso}-stato`}>Stato</label><select id={`${prefisso}-stato`} value={bozza.stato} onChange={e => imposta('stato', e.target.value as Scadenza['stato'])}>{STATI_SCADENZA.map(s => <option key={s}>{s}</option>)}</select>
            {bozza.stato === 'Pagato' && <label className={styles.inclusione}><input type="checkbox" checked={chiusuraConfermata} onChange={e => setChiusuraConfermata(e.target.checked)} />Confermo esplicitamente che l’obbligo è chiuso</label>}
            <label htmlFor={`${prefisso}-nota`}>Nota</label><textarea id={`${prefisso}-nota`} value={bozza.nota} maxLength={2000} onChange={e => imposta('nota', e.target.value)} />
            <label htmlFor={`${prefisso}-riferimento`}>Riferimento / documento (solo testo)</label><input id={`${prefisso}-riferimento`} value={bozza.riferimento} maxLength={300} onChange={e => imposta('riferimento', e.target.value)} />
            <label className={styles.inclusione}><input type="checkbox" checked={bozza.includiNeiTotali} onChange={e => imposta('includiNeiTotali', e.target.checked)} />Includi nei totali previsti — non duplicare tributi già inseriti</label>
            {bozza.tipo === 'F24' && !bozza.includiNeiTotali && <p><strong>Escluso dai totali per evitare possibili duplicazioni</strong></p>}
            <p>F24 escluso inizialmente dai totali: può riepilogare scadenze già elencate. Includilo soltanto se non duplica altre voci. Pagato è uno stato manuale della bozza, non una quietanza né un pagamento.</p>
            {errore && <p role="alert">{errore}</p>}
            <div className={styles.azioni}><button type="submit" disabled={!!persistenza && !persistenza.pronta}>{persistenza ? (modificaId ? 'Aggiorna scadenza' : 'Salva scadenza') : modificaId ? 'Aggiorna bozza locale' : 'Aggiungi bozza locale'}</button><button type="button" onClick={() => { setBozza(null); setModificaId(null); setErrore('') }}>Annulla</button></div>
          </fieldset>
        </form>}
        {persistenza && archiviaId && <form onSubmit={e => {
          e.preventDefault(); if (invioRef.current || !persistenza.pronta || persistenza.occupata) return
          invioRef.current = true
          void persistenza.onArchivia(archiviaId, motivoArchivio, archiviaRevisione).then(() => { setArchiviaId(null); setMotivoArchivio(''); setErrore(''); setMessaggio('Scadenza archiviata, senza cancellazione o pagamento.') }, error => setErrore(error instanceof Error ? error.message : 'Archiviazione non confermata.')).finally(() => { invioRef.current = false })
        }}><fieldset disabled={!persistenza.pronta || persistenza.occupata}><legend>Archiviazione logica</legend><label>Motivo archiviazione <input required maxLength={2000} value={motivoArchivio} onChange={e => setMotivoArchivio(e.target.value)} /></label><button type="submit">Conferma archiviazione</button><button type="button" onClick={() => setArchiviaId(null)}>Annulla archiviazione</button>{errore && <p role="alert">{errore}</p>}</fieldset></form>}
        {scadenzaDaNotifica && persistenza?.pronta && !destinazionePresente && <p role="status">Destinazione non disponibile.</p>}
        {persistenza && !persistenza.pronta ? <p>Elenco non disponibile: nessun fallback alle bozze locali.</p> : !elenco.length ? <p>{!righe.length && !persistenza?.archiviate?.length ? 'Nessuna scadenza inserita. Questo non certifica l’assenza di obblighi fiscali o contributivi.' : 'Nessuna scadenza per il filtro selezionato.'}</p> : <div className={styles.scorrimento} role="region" aria-label="Elenco scadenze locali" tabIndex={0}>
          <table><caption>Scadenze inserite manualmente, in ordine cronologico</caption><thead><tr>{['Tipo', 'Scadenza', 'Previsto', 'Stato', 'Azioni'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead>
            <tbody>{elenco.map(r => <tr key={r.id} ref={destinazionePresente && r.id === scadenzaDaNotifica ? rigaNotifica : undefined}
              tabIndex={r.id === scadenzaDaNotifica ? -1 : undefined} aria-current={destinazionePresente && r.id === scadenzaDaNotifica ? 'true' : undefined}>
              <th scope="row">{r.tipo}{destinazionePresente && r.id === scadenzaDaNotifica && <small>Da notifica</small>}</th><td>{r.dataScadenza}<small>{evidenzaScadenza(r, oggi)}</small></td><td>{euro(r.importoCentesimi)}{!r.includiNeiTotali && <small>{r.tipo === 'F24' ? 'Escluso dai totali per evitare possibili duplicazioni' : 'Riepilogativa: esclusa dai totali'}</small>}</td><td>{r.stato}{r.documentoId && <small>{documenti?.righe.find(d => d.id === r.documentoId)?.tipo_documento === 'F24' ? 'F24 collegato' : 'Documento collegato'}</small>}{r.archiviataAt && <small>Archiviata — stato conservato</small>}</td><td>
              {!r.archiviataAt && <div className={styles.azioni}>
                {r.stato !== 'Pagato' && <button type="button" disabled={!!bozza || !!archiviaId || !!persistenza?.occupata} aria-label={`Segna pagato ${r.tipo} · ${r.dataScadenza}`} onClick={() => setPagamento(r)}>Segna pagato</button>}
                <button type="button" disabled={!!bozza || !!archiviaId || !!persistenza?.occupata} onClick={() => { setBozza(bozzaDaScadenza(r)); setModificaId(r.id); setRevisioneModifica(r.revisione); setChiusuraConfermata(false); setErrore(''); setMessaggio('') }}>{persistenza ? 'Modifica scadenza' : 'Modifica bozza'} {r.tipo} · {r.dataScadenza}</button>
                {persistenza && <button type="button" disabled={!!bozza || !!archiviaId || persistenza.occupata || !persistenza.pronta} onClick={() => { setArchiviaId(r.id); setArchiviaRevisione(r.revisione); setMotivoArchivio(''); setErrore('') }}>Archivia scadenza {r.tipo} · {r.dataScadenza}</button>}
              </div>}
              <details><summary>Dettagli {r.tipo} · {r.dataScadenza}</summary><p>Periodo: {r.periodo}</p><p>Previsto: {euro(r.importoCentesimi)} | Pagato: {euro(pagatoCentesimi(r))} | Residuo: {residuoScadenza(r) === null ? 'Non determinabile' : euro(residuoScadenza(r))}</p><p>Data pagamento: {r.dataPagamento || 'Non indicata'}</p><p>Nota: {r.nota || 'Nessuna'}</p><p>Riferimento: {r.riferimento || 'Non indicato'}</p>{r.revisione && <p>Revisione: {r.revisione} · Ultima modifica: {r.updatedAt}</p>}{r.archiviataAt && <p>Archiviata: {r.archiviataAt} · Motivo: {r.motivoArchiviazione}</p>}{documenti && <AzioniDocumentoScadenza riga={r} documenti={documenti} disabilitata={Boolean(bozza || archiviaId || persistenza?.occupata || !persistenza?.pronta)} />}</details>
            </td></tr>)}</tbody>
          </table>
        </div>}
        {pagamento && <ScadenzaPagamentoDialog riga={pagamento} oggi={oggiLocale()} pronta={!persistenza || persistenza.pronta} occupata={!!persistenza?.occupata} onChiudi={() => setPagamento(null)} onSalva={async b => {
          if (persistenza) {
            if (!persistenza.onPagamento) throw Error('Annotazione non disponibile: nessun fallback locale.')
            await persistenza.onPagamento(pagamento.id, b, pagamento.revisione)
          } else {
            const p = preparaPagamentoScadenza(pagamento, b)
            setRighe(righe.map(r => r.id === pagamento.id ? { ...p.scadenza, importoPagato: p.importoPagato, dataPagamento: p.dataPagamento } : r))
          }
          setMessaggio('Annotazione salvata. Nessun pagamento o movimento economico generato.')
        }} />}
      </div>
    </VistaOperativa>}
  </section>
}
