'use client'

import type { ReactNode } from 'react'
import VistaOperativa from './VistaOperativa'

export default function QuadernoCollegatoFocus({ aperto, attivo = true, contesto, etichettaRitorno, onChiudi, children }: {
  aperto: boolean
  attivo?: boolean
  contesto?: string
  etichettaRitorno: string
  onChiudi: () => void
  children: ReactNode
}) {
  if (!attivo) return children
  return <VistaOperativa titolo="Quaderno" attiva={attivo} visibile={aperto} contesto={contesto}
    etichettaRitorno={etichettaRitorno} onChiudi={onChiudi}>
    <div className="quaderno-collegato-focus" style={{ width: '100%', minWidth: 0, overflowWrap: 'anywhere', containerType: 'inline-size', containerName: 'quaderno-collegato' }}>
      {children}
      {attivo && <style>{`
        .quaderno-collegato-focus input, .quaderno-collegato-focus select, .quaderno-collegato-focus textarea { min-width: 0; max-width: 100%; box-sizing: border-box; }
        .quaderno-collegato-focus button, .quaderno-collegato-focus label { min-width: 0; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
        #area-lavoro-principale > [data-attivita-operativa][aria-label="Quaderno"] > header button { min-width: 0; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
        @container quaderno-collegato (width < 700px) {
          .quaderno-collegato-focus > section > div[style*="grid-template-columns: 2fr auto 1fr"] { grid-template-columns: minmax(0, 1fr) !important; }
          .quaderno-collegato-focus > section > div[style*="grid-template-columns: 2fr auto 1fr"] > * { min-width: 0 !important; max-width: 100%; box-sizing: border-box; }
          .quaderno-collegato-focus div[style*="minmax(180px, 1fr)"] { grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr)) !important; }
        }
      `}</style>}
    </div>
  </VistaOperativa>
}
