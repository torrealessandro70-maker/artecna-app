'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { apriArteCna, type QuadernoFile } from '../engines/quaderno/fileNativo'
import GestioniQuadernoPendenti from './GestioniQuadernoPendenti'
import { duplicaProgetto, eliminaProgetto } from '../engines/quaderno/gestione'
import { rpcQuaderno } from '../engines/quaderno/operazioni'
import SopralluogoAppunti from './SopralluogoAppunti'
import { erroreQuaderno } from '../engines/quaderno/persistenza'

type Progetto = { id: string; titolo: string; updated_at: string; gestione_id?: string | null }
type Props = { onChiudi?: () => void; progettoInizialeId?: string; selezione?: { collegati: readonly string[]; disabled: boolean; onSeleziona: (progetto: Progetto) => void }; supabase: SupabaseClient; attivo: boolean; buttonPrimary: CSSProperties; buttonSecondary: CSSProperties }

export default function QuadernoProgettiPanel({ supabase, attivo, buttonPrimary, buttonSecondary, selezione, progettoInizialeId, onChiudi }: Props) {
  const [importato, setImportato] = useState<QuadernoFile | undefined>()
  const [progetti, setProgetti] = useState<Progetto[]>([])
  const [aperto, setAperto] = useState<string | null>(progettoInizialeId ?? null)
  const [titolo, setTitolo] = useState('')
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [pendenti, setPendenti] = useState(false)
  const [revisioneGestione, setRevisioneGestione] = useState(0)
  const gestioneBusyRef = useRef(false)
  const [gestioneBusy, setGestioneBusy] = useState(false)
  const pendentiRef = useRef(false)
  const salvataggioRef = useRef(false)
  const fileOccupatoRef = useRef(false)

  const carica = useCallback(async () => {
    setCaricamento(true)
    setErrore('')
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Accedi per aprire i progetti Quaderno')
      const { data, error } = await supabase.from('quaderno_progetti')
        .select('id,titolo,updated_at,gestione_id').eq('user_id', auth.user.id).order('updated_at', { ascending: false })
      if (error) throw error
      setProgetti(data || [])
    } catch (error) { setErrore(erroreQuaderno(error as Error)) }
    finally { setCaricamento(false) }
  }, [supabase])

  useEffect(() => { if (attivo) void carica() }, [attivo, carica])

  const aggiornaStato = useCallback((dirty: boolean, saving: boolean, fileBusy = false) => {
    pendentiRef.current = dirty
    salvataggioRef.current = saving
    fileOccupatoRef.current = fileBusy
    setPendenti(dirty)
  }, [])

  function puoCambiare(daFile = false) {
    if (gestioneBusyRef.current || salvataggioRef.current || (!daFile && fileOccupatoRef.current)) return false
    return !pendentiRef.current || window.confirm('Ci sono modifiche non salvate. Abbandonarle e aprire un altro progetto?')
  }

  useEffect(() => {
    if (selezione) return
    const apri = (event: Event) => {
      const contenuto = (event as CustomEvent<QuadernoFile>).detail
      if (!puoCambiare(true)) { event.preventDefault(); return }
      setImportato(contenuto); setAperto(crypto.randomUUID()); setErrore('')
    }
    window.addEventListener('artecna-quaderno-file', apri)
    return () => window.removeEventListener('artecna-quaderno-file', apri)
  }, [selezione])
  async function apriFile(file?: File) {
    if (!file || caricamento) return
    setCaricamento(true)
    try {
      if (file.size > 150 * 1024 * 1024) throw new Error('File oltre 150 MB')
      const contenuto = await apriArteCna(new Uint8Array(await file.arrayBuffer()))
      if (puoCambiare()) { setImportato(contenuto); setAperto(crypto.randomUUID()); setErrore('') }
    } catch (error) { setErrore(erroreQuaderno(error as Error)) }
    finally { setCaricamento(false) }
  }
  async function nuovo() {
    if (gestioneBusyRef.current || caricamento || !titolo.trim() || !puoCambiare()) return
    setCaricamento(true)
    setErrore('')
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Accedi per creare un progetto Quaderno')
      const { data, error } = await supabase.from('quaderno_progetti')
        .insert({ id: crypto.randomUUID(), user_id: auth.user.id, titolo: titolo.trim() })
        .select('id,titolo,updated_at').single()
      if (error) throw error
      setProgetti(correnti => [data, ...correnti])
      setImportato(undefined)
      setAperto(data.id)
      setTitolo('')
    } catch (error) { setErrore(erroreQuaderno(error as Error)) }
    finally { setCaricamento(false) }
  }

  async function gestisci(progetto: Progetto, azione: 'rinomina' | 'duplica' | 'elimina') {
    if (pendentiRef.current) { setErrore('Salva le modifiche del progetto aperto prima di usare le azioni archivio.'); return }
    if (gestioneBusyRef.current || caricamento || !puoCambiare()) return
    let nuovoTitolo: string | null = null
    if (azione === 'rinomina') {
      nuovoTitolo = window.prompt('Nuovo titolo del progetto', progetto.titolo)
      if (nuovoTitolo === null || !nuovoTitolo.trim()) return
    }
    if (azione === 'elimina' && !window.confirm('Eliminare definitivamente questo progetto e i relativi allegati? Le copie già richiamate nei sopralluoghi non verranno modificate.')) return
    gestioneBusyRef.current = true; setGestioneBusy(true); setErrore(''); setAperto(null); aggiornaStato(false, false)
    let erroreOperazione = ''
    try {
      if (azione === 'rinomina') await rpcQuaderno(supabase, 'quaderno_rinomina', { p_id: progetto.id, p_titolo: nuovoTitolo!.trim(), p_versione: progetto.updated_at })
      else if (azione === 'duplica') await duplicaProgetto(supabase, progetto.id)
      else await eliminaProgetto(supabase, progetto)
    } catch (error) { erroreOperazione = 'Operazione non confermata. Controlla le operazioni da riprendere. ' + erroreQuaderno(error as Error) }
    finally { gestioneBusyRef.current = false; setGestioneBusy(false); setRevisioneGestione(n => n + 1); await carica(); if (erroreOperazione) setErrore(erroreOperazione) }
  }

  if (selezione) return <section aria-label="Archivio Quaderno">
    <h4>Archivio Quaderno</h4>
    <button type="button" disabled={caricamento || selezione.disabled} onClick={() => void carica()}>Aggiorna archivio</button>
    {errore && <p role="alert">{errore}</p>}
    {caricamento && <p role="status">Caricamento archivio…</p>}
    {!caricamento && !errore && progetti.length === 0 && <p>Nessun progetto salvato.</p>}
    <ul>{progetti.map(p => <li key={p.id}>
      {p.titolo || 'Senza titolo'} — {p.updated_at}{' '}
      <button type="button" disabled={caricamento || selezione.disabled || !!p.gestione_id || selezione.collegati.includes(p.id)}
        onClick={() => selezione.onSeleziona(p)}>{selezione.collegati.includes(p.id) ? 'Collegato' : 'Collega'}</button>
    </li>)}</ul>
  </section>

  return <section aria-label="Quaderno autonomo" style={{ padding: 16 }}>
    <h2>Strumenti · Quaderno</h2>
    {onChiudi && <button type="button" onClick={() => { if (puoCambiare()) onChiudi() }}>Chiudi Quaderno e rileggi fonti</button>}
    <p>Progetti indipendenti dai sopralluoghi. Salva le modifiche con il pulsante Salva dell’editor.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input aria-label="Titolo nuovo progetto" placeholder="Titolo nuovo progetto" value={titolo}
        onChange={event => setTitolo(event.target.value)} />
      <button style={buttonPrimary} disabled={gestioneBusy || caricamento || !titolo.trim()} onClick={() => void nuovo()}>Nuovo progetto</button>
      <label style={buttonSecondary}>Apri da file<input aria-label="Apri Quaderno da file" type="file" accept=".artecna" disabled={caricamento} style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void apriFile(file) }} /></label>
      <button style={buttonSecondary} disabled={caricamento} onClick={() => void carica()}>Aggiorna archivio</button>
      <span role="status">{caricamento ? 'Caricamento…' : pendenti ? 'Modifiche pendenti' : ''}</span>
    </div>
    {errore && <p role="alert">{errore}</p>}
    {!caricamento && !errore && progetti.length === 0 && <p>Nessun progetto salvato.</p>}
    <ul aria-label="Progetti salvati">
      {progetti.map(progetto => <li key={progetto.id}>
        <strong>{progetto.titolo || 'Senza titolo'}</strong>{' · '}
        {new Date(progetto.updated_at).toLocaleString('it-IT')}{' '}
        <button style={buttonSecondary} disabled={gestioneBusy || !!progetto.gestione_id || aperto === progetto.id} onClick={() => {
          if (puoCambiare()) { setImportato(undefined); setAperto(progetto.id) }
        }}>Apri {progetto.titolo}</button>
        <details style={{ display: 'inline-block', marginLeft: 8 }}>
          <summary aria-label={'Azioni progetto ' + progetto.titolo}>⋯</summary>
          {(['rinomina', 'duplica', 'elimina'] as const).map(azione => <button key={azione} type="button" style={buttonSecondary}
            disabled={gestioneBusy || !!progetto.gestione_id} onClick={() => void gestisci(progetto, azione)}>{azione === 'rinomina' ? 'Rinomina' : azione === 'duplica' ? 'Duplica' : 'Elimina'}</button>)}
        </details>
        {progetto.gestione_id && <span role="status"> Operazione da riprendere</span>}
      </li>)}
    </ul>
    <GestioniQuadernoPendenti supabase={supabase} revisione={revisioneGestione} disabled={gestioneBusy || pendenti}
      onBusy={busy => { gestioneBusyRef.current = busy; setGestioneBusy(busy); if (busy) setAperto(null) }}
      onConclusa={() => { setRevisioneGestione(n => n + 1); void carica() }} />
    {aperto && <SopralluogoAppunti key={aperto} progettoQuadernoId={aperto} importazioneFile={importato}
      mostraAppuntiSopralluogo setMostraAppuntiSopralluogo={() => undefined} integrato
      supabase={supabase} buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
      onStatoProgettoChange={aggiornaStato}
      onProgettoSalvato={carica} />}
  </section>
}
