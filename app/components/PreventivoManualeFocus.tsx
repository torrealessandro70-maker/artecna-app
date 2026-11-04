'use client'

import type { ReactNode } from 'react'
import VistaOperativa from './VistaOperativa'

export default function PreventivoManualeFocus({ contesto, etichettaRitorno, onChiudi, children }: {
  contesto: string
  etichettaRitorno?: string
  onChiudi: () => void
  children: ReactNode
}) {
  return <VistaOperativa titolo="Preventivo manuale" contesto={contesto} etichettaRitorno={etichettaRitorno} onChiudi={onChiudi}>
    <div className="preventivo-manuale-focus" style={{ width: '100%', minWidth: 0, containerType: 'inline-size', containerName: 'preventivo-manuale' }}>
      {children}
      <style>{`
        .preventivo-manuale-focus fieldset { min-width: 0; max-width: 100%; box-sizing: border-box; }
        .preventivo-manuale-focus input, .preventivo-manuale-focus select, .preventivo-manuale-focus textarea { box-sizing: border-box; min-width: 0; max-width: 100%; }
        .preventivo-manuale-focus > section > fieldset > label { display: grid; gap: 4px; margin-bottom: 10px; }
        .preventivo-manuale-focus td { overflow-wrap: anywhere; }
        @container preventivo-manuale (max-width: 1100px) {
          .preventivo-manuale-focus table thead { display: none; }
          .preventivo-manuale-focus table, .preventivo-manuale-focus tbody, .preventivo-manuale-focus tr, .preventivo-manuale-focus td { display: block; width: 100%; min-width: 0; box-sizing: border-box; }
          .preventivo-manuale-focus td:not([colspan])::before { display: block; font-weight: 600; margin-bottom: 4px; }
          .preventivo-manuale-focus td:not([colspan]):nth-child(1)::before { content: 'Descrizione'; }
          .preventivo-manuale-focus td:not([colspan]):nth-child(2)::before { content: 'U.M.'; }
          .preventivo-manuale-focus td:not([colspan]):nth-child(3)::before { content: 'Quantità'; }
          .preventivo-manuale-focus td:not([colspan]):nth-child(4)::before { content: 'Prezzo'; }
          .preventivo-manuale-focus td:not([colspan]):nth-child(5)::before { content: 'Totale'; }
          .preventivo-manuale-focus td:not([colspan]):nth-child(6)::before { content: 'Azioni'; }
          .preventivo-manuale-focus div[style*="display: flex"] { flex-wrap: wrap; min-width: 0; }
          .preventivo-manuale-focus button { min-width: 0 !important; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
        }
      `}</style>
    </div>
  </VistaOperativa>
}
