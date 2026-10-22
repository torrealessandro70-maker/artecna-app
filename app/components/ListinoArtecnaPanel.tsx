'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { leggiListinoManuale, salvaVoceListino, eliminaVoceListinoArtecna, type FormListino, type VoceListino } from '../engines/price-import/listino-manuale'
import { analizzaStoricoListino, applicaProposteStorico, type PropostaStorico } from '../engines/price-import/storico-listino'
import ImportaFileArtecnaPanel from './ImportaFileArtecnaPanel'
import { formattaManodopera, leggiSupportoManodopera } from '../engines/price-import/manodopera'
import { evidenziaRicerca, portaRigaInVista, stileRighePrezzari } from '../utils/ricercaPrezzari'

const nuovoForm = (): FormListino => ({ codice: '', descrizione: '', unita_misura: '', prezzo_unitario: '', categoria: '', zona: 'Catania', regione: '', note: '', incidenza_manodopera: '', prezzo_manodopera: '' })
const labels: Record<keyof FormListino, string> = { codice: 'Codice', descrizione: 'Descrizione', unita_misura: 'U.M.', prezzo_unitario: 'Prezzo unitario (€)', incidenza_manodopera: '% Manodopera', prezzo_manodopera: 'Manodopera €/U.M.', categoria: 'Categoria', zona: 'Zona', regione: 'Regione', note: 'Note' }
export default function ListinoArtecnaPanel({ supabase, onSaved }: { supabase: SupabaseClient; onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState<VoceListino[]>([])
  const [search, setSearch] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const currentRow = useRef<HTMLTableRowElement>(null)
  const contenitoreRighe = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<FormListino | null>(null)
  const [editing, setEditing] = useState<VoceListino>()
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [proposte, setProposte] = useState<PropostaStorico[] | null>(null)
  const [selezionate, setSelezionate] = useState<string[]>([])
  const [manodoperaDisponibile, setManodoperaDisponibile] = useState(false)
  const operazioneStorico = useRef(false)
  const euro = (value: number) => value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  useEffect(() => {
    let active = true
    leggiListinoManuale(supabase).then(data => { if (active) setRows(data) })
      .catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    leggiSupportoManodopera(supabase).then(value => { if (active) setManodoperaDisponibile(value) })
      .catch(() => { if (active) setManodoperaDisponibile(false) })
    return () => { active = false }
  }, [supabase])
  const filtered = rows.filter(row => `${row.codice || ''} ${row.descrizione || ''}`.toLowerCase().includes(search.toLowerCase()))
  const activeIndex = search && filtered.length ? Math.max(0, filtered.findIndex(row => row.id === currentId)) : -1
  const activeId = activeIndex >= 0 ? filtered[activeIndex].id : null
  const naviga = (delta: number) => {
    if (activeIndex < 0) return
    setCurrentId(filtered[(activeIndex + delta + filtered.length) % filtered.length].id)
  }
  useEffect(() => {
    if (activeId) portaRigaInVista(contenitoreRighe.current, currentRow.current)
  }, [activeId, search])
  return <section style={{ padding: 18, background: '#fff', border: '1px solid #dbe3ee', borderRadius: 18, marginTop: 18 }}>
    <h2>LISTINO ARTECNA</h2>
    <input aria-label="Ricerca listino ARTECNA" placeholder="Cerca descrizione o codice" value={search} onChange={e => { setSearch(e.target.value); setCurrentId(null) }} />{' '}
    <span role="status" aria-label="Risultati ricerca Listino ARTECNA" aria-live="polite">{search ? `${activeIndex + 1} / ${filtered.length}` : '—'}</span>{' '}
    <button type="button" aria-label="Risultato precedente" disabled={activeIndex < 0} onClick={() => naviga(-1)}>↑</button>{' '}
    <button type="button" aria-label="Risultato successivo" disabled={activeIndex < 0} onClick={() => naviga(1)}>↓</button>{' '}
    <button disabled={busy || loading} onClick={() => { setEditing(undefined); setForm(nuovoForm()); setError(''); setMessage('') }}>Nuova voce</button>
    {' '}<button disabled={busy || loading || !!form} onClick={async () => {
      if (operazioneStorico.current) return
      operazioneStorico.current = true; setBusy(true); setError(''); setMessage(''); setProposte(null); setSelezionate([])
      try { setProposte(await analizzaStoricoListino(supabase)) }
      catch (e) { setError(e instanceof Error ? e.message : 'Storico non verificabile.') }
      finally { operazioneStorico.current = false; setBusy(false) }
    }}>Aggiorna da storico ARTECNA</button>
    <ImportaFileArtecnaPanel supabase={supabase} disabled={busy || loading || !!form} onBusyChange={setBusy} onSaved={async () => {
      setRows(await leggiListinoManuale(supabase)); setProposte(null); setSelezionate([]); await onSaved()
    }} />
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {loading ? <p>Caricamento listino...</p> : <div ref={contenitoreRighe} role="region" aria-label="Righe Listino ARTECNA" tabIndex={0} style={stileRighePrezzari}><table style={{ width: '100%', textAlign: 'left' }}>
      <thead><tr>{['Codice', 'Descrizione', 'U.M.', 'Prezzo unitario', '% Manodopera', 'Manodopera €/U.M.', 'Categoria', 'Zona', 'Regione', 'Aggiornato il', 'Azioni'].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{filtered.map(row => <tr key={row.id} ref={row.id === activeId ? currentRow : undefined} style={row.id === activeId ? { background: '#eff6ff' } : undefined}>
        <td>{evidenziaRicerca(row.codice, search)}</td><td>{evidenziaRicerca(row.descrizione, search)}</td><td>{row.unita_misura}</td><td>{Number(row.prezzo_unitario).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</td>
        <td>{formattaManodopera(row.incidenza_manodopera)}</td><td>{formattaManodopera(row.prezzo_manodopera)}</td>
        <td>{row.categoria}</td><td>{row.zona}</td><td>{row.regione}</td><td>{row.updated_at ? new Date(row.updated_at).toLocaleString('it-IT') : '—'}</td>
        <td><button disabled={busy || row.tipo_prezzo !== 'artecna'} onClick={() => {
          setEditing(row); setError(''); setMessage(''); setForm({ codice: row.codice || '', descrizione: row.descrizione || '', unita_misura: row.unita_misura || '', prezzo_unitario: String(row.prezzo_unitario), categoria: row.categoria || '', zona: row.zona || '', regione: row.regione || '', note: row.note || '', incidenza_manodopera: row.incidenza_manodopera == null ? '' : String(row.incidenza_manodopera), prezzo_manodopera: row.prezzo_manodopera == null ? '' : String(row.prezzo_manodopera) })
        }}>Modifica</button>{row.tipo_prezzo === 'artecna' && <>{' '}<button type="button" disabled={busy || !!form} onClick={async () => {
          if (busy || operazioneStorico.current) return
          if (!window.confirm(`Eliminare definitivamente questa voce dal Listino ARTECNA?\n\nCodice: ${row.codice || '—'}\nDescrizione: ${row.descrizione}\nU.M.: ${row.unita_misura}\nPrezzo: ${euro(Number(row.prezzo_unitario))}\n\nL’eventuale voce del prezzario SIC24 originale non verrà modificata.`)) return
          operazioneStorico.current = true; setBusy(true); setError(''); setMessage('')
          try {
            await eliminaVoceListinoArtecna(supabase, row)
            setRows(correnti => correnti.filter(voce => voce.id !== row.id))
            setProposte(null); setSelezionate([])
            setMessage('Voce eliminata dal Listino ARTECNA.')
            await onSaved()
          } catch (e) { setError(e instanceof Error ? e.message : 'Errore eliminazione listino.') }
          finally { operazioneStorico.current = false; setBusy(false) }
        }}>Elimina</button></>}</td>
      </tr>)}</tbody>
    </table>{!filtered.length && <p>Nessuna voce trovata.</p>}</div>}
    {proposte && <section aria-label="Proposte da storico ARTECNA" style={{ marginTop: 18 }}>
      <h3>Proposte da storico ARTECNA</h3>
      <p>Nessuna modifica automatica. Prezzo proposto: mediana dei prezzi aziendali, senza maggiorazione.</p>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
        <thead><tr>{['Seleziona', 'Stato', 'Descrizione', 'U.M.', 'Prezzo attuale → proposto', 'Rilevazioni', 'Min', 'Max', 'Media', 'Mediana', 'Origine'].map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{proposte.map(p => <tr key={p.id}>
          <td><input type="checkbox" aria-label={`Seleziona ${p.descrizione}`} disabled={busy || !!form || !!p.blocco || p.stato === 'INVARIATA'} checked={selezionate.includes(p.id)} onChange={e => setSelezionate(e.target.checked ? [...selezionate, p.id] : selezionate.filter(id => id !== p.id))} /></td>
          <td>{p.stato}{p.blocco && <p>{p.blocco}</p>}</td><td>{p.descrizione}</td><td>{p.unita}</td>
          <td>{p.attuale ? euro(Number(p.attuale.prezzo_unitario)) : 'Nessun prezzo attuale'} → {euro(p.mediana)}</td>
          <td>{p.rilevazioni.length}{p.rilevazioni.length === 1 && <span style={{ marginLeft: 6, padding: '2px 6px', borderRadius: 6, background: '#f1f5f9', color: '#475569', fontSize: 12 }}>1 solo riferimento</span>}</td><td>{euro(p.minimo)}</td><td>{euro(p.massimo)}</td><td>{euro(p.media)}</td><td>{euro(p.mediana)}</td>
          <td>{p.rilevazioni.map(r => <div key={r.id}>Preventivo {r.preventivoId} · riga {r.id}{r.cantiere ? ` · ${r.cantiere}` : ''}{r.data ? ` · ${r.data}` : ''} · {r.fonte}</div>)}</td>
        </tr>)}</tbody>
      </table></div>
      {!proposte.length && <p>Nessuna voce storica affidabile disponibile.</p>}
      <button disabled={busy || !!form} onClick={() => setSelezionate(proposte.filter(p => !p.blocco && (p.stato === 'NUOVA' || p.stato === 'AGGIORNAMENTO')).map(p => p.id))}>Seleziona tutto</button>
      {' '}<button disabled={busy || !!form} onClick={() => setSelezionate([])}>Deseleziona tutto</button>{' '}
      <button disabled={busy || !!form || !selezionate.length} onClick={async () => {
        if (operazioneStorico.current) return
        const scelte = proposte.filter(p => selezionate.includes(p.id))
        if (!window.confirm(`Stai per aggiungere ${scelte.filter(p => p.stato === 'NUOVA').length} nuove voci e aggiornare ${scelte.filter(p => p.stato === 'AGGIORNAMENTO').length} voci del Listino ARTECNA. Procedere?`)) return
        operazioneStorico.current = true; setBusy(true); setError(''); setMessage('')
        try {
          const count = await applicaProposteStorico(supabase, proposte, selezionate, true)
          setMessage(`${count} voci applicate al Listino ARTECNA.`)
        } catch (e) { setError(e instanceof Error ? e.message : 'Errore applicazione proposte.') }
        finally {
          setProposte(null); setSelezionate([])
          try { setRows(await leggiListinoManuale(supabase)); await onSaved() }
          catch (e) { setError(e instanceof Error ? e.message : 'Errore rilettura Listino.') }
          operazioneStorico.current = false; setBusy(false)
        }
      }}>Applica selezionate</button>
    </section>}
    {form && <form onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('')
      try {
        await salvaVoceListino(supabase, form, editing, manodoperaDisponibile)
        setForm(null); setEditing(undefined); setMessage('Voce salvata.')
        setRows(await leggiListinoManuale(supabase)); await onSaved()
      } catch (e) { setError(e instanceof Error ? e.message : 'Errore salvataggio listino.') }
      finally { setBusy(false) }
    }} style={{ display: 'grid', gap: 10, marginTop: 18 }}>
      <h3>{editing ? 'Modifica voce' : 'Nuova voce'}</h3>
      {!manodoperaDisponibile && <p>I campi manodopera saranno disponibili dopo la migration. Gli altri campi restano salvabili.</p>}
      {(Object.keys(labels) as (keyof FormListino)[]).map(key => <label key={key}>{labels[key]}{' '}
        {key === 'descrizione' || key === 'note' ? <textarea disabled={busy} required={key === 'descrizione'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /> :
          <input disabled={busy || (!manodoperaDisponibile && (key === 'incidenza_manodopera' || key === 'prezzo_manodopera'))} required={key === 'unita_misura' || key === 'prezzo_unitario'} inputMode={key === 'prezzo_unitario' || key === 'incidenza_manodopera' || key === 'prezzo_manodopera' ? 'decimal' : undefined} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />}
      </label>)}
      <div><button disabled={busy} type="submit">{busy ? 'Salvataggio...' : 'Salva voce'}</button>{' '}<button disabled={busy} type="button" onClick={() => { setForm(null); setEditing(undefined) }}>Annulla</button></div>
    </form>}
  </section>
}
