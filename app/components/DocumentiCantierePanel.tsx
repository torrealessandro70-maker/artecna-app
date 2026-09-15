'use client'

import { useId, useRef, useState, type ComponentProps } from 'react'
import PreventiviEconomiaPanel from './PreventiviEconomiaPanel'
import DocumentIntelligencePanel from './DocumentIntelligencePanel'

export type DocumentiPanelProps = {
  preventivi: Omit<ComponentProps<typeof PreventiviEconomiaPanel>, 'cantiereScheda'>
  analisi: ComponentProps<typeof DocumentIntelligencePanel>
  archiviaPreventivoAnalizzato: (file: File, cantiereId: string) => Promise<{ id: string; importo: number; voci: number }>
  correggiTotaleAnalisi: (valore: string) => void
  caricaFilePreventivo: (file: File) => Promise<void>
}

type Props = {
  cantiere: { id: string; nome: string }
  panelProps: DocumentiPanelProps
}

export default function DocumentiCantierePanel({ cantiere, panelProps: p }: Props) {
  const [dragAttivo, setDragAttivo] = useState(false)
  const [fileSelezionato, setFileSelezionato] = useState<File | null>(null)
  const [azioneInCorso, setAzioneInCorso] = useState<'preventivo' | 'analisi' | null>(null)
  const [analisiAvviata, setAnalisiAvviata] = useState(false)
  const [archiviato, setArchiviato] = useState<{ id: string; importo: number; voci: number } | null>(null)
  const [errore, setErrore] = useState('')
  const occupato = useRef(false)
  const inputId = useId()
  const selezionaFile = (file: File | undefined) => {
    if (!file || occupato.current) return
    setFileSelezionato(file)
    setAnalisiAvviata(false)
    setArchiviato(null)
    setErrore('')
  }
  const esegui = async (azione: 'preventivo' | 'analisi') => {
    if (!fileSelezionato || occupato.current) return
    occupato.current = true
    setAzioneInCorso(azione)
    setErrore('')
    try {
      if (azione === 'preventivo') {
        if (analisiAvviata) setArchiviato(await p.archiviaPreventivoAnalizzato(fileSelezionato, cantiere.id))
        else await p.caricaFilePreventivo(fileSelezionato)
      }
      else {
        setAnalisiAvviata(true)
        await p.analisi.caricaFileAnalisiDocumento(fileSelezionato)
      }
    } catch (error) {
      setErrore(error instanceof Error ? error.message : 'Operazione non completata.')
    } finally {
      occupato.current = false
      setAzioneInCorso(null)
    }
  }
  return (
    <section aria-label="Documenti del cantiere" style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', minWidth: 0 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 22 }}>Documenti del cantiere</h3>
      <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
        <div onDragOver={(e) => { e.preventDefault(); if (!occupato.current) setDragAttivo(true) }}
          onDragLeave={() => setDragAttivo(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragAttivo(false)
            selezionaFile(e.dataTransfer.files[0])
          }}
          aria-busy={azioneInCorso !== null}
          style={{ padding: 16, minWidth: 0, border: dragAttivo ? '2px solid #2563eb' : '2px dashed #cbd5e1', borderRadius: 12, background: dragAttivo ? '#eff6ff' : '#f8fafc' }}>
          <label htmlFor={inputId} style={{ display: 'block', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            {fileSelezionato ? 'Cambia file' : 'Carica documento'}
          </label>
          <input id={inputId} type="file" accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
            disabled={azioneInCorso !== null} style={{ maxWidth: '100%', minHeight: 44 }}
            onChange={(e) => { selezionaFile(e.target.files?.[0]); e.target.value = '' }} />
          <p style={{ color: '#64748b' }}>Seleziona o trascina un file, poi scegli cosa farne.</p>
          {fileSelezionato && <>
            <p style={{ overflowWrap: 'anywhere' }}><strong>File selezionato:</strong> {fileSelezionato.name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
              {!analisiAvviata && <div>
                <button type="button" disabled={azioneInCorso !== null} onClick={() => esegui('preventivo')}
                  style={{ minHeight: 44, padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Archivia come preventivo</button>
                <p style={{ color: '#475569', fontSize: 14 }}>Registra il documento tra i preventivi del cantiere e lo rende disponibile al flusso economico/SAL.</p>
              </div>}
              <div>
                <button type="button" disabled={azioneInCorso !== null || analisiAvviata} onClick={() => esegui('analisi')}
                  style={{ minHeight: 44, padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Analizza documento</button>
                <p style={{ color: '#475569', fontSize: 14 }}>Legge il documento ed estrae testo, importi e voci senza registrarlo automaticamente come preventivo.</p>
              </div>
            </div>
          </>}
          {azioneInCorso && <p role="status">{azioneInCorso === 'preventivo' ? 'Archiviazione in corso…' : 'Analisi in corso…'}</p>}
          {errore && <p role="alert">{errore}</p>}
        </div>
        <section aria-label="Preventivi del cantiere" style={{ minWidth: 0, overflowX: 'auto' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 18 }}>Documenti / Preventivi del cantiere</h4>
          <PreventiviEconomiaPanel {...p.preventivi} cantiereScheda={cantiere.nome}
            preventivi={p.preventivi.preventivi.filter((preventivo) => preventivo.cantiere === cantiere.nome)} />
        </section>
        <section aria-label="Analisi documento" style={{ minWidth: 0, overflowX: 'auto' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 18 }}>Analisi documento</h4>
          {analisiAvviata ? <>
            <p style={{ overflowWrap: 'anywhere' }}><strong>File analizzato:</strong> {p.analisi.nomeFileAnalisiDocumento}</p>
            <DocumentIntelligencePanel {...p.analisi} mostraUpload={false}
              documentInsights={p.analisi.documentInsights ? {
                ...p.analisi.documentInsights,
                actions: p.analisi.documentInsights.actions.filter((action) => action.id !== 'register-preventivo'),
              } : undefined} />
            {archiviato ? <div role="status">
              <strong>Preventivo archiviato</strong>
              <p>{p.preventivi.formatMoney(archiviato.importo)} — ID: {archiviato.id}</p>
              <p>{archiviato.voci > 0 ? `${archiviato.voci} lavorazioni riconosciute, non salvate: collegamento al preventivo da verificare.` : 'Nessuna lavorazione strutturata disponibile.'}</p>
            </div> : <div>
              <label>Totale da archiviare (modificabile)
                <input type="text" inputMode="decimal" value={p.analisi.importoRilevatoDocumento}
                  disabled={azioneInCorso !== null} onChange={(e) => p.correggiTotaleAnalisi(e.target.value)}
                  style={p.analisi.inputStyle} />
              </label>
              <p>{p.analisi.vociAnalizzate.length > 0 ? `${p.analisi.vociAnalizzate.length} lavorazioni riconosciute. In questo passaggio viene archiviato il documento; il salvataggio delle lavorazioni richiede la verifica del collegamento al preventivo.` : 'Nessuna lavorazione strutturata disponibile.'}</p>
              <button type="button" disabled={azioneInCorso !== null} onClick={() => esegui('preventivo')}
                style={{ minHeight: 44, padding: '10px 16px' }}>Archivia come preventivo</button>
            </div>}
          </> : <p style={{ color: '#64748b' }}>Seleziona un file e scegli Analizza documento per visualizzare il risultato.</p>}
        </section>
      </div>
    </section>
  )
}
