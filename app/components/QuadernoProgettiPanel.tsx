'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { apriArteCna, type QuadernoFile } from '../engines/quaderno/fileNativo'
import SopralluogoAppunti from './SopralluogoAppunti'
import { erroreQuaderno } from '../engines/quaderno/persistenza'

type Progetto = { id: string; titolo: string; updated_at: string }
type Props = { supabase: SupabaseClient; attivo: boolean; buttonPrimary: CSSProperties; buttonSecondary: CSSProperties }

export default function QuadernoProgettiPanel({ supabase, attivo, buttonPrimary, buttonSecondary }: Props) {
  const [importato, setImportato] = useState<QuadernoFile | undefined>()
  const [progetti, setProgetti] = useState<Progetto[]>([])
  const [aperto, setAperto] = useState<string | null>(null)
  const [titolo, setTitolo] = useState('')
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [pendenti, setPendenti] = useState(false)
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
        .select('id,titolo,updated_at').eq('user_id', auth.user.id).order('updated_at', { ascending: false })
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
    if (salvataggioRef.current || (!daFile && fileOccupatoRef.current)) return false
    return !pendentiRef.current || window.confirm('Ci sono modifiche non salvate. Abbandonarle e aprire un altro progetto?')
  }

  useEffect(() => {
    const apri = (event: Event) => {
      const contenuto = (event as CustomEvent<QuadernoFile>).detail
      if (!puoCambiare(true)) { event.preventDefault(); return }
      setImportato(contenuto); setAperto(crypto.randomUUID()); setErrore('')
    }
    window.addEventListener('artecna-quaderno-file', apri)
    return () => window.removeEventListener('artecna-quaderno-file', apri)
  }, [])
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
    if (caricamento || !titolo.trim() || !puoCambiare()) return
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

  return <section aria-label="Quaderno autonomo" style={{ padding: 16 }}>
    <h2>Strumenti · Quaderno</h2>
    <p>Progetti indipendenti dai sopralluoghi. Salva le modifiche con il pulsante Salva dell’editor.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input aria-label="Titolo nuovo progetto" placeholder="Titolo nuovo progetto" value={titolo}
        onChange={event => setTitolo(event.target.value)} />
      <button style={buttonPrimary} disabled={caricamento || !titolo.trim()} onClick={() => void nuovo()}>Nuovo progetto</button>
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
        <button style={buttonSecondary} disabled={aperto === progetto.id} onClick={() => {
          if (puoCambiare()) { setImportato(undefined); setAperto(progetto.id) }
        }}>Apri {progetto.titolo}</button>
      </li>)}
    </ul>
    {aperto && <SopralluogoAppunti key={aperto} progettoQuadernoId={aperto} importazioneFile={importato}
      mostraAppuntiSopralluogo setMostraAppuntiSopralluogo={() => undefined} integrato
      supabase={supabase} buttonPrimary={buttonPrimary} buttonSecondary={buttonSecondary}
      onStatoProgettoChange={aggiornaStato}
      onProgettoSalvato={carica} />}
  </section>
}
