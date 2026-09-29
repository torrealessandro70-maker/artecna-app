'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { elencaPreventiviSorgenteVariante, caricaLavorazioniPreventivoSorgente, type PreventivoSorgenteCandidato } from '../engines/varianti/repositoryPreventiviSorgente'
import { adattaPreventivoAVariante } from '../engines/varianti/adattaPreventivoAVariante'
import type { PropostaVarianteDaPreventivo, PropostaVarianteDaFile, NaturaVariante, AcquisizioneVariante, AnomaliaPropostaVarianteDaFile } from '../engines/varianti/types'
import type { AnomaliaMappingLavorazionePreventivo } from '../engines/varianti/mappaLavorazioniPreventivo'
import { estraiVociVarianteDaFile } from '../engines/varianti/estraiVociVarianteDaFile'
import { adattaFileAVariante } from '../engines/varianti/adattaFileAVariante'

const etichetteAnomalieFile: Record<AnomaliaPropostaVarianteDaFile['codice'], string> = {
  cantiere_id_non_valido: 'Cantiere non valido',
  nome_file_mancante: 'Nome file mancante',
  formato_non_supportato: 'Formato non supportato',
  descrizione_mancante: 'Descrizione mancante',
  quantita_non_valida: 'Quantità non valida',
  unita_misura_mancante: 'UM mancante',
  prezzo_non_valido: 'Prezzo non valido',
  totale_non_valido: 'Totale non valido',
  totale_incoerente: 'Totale incoerente',
}

function AnteprimaPreventivoVariante({ cantiereId }: { cantiereId: string }) {
  const [aperto, setAperto] = useState(false)
  const [natura, setNatura] = useState<NaturaVariante>('preventivo_integrativo')
  const [acquisizione, setAcquisizione] = useState<AcquisizioneVariante>('dati_artecna')
  const percorsoPreventivo = natura === 'preventivo_integrativo' && acquisizione === 'dati_artecna'
  const percorsoFile = natura === 'preventivo_integrativo' && acquisizione === 'file'
  const [fileSelezionato, setFileSelezionato] = useState<File | null>(null)
  const [analisiFile, setAnalisiFile] = useState(false)
  const [erroreFile, setErroreFile] = useState('')
  const [warningsFile, setWarningsFile] = useState<string[]>([])
  const [propostaFile, setPropostaFile] = useState<PropostaVarianteDaFile | null>(null)
  const [preventivi, setPreventivi] = useState<PreventivoSorgenteCandidato[]>([])
  const [preventivoId, setPreventivoId] = useState('')
  const [caricamentoElenco, setCaricamentoElenco] = useState(false)
  const [caricamentoAnteprima, setCaricamentoAnteprima] = useState(false)
  const [messaggio, setMessaggio] = useState('')
  const [anteprima, setAnteprima] = useState<{
    proposta: PropostaVarianteDaPreventivo
    anomalieMapper: AnomaliaMappingLavorazionePreventivo[]
  } | null>(null)
  const richiesta = useRef(0)

  function resetFile() {
    setFileSelezionato(null)
    setAnalisiFile(false)
    setErroreFile('')
    setWarningsFile([])
    setPropostaFile(null)
  }

  function resetPercorso() {
    richiesta.current += 1
    resetFile()
    setPreventivi([])
    setPreventivoId('')
    setAnteprima(null)
    setMessaggio('')
    setCaricamentoAnteprima(false)
    setCaricamentoElenco(false)
  }

  useEffect(() => {
    let attivo = true
    const corrente = ++richiesta.current
    resetFile()
    setPreventivi([])
    setPreventivoId('')
    setAnteprima(null)
    setMessaggio('')
    setCaricamentoAnteprima(false)
    setCaricamentoElenco(aperto && percorsoPreventivo)
    if (aperto && percorsoPreventivo) {
      void elencaPreventiviSorgenteVariante(supabase, cantiereId).then(esito => {
        if (!attivo || corrente !== richiesta.current) return
        if (esito.stato === 'errore') setMessaggio(esito.messaggio)
        else setPreventivi(esito.preventivi)
      }).catch(() => {
        if (attivo && corrente === richiesta.current) setMessaggio('Impossibile caricare i preventivi sorgente.')
      }).finally(() => {
        if (attivo && corrente === richiesta.current) setCaricamentoElenco(false)
      })
    }
    return () => { attivo = false; richiesta.current += 1 }
  }, [aperto, cantiereId, natura, acquisizione, percorsoPreventivo])

  async function caricaAnteprima() {
    if (!aperto || !percorsoPreventivo || !preventivi.some(p => p.id === preventivoId)) return
    const corrente = ++richiesta.current
    setAnteprima(null)
    setMessaggio('')
    setCaricamentoAnteprima(true)
    try {
      const esito = await caricaLavorazioniPreventivoSorgente(supabase, cantiereId, preventivoId)
      if (corrente !== richiesta.current) return
      if (esito.stato === 'errore') { setMessaggio(esito.messaggio); return }
      if (esito.stato === 'nessuna_lavorazione') {
        setMessaggio('Il preventivo selezionato non contiene lavorazioni disponibili.')
        return
      }
      setAnteprima({
        proposta: adattaPreventivoAVariante(cantiereId, preventivoId, esito.voci),
        anomalieMapper: esito.anomalie,
      })
    } catch {
      if (corrente === richiesta.current) setMessaggio('Impossibile caricare l’anteprima.')
    } finally {
      if (corrente === richiesta.current) setCaricamentoAnteprima(false)
    }
  }

  async function analizzaFile() {
    if (!aperto || !percorsoFile || !fileSelezionato || analisiFile) return
    const corrente = ++richiesta.current
    setAnalisiFile(true)
    setErroreFile('')
    setWarningsFile([])
    setPropostaFile(null)
    try {
      const esito = await estraiVociVarianteDaFile(fileSelezionato)
      if (corrente !== richiesta.current) return
      setWarningsFile(esito.warnings)
      if (esito.stato === 'errore') { setErroreFile(esito.messaggio); return }
      if (esito.voci.length === 0) { setErroreFile('Nessuna voce riconosciuta nel file.'); return }
      const risultato = adattaFileAVariante({
        cantiereId, nomeFile: esito.nomeFile, formato: esito.formato, voci: esito.voci,
      })
      if (risultato.stato === 'errore') {
        setErroreFile(risultato.anomalie.map(a => etichetteAnomalieFile[a.codice]).join('; '))
        return
      }
      setPropostaFile(risultato.proposta)
    } catch {
      if (corrente === richiesta.current) setErroreFile('Impossibile analizzare il file.')
    } finally {
      if (corrente === richiesta.current) setAnalisiFile(false)
    }
  }

  const numero = (valore: number | undefined) => typeof valore === 'number' && Number.isFinite(valore)
    ? valore.toLocaleString('it-IT', { maximumFractionDigits: 20 }) : 'Non disponibile'
  const totale = anteprima?.proposta.lavorazioni.reduce((somma, voce) =>
    somma + (typeof voce.totale === 'number' && Number.isFinite(voce.totale) && voce.totale >= 0 ? voce.totale : 0), 0)
  const cella = { padding: '8px 10px', border: '1px solid #dbe3ee', verticalAlign: 'top' as const }
  const totaleFile = propostaFile?.lavorazioni.reduce((somma, voce) =>
    somma + (typeof voce.totale === 'number' && Number.isFinite(voce.totale) && voce.totale >= 0 ? voce.totale : 0), 0)

  return <div style={{ margin: '12px 0' }}>
    <button type="button" onClick={() => {
      richiesta.current += 1
      resetFile()
      setAperto(!aperto)
    }}>{aperto ? 'Chiudi anteprima da preventivo' : '+ Nuova variante da preventivo'}</button>
    {aperto && <section aria-label="Origine e acquisizione variante"
      style={{ marginTop: 12, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label>Origine variante<select value={natura} style={{ display: 'block', padding: 8 }}
          onChange={e => { resetPercorso(); setNatura(e.target.value as NaturaVariante) }}>
          <option value="preventivo_integrativo">Preventivo integrativo</option>
          <option value="lavori_in_economia">Lavori in economia</option>
        </select></label>
        <label>Acquisizione<select value={acquisizione} style={{ display: 'block', padding: 8 }}
          onChange={e => { resetPercorso(); setAcquisizione(e.target.value as AcquisizioneVariante) }}>
          <option value="manuale">Manuale</option>
          <option value="dati_artecna">Da dati ARTECNA</option>
          <option value="file">Importa file</option>
        </select></label>
      </div>
      {!percorsoPreventivo && !percorsoFile && <p role="status">Questo percorso non è ancora configurato.</p>}
      {percorsoFile && <>
        <p>Solo anteprima: il file resta locale e nessuna variante viene creata o salvata.</p>
        <label>File preventivo<input type="file" accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
          style={{ display: 'block', margin: '8px 0', maxWidth: '100%' }}
          onChange={e => {
            richiesta.current += 1
            resetFile()
            setFileSelezionato(e.target.files?.[0] ?? null)
            e.target.value = ''
          }} /></label>
        {fileSelezionato && <p style={{ overflowWrap: 'anywhere' }}>{fileSelezionato.name}</p>}
        <button type="button" disabled={!fileSelezionato || analisiFile}
          onClick={() => void analizzaFile()}>{analisiFile ? 'Analisi in corso...' : 'Analizza file'}</button>
        {erroreFile && <p role="status">{erroreFile}</p>}
        {warningsFile.length > 0 && <div><p>Avvisi lettura file:</p>
          <ul>{warningsFile.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
        </div>}
        {propostaFile && <>
          <p>Totale sorgente leggibile: {numero(totaleFile)} € (solo totali validi e finiti).</p>
          {propostaFile.anomalie.filter(a => a.indiceVoce === undefined).map((a, i) =>
            <p key={i}>{etichetteAnomalieFile[a.codice]}</p>)}
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780, fontSize: 14 }}>
              <caption style={{ textAlign: 'left', padding: 8 }}>Lavorazioni del file — sola lettura</caption>
              <thead><tr>{['Descrizione', 'UM', 'Quantità', 'Prezzo sorgente', 'Totale sorgente', 'Verifica'].map(t =>
                <th key={t} scope="col" style={{ ...cella, textAlign: 'left', background: '#f1f5f9' }}>{t}</th>)}</tr></thead>
              <tbody>{propostaFile.lavorazioni.map((voce, indice) => {
                const anomalie = propostaFile.anomalie.filter(a => a.indiceVoce === indice)
                return <tr key={indice} style={{ background: indice % 2 ? '#f8fafc' : '#fff' }}>
                  <td style={{ ...cella, whiteSpace: 'pre-wrap' }}>{voce.descrizione ?? 'Non disponibile'}</td>
                  <td style={cella}>{voce.unitaMisura ?? 'Non disponibile'}</td>
                  <td style={cella}>{numero(voce.quantita)}</td>
                  <td style={cella}>{numero(voce.prezzoSorgente)}</td>
                  <td style={cella}>{numero(voce.totale)}</td>
                  <td style={cella}>{anomalie.length ? anomalie.map((a, i) =>
                    <div key={i}>{etichetteAnomalieFile[a.codice]}</div>) : 'Nessuna anomalia rilevata'}</td>
                </tr>
              })}</tbody>
            </table>
          </div>
        </>}
      </>}
      {percorsoPreventivo && <>
      <p>Solo anteprima: nessuna variante viene creata o salvata. Le voci e gli importi sorgente non vengono corretti automaticamente.</p>
      <label>Preventivo sorgente<select value={preventivoId} disabled={caricamentoElenco}
        style={{ display: 'block', width: '100%', padding: 8, margin: '8px 0' }}
        onChange={e => {
          richiesta.current += 1
          setPreventivoId(e.target.value)
          setAnteprima(null)
          setMessaggio('')
          setCaricamentoAnteprima(false)
        }}>
        <option value="">Seleziona un preventivo</option>
        {preventivi.map(p => <option key={p.id} value={p.id}>
          {p.nomeFile || 'Preventivo'} — {p.dataPreventivo || p.createdAt || 'Data non disponibile'}
          {' — '}{p.importoTotale !== undefined ? `${p.importoTotale} €` : 'Importo non disponibile'}
          {' — '}{p.numeroLavorazioni} voci
        </option>)}
      </select></label>
      {caricamentoElenco && <p role="status">Caricamento preventivi...</p>}
      {!caricamentoElenco && !messaggio && preventivi.length === 0 && <p>Nessun preventivo strutturato disponibile per questo cantiere.</p>}
      <button type="button" disabled={!preventivoId || caricamentoElenco || caricamentoAnteprima}
        onClick={() => void caricaAnteprima()}>{caricamentoAnteprima ? 'Caricamento anteprima...' : 'Carica anteprima'}</button>
      {messaggio && <p role="status">{messaggio}</p>}
      {anteprima && <>
        <p>Totale sorgente leggibile: {numero(totale)} € (solo totali validi e finiti).</p>
        {anteprima.proposta.anomalie.filter(a => a.indiceVoce === undefined).map((a, i) =>
          <p key={i}>Adapter: {a.codice.replaceAll('_', ' ')}</p>)}
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780, fontSize: 14 }}>
            <caption style={{ textAlign: 'left', padding: 8 }}>Lavorazioni sorgente — sola lettura</caption>
            <thead><tr>{['Descrizione', 'UM', 'Quantità', 'Prezzo sorgente', 'Totale sorgente', 'Verifica'].map(t =>
              <th key={t} scope="col" style={{ ...cella, textAlign: 'left', background: '#f1f5f9' }}>{t}</th>)}</tr></thead>
            <tbody>{anteprima.proposta.lavorazioni.map((voce, indice) => {
              const anomalie = [
                ...anteprima.anomalieMapper.filter(a => a.indiceRiga === indice).map(a => `Mapper: ${a.codice.replaceAll('_', ' ')}`),
                ...anteprima.proposta.anomalie.filter(a => a.indiceVoce === indice).map(a => `Adapter: ${a.codice.replaceAll('_', ' ')}`),
              ]
              return <tr key={indice} style={{ background: indice % 2 ? '#f8fafc' : '#fff' }}>
                <td style={{ ...cella, whiteSpace: 'pre-wrap' }}>{voce.descrizione ?? 'Non disponibile'}</td>
                <td style={cella}>{voce.unitaMisura ?? 'Non disponibile'}</td>
                <td style={cella}>{numero(voce.quantita)}</td>
                <td style={cella}>{numero(voce.prezzoSorgente)}</td>
                <td style={cella}>{numero(voce.totale)}</td>
                <td style={cella}>{anomalie.length ? anomalie.map((a, i) => <div key={i}>{a}</div>) : 'Nessuna anomalia rilevata'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </>}
      </>}
    </section>}
  </div>
}

type Variante = {
  id: string
  numero: number | null
  titolo: string | null
  descrizione: string
  stato: string
  data_variante: string | null
  importo_delta_approvato: number | string | null
  approvata_at?: string | null
  riferimento_approvazione?: string | null
  preventivo_contrattuale_id: string | null
}

type Stato =
  | { tipo: 'loading' }
  | { tipo: 'errore'; messaggio: string }
  | { tipo: 'elenco'; righe: Variante[] }

const erroriLetturaRpc: Record<string, string> = {
  P2020: 'Sessione utente non valida.',
  P2021: 'Non sei autorizzato a visualizzare le varianti di questo cantiere.',
}

const erroriRpc: Record<string, string> = {
  P2020: 'Identità o dati non validi. Controlla il titolo e la sessione.',
  P2021: 'Non sei autorizzato a creare varianti per questo cantiere.',
  P2022: 'Cantiere o preventivo contrattuale non disponibile o incoerente.',
  P2023: 'Creazione della bozza non completata.',
  '40001': 'Conflitto concorrente: salvataggio annullato. Puoi riprovare manualmente.',
  '40P01': 'Conflitto concorrente: salvataggio annullato. Puoi riprovare manualmente.',
}

export default function VariantiCantierePanel({ cantiereId }: { cantiereId?: string | null }) {
  const [stato, setStato] = useState<Stato>({ tipo: 'loading' })
  const [formAperto, setFormAperto] = useState(false)
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [dataVariante, setDataVariante] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreSalvataggio, setErroreSalvataggio] = useState('')
  const [successo, setSuccesso] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [bozzeCreate, setBozzeCreate] = useState<Variante[]>([])
  const [proposteConfermate, setProposteConfermate] = useState<Variante[]>([])
  const [approvazioniConfermate, setApprovazioniConfermate] = useState<Variante[]>([])
  const invioInCorso = useRef(false)
  const contesto = useRef<object | null>(null)

  useEffect(() => {
    const corrente = {}
    contesto.current = corrente
    invioInCorso.current = false
    setFormAperto(false)
    setTitolo('')
    setDescrizione('')
    setDataVariante('')
    setErroreSalvataggio('')
    setSuccesso('')
    setSalvataggio(false)
    setBozzeCreate([])
    setProposteConfermate([])
    setApprovazioniConfermate([])
    return () => { contesto.current = null }
  }, [cantiereId])

  useEffect(() => {
    let attivo = true
    if (!cantiereId) {
      setStato({ tipo: 'errore', messaggio: 'Cantiere non identificato. Seleziona un cantiere valido.' })
      return
    }
    setStato({ tipo: 'loading' })
    async function carica() {
      try {
        const righe: Variante[] = []
        const pagina = 200
        for (let offset = 0; ; offset += pagina) {
          const { data, error } = await supabase
            .rpc('leggi_varianti_cantiere', { p_cantiere_id: cantiereId! })
            .order('numero', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true })
            .range(offset, offset + pagina - 1)
          if (!attivo) return
          if (error) {
            const messaggio = erroriLetturaRpc[error.code]
            if (!messaggio) throw error
            setStato({ tipo: 'errore', messaggio })
            return
          }
          if (!data) throw new Error('Risposta non disponibile.')
          righe.push(...data)
          if (data.length < pagina) break
        }
        if (attivo) setStato({ tipo: 'elenco', righe })
      } catch {
        if (attivo) setStato({ tipo: 'errore', messaggio: 'Errore di aggiornamento elenco. Le bozze già confermate restano salvate. Riapri la tab per riprovare la lettura.' })
      }
    }
    void carica()
    return () => { attivo = false }
  }, [cantiereId, refresh])

  function resetForm() {
    setFormAperto(false)
    setTitolo('')
    setDescrizione('')
    setDataVariante('')
    setErroreSalvataggio('')
  }

  async function salvaBozza(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (invioInCorso.current) return
    if (!cantiereId || !titolo.trim()) {
      setErroreSalvataggio('Seleziona un cantiere e inserisci un titolo non vuoto.')
      return
    }
    const corrente = contesto.current
    if (!corrente) return
    invioInCorso.current = true
    setSalvataggio(true)
    setErroreSalvataggio('')
    setSuccesso('')
    try {
      const { data, error } = await supabase.rpc('crea_bozza_variante', {
        p_cantiere_id: cantiereId,
        p_titolo: titolo.trim(),
        p_descrizione: descrizione.trim() || null,
        p_data_variante: dataVariante || null,
      })
      if (contesto.current !== corrente) return
      if (error) {
        setErroreSalvataggio(erroriRpc[error.code] ||
          'Salvataggio non confermato. Verifica se la bozza esiste prima di riprovare.')
        return
      }
      const nuova = Array.isArray(data) && data.length === 1 ? data[0] : null
      if (!nuova || typeof nuova.id !== 'string' || !nuova.id.trim() ||
          nuova.cantiere_id !== cantiereId || nuova.stato !== 'bozza' ||
          nuova.numero !== null || typeof nuova.titolo !== 'string' ||
          typeof nuova.descrizione !== 'string' || typeof nuova.data_variante !== 'string' ||
          typeof nuova.preventivo_contrattuale_id !== 'string') {
        setErroreSalvataggio('Risposta di creazione non verificabile. Controlla se la bozza è stata creata prima di riprovare.')
        return
      }
      const confermata: Variante = {
        id: nuova.id,
        numero: nuova.numero,
        titolo: nuova.titolo,
        descrizione: nuova.descrizione,
        stato: nuova.stato,
        data_variante: nuova.data_variante,
        preventivo_contrattuale_id: nuova.preventivo_contrattuale_id,
        importo_delta_approvato: null,
      }
      setBozzeCreate(precedenti => [...precedenti.filter(v => v.id !== confermata.id), confermata])
      resetForm()
      setSuccesso('Bozza salvata.')
      setRefresh(valore => valore + 1)
    } catch {
      if (contesto.current === corrente) {
        setErroreSalvataggio('Salvataggio non confermato per un errore di comunicazione. Verifica se la bozza esiste prima di riprovare.')
      }
    } finally {
      if (contesto.current === corrente) {
        invioInCorso.current = false
        setSalvataggio(false)
      }
    }
  }

  function confermaProposta(variante: Variante, numero: number) {
    const proposta = { ...variante, stato: 'proposta', numero }
    setProposteConfermate(precedenti => [...precedenti.filter(v => v.id !== variante.id), proposta])
    setSuccesso(`Variante proposta come n. ${numero}.`)
    setRefresh(valore => valore + 1)
  }

  function confermaApprovazione(variante: Variante, esito: EsitoApprovazione) {
    const approvata = { ...variante, ...esito }
    setApprovazioniConfermate(precedenti => [...precedenti.filter(v => v.id !== variante.id), approvata])
    setSuccesso(`Variante n. ${esito.numero} approvata.`)
    setRefresh(valore => valore + 1)
  }

  const righeLette = stato.tipo === 'elenco' ? stato.righe : []
  const righe = [
    ...righeLette,
    ...bozzeCreate.filter(bozza => !righeLette.some(riga => riga.id === bozza.id)),
    ...proposteConfermate.filter(proposta => !righeLette.some(r => r.id === proposta.id) && !bozzeCreate.some(r => r.id === proposta.id)),
    ...approvazioniConfermate.filter(approvata => ![...righeLette, ...bozzeCreate, ...proposteConfermate].some(v => v.id === approvata.id)),
  ].map(variante => variante.stato === 'bozza'
    ? proposteConfermate.find(p => p.id === variante.id) || variante
    : variante).map(variante => approvazioniConfermate.find(v => v.id === variante.id) || variante).sort((a, b) => {
    if (a.numero === null && b.numero !== null) return 1
    if (a.numero !== null && b.numero === null) return -1
    return (a.numero ?? 0) - (b.numero ?? 0) || a.id.localeCompare(b.id)
  })
  const bozzeNonRilette = stato.tipo === 'elenco' &&
    bozzeCreate.some(bozza => !righeLette.some(riga => riga.id === bozza.id))

  return (
    <section aria-label="Varianti" style={{ marginTop: 16 }}>
      <h3>Varianti</h3>
      {cantiereId && <AnteprimaPreventivoVariante key={cantiereId} cantiereId={cantiereId} />}
      {!formAperto && (
        <button type="button" disabled={!cantiereId || salvataggio}
          onClick={() => { setErroreSalvataggio(''); setFormAperto(true) }}>
          Nuova variante
        </button>
      )}
      {formAperto && (
        <form onSubmit={salvaBozza} style={{ marginTop: 16 }}>
          <fieldset disabled={salvataggio} style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <legend>Nuova variante</legend>
            <label>Titolo *<input required value={titolo} onChange={e => setTitolo(e.target.value)}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 8 }} /></label>
            <label>Descrizione<textarea value={descrizione} onChange={e => setDescrizione(e.target.value)}
              rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 8 }} /></label>
            <label>Data variante<input type="date" value={dataVariante} onChange={e => setDataVariante(e.target.value)}
              style={{ display: 'block', padding: 8 }} /></label>
            <p style={{ margin: 0 }}>Se lasci la data vuota verrà usata la data corrente del database.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" onClick={resetForm}>Annulla</button>
              <button type="submit" disabled={salvataggio || !cantiereId || !titolo.trim()}>
                {salvataggio ? 'Salvataggio...' : 'Salva bozza'}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {salvataggio && <p role="status">Salvataggio...</p>}
      {erroreSalvataggio && <p role="alert">{erroreSalvataggio}</p>}
      {successo && <p role="status">{successo}</p>}
      {stato.tipo === 'loading' && <p role="status">Caricamento varianti...</p>}
      {stato.tipo === 'errore' && <p role="alert">{stato.messaggio}</p>}
      {bozzeNonRilette && <p role="status">L'elenco aggiornato non restituisce tutte le bozze appena salvate. Sono mostrate le conferme di questa apertura del pannello; la rilettura non è confermata.</p>}
      {stato.tipo === 'elenco' && righe.length === 0 && <p>Nessuna variante presente per questo cantiere.</p>}
      {righe.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {righe.map(variante => (
            <article key={variante.id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
              <h4 style={{ marginTop: 0 }}>
                {variante.stato === 'approvata' ? 'Approvata' : variante.stato === 'proposta' ? 'Proposta' : variante.numero === null ? 'Bozza' : `Variante n. ${variante.numero}`}
                {' — '}{variante.titolo || 'Senza titolo'}
              </h4>
              <p>Stato: {variante.stato}</p>
              {variante.numero !== null && <p>Numero: {variante.numero}</p>}
              <p style={{ whiteSpace: 'pre-wrap' }}>{variante.descrizione || 'Nessuna descrizione.'}</p>
              <p>Data variante: {variante.data_variante
                ? variante.data_variante.slice(0, 10).split('-').reverse().join('/')
                : 'Non indicata'}</p>
              <p>Importo delta approvato: {variante.importo_delta_approvato === null
                ? 'Non disponibile'
                : Number(variante.importo_delta_approvato).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p>
              {variante.stato === 'approvata' && <>
                <p>Riferimento approvazione: {variante.riferimento_approvazione || 'Non disponibile'}</p>
                <p>Data approvazione: {variante.approvata_at && Number.isFinite(Date.parse(variante.approvata_at))
                  ? new Date(variante.approvata_at).toLocaleString('it-IT') : 'Non disponibile'}</p>
              </>}
              {variante.stato === 'proposta' && <ApprovazioneVarianteForm key={`approva:${cantiereId}:${variante.id}`}
                variante={variante} cantiereId={cantiereId}
                onApprovata={esito => confermaApprovazione(variante, esito)} />}
              <details>
                <summary>Preventivo contrattuale collegato</summary>
                <p style={{ overflowWrap: 'anywhere' }}>{variante.preventivo_contrattuale_id || 'Non disponibile'}</p>
              </details>
              <LavorazioniVariantePanel key={`${cantiereId}:${variante.id}`} varianteId={variante.id}
                cantiereId={cantiereId} statoVariante={variante.stato}
                onProposta={numero => confermaProposta(variante, numero)} />
            </article>
          ))}
        </div>
      )}
    </section>
  )
}


type LavorazioneVariante = {
  numero_riga: number
  descrizione: string
  unita_misura: string | null
  quantita_delta: number | string
  prezzo_unitario: number | string
  delta_contratto: number | string
}

const erroriLavorazioniRpc: Record<string, string> = {
  P2022: 'Sessione utente non valida.',
  P2023: 'Dati della lavorazione non validi.',
  P2024: 'Variante non disponibile o non autorizzata.',
  P2025: 'La variante non è più modificabile.',
  P2026: "Conflitto durante l'aggiunta. Riprova.",
}

const numeroLavorazione = (value: unknown): number => {
  if (typeof value !== 'string' && typeof value !== 'number') return NaN
  if (typeof value === 'string' && !value.trim()) return NaN
  return Number(typeof value === 'string' ? value.trim().replace(',', '.') : value)
}

const lavorazioneValida = (value: unknown): value is LavorazioneVariante => {
  if (!value || typeof value !== 'object') return false
  const riga = value as Record<string, unknown>
  return Number.isInteger(riga.numero_riga) && Number(riga.numero_riga) > 0 &&
    typeof riga.descrizione === 'string' && !!riga.descrizione.trim() &&
    (riga.unita_misura === null || typeof riga.unita_misura === 'string') &&
    ['quantita_delta', 'prezzo_unitario', 'delta_contratto'].every(campo =>
      Number.isFinite(numeroLavorazione(riga[campo])))
}

const erroriPropostaRpc: Record<string, string> = {
  P2010: 'Variante non disponibile.',
  P2011: 'La variante non è più in bozza.',
  P2012: 'Il contratto di riferimento è cambiato o non è valido.',
  P2013: 'La variante deve contenere almeno una lavorazione.',
  P2014: 'Una o più lavorazioni della variante non sono valide.',
  P2015: 'Una lavorazione contiene un riferimento non valido.',
  P2016: 'Una lavorazione contiene un riferimento non valido.',
  P2017: 'Conflitto durante la proposta. Riprova.',
}

function LavorazioniVariantePanel({ varianteId, cantiereId, statoVariante, onProposta }: {
  varianteId: string
  cantiereId?: string | null
  statoVariante: string
  onProposta: (numero: number) => void
}) {
  const [righe, setRighe] = useState<LavorazioneVariante[]>([])
  const [confermate, setConfermate] = useState<LavorazioneVariante[]>([])
  const [lettura, setLettura] = useState<'loading' | 'elenco' | 'errore'>('loading')
  const [erroreLettura, setErroreLettura] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [aperto, setAperto] = useState(false)
  const [descrizione, setDescrizione] = useState('')
  const [unita, setUnita] = useState('')
  const [quantita, setQuantita] = useState('')
  const [prezzo, setPrezzo] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreSalvataggio, setErroreSalvataggio] = useState('')
  const [successo, setSuccesso] = useState('')
  const [bloccata, setBloccata] = useState(false)
  const [propostaInCorso, setPropostaInCorso] = useState(false)
  const [erroreProposta, setErroreProposta] = useState('')
  const invio = useRef(false)
  const contesto = useRef<object | null>(null)
  const modificabile = statoVariante === 'bozza' && !bloccata

  useEffect(() => {
    contesto.current = {}
    return () => { contesto.current = null }
  }, [])

  useEffect(() => {
    let attivo = true
    setLettura('loading')
    setErroreLettura('')
    async function caricaLavorazioni() {
      try {
        const elenco: LavorazioneVariante[] = []
        const pagina = 200
        for (let offset = 0; ; offset += pagina) {
          const { data, error } = await supabase
            .rpc('leggi_lavorazioni_variante', { p_variante_id: varianteId })
            .order('numero_riga', { ascending: true })
            .range(offset, offset + pagina - 1)
          if (!attivo) return
          if (error) {
            if (error.code === 'P2025') setBloccata(true)
            setErroreLettura(erroriLavorazioniRpc[error.code] || 'Impossibile caricare le lavorazioni della variante.')
            setLettura('errore')
            return
          }
          if (!Array.isArray(data) || !data.every(lavorazioneValida)) throw new Error('Risposta non valida')
          elenco.push(...data)
          if (data.length < pagina) break
        }
        if (attivo) {
          setRighe(elenco)
          setLettura('elenco')
        }
      } catch {
        if (attivo) {
          setErroreLettura('Impossibile caricare le lavorazioni della variante.')
          setLettura('errore')
        }
      }
    }
    void caricaLavorazioni()
    return () => { attivo = false }
  }, [varianteId, refresh])

  function resetForm() {
    setAperto(false)
    setDescrizione('')
    setUnita('')
    setQuantita('')
    setPrezzo('')
    setErroreSalvataggio('')
  }

  async function salvaLavorazione(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (invio.current) return
    if (!modificabile) {
      setErroreSalvataggio(erroriLavorazioniRpc.P2025)
      return
    }
    const q = numeroLavorazione(quantita)
    const p = numeroLavorazione(prezzo)
    if (!descrizione.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0) {
      setErroreSalvataggio(erroriLavorazioniRpc.P2023)
      return
    }
    const corrente = contesto.current
    if (!corrente) return
    invio.current = true
    setSalvataggio(true)
    setErroreSalvataggio('')
    setSuccesso('')
    try {
      const { data, error } = await supabase.rpc('aggiungi_lavorazione_variante', {
        p_variante_id: varianteId,
        p_descrizione: descrizione.trim(),
        p_unita_misura: unita.trim() || null,
        p_quantita: q,
        p_prezzo_unitario: p,
      })
      if (contesto.current !== corrente) return
      if (error) {
        if (error.code === 'P2025') setBloccata(true)
        setErroreSalvataggio(erroriLavorazioniRpc[error.code] ||
          'Salvataggio non confermato. Ricarica le lavorazioni prima di riprovare.')
        return
      }
      const nuova = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data
      if (!lavorazioneValida(nuova)) {
        setErroreSalvataggio('Risposta di salvataggio non verificabile. Ricarica le lavorazioni prima di riprovare.')
        return
      }
      setConfermate(precedenti => [...precedenti.filter(r => r.numero_riga !== nuova.numero_riga), nuova])
      resetForm()
      setSuccesso('Lavorazione salvata.')
      setRefresh(valore => valore + 1)
    } catch {
      if (contesto.current === corrente) {
        setErroreSalvataggio('Salvataggio non confermato. Ricarica le lavorazioni prima di riprovare.')
      }
    } finally {
      if (contesto.current === corrente) {
        invio.current = false
        setSalvataggio(false)
      }
    }
  }

  async function proponiVariante() {
    if (invio.current || !modificabile || lettura !== 'elenco' || righe.length === 0 || !cantiereId) return
    if (!confirm('Proporre questa variante? Dopo la proposta le lavorazioni non saranno più modificabili.')) return
    const corrente = contesto.current
    if (!corrente) return
    invio.current = true
    setPropostaInCorso(true)
    setErroreProposta('')
    try {
      const { data, error } = await supabase.rpc('proponi_variante', { p_variante_id: varianteId })
      if (contesto.current !== corrente) return
      if (error) {
        if (error.code === 'P2011') setBloccata(true)
        setErroreProposta(erroriPropostaRpc[error.code] ||
          'Proposta non confermata. Riapri il pannello per verificare lo stato prima di riprovare.')
        return
      }
      const proposta = Array.isArray(data) && data.length === 1 ? data[0] : null
      if (!proposta || proposta.id !== varianteId || proposta.cantiere_id !== cantiereId ||
          proposta.stato !== 'proposta' || !Number.isInteger(proposta.numero) || proposta.numero <= 0) {
        setErroreProposta('Risposta di proposta non verificabile. Riapri il pannello per verificare lo stato prima di riprovare.')
        return
      }
      setBloccata(true)
      resetForm()
      setSuccesso('')
      setRefresh(valore => valore + 1)
      onProposta(proposta.numero)
    } catch {
      if (contesto.current === corrente) {
        setErroreProposta('Proposta non confermata. Riapri il pannello per verificare lo stato prima di riprovare.')
      }
    } finally {
      if (contesto.current === corrente) {
        invio.current = false
        setPropostaInCorso(false)
      }
    }
  }

  const visibili = [...righe, ...confermate.filter(c => !righe.some(r => r.numero_riga === c.numero_riga))]
    .sort((a, b) => a.numero_riga - b.numero_riga)
  const nonRilette = confermate.some(c => !righe.some(r => r.numero_riga === c.numero_riga))
  const totale = visibili.reduce((somma, riga) => somma + numeroLavorazione(riga.delta_contratto), 0)
  const euro = (valore: number | string) => numeroLavorazione(valore).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box' as const, padding: 8 }

  return (
    <section aria-label="Lavorazioni della variante" style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
      <h5>Lavorazioni della variante</h5>
      {modificabile && lettura === 'elenco' && righe.length > 0 && (
        <button type="button" disabled={propostaInCorso || salvataggio || !cantiereId} onClick={() => void proponiVariante()}>
          {propostaInCorso ? 'Proposta in corso...' : 'Proponi variante'}
        </button>
      )}
      {erroreProposta && <p role="alert">{erroreProposta}</p>}
      {modificabile && !aperto && <button type="button" disabled={propostaInCorso} onClick={() => { setAperto(true); setErroreSalvataggio(''); setSuccesso('') }}>+ Nuova lavorazione</button>}
      {modificabile && aperto && (
        <form onSubmit={salvaLavorazione} style={{ marginTop: 12 }}>
          <fieldset disabled={salvataggio || propostaInCorso} style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #e2e8f0' }}>
            <legend>Nuova lavorazione</legend>
            <label>Descrizione *<textarea required value={descrizione} onChange={e => setDescrizione(e.target.value)} rows={3} style={inputStyle} /></label>
            <label>UM<input value={unita} onChange={e => setUnita(e.target.value)} style={inputStyle} /></label>
            <label>Quantità *<input required inputMode="decimal" value={quantita} onChange={e => setQuantita(e.target.value)} style={inputStyle} /></label>
            <label>Prezzo unitario *<input required inputMode="decimal" value={prezzo} onChange={e => setPrezzo(e.target.value)} style={inputStyle} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={resetForm}>Annulla</button>
              <button type="submit" disabled={salvataggio}>{salvataggio ? 'Salvataggio...' : 'Salva lavorazione'}</button>
            </div>
          </fieldset>
        </form>
      )}
      {erroreSalvataggio && <p role="alert">{erroreSalvataggio}</p>}
      {successo && <p role="status">{successo}</p>}
      {lettura === 'loading' && <p role="status">Caricamento lavorazioni...</p>}
      {erroreLettura && <p role="alert">{erroreLettura}</p>}
      <button type="button" disabled={lettura === 'loading' || salvataggio || propostaInCorso} onClick={() => setRefresh(v => v + 1)}>Ricarica lavorazioni</button>
      {lettura === 'elenco' && visibili.length === 0 && <p>Nessuna lavorazione presente.</p>}
      {visibili.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead><tr><th scope="col">N.</th><th scope="col">Descrizione</th><th scope="col">UM</th><th scope="col">Quantità</th><th scope="col">Prezzo unitario</th><th scope="col">Delta contratto</th></tr></thead>
            <tbody>{visibili.map(riga => <tr key={riga.numero_riga}>
              <td>{riga.numero_riga}</td><td style={{ whiteSpace: 'pre-wrap' }}>{riga.descrizione}</td><td>{riga.unita_misura || '—'}</td>
              <td>{numeroLavorazione(riga.quantita_delta).toLocaleString('it-IT', { maximumFractionDigits: 20 })}</td>
              <td>{euro(riga.prezzo_unitario)}</td><td>{euro(riga.delta_contratto)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      {lettura === 'elenco' && !nonRilette
        ? <p><strong>Totale variante: {euro(totale)}</strong></p>
        : <p>Totale variante da aggiornare.{visibili.length > 0 && <> Somma delle righe visualizzate: {euro(totale)}.</>}</p>}
      {lettura === 'elenco' && nonRilette && <p role="status">La rilettura non include tutte le lavorazioni appena confermate. Sono mantenute visibili le righe restituite dal salvataggio.</p>}
    </section>
  )
}


type EsitoApprovazione = {
  stato: 'approvata'
  numero: number
  importo_delta_approvato: number | string
  approvata_at: string
  riferimento_approvazione: string
}

const erroriApprovazioneRpc: Record<string, string> = {
  P2027: 'Sessione utente non valida.',
  P2028: 'Riferimento approvazione obbligatorio.',
  P2029: 'Variante non disponibile o non autorizzata.',
  P2030: 'La variante non è approvabile.',
  P2031: 'Il contratto di riferimento è cambiato o non è valido.',
  P2032: 'Le lavorazioni della variante non producono un delta valido.',
  P2033: "Conflitto durante l'approvazione. Riprova.",
}

function ApprovazioneVarianteForm({ variante, cantiereId, onApprovata }: {
  variante: Variante
  cantiereId?: string | null
  onApprovata: (esito: EsitoApprovazione) => void
}) {
  const [aperto, setAperto] = useState(false)
  const [riferimento, setRiferimento] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState('')
  const invio = useRef(false)
  const contesto = useRef<object | null>(null)

  useEffect(() => {
    contesto.current = {}
    return () => { contesto.current = null }
  }, [])

  function annulla() {
    setAperto(false)
    setRiferimento('')
    setErrore('')
  }

  async function approva(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (invio.current) return
    if (variante.stato !== 'proposta' || !cantiereId || !Number.isInteger(variante.numero) || Number(variante.numero) <= 0) {
      setErrore(erroriApprovazioneRpc.P2030)
      return
    }
    const riferimentoInviato = riferimento.trim()
    if (!riferimentoInviato) {
      setErrore(erroriApprovazioneRpc.P2028)
      return
    }
    if (!confirm(`Approvare definitivamente la variante n. ${variante.numero}? Dopo l'approvazione la variante diventa storica e il preventivo contrattuale di base viene congelato.`)) return
    const corrente = contesto.current
    if (!corrente) return
    invio.current = true
    setInCorso(true)
    setErrore('')
    try {
      const { data, error } = await supabase.rpc('approva_variante', {
        p_variante_id: variante.id,
        p_riferimento_approvazione: riferimentoInviato,
      })
      if (contesto.current !== corrente) return
      if (error) {
        setErrore(erroriApprovazioneRpc[error.code] ||
          'Approvazione non confermata. Riapri il pannello per verificare lo stato prima di riprovare.')
        return
      }
      const esito = Array.isArray(data) && data.length === 1 ? data[0] : null
      const delta = numeroLavorazione(esito?.importo_delta_approvato)
      if (!esito || esito.id !== variante.id || esito.cantiere_id !== cantiereId ||
          esito.numero !== variante.numero || !Number.isInteger(esito.numero) || esito.stato !== 'approvata' ||
          !Number.isFinite(delta) || delta === 0 ||
          typeof esito.approvata_at !== 'string' || !Number.isFinite(Date.parse(esito.approvata_at)) ||
          typeof esito.riferimento_approvazione !== 'string' || !esito.riferimento_approvazione.trim()) {
        setErrore('Risposta di approvazione non verificabile. Riapri il pannello per verificare lo stato prima di riprovare.')
        return
      }
      annulla()
      onApprovata({
        stato: 'approvata', numero: esito.numero,
        importo_delta_approvato: esito.importo_delta_approvato,
        approvata_at: esito.approvata_at,
        riferimento_approvazione: esito.riferimento_approvazione,
      })
    } catch {
      if (contesto.current === corrente) {
        setErrore('Approvazione non confermata. Riapri il pannello per verificare lo stato prima di riprovare.')
      }
    } finally {
      if (contesto.current === corrente) {
        invio.current = false
        setInCorso(false)
      }
    }
  }

  if (variante.stato !== 'proposta') return null
  return (
    <div style={{ marginTop: 12 }}>
      {!aperto && <button type="button" onClick={() => { setAperto(true); setErrore('') }}>Approva variante</button>}
      {aperto && <form onSubmit={approva}>
        <fieldset disabled={inCorso} style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #e2e8f0' }}>
          <legend>Approva variante</legend>
          <label>Riferimento approvazione *
            <input required value={riferimento} onChange={e => setRiferimento(e.target.value)}
              placeholder="Approvazione cliente del 18/09/2026"
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 8 }} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={annulla}>Annulla</button>
            <button type="submit" disabled={inCorso}>{inCorso ? 'Approvazione in corso...' : 'Conferma approvazione'}</button>
          </div>
        </fieldset>
      </form>}
      {errore && <p role="alert">{errore}</p>}
    </div>
  )
}
