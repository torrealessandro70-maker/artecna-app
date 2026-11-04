'use client'

import type { ReactNode, RefObject } from 'react'
import VistaOperativa from './VistaOperativa'

export default function AnalisiDocumentoFocus({ aperta, onChiudi, occupata, contesto, ritornoFocusRef, inlineChiusa = false, progresso, children }: {
  aperta: boolean
  onChiudi: () => void
  occupata?: boolean
  contesto?: string
  ritornoFocusRef?: RefObject<HTMLElement | null>
  inlineChiusa?: boolean
  progresso?: ReactNode
  children: ReactNode
}) {
  return <VistaOperativa titolo="Analisi documento" etichettaRitorno="← Torna ai documenti"
    attiva={!inlineChiusa || aperta} visibile={inlineChiusa || aperta} contesto={contesto}
    onChiudi={onChiudi} occupata={occupata} ritornoFocusRef={ritornoFocusRef}>
    <div className="analisi-documento-focus" style={{ width: '100%', minWidth: 0, overflowWrap: 'anywhere' }}>
      {aperta && progresso && <div aria-label="Avanzamento analisi documento" style={{ position: 'sticky', top: 0, zIndex: 20, padding: '8px 0', background: '#fff' }}>{progresso}</div>}
      {children}
      <style>{`
        .analisi-documento-focus input, .analisi-documento-focus select, .analisi-documento-focus textarea { min-width: 0; max-width: 100%; box-sizing: border-box; }
        .analisi-documento-focus button { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
        .analisi-documento-focus pre { white-space: pre-wrap; overflow-wrap: anywhere; }
      `}</style>
    </div>
  </VistaOperativa>
}
