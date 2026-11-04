'use client'

import { useRef, useState } from 'react'
import ProgressoOperazione, { type StatoProgressoOperazione } from './ProgressoOperazione'

type Props = {
  titolo: string
  nomeFileAnalisiDocumento: string
  caricaFileAnalisiDocumento: (file: File) => void | Promise<void>
  inputStyle: any
  accettaExcel?: boolean
  progresso?: StatoProgressoOperazione | null
  bloccato?: boolean
}

export default function DocumentUploadBox({
  titolo,
  nomeFileAnalisiDocumento,
  caricaFileAnalisiDocumento,
  inputStyle,
  accettaExcel = false,
  progresso,
  bloccato = false,
}: Props) {
  const occupato = useRef(false)
  const [ricevuto, setRicevuto] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState('')
  return (
    <div
      style={{
        border: '2px dashed #cbd5e1',
        borderRadius: 12,
        padding: 20,
        background: '#f8fafc',
        marginBottom: 20,
      }}
    >
      <h3 style={{ marginTop: 0 }}>{titolo}</h3>

      <input
        type="file"
        disabled={bloccato || inCorso || progresso?.stato === 'in_corso'}
        aria-busy={inCorso}
        accept={accettaExcel ? '.pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx' : '.pdf,.jpg,.jpeg,.png,.webp'}
        style={inputStyle}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file || occupato.current || bloccato || progresso?.stato === 'in_corso') return
          const input = e.target
          occupato.current = true
          setRicevuto(file.name)
          setInCorso(true)
          setErrore('')
          try { await caricaFileAnalisiDocumento(file) }
          catch { setErrore('Errore durante l’analisi del documento') }
          finally { occupato.current = false; setInCorso(false); input.value = '' }
        }}
      />

      {ricevuto && <p style={{ overflowWrap: 'anywhere' }}>Documento ricevuto: {ricevuto}</p>}
      <ProgressoOperazione progresso={errore ? { stato: 'errore', testo: errore } : progresso ?? (inCorso ? { stato: 'in_corso', testo: 'Documento ricevuto — lettura del documento...' } : null)} />
      <p style={{ marginTop: 10, color: '#64748b' }}>
        Estrae testo, importi e voci da PDF o immagini{accettaExcel ? ', XLS o XLSX' : ''}. L&apos;analisi non
        modifica automaticamente preventivi, SAL o costi.
      </p>

      {nomeFileAnalisiDocumento && (
        <p style={{ marginTop: 10 }}>
          <strong>File caricato:</strong> {nomeFileAnalisiDocumento}
        </p>
      )}
    </div>
  )
}
