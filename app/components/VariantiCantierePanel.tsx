'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

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
