'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import QuadernoProgettiPanel from './QuadernoProgettiPanel'
import { leggiFontiCollegate, previewVariante, type FonteQuadernoCollegata } from '../engines/sopralluogo-memory/previewVariante'

type Props = {
  supabase: SupabaseClient
  cantiereId: string
  variante: { id: string; stato: 'bozza'; titolo: string | null; descrizione: string; preventivo_contrattuale_id: string | null }
}

async function leggiDaServer(supabase: SupabaseClient, id: string) {
  const r = await supabase.rpc('leggi_fonti_memory_variante', { p_variante_id: id })
  if (r.error) throw r.error
  return leggiFontiCollegate(r.data)
}

export default function VarianteFontiMemoryPanel({ supabase, cantiereId, variante }: Props) {
  const [fonti, setFonti] = useState<FonteQuadernoCollegata[] | null>(null)
  const [errore, setErrore] = useState('')
  const [busy, setBusy] = useState(false)
  const [archivio, setArchivio] = useState(false)
  const [aperto, setAperto] = useState<string | null>(null)
  const attivo = useRef(false)
  const richiesta = useRef(0)
  const scrittura = useRef(false)
  const carica = useCallback(() => {
    const token = ++richiesta.current
    return leggiDaServer(supabase, variante.id).then(lette => {
      if (attivo.current && token === richiesta.current) { setFonti(lette); setErrore('') }
    }).catch(() => {
      if (attivo.current && token === richiesta.current) { setFonti(null); setErrore('Fonti non disponibili. Aggiorna per verificarne lo stato.') }
    })
  }, [supabase, variante.id])
  useEffect(() => {
    attivo.current = true
    void carica()
    return () => { attivo.current = false }
  }, [carica])

  async function modifica(id: string, azione: 'collega' | 'scollega' | 'aggiorna', versione?: string) {
    if (scrittura.current || fonti === null) return
    scrittura.current = true; setBusy(true); setErrore('')
    try {
      const r = await supabase.rpc('modifica_fonte_memory_variante', {
        p_variante_id: variante.id, p_source_id: id, p_azione: azione, p_versione: versione ?? null,
      })
      if (r.error) throw r.error
      if (attivo.current) await carica()
    } catch (error) {
      if (attivo.current) {
        if (azione === 'collega' && error && typeof error === 'object' && 'code' in error && error.code === '23505') {
          setErrore('Questo Quaderno è già collegato alla Variante')
          return
        }
        setFonti(null)
        setErrore('Operazione non confermata. Aggiorna le fonti prima di riprovare; nessun tentativo automatico.')
      }
    } finally {
      scrittura.current = false
      if (attivo.current) setBusy(false)
    }
  }

  const preview = fonti && previewVariante(variante, cantiereId, variante.preventivo_contrattuale_id, fonti)
  return <section aria-label="Fonti del preventivo integrativo">
    <h3>Fonti del preventivo integrativo</h3>
    <h4>Contesto contrattuale</h4>
    <p>Preventivo contrattuale: {variante.preventivo_contrattuale_id || 'Non disponibile'}</p>
    <button type="button" disabled={busy || fonti === null || aperto !== null} aria-expanded={archivio} onClick={() => setArchivio(v => !v)}>+ Collega Quaderno</button>{' '}
    <button type="button" disabled={busy} onClick={() => void carica()}>Aggiorna fonti</button>
    {errore && <p role="alert">{errore}</p>}
    {fonti === null && !errore && <p role="status">Caricamento fonti…</p>}
    {archivio && <div aria-label="Selezione dall’Archivio Quaderno">
      <button type="button" onClick={() => setArchivio(false)}>Chiudi archivio</button>
      <QuadernoProgettiPanel supabase={supabase} attivo buttonPrimary={{}} buttonSecondary={{}}
        selezione={{ collegati: (fonti ?? []).map(f => f.id), disabled: busy || fonti === null,
          onSeleziona: p => void modifica(p.id, 'collega', p.updated_at) }} />
    </div>}
    <ul>{fonti?.map(f => <li key={f.id}>
      <strong>{f.titolo || 'Senza titolo'}</strong> — Ultima modifica: {f.updated_at}
      <p>{!f.disponibile ? 'Quaderno temporaneamente non disponibile' : f.aggiornato ? 'Aggiornato' : 'Quaderno modificato dopo il collegamento'}</p>
      <p>Versione collegata: {f.source_version}</p>
      <button type="button" disabled={busy || !f.disponibile || aperto !== null} onClick={() => { setArchivio(false); setAperto(f.id) }}>Apri</button>{' '}
      <button type="button" disabled={busy} onClick={() => void modifica(f.id, 'scollega')}>Scollega</button>{' '}
      {!f.aggiornato && <button type="button" disabled={busy || !f.disponibile}
        onClick={() => void modifica(f.id, 'aggiorna', f.updated_at)}>Aggiorna riferimento</button>}
    </li>)}</ul>
    {aperto && <div aria-label="Quaderno collegato">
      <QuadernoProgettiPanel key={aperto} supabase={supabase} attivo buttonPrimary={{}} buttonSecondary={{}} progettoInizialeId={aperto}
        onChiudi={() => { setAperto(null); void carica() }} />
    </div>}
    {preview && <section aria-label="Anteprima fonti AI">
      <h4>Anteprima fonti AI</h4>
      <p>Anteprima del testo per il futuro generatore. Nessuna richiesta AI viene eseguita.</p>
      <p>Si usa il contenuto salvato attuale dei Quaderni. Il riferimento conservato non consente di ricostruire versioni storiche.</p>
      {!variante.descrizione.trim() && fonti?.length === 0 && <p>Nessuna fonte narrativa disponibile.</p>}
      {fonti?.some(f => !f.disponibile) && <p role="status">Anteprima parziale: fonti temporaneamente non disponibili escluse.</p>}
      <ul>{preview.fonti.map((f, i) => <li key={i}>
        {f.origine} — {f.source_type === 'nota' ? f.titolo || 'Senza titolo' : 'Descrizione'} — ID: {f.source_id} — Versione: {f.source_version || 'Non disponibile'}
      </li>)}</ul>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.testoUnificato}</pre>
    </section>}
  </section>
}
