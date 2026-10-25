'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FotoCantiereGallery from './FotoCantiereGallery'
import SopralluogoFotoGallery from './SopralluogoFotoGallery'
import FotoFullscreenModal from './FotoFullscreenModal'
import FotoPrivataDesktopV1 from './FotoPrivataDesktopV1'
import type { FotoCantiere } from '../types'
import { chiaveFoto, leggiFotoFonti, leggiOsservatore, type FotoFonte, type LetturaOsservatore } from '../engines/variante-fonti/contratto'

type Props = { supabase: SupabaseClient; varianteId: string; narrativaToken: string }
async function lettura(supabase: SupabaseClient, id: string) {
  const r = await supabase.rpc('leggi_osservatore_variante', { p_variante_id: id })
  if (r.error) throw r.error
  return leggiOsservatore(r.data, id)
}

export default function VarianteFontiVisivePanel({ supabase, varianteId, narrativaToken }: Props) {
  const [dati, setDati] = useState<LetturaOsservatore | null>(null)
  const [candidati, setCandidati] = useState<FotoFonte[] | null>(null)
  const [selettore, setSelettore] = useState(false)
  const [selezionateCantiere, setSelezionateCantiere] = useState<string[]>([])
  const [selezionateSopralluogo, setSelezionateSopralluogo] = useState<string[]>([])
  const [fullscreen, setFullscreen] = useState<FotoCantiere | null>(null)
  const [errore, setErrore] = useState('')
  const [busy, setBusy] = useState(false)
  const mounted = useRef(false), generation = useRef(0), writing = useRef(false)
  const carica = useCallback(() => {
    const token = ++generation.current
    return lettura(supabase, varianteId).then(value => {
      if (mounted.current && token === generation.current) { setDati(value); setErrore('') }
    }).catch(() => {
      if (mounted.current && token === generation.current) { setDati(null); setErrore('Fonti visive/analisi non disponibili. Aggiorna per verificare lo stato.') }
    })
  }, [supabase, varianteId])
  useEffect(() => {
    mounted.current = true
    void carica()
    return () => { mounted.current = false }
  }, [carica, narrativaToken])

  async function apriSelettore() {
    if (writing.current) return
    writing.current = true; setBusy(true); setErrore('')
    try {
      const r = await supabase.rpc('leggi_foto_fonti_variante', { p_variante_id: varianteId, p_collegate: false })
      if (r.error) throw r.error
      const foto = leggiFotoFonti(r.data)
      if (mounted.current) { setCandidati(foto); setSelettore(true); setSelezionateCantiere([]); setSelezionateSopralluogo([]) }
    } catch { if (mounted.current) setErrore('Foto non disponibili nel contesto della Variante.') }
    finally { writing.current = false; if (mounted.current) setBusy(false) }
  }
  async function modifica(fonti: FotoFonte[], azione: 'collega' | 'scollega') {
    if (writing.current || !fonti.length) return
    writing.current = true; setBusy(true); setErrore('')
    try {
      const r = await supabase.rpc('modifica_foto_fonti_variante', { p_variante_id: varianteId,
        p_fonti: fonti.map(f => ({ source_type: f.source_type, source_id: f.source_id })), p_azione: azione })
      if (r.error) throw r.error
      if (mounted.current) { setSelettore(false); setCandidati(null); await carica() }
    } catch (e) {
      if (mounted.current) setErrore(e && typeof e === 'object' && 'code' in e && e.code === '23505'
        ? 'Questa foto è già collegata alla Variante' : 'Collegamento non confermato. Aggiorna lo stato; nessun tentativo automatico.')
    } finally { writing.current = false; if (mounted.current) setBusy(false) }
  }
  async function analizza() {
    if (writing.current || !dati) return
    writing.current = true; setBusy(true); setErrore('')
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) throw Error('Accesso richiesto')
      const response = await fetch('/api/varianti/osservatore', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ variante_id: varianteId, richiesta_id: crypto.randomUUID() }) })
      if (!response.ok) {
        const r: unknown = await response.json()
        const message = r && typeof r === 'object' && 'error' in r && typeof r.error === 'string' ? r.error : 'Analisi non confermata'
        throw Error(message)
      }
      const next = leggiOsservatore(await response.json(), varianteId)
      if (mounted.current) setDati(next)
    } catch (error) { if (mounted.current) setErrore(`${error instanceof Error ? error.message : 'Analisi non confermata'}. Rileggi lo stato prima di decidere se rianalizzare; nessun retry automatico.`) }
    finally { writing.current = false; if (mounted.current) setBusy(false) }
  }
  const foto = dati?.fonti.foto ?? []
  const scelte = (candidati ?? []).filter(f => f.source_type === 'foto_cantiere' ? selezionateCantiere.includes(f.source_id) : selezionateSopralluogo.includes(f.source_id))
  const disponibili = (candidati ?? []).filter(f => !f.collegata)
  const sopralluoghi = [...new Set(disponibili.filter(f => f.source_type === 'foto_sopralluogo').map(f => f.sopralluogo_id!))].sort()
  const risultato = dati?.analisi
  return <section aria-label="Fonti visive e AI Osservatore Variante">
    <h4>Fonti visive</h4>
    <p>{foto.length} foto collegate. Le immagini restano separate dal testo narrativo.</p>
    <p>L’Osservatore legge JPEG, PNG e WebP fino a 4 MB per foto: dati inline, Storage pubblico esistente e foto private Rapportino tramite il lettore autorizzato. Una foto non leggibile blocca l’analisi, senza escluderla silenziosamente.</p>
    <p>Versione foto non disponibile: l’impronta del record rileva modifiche ai metadati o ai dati inline. Sostituzioni dei byte allo stesso URL senza aggiornare il record non sono rilevabili automaticamente.</p>
    <button type="button" disabled={busy} onClick={() => void apriSelettore()}>+ Collega foto</button>{' '}
    <button type="button" disabled={busy} onClick={() => void carica()}>Aggiorna fonti visive e analisi</button>
    {errore && <p role="alert">{errore}</p>}
    {!dati && !errore && <p role="status">Caricamento fonti visive…</p>}
    {selettore && <section aria-label="Seleziona dalla Galleria esistente">
      <h5>Foto disponibili nel contesto</h5>
      <p>Selezione multipla, massimo otto foto collegate (limite dell’Osservatore esistente). Nessuna copia o upload.</p>
      <FotoCantiereGallery selezioneFonti contestuale supabase={supabase} cantiereScheda={dati?.fonti.cantiere_id ?? ''}
        fotoCantiere={disponibili.filter(f => f.source_type === 'foto_cantiere').map(f => ({ ...f.foto, cantiere: dati?.fonti.cantiere_id ?? '' }))}
        setFotoCantiere={() => {}} filtroFotoCantiere="tutte" fotoCantiereSelezionate={selezionateCantiere}
        setFotoCantiereSelezionate={setSelezionateCantiere} setFotoFullscreen={setFullscreen} fotoStorageBucket="preventivi"
        caricaFotoCantiere={() => {}} eliminaFotoCantiere={() => {}} buttonSecondary={{}} />
      {sopralluoghi.map(id => <div key={id}><h6>Sopralluogo {id}</h6>
        <SopralluogoFotoGallery selezioneFonti sopralluogoAperto={{ id }}
          fotoSopralluoghi={disponibili.filter(f => f.source_type === 'foto_sopralluogo').map(f => ({ ...f.foto, sopralluogo_id: f.sopralluogo_id!, tag: f.foto.tag ?? undefined }))}
          setFotoSopralluoghi={() => {}} modalitaGestione fotoSelezionate={selezionateSopralluogo}
          setFotoSelezionate={setSelezionateSopralluogo} setFotoFullscreen={setFullscreen} caricaFotoSopralluoghi={() => {}} supabase={supabase} />
      </div>)}
      {disponibili.length === 0 && <p>Nessuna altra foto accessibile nel contesto.</p>}
      <button type="button" disabled={busy || scelte.length === 0 || scelte.length + foto.length > 8} onClick={() => void modifica(scelte, 'collega')}>Collega selezionate ({scelte.length})</button>{' '}
      <button type="button" disabled={busy} onClick={() => setSelettore(false)}>Chiudi selezione foto</button>
    </section>}
    <ul>{foto.map((f, i) => <li key={chiaveFoto(f)}>
      <strong>Foto {i + 1} — {f.origine}</strong> — {f.foto.data_foto || f.foto.created_at || 'Data non disponibile'}
      {f.foto.allegato_v1_id ? <FotoPrivataDesktopV1 allegato={f.foto.allegato_v1_id} rapportino={f.foto.rapportino_id ?? undefined} foto={f.source_id} style={{ width: 120, height: 90, objectFit: 'contain' }} />
        // Existing Gallery/Fullscreen use the same physical resource; not copied.
        // eslint-disable-next-line @next/next/no-img-element
        : (f.foto.file_url || f.foto.immagine_base64) ? <img src={f.foto.file_url || f.foto.immagine_base64} alt={f.foto.nota || `Foto ${i + 1}`} style={{ width: 120, height: 90, objectFit: 'contain' }} /> : <p>Risorsa foto non disponibile</p>}
      <p>{f.foto.nota || 'Nessuna descrizione'}</p>
      <p style={{ overflowWrap: 'anywhere' }}>{f.disponibile ? 'Collegata' : 'Foto non più accessibile: riferimento da scollegare'} — ID {f.source_id} — versione non disponibile — impronta {f.impronta}</p>
      <button type="button" disabled={!f.disponibile || (!f.foto.allegato_v1_id && !f.foto.file_url && !f.foto.immagine_base64)} onClick={() => setFullscreen(f.foto)}>Apri foto {i + 1}</button>{' '}
      <button type="button" disabled={busy} onClick={() => void modifica([f], 'scollega')}>Scollega foto {i + 1}</button>
    </li>)}</ul>
    <FotoFullscreenModal fotoFullscreen={fullscreen} setFotoFullscreen={setFullscreen} />
    <section aria-label="Risultato AI Osservatore Variante">
      <h4>AI Osservatore</h4>
      <p>Invia soltanto Memory narrativa e foto collegate al motore esistente. L’analisi è un risultato della Variante, non una nuova fonte narrativa.</p>
      <button type="button" disabled={busy || !dati || foto.some(f => !f.disponibile)} onClick={() => void analizza()}>{risultato ? 'Rianalizza' : 'Analizza fonti con AI Osservatore'}</button>
      {busy && <p role="status">Operazione in corso…</p>}
      {risultato && <div>
        <p>{risultato.allineata ? 'Analisi allineata alle fonti verificate' : 'Analisi non più allineata alle fonti'}</p>
        <p>Analisi {risultato.id} — {risultato.data} — modello {risultato.modello}</p>
        <details><summary>Fonti utilizzate da questa analisi</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(risultato.fonti, null, 2)}</pre></details>
        <p>{risultato.risultato.sintesi}</p>
        {(['ipotesi', 'verifiche', 'domande'] as const).map(k => <div key={k}><h5>{k}</h5><ul>{risultato.risultato[k].map((t, i) => <li key={i}>{t}</li>)}</ul></div>)}
        <p>{risultato.risultato.avvertenza}</p>
      </div>}
    </section>
  </section>
}
