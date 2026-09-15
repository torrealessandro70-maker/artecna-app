'use client'

import { useState, type ComponentProps } from 'react'
import UploadPreventivoBox from './UploadPreventivoBox'
import PreventiviEconomiaPanel from './PreventiviEconomiaPanel'
import DocumentIntelligencePanel from './DocumentIntelligencePanel'

export type DocumentiPanelProps = {
  upload: Omit<ComponentProps<typeof UploadPreventivoBox>, 'cantiereScheda'>
  preventivi: Omit<ComponentProps<typeof PreventiviEconomiaPanel>, 'cantiereScheda'>
  analisi: ComponentProps<typeof DocumentIntelligencePanel>
  caricaFilePreventivo: (file: File) => Promise<void>
}

type Props = {
  cantiere: { id: string; nome: string }
  panelProps: DocumentiPanelProps
}

export default function DocumentiCantierePanel({ cantiere, panelProps: p }: Props) {
  const [dragAttivo, setDragAttivo] = useState(false)
  return (
    <section aria-label="Documenti del cantiere" style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', minWidth: 0 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 22 }}>Documenti del cantiere</h3>
      <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
        <div onDragOver={(e) => { e.preventDefault(); setDragAttivo(true) }}
          onDragLeave={() => setDragAttivo(false)}
          onDrop={async (e) => {
            e.preventDefault()
            setDragAttivo(false)
            const file = e.dataTransfer.files?.[0]
            if (file) await p.caricaFilePreventivo(file)
          }}
          style={{ padding: 16, minWidth: 0, overflowX: 'auto', border: dragAttivo ? '2px solid #2563eb' : '2px dashed #cbd5e1', borderRadius: 12, background: dragAttivo ? '#eff6ff' : '#f8fafc' }}>
          <UploadPreventivoBox {...p.upload} cantiereScheda={cantiere.nome} />
        </div>
        <section aria-label="Preventivi del cantiere" style={{ minWidth: 0, overflowX: 'auto' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 18 }}>Documenti / Preventivi del cantiere</h4>
          <PreventiviEconomiaPanel {...p.preventivi} cantiereScheda={cantiere.nome}
            preventivi={p.preventivi.preventivi.filter((preventivo) => preventivo.cantiere === cantiere.nome)} />
        </section>
        <section aria-label="Analisi documento" style={{ minWidth: 0, overflowX: 'auto' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 18 }}>Analisi documento</h4>
          <DocumentIntelligencePanel {...p.analisi} />
        </section>
      </div>
    </section>
  )
}
