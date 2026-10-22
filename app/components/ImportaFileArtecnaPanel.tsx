'use client'
import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { leggiFileArtecna, confrontaFileListino, applicaFileListino, fileApplicabile, decidiDuplicatoFile, modificaAnteprimaFile, type CampoFileArtecna, type RigaFileArtecna, type PropostaFileArtecna } from '../engines/price-import/file-listino'
import { leggiListinoManuale, type VoceListino } from '../engines/price-import/listino-manuale'

export default function ImportaFileArtecnaPanel({ supabase, disabled, onBusyChange, onSaved }: {
  supabase: SupabaseClient; disabled: boolean; onBusyChange: (busy: boolean) => void; onSaved: () => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null), lock = useRef(false)
  const listino = useRef<VoceListino[]>([]), originali = useRef<RigaFileArtecna[]>([])
  const [bozze, setBozze] = useState<Record<string, Partial<Record<CampoFileArtecna, string>>>>({})
  const [proposte, setProposte] = useState<PropostaFileArtecna[] | null>(null)
  const [selected, setSelected] = useState<string[]>([]), [fileName, setFileName] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('')
  const euro = (value?: number | null) => value == null ? '—' : value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  const scegli = (p: PropostaFileArtecna, decisione?: PropostaFileArtecna['decisione']) => {
    setProposte(correnti => correnti?.map(q => q.riga.id === p.riga.id ? decidiDuplicatoFile(q, decisione) : q) ?? null)
    setSelected(correnti => correnti.filter(id => id !== p.riga.id))
  }
  const edita = (p: PropostaFileArtecna, campo: CampoFileArtecna, value: string) => {
    setBozze(correnti => ({ ...correnti, [p.riga.id]: { ...correnti[p.riga.id], [campo]: value } }))
    setProposte(correnti => correnti ? modificaAnteprimaFile(correnti, p.riga.id, { [campo]: value }, listino.current) : null)
    setSelected([])
  }
  const ripristina = (p: PropostaFileArtecna) => {
    setProposte(correnti => correnti ? modificaAnteprimaFile(correnti, p.riga.id, {}, listino.current, originali.current.find(r => r.id === p.riga.id)) : null)
    setBozze(correnti => { const next = { ...correnti }; delete next[p.riga.id]; return next })
    setSelected([])
  }
  const campoEditabile = (p: PropostaFileArtecna, campo: CampoFileArtecna, label: string, ampio = false) => {
    const value = bozze[p.riga.id]?.[campo] ?? String(p.riga[campo] ?? '')
    const props = { 'aria-label': `${label} ${p.riga.foglio} riga ${p.riga.riga}`, disabled, value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => edita(p, campo, e.target.value) }
    return ampio ? <textarea {...props} rows={3} style={{ minWidth: 260 }} /> :
      <input {...props} type={campo === 'prezzo' ? 'number' : 'text'} step={campo === 'prezzo' ? 'any' : undefined} style={{ width: campo === 'unita' ? 65 : 130 }} />
  }
  return <section aria-label="Importazione file ARTECNA" style={{ marginTop: 12 }}>
    <button type="button" disabled={disabled} onClick={() => input.current?.click()}>Importa file ARTECNA</button>
    <input ref={input} type="file" accept=".xlsx,.xls,.csv" aria-label="File prezzi ARTECNA" disabled={disabled} style={{ display: 'none' }} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file || lock.current) return
      lock.current = true; onBusyChange(true); setError(''); setMessage(''); setProposte(null); setSelected([]); setBozze({}); setFileName(file.name)
      try {
        const righe = leggiFileArtecna(file.name, await file.arrayBuffer())
        listino.current = await leggiListinoManuale(supabase); originali.current = righe
        setProposte(confrontaFileListino(righe, listino.current))
      }
      catch (e) { setError(e instanceof Error ? e.message : 'Errore analisi file.') }
      finally { lock.current = false; onBusyChange(false) }
    }} />
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {proposte && <>
      <h3>Anteprima file ARTECNA — {fileName}</h3>
      <p>Nessuna scrittura automatica. Duplicati e righe ambigue restano bloccati.</p>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
        <thead><tr>{['Seleziona', 'Stato', 'Codice', 'Descrizione', 'U.M.', 'Prezzo', 'Categoria', 'Zona', 'Regione', 'Note', 'Prezzo Listino attuale', 'Match Listino', 'Confidence', 'Diagnostica', 'Azioni'].map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{proposte.map(p => <tr key={p.riga.id}>
          <td><input type="checkbox" aria-label={`Seleziona file ${p.riga.foglio} riga ${p.riga.riga}`} disabled={disabled || !fileApplicabile(p)} checked={selected.includes(p.riga.id)} onChange={e => setSelected(e.target.checked ? [...selected, p.riga.id] : selected.filter(id => id !== p.riga.id))} /></td>
          <td>{p.stato}</td><td>{campoEditabile(p, 'codice', 'Codice')}</td><td>{campoEditabile(p, 'descrizione', 'Descrizione', true)}<div>{p.riga.foglio} · riga {p.riga.riga}</div></td><td>{campoEditabile(p, 'unita', 'U.M.')}</td><td>{campoEditabile(p, 'prezzo', 'Prezzo')}</td>
          <td>{campoEditabile(p, 'categoria', 'Categoria')}</td><td>{campoEditabile(p, 'zona', 'Zona')}</td><td>{campoEditabile(p, 'regione', 'Regione')}</td><td>{campoEditabile(p, 'note', 'Note', true)}</td>
          <td>{p.matches.length ? p.matches.map(r => <div key={r.id}>{euro(Number(r.prezzo_unitario))}</div>) : '—'}</td>
          <td>{p.matches.map(r => <div key={r.id}>{p.stato === 'POSSIBILE DUPLICATO' && <>Possibile corrispondenza: </>}{r.codice} · {r.descrizione} · {r.unita_misura} · {euro(Number(r.prezzo_unitario))}
            {(p.stato === 'POSSIBILE DUPLICATO' || p.decisione) && <button type="button" aria-pressed={p.decisione?.tipo === 'esistente' && p.decisione.id === r.id} disabled={disabled || r.tipo_prezzo !== 'artecna' || /^SIC24/i.test(r.codice || '')} onClick={() => scegli(p, { tipo: 'esistente', id: r.id })}>Usa voce esistente</button>}
          </div>)}</td><td>{Math.round(p.confidence * 100)}%</td><td>{p.motivi.join(' ')}
            {(p.stato === 'POSSIBILE DUPLICATO' || p.decisione) && <div>
              {p.decisione?.tipo === 'esistente' && p.attuale?.id === p.decisione.id && <div>Voce scelta: {p.attuale.codice} · {p.attuale.descrizione}</div>}
              <button type="button" aria-pressed={p.decisione?.tipo === 'nuova'} disabled={disabled} onClick={() => scegli(p, { tipo: 'nuova' })}>Importa come nuova</button>{' '}
              {p.decisione && <button type="button" disabled={disabled} onClick={() => scegli(p)}>Annulla scelta</button>}
            </div>}
          </td>
          <td><button type="button" disabled={disabled} onClick={() => ripristina(p)}>Ripristina</button></td>
        </tr>)}</tbody>
      </table></div>
      <button type="button" disabled={disabled} onClick={() => setSelected(proposte.filter(fileApplicabile).map(p => p.riga.id))}>Seleziona tutto</button>{' '}
      <button type="button" disabled={disabled} onClick={() => setSelected([])}>Deseleziona tutto</button>{' '}
      <button type="button" disabled={disabled || !selected.length} onClick={async () => {
        if (lock.current) return
        const scelte = proposte.filter(p => selected.includes(p.riga.id))
        if (!window.confirm(`Stai per aggiungere ${scelte.filter(p => p.stato === 'NUOVA' || p.stato === 'NUOVA CONFERMATA').length} nuove voci e aggiornare ${scelte.filter(p => p.stato === 'AGGIORNAMENTO' || p.stato === 'AGGIORNAMENTO MANUALE').length} voci del Listino ARTECNA. Procedere?`)) return
        lock.current = true; onBusyChange(true); setError(''); setMessage('')
        try { const count = await applicaFileListino(supabase, proposte, selected, true); setMessage(`${count} righe applicate al Listino ARTECNA.`) }
        catch (e) { setError(e instanceof Error ? e.message : 'Errore importazione.') }
        finally {
          setProposte(null); setSelected([]); setBozze({})
          try { await onSaved() } catch (e) { setError(e instanceof Error ? e.message : 'Errore rilettura Listino.') }
          lock.current = false; onBusyChange(false)
        }
      }}>Applica selezionate</button>
    </>}
  </section>
}
