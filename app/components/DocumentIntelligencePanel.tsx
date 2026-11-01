'use client'

import DocumentDestinationSelector from './DocumentDestinationSelector'
import DocumentUploadBox from './DocumentUploadBox'
import type { DocumentInsights } from '@/app/engines/document-intelligence'
import { DocumentUnderstandingCard } from './ui/DocumentUnderstandingCard'
import { totaleVoceAnalizzata } from '../engines/document-parser/voci-analizzate'

type Props = {
  mostraUpload?: boolean
  titolo?: string
  fileAnalisiDocumento: any
  nomeFileAnalisiDocumento: string
  testoEstrattoDocumento: string
  importoRilevatoDocumento: string
  vociAnalizzate: any[]
  documentInsights?: DocumentInsights
  onDocumentAction?: (actionId: string) => void
  caricaFileAnalisiDocumento: (file: File) => void | Promise<void>
  inputStyle: any
  accettaExcel?: boolean
  warningsAnalisiDocumento?: string[]
}

export default function DocumentIntelligencePanel({
  titolo = 'Document Intelligence',
  mostraUpload = true,
  fileAnalisiDocumento,
  nomeFileAnalisiDocumento,
  testoEstrattoDocumento,
  importoRilevatoDocumento,
  vociAnalizzate,
  documentInsights,
onDocumentAction,
  caricaFileAnalisiDocumento,
  inputStyle,
  accettaExcel = false,
  warningsAnalisiDocumento = [],
}: Props) {
  const usaTotaliExcel = /\.xlsx?$/i.test(nomeFileAnalisiDocumento)
  const totaleVociAnalizzate = (vociAnalizzate || []).reduce(
    (tot: number, voce: any) => tot + (usaTotaliExcel ? totaleVoceAnalizzata(voce) : Number(voce.totale || 0)),
    0
  )

  return (
    <>
      {mostraUpload && <DocumentUploadBox
        titolo={titolo}
        nomeFileAnalisiDocumento={nomeFileAnalisiDocumento}
        caricaFileAnalisiDocumento={caricaFileAnalisiDocumento}
        inputStyle={inputStyle}
        accettaExcel={accettaExcel}
      />}

      {fileAnalisiDocumento && (
        <div
          style={{
            padding: 12,
            border: '1px solid #d1d5db',
            borderRadius: 10,
            background: '#fff',
            marginBottom: 20,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Risultato analisi</h3>
          {warningsAnalisiDocumento.length > 0 && (
            <div role="status" aria-live="polite">
              <strong>Avvisi lettura Excel</strong>
              <ul>{warningsAnalisiDocumento.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </div>
          )}

          <p>
            <strong>Importo rilevato:</strong>{' '}
            {importoRilevatoDocumento || 'Non rilevato'}
          </p>

          <p>
            <strong>Voci analizzate:</strong> {(vociAnalizzate || []).length}
          </p>

          <p>
            <strong>Totale voci:</strong>{' '}
            {totaleVociAnalizzate.toLocaleString('it-IT', {
              style: 'currency',
              currency: 'EUR',
            })}
          </p>

          {testoEstrattoDocumento && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer' }}>
                Vedi testo estratto
              </summary>

              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 8,
                  background: '#f8fafc',
                  maxHeight: 260,
                  overflow: 'auto',
                }}
              >
                {testoEstrattoDocumento}
              </pre>
            </details>
          )}
        </div>
      )}
<DocumentUnderstandingCard
  insights={documentInsights}
  onAction={onDocumentAction}
/>

<DocumentDestinationSelector insights={documentInsights} />
    </>
  )
}
