'use client'

import FileDropZone from './FileDropZone'
import { useRef, useState, type CSSProperties } from 'react'
import { formatiFatture, importaBatchDocumenti, type AnteprimaFattura, type FlussiDocumenti, type RiepilogoDocumenti } from '../engines/fatture/import-documenti'

type Props = {
  flussi: FlussiDocumenti; onAnteprima: (anteprima: AnteprimaFattura) => void
  anteprimaAttiva: boolean; buttonStyle: CSSProperties
}
export default function ImportaFattureDocumenti({ flussi, onAnteprima, anteprimaAttiva, buttonStyle }: Props) {
  const inCorso = useRef(false)
  const coda = useRef<File[]>([])
  const sequenza = useRef(0)
  const [busy, setBusy] = useState(false)
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
  return <FileDropZone title="Importa fatture e documenti" accept={formatiFatture} onFiles={files => void importa(files)} buttonStyle={buttonStyle}>
    <p>PDF · XML · XLS · XLSX · CSV · ZIP</p>
    <p>XML, PDF ed Excel/CSV restano in anteprima fino al salvataggio. Gli XML negli ZIP seguono l’importazione Bluenext esistente.</p>
    {busy && <p role="status" aria-live="polite">{riepilogo?.elaborati || 0}/{riepilogo?.totaleFile || 0} elaborati…</p>}
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
  </FileDropZone>
}
