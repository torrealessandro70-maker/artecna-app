'use client'

import { useRef, useState, type FormEvent } from 'react'
import type { Scadenza } from '../engines/contabilita-ditta/scadenziario'
import type { ArchivioDocumentiFiscali, DocumentoFiscale, MetadatoFiscale } from '../engines/contabilita-ditta/documentiFiscali'
import styles from './ScadenziarioFiscalePanel.module.css'

export type CollegamentoDocumentiFiscali = {
  archivio: ArchivioDocumentiFiscali
  righe: DocumentoFiscale[]
  errore: string
  rileggi: () => Promise<void>
  collega: (riga: Scadenza, documentoId: string | null) => Promise<void>
}

async function apriPdf(archivio: ArchivioDocumentiFiscali, documento: DocumentoFiscale) {
  // Aprire durante il gesto utente evita il blocco popup dopo la richiesta di firma.
  const scheda = window.open('about:blank', '_blank')
  if (!scheda) throw Error('Consentire l’apertura di una nuova scheda.')
  scheda.opener = null
  try { scheda.location.replace(await archivio.urlFirmato(documento)) }
  catch (errore) { scheda.close(); throw errore }
}

const nuovoMetadato: MetadatoFiscale = { tipo: 'F24', nome: '', data: '' }
const etichetta = (d: DocumentoFiscale) => [d.tipo_documento, d.nome_file, d.data_documento].filter(Boolean).join(' · ')

export function RegistroDocumentiFiscali({ documenti }: { documenti: CollegamentoDocumentiFiscali }) {
  const [metadato, setMetadato] = useState(nuovoMetadato)
  const [modifica, setModifica] = useState<DocumentoFiscale | null>(null)
  const [prenotazione, setPrenotazione] = useState<DocumentoFiscale | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [errore, setErrore] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [occupata, setOccupata] = useState(false)
  const operazione = useRef(false)
  const identitaRichiesta = useRef<string | null>(null)
  const [archivia, setArchivia] = useState<DocumentoFiscale | null>(null)
  const { archivio } = documenti

  async function esegui(azione: () => Promise<void>) {
    if (operazione.current) return
    operazione.current = true
    setOccupata(true)
    setErrore('')
    setMessaggio('')
    try { await azione() }
    catch (e) { setErrore(e instanceof Error ? e.message : 'Operazione non confermata. Rileggere il registro.') }
    finally { operazione.current = false; setOccupata(false) }
  }

  function salva(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void esegui(async () => {
      if (modifica) {
        await archivio.aggiorna(modifica.id, modifica.revisione, metadato)
        setModifica(null)
        setMetadato(nuovoMetadato)
        setMessaggio('Metadati aggiornati.')
      } else {
        if (!file) throw Error('Selezionare il PDF da prenotare.')
        if (!identitaRichiesta.current) identitaRichiesta.current = crypto.randomUUID()
        setPrenotazione(await archivio.crea(metadato, file, identitaRichiesta.current))
        identitaRichiesta.current = null
        setMessaggio('Metadati registrati. Ora carica il PDF.')
      }
      await documenti.rileggi()
    })
  }

  function confermaPdf(d: DocumentoFiscale, caricaFile: boolean) {
    void esegui(async () => {
      if (caricaFile) {
        if (!file) throw Error('Selezionare il PDF della prenotazione.')
        await archivio.carica(d, file)
      }
      await archivio.conferma(d.id)
      setPrenotazione(null)
      setMetadato(nuovoMetadato)
      setFile(null)
      setMessaggio('PDF disponibile per il collegamento.')
      await documenti.rileggi()
    })
  }

  return <details>
    <summary>Documenti fiscali</summary>
    <p>Registra i metadati, carica il PDF e poi collegalo dalla scadenza.</p>
    {documenti.errore && <p role="alert">{documenti.errore}</p>}
    {errore && <p role="alert">{errore}</p>}
    {messaggio && <p role="status">{messaggio}</p>}
    <button type="button" disabled={occupata} onClick={() => void esegui(documenti.rileggi)}>Rileggi documenti</button>
    <form onSubmit={salva} className={styles.form}>
      <fieldset disabled={occupata || Boolean(prenotazione)}>
        <legend>{modifica ? 'Modifica metadati' : 'Registra documento'}</legend>
        <label>Tipo <select value={metadato.tipo} onChange={e => setMetadato({ ...metadato, tipo: e.target.value as MetadatoFiscale['tipo'] })}><option>F24</option><option>Altro</option></select></label>
        <label>Nome file <input value={metadato.nome} required maxLength={255} onChange={e => setMetadato({ ...metadato, nome: e.target.value })} /></label>
        <label>Data documento <input type="date" value={metadato.data} onChange={e => setMetadato({ ...metadato, data: e.target.value })} /></label>
        {!modifica && <label>PDF <input type="file" accept="application/pdf,.pdf" onChange={e => {
          const scelto = e.target.files?.[0] ?? null
          setFile(scelto)
          if (scelto && !metadato.nome) setMetadato({ ...metadato, nome: scelto.name })
        }} /></label>}
        <button type="submit" disabled={!modifica && !file}>{modifica ? 'Salva metadati' : 'Crea metadato'}</button>
        {modifica && <button type="button" onClick={() => { setModifica(null); setMetadato(nuovoMetadato) }}>Annulla modifica</button>}
      </fieldset>
    </form>
    {prenotazione && <fieldset disabled={occupata}>
      <legend>Carica PDF per {prenotazione.nome_file}</legend>
      <label>PDF della prenotazione <input type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <button type="button" disabled={!file} onClick={() => confermaPdf(prenotazione, true)}>Carica documento</button>
      <button type="button" onClick={() => confermaPdf(prenotazione, false)}>Verifica PDF già caricato</button>
      <button type="button" onClick={() => { setPrenotazione(null); setFile(null); setMetadato(nuovoMetadato) }}>Chiudi prenotazione</button>
    </fieldset>}
    {archivia && <p>
      Archiviare {archivia.nome_file}? Il PDF e i collegamenti esistenti restano consultabili.
      <button type="button" disabled={occupata} onClick={() => void esegui(async () => {
        await archivio.archivia(archivia.id, archivia.revisione)
        if (prenotazione?.id === archivia.id) { setPrenotazione(null); setFile(null) }
        if (modifica?.id === archivia.id) { setModifica(null); setMetadato(nuovoMetadato) }
        setArchivia(null)
        await documenti.rileggi()
      })}>Conferma archiviazione documento</button>
      <button type="button" disabled={occupata} onClick={() => setArchivia(null)}>Annulla</button>
    </p>}
    <ul>{documenti.righe.map(d => <li key={d.id}>
      {etichetta(d)}{d.archiviata_at ? ' · Archiviato' : d.caricato_at ? '' : ' · In attesa di PDF'}
      {d.caricato_at && <button type="button" disabled={occupata} onClick={() => void esegui(() => apriPdf(archivio, d))}>Apri documento</button>}
      {!d.archiviata_at && <>
        {!d.caricato_at && <button type="button" disabled={occupata || Boolean(modifica)} onClick={() => { setFile(null); setPrenotazione(d) }}>Riprendi upload</button>}
        <button type="button" disabled={occupata || Boolean(prenotazione)} onClick={() => {
          setModifica(d)
          setMetadato({ tipo: d.tipo_documento, nome: d.nome_file, data: d.data_documento ?? '' })
        }}>Modifica metadati</button>
        <button type="button" disabled={occupata} onClick={() => setArchivia(d)}>Archivia documento</button>
      </>}
    </li>)}</ul>
  </details>
}

export function AzioniDocumentoScadenza({ riga, documenti, disabilitata }: {
  riga: Scadenza; documenti: CollegamentoDocumentiFiscali; disabilitata: boolean
}) {
  const [selezione, setSelezione] = useState('')
  const [scelta, setScelta] = useState(false)
  const [errore, setErrore] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const operazione = useRef(false)
  const attesa = useRef<Scadenza | null>(null)
  const collegato = documenti.righe.find(d => d.id === riga.documentoId)
  const collegabili = documenti.righe.filter(d => d.caricato_at && !d.archiviata_at && d.id !== riga.documentoId)
  async function esegui(azione: () => Promise<void>) {
    if (operazione.current) return
    operazione.current = true
    setInCorso(true)
    setErrore('')
    try { await azione() }
    catch (e) { setErrore(e instanceof Error ? e.message : 'Operazione non confermata.') }
    finally { operazione.current = false; setInCorso(false) }
  }

  return <div>
    {riga.documentoId && <p>Documento collegato: {collegato ? etichetta(collegato) : 'metadati da rileggere'}{collegato?.archiviata_at && ' · Archiviato'}</p>}
    {collegato?.caricato_at && <button type="button" disabled={inCorso} onClick={() => void esegui(() => apriPdf(documenti.archivio, collegato))}>Apri documento</button>}
    {!riga.archiviataAt && riga.revisione && <>
      <button type="button" disabled={disabilitata || inCorso || !collegabili.length} onClick={() => {
        attesa.current = riga
        setSelezione('')
        setScelta(true)
      }}>Collega documento</button>
      {riga.documentoId && <button type="button" disabled={disabilitata || inCorso} onClick={() => void esegui(async () => {
        await documenti.collega(riga, null)
        setScelta(false)
      })}>Scollega</button>}
      {scelta && <div>
        <label>Documento da collegare <select value={selezione} disabled={inCorso} onChange={e => setSelezione(e.target.value)}>
          <option value="">Seleziona PDF</option>
          {collegabili.map(d => <option key={d.id} value={d.id}>{etichetta(d)}</option>)}
        </select></label>
        <button type="button" disabled={disabilitata || inCorso || !collegabili.some(d => d.id === selezione)} onClick={() => void esegui(async () => {
          if (!attesa.current) return
          await documenti.collega(attesa.current, selezione)
          setScelta(false)
        })}>Conferma collegamento</button>
        <button type="button" disabled={inCorso} onClick={() => setScelta(false)}>Annulla collegamento</button>
      </div>}
    </>}
    {errore && <p role="alert">{errore}</p>}
  </div>
}
