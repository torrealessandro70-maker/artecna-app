'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import VistaOperativa from './VistaOperativa'
import { leggiListinoManuale, type FormListino, type VoceListino } from '../engines/price-import/listino-manuale'
import { codiceNuovaVocePreventivo, confrontaPreventivoListino, haConflittoPreventivo, importaPreventivoListino, leggiPreventivoListino, type RigaPreventivoListino } from '../engines/price-import/preventivo-listino'

const campoStyle: CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: 10 }
const bottoneStyle: CSSProperties = { minHeight: 44, padding: '10px 14px', maxWidth: '100%', whiteSpace: 'normal' }
const labels: Record<keyof FormListino, string> = { codice: 'Codice', descrizione: 'Descrizione', unita_misura: 'U.M.', prezzo_unitario: 'Prezzo unitario €',
  categoria: 'Categoria', zona: 'Zona', regione: 'Regione', note: 'Note', incidenza_manodopera: '% Manodopera', prezzo_manodopera: 'Manodopera €/U.M.' }

export default function ImportaPreventivoExcelListinoPanel({ supabase, disabled, manodoperaDisponibile, onBusyChange, onSaved }: {
  supabase: SupabaseClient; disabled: boolean; manodoperaDisponibile: boolean
  onBusyChange: (busy: boolean) => void; onSaved: (count: number) => Promise<void>
}) {
  const [aperta, setAperta] = useState(false), [occupata, setOccupata] = useState(false)
  const lock = useRef(false), ritornoFocus = useRef<HTMLButtonElement>(null)
  const inputFile = useRef<HTMLInputElement>(null), dialogConferma = useRef<HTMLDialogElement>(null)
  const [confermaAperta, setConfermaAperta] = useState(false)
  const [righe, setRighe] = useState<RigaPreventivoListino[]>([]), [listino, setListino] = useState<VoceListino[]>([])
  const [nomeFile, setNomeFile] = useState(''), [avvisi, setAvvisi] = useState<string[]>([])
  const [selezionate, setSelezionate] = useState<string[]>([])
  const [decisioni, setDecisioni] = useState<Record<string, 'salta' | 'nuova'>>({})
  const [errore, setErrore] = useState(''), [messaggio, setMessaggio] = useState(''), [daRileggere, setDaRileggere] = useState(false)
  const proposte = confrontaPreventivoListino(righe, listino, manodoperaDisponibile)
  const importabile = (p: typeof proposte[number]) => !daRileggere && !p.errori.length && (!haConflittoPreventivo(p) || decisioni[p.riga.id] === 'nuova')
  const scelte = proposte.filter(p => selezionate.includes(p.riga.id) && importabile(p))
  const occupa = (value: boolean) => { lock.current = value; setOccupata(value); onBusyChange(value) }
  useEffect(() => {
    const dialog = dialogConferma.current
    if (!confermaAperta || !dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [confermaAperta])
  const resetFile = () => {
    if (lock.current) return
    if (inputFile.current) inputFile.current.value = ''
    setNomeFile(''); setRighe([]); setListino([]); setSelezionate([]); setDecisioni({})
    setAvvisi([]); setErrore(''); setMessaggio(''); setDaRileggere(false); setConfermaAperta(false)
  }
  const edita = (id: string, campo: keyof FormListino, value: string) => {
    setRighe(correnti => correnti.map(r => r.id === id ? { ...r, form: { ...r.form, [campo]: value } } : r))
    setSelezionate([]); setDecisioni({})
  }
  const rileggi = async () => {
    if (lock.current) return
    occupa(true); setErrore(''); setSelezionate([]); setDecisioni({})
    try {
      setListino(await leggiListinoManuale(supabase)); await onSaved(0)
      setDaRileggere(false)
      if (!righe.length) setAperta(false)
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Errore rilettura Listino.'); setDaRileggere(true) }
    finally { occupa(false) }
  }
  return <section aria-label="Importazione preventivo Excel" style={{ marginTop: 10 }}>
    <button ref={ritornoFocus} type="button" disabled={disabled} style={bottoneStyle} onClick={() => setAperta(true)}>Importa da preventivo Excel</button>
    {aperta && <VistaOperativa titolo="Importa voci da preventivo Excel" etichettaRitorno="← Torna al Listino ARTECNA"
      onChiudi={() => setAperta(false)} occupata={occupata} ritornoFocusRef={ritornoFocus}>
      <p>Seleziona personalmente le voci del preventivo che vuoi aggiungere. Caricamento, correzioni e selezione non scrivono nel Listino.</p>
      <label style={{ display: 'grid', gap: 8, minWidth: 0, marginBottom: 16 }}>Preventivo Excel (.xlsx / .xls)
        <input ref={inputFile} type="file" accept=".xlsx,.xls" aria-label="Preventivo Excel per Listino" disabled={occupata} style={campoStyle} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (!file || lock.current) return
          occupa(true); setErrore(''); setMessaggio(''); setSelezionate([]); setDecisioni({}); setDaRileggere(false); setRighe([]); setAvvisi([]); setNomeFile(file.name); setConfermaAperta(false)
          try {
            const parsed = await leggiPreventivoListino(file)
            const corrente = await leggiListinoManuale(supabase)
            setListino(corrente); setRighe(parsed.righe); setAvvisi(parsed.avvisi)
          } catch (e) { setErrore(e instanceof Error ? e.message : 'Errore lettura preventivo Excel.') }
          finally { occupa(false) }
        }} />
      </label>
      {!nomeFile && <p>Nessun file scelto</p>}
      {!righe.length && <button type="button" style={bottoneStyle} disabled={occupata || !nomeFile} onClick={resetFile}>Reset file</button>}
      {occupata && <p role="status">Operazione in corso…</p>}
      {errore && <p role="alert">{errore}</p>}{messaggio && <p role="status">{messaggio}</p>}
      {daRileggere && <button type="button" style={bottoneStyle} disabled={occupata} onClick={rileggi}>Rileggi Listino e confronta di nuovo</button>}
      {righe.length > 0 && <>
        <div role="region" aria-label="Azioni importazione Excel" style={{ position: 'sticky', top: 64, zIndex: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBlock: 16, padding: 12, border: '1px solid #cbd5e1', borderRadius: 12, background: '#fff', boxShadow: '0 2px 8px #0f172a18' }}>
          <button type="button" style={bottoneStyle} disabled={occupata} onClick={resetFile}>Reset file</button>
          <button type="button" style={bottoneStyle} disabled={occupata || daRileggere} onClick={() => setSelezionate(proposte.filter(importabile).map(p => p.riga.id))}>Seleziona tutto</button>
          <button type="button" style={bottoneStyle} disabled={occupata} onClick={() => setSelezionate([])}>Deseleziona tutto</button>
          <button type="button" style={{ ...bottoneStyle, background: '#1d4ed8', color: '#fff', border: 0 }} disabled={occupata || daRileggere || !scelte.length} onClick={() => {
            if (!lock.current && scelte.length && !daRileggere) setConfermaAperta(true)
          }}>Importa {scelte.length} voci selezionate</button>
        </div>
        {avvisi.length > 0 && <details><summary>Avvisi di lettura ({avvisi.length})</summary><ul>{avvisi.map((v, i) => <li key={i}>{v}</li>)}</ul></details>}
        <h3>Anteprima — {nomeFile}</h3>
        <p role="status" aria-live="polite">Voci lette: {righe.length} · Selezionate: {scelte.length} · Da completare: {proposte.filter(p => p.errori.length).length} · Possibili duplicati: {proposte.filter(haConflittoPreventivo).length}</p>
        <p>I conflitti non vengono aggiornati automaticamente. Puoi saltarli o aggiungere una nuova voce; per modificare una voce esistente usa Modifica nel Listino.</p>
        {!manodoperaDisponibile && <p>I valori manodopera del documento saranno conservati nelle Note: i relativi campi non sono disponibili nel Listino corrente.</p>}
        <div aria-label="Voci del preventivo Excel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 16, minWidth: 0 }}>
          {proposte.map(p => {
            const r = p.riga, id = r.id, conflitto = haConflittoPreventivo(p)
            const perCodici = [...scelte.filter(q => q.riga.id !== id).map(q => q.riga), r]
            const codice = codiceNuovaVocePreventivo(r, listino, perCodici)
            return <article key={id} aria-label={`${r.foglio} riga ${r.riga}`} style={{ minWidth: 0, padding: 16, border: '1px solid #cbd5e1', borderRadius: 12, overflowWrap: 'anywhere' }}>
              <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
                  <input type="checkbox" aria-label={`Importa ${r.foglio} riga ${r.riga}`} checked={selezionate.includes(id) && importabile(p)} disabled={occupata || !importabile(p)}
                    onChange={e => setSelezionate(ids => e.target.checked ? [...ids, id] : ids.filter(value => value !== id))} style={{ width: 22, height: 22 }} />Importa
                </label>
                <strong>{p.errori.length ? 'Da completare' : conflitto ? 'Possibile duplicato' : 'Pronta'}</strong>
              </header>
              <p>{r.foglio} · riga {r.riga}{r.quantita === undefined ? '' : ` · Quantità: ${r.quantita}`}</p>
              {p.errori.length > 0 && <ul>{p.errori.map(e => <li key={e}>{e}</li>)}</ul>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, minWidth: 0 }}>
                {(Object.keys(labels) as (keyof FormListino)[]).map(campo => <label key={campo} style={{ display: 'grid', gap: 6, minWidth: 0, gridColumn: campo === 'descrizione' || campo === 'note' ? '1 / -1' : undefined }}>
                  {labels[campo]}
                  {campo === 'descrizione' || campo === 'note'
                    ? <textarea aria-label={`${labels[campo]} ${r.foglio} riga ${r.riga}`} rows={campo === 'descrizione' ? 4 : 2} disabled={occupata} value={r.form[campo] ?? ''} style={campoStyle} onChange={e => edita(id, campo, e.target.value)} />
                    : <input aria-label={`${labels[campo]} ${r.foglio} riga ${r.riga}`} disabled={occupata} readOnly={(campo === 'prezzo_unitario' && r.prezzoDocumentale !== undefined) || (!manodoperaDisponibile && (campo === 'incidenza_manodopera' || campo === 'prezzo_manodopera'))}
                      inputMode={campo === 'prezzo_unitario' || campo === 'incidenza_manodopera' || campo === 'prezzo_manodopera' ? 'decimal' : undefined} value={r.form[campo] ?? ''} style={campoStyle} onChange={e => edita(id, campo, e.target.value)} />}
                </label>)}
              </div>
              <p>{r.prezzoDocumentale !== undefined ? 'Prezzo documentale conservato, senza ricalcolo.' : 'Prezzo da completare manualmente.'}</p>
              <p>{codice ? `Codice da conservare: ${codice}` : 'Nuovo codice ART_ generato dal writer Listino al salvataggio; codice originale conservato nelle Note.'}</p>
              {r.avvisi.map((v, i) => <p key={i}>{v}</p>)}
              {conflitto && <section aria-label={`Conflitti ${r.foglio} riga ${r.riga}`}>
                {p.matches.map(v => <p key={v.id}>Nel Listino: {v.codice} · {v.descrizione} · {v.unita_misura} · {v.prezzo_unitario} €</p>)}
                {p.duplicatiFile.length > 0 && <p>Possibile duplicato anche nel file: {righe.filter(v => p.duplicatiFile.includes(v.id)).map(v => `${v.foglio}, riga ${v.riga}`).join('; ')}.</p>}
                <label style={{ display: 'grid', gap: 6 }}>Gestione conflitto
                  <select aria-label={`Gestione conflitto ${r.foglio} riga ${r.riga}`} disabled={occupata} value={decisioni[id] || 'salta'} style={campoStyle} onChange={e => {
                    setDecisioni(s => ({ ...s, [id]: e.target.value as 'salta' | 'nuova' })); setSelezionate(ids => ids.filter(value => value !== id))
                  }}><option value="salta">Salta</option><option value="nuova">Aggiungi come nuova</option></select>
                </label>
              </section>}
              <details style={{ marginTop: 12 }}><summary>Testo originale della riga</summary><p style={{ whiteSpace: 'pre-wrap' }}>{r.testoOriginale}</p></details>
            </article>
          })}
        </div>
        {confermaAperta && <dialog ref={dialogConferma} aria-labelledby="conferma-importazione-excel" onCancel={e => { e.preventDefault(); if (!lock.current) setConfermaAperta(false) }}
          style={{ width: 'min(480px, calc(100% - 32px))', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', boxSizing: 'border-box', padding: 24, border: '1px solid #cbd5e1', borderRadius: 16 }}>
          <h3 id="conferma-importazione-excel">Conferma importazione</h3>
          <p>Stai per aggiungere {scelte.length} voci al Listino ARTECNA. Continuare?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="button" autoFocus disabled={occupata} style={bottoneStyle} onClick={() => setConfermaAperta(false)}>Annulla</button>
          <button type="button" style={bottoneStyle} disabled={occupata || daRileggere || !scelte.length} onClick={async () => {
          if (lock.current || !confermaAperta || daRileggere || !scelte.length) return
          occupa(true); setErrore(''); setMessaggio('')
          try {
            const risultato = await importaPreventivoListino(supabase, proposte, scelte.map(p => ({ id: p.riga.id, conflitto: decisioni[p.riga.id] || 'salta' })), nomeFile, manodoperaDisponibile, true)
            // Remove acknowledged rows before refreshing: a failed refresh must
            // never leave already inserted rows available for another click.
            setRighe(rows => rows.filter(r => !risultato.salvate.includes(r.id))); setSelezionate([]); setDecisioni({})
            setMessaggio(`${risultato.salvate.length} voci importate nel Listino ARTECNA`)
            if (risultato.errore) { setErrore(risultato.errore); setDaRileggere(true) }
            await onSaved(risultato.salvate.length)
            if (!risultato.errore) { setRighe([]); setAvvisi([]); setAperta(false) }
          } catch (e) {
            setErrore(e instanceof Error ? e.message : 'Errore importazione.'); setDaRileggere(true); setSelezionate([])
          } finally { setConfermaAperta(false); occupa(false) }
        }}>Conferma importazione</button>
          </div>
        </dialog>}
      </>}
    </VistaOperativa>}
  </section>
}
