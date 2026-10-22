'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { formatiFatture, importaBatchDocumenti, type AnteprimaFattura, type FlussiDocumenti, type RiepilogoDocumenti } from '../engines/fatture/import-documenti'

type Props = {
  flussi: FlussiDocumenti; onAnteprima: (anteprima: AnteprimaFattura) => void
  anteprimaAttiva: boolean; buttonStyle: CSSProperties
}
export default function ImportaFattureDocumenti({ flussi, onAnteprima, anteprimaAttiva, buttonStyle }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const inCorso = useRef(false)
  const coda = useRef<File[]>([])
  const sequenza = useRef(0)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [errore, setErrore] = useState('')
  const [riepilogo, setRiepilogo] = useState<RiepilogoDocumenti | null>(null)
  const [anteprime, setAnteprime] = useState<{ id: number; dati: AnteprimaFattura }[]>([])
  const importa = async (files: File[]) => {
    if (!files.length) return
    if (inCorso.current) { coda.current.push(...files); return }
    inCorso.current = true; coda.current = [...files]; setBusy(true); setErrore('')
    try {
      const risultato = await importaBatchDocumenti(coda.current, flussi, setRiepilogo)
      const nuove = risultato.esiti.flatMap(e => e.anteprima ? [{ id: ++sequenza.current, dati: e.anteprima }] : [])
      setAnteprime(current => [...current, ...nuove])
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Elaborazione interrotta per errore generale.') }
    finally { inCorso.current = false; coda.current = []; setBusy(false) }
  }
  const problemi = !!errore || !!riepilogo?.falliti || !!riepilogo?.nonSupportati
  return <section aria-label="Importa fatture e documenti" tabIndex={0}
    onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true) } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false) }}
    onDrop={e => { e.preventDefault(); setDrag(false); void importa(Array.from(e.dataTransfer.files)) }}
    onPaste={e => { const files = Array.from(e.clipboardData.files); if (files.length) { e.preventDefault(); void importa(files) } }}
    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere', padding: 18, borderRadius: 12,
      border: `2px ${drag ? 'solid' : 'dashed'} ${problemi ? '#b45309' : drag ? '#2563eb' : '#cbd5e1'}`,
      background: drag ? '#eff6ff' : busy ? '#f8fafc' : '#fff' }}>
    <h3 style={{ marginTop: 0 }}>IMPORTA FATTURE / DOCUMENTI</h3>
    <p>PDF · XML · XLS · XLSX · CSV · ZIP</p>
    <p>Trascina qui i file, incollali con Ctrl+V oppure selezionali dal computer.</p>
    <button type="button" style={buttonStyle} onClick={() => input.current?.click()}>Seleziona file</button>
    <input ref={input} aria-label="Seleziona fatture o documenti" type="file" multiple accept={formatiFatture} style={{ display: 'none' }}
      onChange={e => { const files = Array.from(e.currentTarget.files || []); e.currentTarget.value = ''; void importa(files) }} />
    <p>XML, PDF ed Excel/CSV restano in anteprima fino al salvataggio. Gli XML negli ZIP seguono l’importazione Bluenext esistente.</p>
    {busy && <p role="status" aria-live="polite">{riepilogo?.elaborati || 0}/{coda.current.length} elaborati…</p>}
    {errore && <p role="alert">{errore}</p>}
    {riepilogo && <div role="status" aria-live="polite">
      <strong>{busy ? 'Elaborazione' : errore ? 'Interrotto' : problemi ? 'Completato con segnalazioni' : 'Completato'}</strong>
      <p>Totale file: {riepilogo.totaleFile} · Importati: {riepilogo.importati} · Duplicati: {riepilogo.duplicati} · Falliti: {riepilogo.falliti} · Non supportati: {riepilogo.nonSupportati} · In anteprima: {riepilogo.anteprime}</p>
      <small>I conteggi documenti includono i contenuti degli ZIP. “In anteprima” non significa salvato.</small>
      {riepilogo.esiti.filter(e => e.motivo).map((e, i) => <p key={i}>{e.nome}: {e.motivo}</p>)}
    </div>}
    {!!anteprime.length && <div aria-label="Anteprime documenti del batch">
      <p>Anteprime da aprire: {anteprime.length}. Salva o pulisci l’anteprima corrente prima di aprirne un’altra.</p>
      {anteprime.map(item => <div key={item.id} style={{ marginTop: 8 }}>
        <span>{item.dati.nomeFile} · {item.dati.fornitore || 'Fornitore da verificare'} · {item.dati.numero || 'Numero da verificare'} </span>
        <button type="button" disabled={busy || anteprimaAttiva} onClick={() => {
          onAnteprima(item.dati); setAnteprime(current => current.filter(p => p.id !== item.id))
        }}>Apri anteprima</button>
      </div>)}
    </div>}
  </section>
}
