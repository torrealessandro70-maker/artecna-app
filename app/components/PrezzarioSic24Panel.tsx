'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { leggiPrezzarioSic24, type VocePrezzarioSic24 } from '../engines/price-import/prezzario-sic24'
import { formattaManodopera } from '../engines/price-import/manodopera'
import { aggiornaOverridePrezzario, caricaOverridePerOrigine, creaOverrideDaPrezzario, formPersonalizzazione, origineRegionaleValida, rimuoviOverridePrezzario, validaOriginePrezzario, type OverridePrezzario } from '../engines/price-import/override-prezzario'
import type { FormListino } from '../engines/price-import/listino-manuale'
import { evidenziaRicerca, portaRigaInVista, stileRighePrezzari } from '../utils/ricercaPrezzari'

const campi: [keyof FormListino, string][] = [['descrizione', 'Descrizione ARTECNA'], ['unita_misura', 'U.M. ARTECNA'],
  ['prezzo_unitario', 'Prezzo ARTECNA'], ['incidenza_manodopera', '% Manodopera ARTECNA'],
  ['prezzo_manodopera', 'Manodopera €/U.M. ARTECNA'], ['categoria', 'Categoria'], ['zona', 'Zona'], ['regione', 'Regione'], ['note', 'Note']]

export default function PrezzarioSic24Panel({ supabase }: { supabase: SupabaseClient }) {
  const [rows, setRows] = useState<VocePrezzarioSic24[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overrides, setOverrides] = useState<Record<string, OverridePrezzario>>({})
  const [overrideLoading, setOverrideLoading] = useState(true)
  const [overrideError, setOverrideError] = useState('')
  const [editor, setEditor] = useState<{ origine: VocePrezzarioSic24; voce?: OverridePrezzario; form: FormListino } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const currentRow = useRef<HTMLTableRowElement>(null)
  const contenitoreRighe = useRef<HTMLDivElement>(null)
  const operation = useRef(false)
  useEffect(() => {
    let active = true
    leggiPrezzarioSic24(supabase).then(data => { if (active) setRows(data) })
      .catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [supabase])
  const filtered = rows.filter(row => `${row.codice || ''} ${row.descrizione || ''}`.toLowerCase().includes(search.toLowerCase()))
  const activeIndex = search && filtered.length ? Math.max(0, filtered.findIndex(row => row.id === currentId)) : -1
  const activeId = activeIndex >= 0 ? filtered[activeIndex].id : null
  const pageCount = Math.max(1, Math.ceil(filtered.length / 30))
  const currentPage = activeIndex >= 0 ? Math.floor(activeIndex / 30) : Math.min(page, pageCount - 1)
  const naviga = (delta: number) => {
    if (activeIndex < 0) return
    const next = (activeIndex + delta + filtered.length) % filtered.length
    setCurrentId(filtered[next].id); setPage(Math.floor(next / 30))
  }
  const cambiaPagina = (next: number) => {
    setPage(next)
    if (search) setCurrentId(filtered[next * 30]?.id || null)
  }
  useEffect(() => {
    if (activeId) portaRigaInVista(contenitoreRighe.current, currentRow.current)
  }, [activeId, search, currentPage])
  const visible = filtered.slice(currentPage * 30, (currentPage + 1) * 30)
  const originIds = visible.map(row => row.id).join('|')
  useEffect(() => {
    let active = true
    setOverrideLoading(true); setOverrideError('')
    caricaOverridePerOrigine(supabase, originIds ? originIds.split('|') : []).then(data => { if (active) setOverrides(data) })
      .catch(e => { if (active) setOverrideError(e instanceof Error ? e.message : 'Personalizzazioni non disponibili.') })
      .finally(() => { if (active) setOverrideLoading(false) })
    return () => { active = false }
  }, [supabase, originIds])
  const apri = async (origine: VocePrezzarioSic24) => {
    if (operation.current) return
    operation.current = true; setBusy(true); setOverrideError(''); setMessage('')
    try {
      const official = await validaOriginePrezzario(supabase, origine)
      const voce = (await caricaOverridePerOrigine(supabase, [origine.id]))[origine.id]
      setEditor({ origine: official, voce, form: formPersonalizzazione(official, voce) })
    } catch (e) { setOverrideError(e instanceof Error ? e.message : 'Origine non verificabile.') }
    finally { operation.current = false; setBusy(false) }
  }
  return <section aria-label="Prezzario SIC24" style={{ padding: 18, background: '#fff', border: '1px solid #dbe3ee', borderRadius: 18, marginTop: 18 }}>
    <h2>PREZZARIO SIC24</h2>
    <p>Dati ufficiali in sola lettura. Le personalizzazioni ARTECNA restano separate.</p>
    <input aria-label="Ricerca prezzario SIC24" placeholder="Cerca descrizione o codice" value={search}
      onChange={e => { setSearch(e.target.value); setPage(0); setCurrentId(null) }} />{' '}
    <span role="status" aria-label="Risultati ricerca Prezzario SIC24" aria-live="polite">{search ? `${activeIndex + 1} / ${filtered.length}` : '—'}</span>{' '}
    <button type="button" aria-label="Risultato SIC24 precedente" disabled={activeIndex < 0} onClick={() => naviga(-1)}>↑</button>{' '}
    <button type="button" aria-label="Risultato SIC24 successivo" disabled={activeIndex < 0} onClick={() => naviga(1)}>↓</button>
    {loading && <p role="status">Caricamento prezzario SIC24...</p>}
    {error && <p role="alert">{error}</p>}
    {overrideError && <p role="alert">{overrideError}</p>}{message && <p role="status">{message}</p>}
    {!loading && !error && <>
      <p role="status">{filtered.length} voci</p>
      <div ref={contenitoreRighe} role="region" aria-label="Righe Prezzario SIC24" tabIndex={0} style={stileRighePrezzari}>
        <table>
          <thead><tr>{['Codice', 'Descrizione', 'U.M.', 'Prezzo unitario', '% Manodopera', 'Manodopera €/U.M.', 'Fonte', 'Anno', 'Versione', 'Personalizzazione ARTECNA'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{visible.map(row => <tr key={row.id} ref={row.id === activeId ? currentRow : undefined} style={row.id === activeId ? { background: '#eff6ff' } : undefined}>
            <td>{evidenziaRicerca(row.codice, search)}</td><td>{evidenziaRicerca(row.descrizione || '—', search)}</td><td>{row.unita_misura || '—'}</td>
            <td>{formattaManodopera(row.prezzo_unitario)}</td><td>{formattaManodopera(row.incidenza_manodopera)}</td>
            <td>{formattaManodopera(row.prezzo_manodopera)}</td><td>{row.fonte}</td><td>{row.anno ?? '—'}</td><td>{row.versione}</td>
            <td>{overrides[row.id] && <div aria-label={`Confronto ${row.codice}`}>
              <strong>UFFICIALE</strong>: {formattaManodopera(row.prezzo_unitario)} €/{row.unita_misura || '—'}<br />
              Manodopera: {formattaManodopera(row.incidenza_manodopera)}% / {formattaManodopera(row.prezzo_manodopera)} €/{row.unita_misura || '—'}<br />
              <strong>ARTECNA</strong>: {formattaManodopera(overrides[row.id].prezzo_unitario)} €/{overrides[row.id].unita_misura}<br />
              Manodopera: {formattaManodopera(overrides[row.id].incidenza_manodopera)}% / {formattaManodopera(overrides[row.id].prezzo_manodopera)} €/{overrides[row.id].unita_misura}
            </div>}
              {origineRegionaleValida(row) && <button type="button" disabled={busy || overrideLoading || !!editor} onClick={() => apri(row)}>
                {overrides[row.id] ? 'Modifica personalizzazione' : 'Personalizza per ARTECNA'}
              </button>}
              {overrides[row.id] && <button type="button" disabled={busy || overrideLoading || !!editor} onClick={async () => {
                if (operation.current || !window.confirm(`Rimuovere la personalizzazione ARTECNA di ${row.codice} (${row.versione})? La voce ufficiale non verrà modificata.`)) return
                operation.current = true; setBusy(true); setOverrideError(''); setMessage('')
                try {
                  await rimuoviOverridePrezzario(supabase, row, overrides[row.id])
                  setOverrides(current => { const next = { ...current }; delete next[row.id]; return next })
                  setMessage('Personalizzazione rimossa. Il dato ufficiale è invariato.')
                } catch (e) { setOverrideError(e instanceof Error ? e.message : 'Rimozione non riuscita.') }
                finally { operation.current = false; setBusy(false) }
              }}>Rimuovi personalizzazione</button>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {!filtered.length && <p>Nessuna voce SIC24 trovata.</p>}
      <div aria-label="Paginazione prezzario SIC24">
        <button type="button" disabled={currentPage === 0} onClick={() => cambiaPagina(currentPage - 1)}>Pagina precedente</button>{' '}
        <span>{filtered.length ? `${currentPage + 1} / ${pageCount}` : '0 / 0'}</span>{' '}
        <button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => cambiaPagina(currentPage + 1)}>Pagina successiva</button>
      </div>
    </>}
    {editor && <form aria-label="Personalizzazione ARTECNA" onSubmit={async e => {
      e.preventDefault()
      if (operation.current) return
      operation.current = true; setBusy(true); setOverrideError(''); setMessage('')
      try {
        const saved = editor.voce
          ? await aggiornaOverridePrezzario(supabase, editor.origine, editor.voce, editor.form)
          : await creaOverrideDaPrezzario(supabase, editor.origine, editor.form)
        setOverrides(current => ({ ...current, [editor.origine.id]: saved })); setEditor(null)
        setMessage('Personalizzazione ARTECNA salvata. Il dato ufficiale è invariato.')
      } catch (e) {
        setOverrideError(e instanceof Error ? e.message : 'Salvataggio non riuscito.')
        // Dopo un conflitto UNIQUE, ricaricare la stessa origine senza creare o aggiornare altre righe.
        try {
          const current = (await caricaOverridePerOrigine(supabase, [editor.origine.id]))[editor.origine.id]
          if (current) { setOverrides(rows => ({ ...rows, [editor.origine.id]: current })); setEditor(null) }
        } catch { /* Conservare l'errore originale; nessun retry di scrittura. */ }
      } finally { operation.current = false; setBusy(false) }
    }}>
      <h3>{editor.voce ? 'Modifica personalizzazione' : 'Personalizza per ARTECNA'}</h3>
      <p>Origine ufficiale: {editor.origine.codice} · {editor.origine.versione} · {editor.origine.id}</p>
      <p>UFFICIALE: {formattaManodopera(editor.origine.prezzo_unitario)} €/{editor.origine.unita_misura || '—'} · Manodopera: {formattaManodopera(editor.origine.incidenza_manodopera)}% / {formattaManodopera(editor.origine.prezzo_manodopera)} €/{editor.origine.unita_misura || '—'}</p>
      {campi.map(([key, label]) => <label key={key} style={{ display: 'block', marginTop: 8 }}>{label}{' '}
        <input aria-label={label} disabled={busy} value={editor.form[key] || ''}
          onChange={e => setEditor(current => current ? { ...current, form: { ...current.form, [key]: e.target.value } } : null)} />
      </label>)}
      <button type="submit" disabled={busy}>Salva personalizzazione</button>{' '}
      <button type="button" disabled={busy} onClick={() => { setEditor(null); setOverrideError('') }}>Annulla</button>
    </form>}
  </section>
}
